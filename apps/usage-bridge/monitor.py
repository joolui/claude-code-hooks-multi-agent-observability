"""
Claude Monitor integration wrapper.
Provides a clean interface to the Claude Monitor library with error handling.
"""

import logging
from typing import List, Optional, Dict, Any

from .claude_monitor_wrapper import claude_monitor
from .models import SessionBlock, UsageStats, UsageConfig

logger = logging.getLogger(__name__)


class ClaudeMonitorIntegration:
    """Integration wrapper for Claude Monitor library using enhanced wrapper."""
    
    def __init__(self):
        # Use the enhanced wrapper instance
        self._wrapper = claude_monitor

    @property
    def is_available(self) -> bool:
        """Check if Claude Monitor is available."""
        return self._wrapper.is_available

    def _convert_monitor_session_to_api(self, monitor_session) -> SessionBlock:
        """Convert Claude Monitor SessionBlock to API SessionBlock using enhanced wrapper."""
        return self._wrapper.convert_session_block(monitor_session)

    def get_usage_stats(self, config_params: Optional[UsageConfig] = None) -> UsageStats:
        """Get current usage statistics from Claude Monitor using enhanced wrapper."""
        return self._wrapper.get_usage_statistics(config_params)

    def get_session_history(self, hours_back: int = 24) -> List[SessionBlock]:
        """Get session history from Claude Monitor using enhanced wrapper."""
        return self._wrapper.get_session_history(hours_back)

    def validate_config(self, config_data: UsageConfig) -> Dict[str, Any]:
        """Validate configuration using Claude Monitor's validation via enhanced wrapper."""
        return self._wrapper.validate_configuration(config_data)

    def get_monitor_info(self) -> Dict[str, Any]:
        """Get comprehensive information about the loaded Claude Monitor library."""
        return self._wrapper.get_monitor_info()


# Global monitor integration instance
monitor = ClaudeMonitorIntegration()