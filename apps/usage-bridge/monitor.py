"""
Claude Monitor integration wrapper.
Provides a clean interface to the Claude Monitor library with error handling.
"""

import sys
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .config import config
from .models import SessionBlock, UsageStats, UsageConfig, BurnRate, TokenCounts, UsagePredictions, UsageTotals

logger = logging.getLogger(__name__)


class ClaudeMonitorIntegration:
    """Integration wrapper for Claude Monitor library."""
    
    def __init__(self):
        self._monitor_available = False
        self._settings_class = None
        self._data_manager_class = None
        self._orchestrator_class = None
        self._models_module = None
        self._setup_claude_monitor()

    def _setup_claude_monitor(self):
        """Set up Claude Monitor library integration."""
        try:
            if not config.is_claude_monitor_available:
                logger.error("Claude Monitor not found at configured path")
                return

            # Add Claude Monitor source to Python path
            claude_src_path = str(config.claude_monitor_src_path)
            if claude_src_path not in sys.path:
                sys.path.insert(0, claude_src_path)

            # Import Claude Monitor modules
            from claude_monitor.core.settings import Settings
            from claude_monitor.monitoring.data_manager import DataManager
            from claude_monitor.monitoring.orchestrator import MonitoringOrchestrator
            from claude_monitor.core import models

            self._settings_class = Settings
            self._data_manager_class = DataManager
            self._orchestrator_class = MonitoringOrchestrator
            self._models_module = models
            self._monitor_available = True
            
            logger.info("Claude Monitor integration initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Claude Monitor integration: {e}")
            self._monitor_available = False

    @property
    def is_available(self) -> bool:
        """Check if Claude Monitor is available."""
        return self._monitor_available

    def _convert_monitor_session_to_api(self, monitor_session) -> SessionBlock:
        """Convert Claude Monitor SessionBlock to API SessionBlock."""
        try:
            # Extract basic information
            session_data = {
                'id': monitor_session.id,
                'start_time': monitor_session.start_time,
                'end_time': monitor_session.end_time,
                'is_active': monitor_session.is_active,
                'cost_usd': monitor_session.cost_usd,
                'models': monitor_session.models or [],
                'sent_messages_count': monitor_session.sent_messages_count,
                'per_model_stats': monitor_session.per_model_stats or {}
            }

            # Convert token counts
            if hasattr(monitor_session, 'token_counts') and monitor_session.token_counts:
                session_data['token_counts'] = TokenCounts(
                    input_tokens=monitor_session.token_counts.input_tokens,
                    output_tokens=monitor_session.token_counts.output_tokens,
                    cache_creation_tokens=monitor_session.token_counts.cache_creation_tokens,
                    cache_read_tokens=monitor_session.token_counts.cache_read_tokens
                )
            else:
                session_data['token_counts'] = TokenCounts()

            # Convert burn rate
            if hasattr(monitor_session, 'burn_rate') and monitor_session.burn_rate:
                session_data['burn_rate'] = BurnRate(
                    tokens_per_minute=monitor_session.burn_rate.tokens_per_minute,
                    cost_per_hour=monitor_session.burn_rate.cost_per_hour
                )

            return SessionBlock(**session_data)
            
        except Exception as e:
            logger.error(f"Error converting monitor session to API: {e}")
            # Return minimal session data
            return SessionBlock(
                id=getattr(monitor_session, 'id', 'unknown'),
                start_time=getattr(monitor_session, 'start_time', datetime.utcnow()),
                end_time=getattr(monitor_session, 'end_time', datetime.utcnow())
            )

    def get_usage_stats(self, config_params: Optional[UsageConfig] = None) -> UsageStats:
        """Get current usage statistics from Claude Monitor."""
        if not self.is_available:
            logger.warning("Claude Monitor not available, returning empty stats")
            return UsageStats()

        try:
            # Create settings from config parameters
            settings_kwargs = {}
            if config_params:
                settings_kwargs.update({
                    'plan': config_params.plan,
                    'view': config_params.view,
                    'timezone': config_params.timezone,
                    'time_format': config_params.time_format,
                    'theme': config_params.theme,
                    'refresh_rate': config_params.refresh_rate,
                    'refresh_per_second': config_params.refresh_per_second,
                    'reset_hour': config_params.reset_hour,
                })
                if config_params.custom_limit_tokens:
                    settings_kwargs['custom_limit_tokens'] = config_params.custom_limit_tokens

            # Initialize Claude Monitor components
            settings = self._settings_class(**settings_kwargs)
            data_manager = self._data_manager_class(settings)
            orchestrator = self._orchestrator_class(data_manager, settings)

            # Get current data from orchestrator
            orchestrator.update()
            current_data = orchestrator.get_current_data()

            # Convert to API format
            usage_stats = UsageStats()

            # Get current session
            if hasattr(current_data, 'current_session') and current_data.current_session:
                usage_stats.current_session = self._convert_monitor_session_to_api(
                    current_data.current_session
                )

            # Get recent sessions
            if hasattr(current_data, 'recent_sessions') and current_data.recent_sessions:
                usage_stats.recent_sessions = [
                    self._convert_monitor_session_to_api(session)
                    for session in current_data.recent_sessions
                ]

            # Get burn rate
            if hasattr(current_data, 'burn_rate') and current_data.burn_rate:
                usage_stats.burn_rate = BurnRate(
                    tokens_per_minute=current_data.burn_rate.tokens_per_minute,
                    cost_per_hour=current_data.burn_rate.cost_per_hour
                )

            # Get predictions (if available)
            predictions = UsagePredictions()
            if hasattr(current_data, 'predictions'):
                pred = current_data.predictions
                if hasattr(pred, 'tokens_run_out'):
                    predictions.tokens_run_out = pred.tokens_run_out
                if hasattr(pred, 'limit_resets_at'):
                    predictions.limit_resets_at = pred.limit_resets_at
            usage_stats.predictions = predictions

            # Get totals/percentages (if available)
            totals = UsageTotals()
            if hasattr(current_data, 'totals'):
                tot = current_data.totals
                if hasattr(tot, 'cost_percentage'):
                    totals.cost_percentage = tot.cost_percentage
                if hasattr(tot, 'token_percentage'):
                    totals.token_percentage = tot.token_percentage
                if hasattr(tot, 'message_percentage'):
                    totals.message_percentage = tot.message_percentage
                if hasattr(tot, 'time_to_reset_percentage'):
                    totals.time_to_reset_percentage = tot.time_to_reset_percentage
            usage_stats.totals = totals

            return usage_stats

        except Exception as e:
            logger.error(f"Error getting usage stats from Claude Monitor: {e}")
            return UsageStats()

    def get_session_history(self, hours_back: int = 24) -> List[SessionBlock]:
        """Get session history from Claude Monitor."""
        if not self.is_available:
            logger.warning("Claude Monitor not available, returning empty history")
            return []

        try:
            # Initialize Claude Monitor components
            settings = self._settings_class()
            data_manager = self._data_manager_class(settings)

            # Get session history
            sessions = data_manager.get_recent_sessions(hours_back=hours_back)
            
            # Convert to API format
            return [
                self._convert_monitor_session_to_api(session)
                for session in sessions
            ]

        except Exception as e:
            logger.error(f"Error getting session history from Claude Monitor: {e}")
            return []

    def validate_config(self, config_data: UsageConfig) -> Dict[str, Any]:
        """Validate configuration using Claude Monitor's validation."""
        if not self.is_available:
            return {"valid": False, "error": "Claude Monitor not available"}

        try:
            # Validate using Claude Monitor's settings validation
            settings_kwargs = {
                'plan': config_data.plan,
                'view': config_data.view,
                'timezone': config_data.timezone,
                'time_format': config_data.time_format,
                'theme': config_data.theme,
                'refresh_rate': config_data.refresh_rate,
                'refresh_per_second': config_data.refresh_per_second,
                'reset_hour': config_data.reset_hour,
            }
            
            if config_data.custom_limit_tokens:
                settings_kwargs['custom_limit_tokens'] = config_data.custom_limit_tokens

            # This will raise validation errors if invalid
            settings = self._settings_class(**settings_kwargs)
            
            return {"valid": True, "settings": settings.model_dump()}

        except Exception as e:
            return {"valid": False, "error": str(e)}


# Global monitor integration instance
monitor = ClaudeMonitorIntegration()