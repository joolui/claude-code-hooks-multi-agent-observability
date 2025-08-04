"""
Configuration management for the Usage Bridge service.
Handles environment variables and service settings.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class BridgeConfig(BaseSettings):
    """Configuration for the Usage Bridge service."""
    
    # Service configuration
    host: str = Field("0.0.0.0", description="Host to bind the service to")
    port: int = Field(8001, description="Port to bind the service to")
    debug: bool = Field(False, description="Enable debug mode")
    log_level: str = Field("INFO", description="Logging level")
    
    # Claude Monitor integration
    claude_monitor_path: Optional[Path] = Field(
        None, 
        description="Path to Claude Monitor installation (auto-detected if None)"
    )
    
    # CORS settings
    cors_origins: list[str] = Field(
        ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4000"],
        description="Allowed CORS origins"
    )
    
    # Rate limiting
    rate_limit_per_minute: int = Field(60, description="API requests per minute limit")
    
    # Configuration storage
    config_storage_path: Optional[Path] = Field(
        None,
        description="Path to store configuration data (defaults to ~/.claude-monitor-bridge)"
    )

    class Config:
        env_prefix = "BRIDGE_"
        case_sensitive = False

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Auto-detect Claude Monitor path if not provided
        if self.claude_monitor_path is None:
            self.claude_monitor_path = self._detect_claude_monitor_path()
            
        # Set default config storage path
        if self.config_storage_path is None:
            self.config_storage_path = Path.home() / ".claude-monitor-bridge"
            
        # Ensure config directory exists
        self.config_storage_path.mkdir(parents=True, exist_ok=True)

    def _detect_claude_monitor_path(self) -> Optional[Path]:
        """Auto-detect Claude Monitor installation path."""
        # First, try relative path from current project
        current_dir = Path(__file__).parent
        relative_path = current_dir.parent.parent.parent / "Claude-Code-Usage-Monitor"
        
        if relative_path.exists() and (relative_path / "src" / "claude_monitor").exists():
            return relative_path
            
        # Try common installation paths
        possible_paths = [
            Path.home() / "Claude-Code-Usage-Monitor",
            Path("/opt/claude-monitor"),
            Path("/usr/local/claude-monitor"),
        ]
        
        for path in possible_paths:
            if path.exists() and (path / "src" / "claude_monitor").exists():
                return path
                
        return None

    @property
    def claude_monitor_src_path(self) -> Optional[Path]:
        """Get the source path for Claude Monitor."""
        if self.claude_monitor_path:
            return self.claude_monitor_path / "src"
        return None

    @property
    def is_claude_monitor_available(self) -> bool:
        """Check if Claude Monitor is available."""
        return (
            self.claude_monitor_path is not None 
            and self.claude_monitor_src_path is not None
            and self.claude_monitor_src_path.exists()
            and (self.claude_monitor_src_path / "claude_monitor").exists()
        )


# Global configuration instance
config = BridgeConfig()