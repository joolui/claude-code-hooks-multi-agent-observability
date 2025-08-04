"""
FastAPI Python Bridge Service for Claude Monitor Integration.
Provides REST API endpoints for usage statistics and configuration management.
"""

import logging
import time
from datetime import datetime
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import config
from .models import (
    UsageStats, 
    UsageConfig, 
    UsageConfigQuery, 
    SessionBlock,
    ErrorResponse,
    HealthResponse
)
from .monitor import monitor

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global state
start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("Starting Usage Bridge Service")
    logger.info(f"Claude Monitor available: {monitor.is_available}")
    if not monitor.is_available:
        logger.warning("Claude Monitor not available - service will return empty data")
    
    yield
    
    logger.info("Shutting down Usage Bridge Service")


# Initialize FastAPI app
app = FastAPI(
    title="Claude Usage Monitor Bridge",
    description="FastAPI bridge service for Claude Monitor integration with web UI",
    version="1.0.0",
    docs_url="/docs" if config.debug else None,
    redoc_url="/redoc" if config.debug else None,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


# Error handlers
@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    """Handle Pydantic validation errors."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(
            error="Validation Error",
            detail=str(exc)
        ).dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal Server Error",
            detail=str(exc) if config.debug else "An unexpected error occurred"
        ).dict()
    )


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if monitor.is_available else "unhealthy",
        claude_monitor_available=monitor.is_available,
        uptime_seconds=time.time() - start_time
    )


# Configuration management
_config_store: Optional[UsageConfig] = None


def get_current_config() -> UsageConfig:
    """Get current configuration."""
    global _config_store
    if _config_store is None:
        _config_store = UsageConfig()
    return _config_store


def update_config_store(config_data: UsageConfig):
    """Update the configuration store."""
    global _config_store
    config_data.updated_at = datetime.utcnow()
    if config_data.created_at is None:
        config_data.created_at = datetime.utcnow()
    _config_store = config_data


# Usage statistics endpoints
@app.get("/usage/stats", response_model=UsageStats)
async def get_usage_stats(
    plan: Optional[str] = Query(None, description="Plan type (pro, max5, max20, custom)"),
    custom_limit_tokens: Optional[int] = Query(None, gt=0, description="Custom token limit"),
    timezone: Optional[str] = Query(None, description="Timezone"),
    reset_hour: Optional[int] = Query(None, ge=0, le=23, description="Reset hour"),
    view: Optional[str] = Query(None, description="View mode"),
):
    """Get current usage statistics with optional configuration override."""
    try:
        # Build query config
        query_config = None
        if any([plan, custom_limit_tokens, timezone, reset_hour, view]):
            query_params = {}
            if plan:
                query_params['plan'] = plan
            if custom_limit_tokens:
                query_params['custom_limit_tokens'] = custom_limit_tokens
            if timezone:
                query_params['timezone'] = timezone
            if reset_hour is not None:
                query_params['reset_hour'] = reset_hour
            if view:
                query_params['view'] = view
                
            # Merge with current config
            current_config = get_current_config()
            config_dict = current_config.dict()
            config_dict.update(query_params)
            query_config = UsageConfig(**config_dict)
        else:
            query_config = get_current_config()

        # Get stats from monitor
        stats = monitor.get_usage_stats(query_config)
        return stats

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid configuration parameters: {e}"
        )
    except Exception as e:
        logger.error(f"Error getting usage stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get usage statistics: {str(e)}"
        )


@app.get("/usage/config", response_model=UsageConfig)
async def get_usage_config():
    """Get current usage configuration."""
    try:
        return get_current_config()
    except Exception as e:
        logger.error(f"Error getting config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get configuration: {str(e)}"
        )


@app.post("/usage/config", response_model=UsageConfig)
async def update_usage_config(config_data: UsageConfig):
    """Update usage configuration."""
    try:
        # Validate configuration with Claude Monitor
        validation_result = monitor.validate_config(config_data)
        if not validation_result.get("valid", False):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid configuration: {validation_result.get('error', 'Unknown error')}"
            )

        # Update configuration store
        update_config_store(config_data)
        
        logger.info(f"Configuration updated: {config_data.dict()}")
        return config_data

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Validation error: {e}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update configuration: {str(e)}"
        )


@app.get("/usage/sessions", response_model=List[SessionBlock])
async def get_usage_sessions(hours_back: int = Query(24, ge=1, le=168, description="Hours of history to retrieve")):
    """Get usage session history."""
    try:
        sessions = monitor.get_session_history(hours_back)
        return sessions

    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get usage sessions: {str(e)}"
        )


# Additional utility endpoints
@app.get("/usage/validate-config")
async def validate_config(config_data: UsageConfig):
    """Validate configuration without saving."""
    try:
        validation_result = monitor.validate_config(config_data)
        return validation_result
    except Exception as e:
        logger.error(f"Error validating config: {e}")
        return {"valid": False, "error": str(e)}


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Claude Usage Monitor Bridge",
        "version": "1.0.0",
        "status": "running",
        "claude_monitor_available": monitor.is_available,
        "endpoints": {
            "health": "/health",
            "usage_stats": "/usage/stats",
            "usage_config": "/usage/config",
            "usage_sessions": "/usage/sessions",
            "docs": "/docs" if config.debug else None
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
        log_level=config.log_level.lower()
    )