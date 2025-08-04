"""
Pydantic models for the Usage Bridge API.
Maps Claude Monitor data structures to FastAPI-compatible models.
"""

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, validator


class UsageEntry(BaseModel):
    """Individual usage record from Claude usage data."""
    
    timestamp: datetime
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0
    cost_usd: float = 0.0
    model: str = ""
    message_id: str = ""
    request_id: str = ""

    class Config:
        json_encoders = {
            datetime: lambda v: int(v.timestamp()) if v else None
        }


class TokenCounts(BaseModel):
    """Token aggregation structure with computed totals."""
    
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0
    
    @property
    def total_tokens(self) -> int:
        """Get total tokens across all types."""
        return (
            self.input_tokens
            + self.output_tokens
            + self.cache_creation_tokens
            + self.cache_read_tokens
        )


class BurnRate(BaseModel):
    """Token consumption rate metrics."""
    
    tokens_per_minute: float
    cost_per_hour: float


class SessionBlock(BaseModel):
    """Aggregated session block representing a 5-hour period."""
    
    id: str
    start_time: datetime
    end_time: datetime
    is_active: bool = False
    token_counts: TokenCounts = Field(default_factory=TokenCounts)
    cost_usd: float = 0.0
    burn_rate: Optional[BurnRate] = None
    models: List[str] = Field(default_factory=list)
    sent_messages_count: int = 0
    per_model_stats: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: int(v.timestamp()) if v else None
        }

    @property
    def total_tokens(self) -> int:
        """Get total tokens from token_counts."""
        return self.token_counts.total_tokens

    @property
    def total_cost(self) -> float:
        """Get total cost - alias for cost_usd."""
        return self.cost_usd


class UsageConfig(BaseModel):
    """Configuration parameters for usage monitoring."""
    
    id: Optional[int] = None
    plan: Literal['pro', 'max5', 'max20', 'custom'] = 'custom'
    custom_limit_tokens: Optional[int] = Field(None, gt=0)
    view: Literal['realtime', 'daily', 'monthly', 'session'] = 'realtime'
    timezone: str = 'auto'
    time_format: Literal['12h', '24h', 'auto'] = 'auto'
    theme: Literal['light', 'dark', 'classic', 'auto'] = 'auto'
    refresh_rate: int = Field(10, ge=1, le=60, description="Refresh rate in seconds")
    refresh_per_second: float = Field(0.75, ge=0.1, le=20.0, description="Display refresh rate per second")
    reset_hour: Optional[int] = Field(None, ge=0, le=23)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: int(v.timestamp()) if v else None
        }

    @validator('plan')
    def validate_plan(cls, v):
        """Validate plan value."""
        if v not in ['pro', 'max5', 'max20', 'custom']:
            raise ValueError('Plan must be one of: pro, max5, max20, custom')
        return v

    @validator('view')
    def validate_view(cls, v):
        """Validate view value."""
        if v not in ['realtime', 'daily', 'monthly', 'session']:
            raise ValueError('View must be one of: realtime, daily, monthly, session')
        return v


class UsageConfigQuery(BaseModel):
    """Query parameters for usage statistics requests."""
    
    plan: Optional[Literal['pro', 'max5', 'max20', 'custom']] = None
    custom_limit_tokens: Optional[int] = Field(None, gt=0)
    timezone: Optional[str] = None
    reset_hour: Optional[int] = Field(None, ge=0, le=23)
    view: Optional[Literal['realtime', 'daily', 'monthly', 'session']] = None


class UsagePredictions(BaseModel):
    """Usage prediction calculations."""
    
    tokens_run_out: Optional[datetime] = Field(None, description="When tokens are predicted to run out")
    limit_resets_at: Optional[datetime] = Field(None, description="When the limit resets")

    class Config:
        json_encoders = {
            datetime: lambda v: int(v.timestamp()) if v else None
        }


class UsageTotals(BaseModel):
    """Usage percentage totals."""
    
    cost_percentage: float = Field(0.0, ge=0.0, le=100.0)
    token_percentage: float = Field(0.0, ge=0.0, le=100.0)
    message_percentage: float = Field(0.0, ge=0.0, le=100.0)
    time_to_reset_percentage: float = Field(0.0, ge=0.0, le=100.0)


class UsageStats(BaseModel):
    """Complete usage statistics response."""
    
    current_session: Optional[SessionBlock] = None
    recent_sessions: List[SessionBlock] = Field(default_factory=list)
    predictions: UsagePredictions = Field(default_factory=UsagePredictions)
    burn_rate: BurnRate = Field(default_factory=lambda: BurnRate(tokens_per_minute=0.0, cost_per_hour=0.0))
    totals: UsageTotals = Field(default_factory=UsageTotals)


class ErrorResponse(BaseModel):
    """Error response model."""
    
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: int(v.timestamp()) if v else None
        }


class HealthResponse(BaseModel):
    """Health check response."""
    
    status: Literal['healthy', 'unhealthy'] = 'healthy'
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    claude_monitor_available: bool = True
    uptime_seconds: float = 0.0

    class Config:
        json_encoders = {
            datetime: lambda v: int(v.timestamp()) if v else None
        }