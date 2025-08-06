"""
Enhanced Claude Monitor Library Wrapper.
Provides dynamic property reading and comprehensive integration with the Claude Monitor library.
"""

import os
import sys
import logging
import importlib
import inspect
import contextlib
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any, Type, Callable
from dataclasses import asdict

try:
    from .config import config
    from .models import (
        SessionBlock, UsageStats, UsageConfig, BurnRate, TokenCounts, 
        UsagePredictions, UsageTotals, UsageEntry
    )
except ImportError:
    # Handle direct execution case
    from config import config
    from models import (
        SessionBlock, UsageStats, UsageConfig, BurnRate, TokenCounts, 
        UsagePredictions, UsageTotals, UsageEntry
    )

logger = logging.getLogger(__name__)


class DynamicPropertyReader:
    """Utility class for dynamic property reading from Claude Monitor objects."""
    
    @staticmethod
    def safe_getattr(obj: Any, attr: str, default: Any = None) -> Any:
        """Safely get attribute from object with fallback."""
        try:
            return getattr(obj, attr, default)
        except Exception as e:
            logger.debug(f"Failed to get attribute '{attr}': {e}")
            return default
    
    @staticmethod
    def extract_properties(obj: Any, property_map: Dict[str, str]) -> Dict[str, Any]:
        """Extract properties from object using a mapping."""
        result = {}
        for key, attr_path in property_map.items():
            value = obj
            try:
                # Handle nested attribute paths (e.g., "token_counts.total_tokens")
                for attr in attr_path.split('.'):
                    value = getattr(value, attr)
                result[key] = value
            except (AttributeError, TypeError) as e:
                logger.debug(f"Failed to extract property '{key}' from path '{attr_path}': {e}")
                result[key] = None
        return result

    @staticmethod
    def convert_datetime(dt: Any) -> Optional[datetime]:
        """Convert various datetime formats to datetime object."""
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt
        if isinstance(dt, (int, float)):
            return datetime.fromtimestamp(dt, tz=timezone.utc)
        if isinstance(dt, str):
            try:
                return datetime.fromisoformat(dt.replace('Z', '+00:00'))
            except ValueError:
                logger.debug(f"Failed to parse datetime string: {dt}")
                return None
        return None


class ClaudeMonitorWrapper:
    """Enhanced wrapper for Claude Monitor library with dynamic property reading."""
    
    def __init__(self):
        self._is_available = False
        self._modules = {}
        self._classes = {}
        self._functions = {}
        self._setup_monitor()

    @contextlib.contextmanager
    def _safe_import_context(self):
        """Context manager to safely import modules without CLI interference."""
        # Save original sys.argv and replace with safe values
        original_argv = sys.argv.copy()
        try:
            # Set minimal argv to prevent CLI argument parsing
            sys.argv = [sys.argv[0]]
            yield
        finally:
            # Restore original argv
            sys.argv = original_argv

    def _setup_monitor(self):
        """Set up Claude Monitor library with comprehensive module loading."""
        try:
            if not config.is_claude_monitor_available:
                logger.error("Claude Monitor not found at configured path")
                return

            # Add Claude Monitor source to Python path
            claude_src_path = str(config.claude_monitor_src_path)
            if claude_src_path not in sys.path:
                sys.path.insert(0, claude_src_path)
            
            # Set environment variable to prevent CLI execution during import
            os.environ["CLAUDE_MONITOR_DISABLE_CLI"] = "1"

            # Dynamic module loading with error handling
            # Skip CLI-related modules to avoid CLI execution during import
            modules_to_load = {
                'settings': 'claude_monitor.core.settings',
                'models': 'claude_monitor.core.models',
                'data_manager': 'claude_monitor.monitoring.data_manager',
                'orchestrator': 'claude_monitor.monitoring.orchestrator',
                'calculations': 'claude_monitor.core.calculations',
                'plans': 'claude_monitor.core.plans',
                'pricing': 'claude_monitor.core.pricing',
            }

            for name, module_path in modules_to_load.items():
                try:
                    # Import modules safely without triggering CLI
                    with self._safe_import_context():
                        self._modules[name] = importlib.import_module(module_path)
                        logger.debug(f"Loaded module: {module_path}")
                except ImportError as e:
                    logger.warning(f"Failed to load module {module_path}: {e}")
                except Exception as e:
                    logger.warning(f"Unexpected error loading module {module_path}: {e}")

            # Extract key classes dynamically
            self._extract_classes()
            
            # Extract key functions
            self._extract_functions()

            self._is_available = len(self._modules) > 0
            
            if self._is_available:
                logger.info("Claude Monitor wrapper initialized successfully")
                logger.info(f"Loaded modules: {list(self._modules.keys())}")
            else:
                logger.error("Failed to load any Claude Monitor modules")
                
        except Exception as e:
            logger.error(f"Failed to initialize Claude Monitor wrapper: {e}")
            self._is_available = False

    def _extract_classes(self):
        """Dynamically extract classes from loaded modules."""
        class_mappings = {
            'Settings': ('settings', 'Settings'),
            'DataManager': ('data_manager', 'DataManager'),
            'MonitoringOrchestrator': ('orchestrator', 'MonitoringOrchestrator'),
            'SessionBlock': ('models', 'SessionBlock'),
            'UsageEntry': ('models', 'UsageEntry'),
            'TokenCounts': ('models', 'TokenCounts'),
            'BurnRate': ('models', 'BurnRate'),
        }

        for class_name, (module_name, class_attr) in class_mappings.items():
            if module_name in self._modules:
                try:
                    self._classes[class_name] = getattr(self._modules[module_name], class_attr)
                    logger.debug(f"Extracted class: {class_name}")
                except AttributeError as e:
                    logger.warning(f"Failed to extract class {class_name}: {e}")

    def _extract_functions(self):
        """Dynamically extract utility functions from loaded modules."""
        function_mappings = {
            'normalize_model_name': ('models', 'normalize_model_name'),
        }

        for func_name, (module_name, func_attr) in function_mappings.items():
            if module_name in self._modules:
                try:
                    self._functions[func_name] = getattr(self._modules[module_name], func_attr)
                    logger.debug(f"Extracted function: {func_name}")
                except AttributeError as e:
                    logger.warning(f"Failed to extract function {func_name}: {e}")

    @property
    def is_available(self) -> bool:
        """Check if Claude Monitor is available."""
        return self._is_available

    def get_available_modules(self) -> List[str]:
        """Get list of successfully loaded modules."""
        return list(self._modules.keys())

    def get_available_classes(self) -> List[str]:
        """Get list of successfully extracted classes."""
        return list(self._classes.keys())

    def create_settings(self, **kwargs) -> Any:
        """Create Settings instance with provided parameters."""
        if 'Settings' not in self._classes:
            raise RuntimeError("Settings class not available")
        
        try:
            # Use safe import context to prevent CLI argument parsing
            with self._safe_import_context():
                return self._classes['Settings'](**kwargs)
        except Exception as e:
            logger.error(f"Failed to create Settings instance: {e}")
            raise

    def create_data_manager(self, settings: Any) -> Any:
        """Create DataManager instance."""
        if 'DataManager' not in self._classes:
            raise RuntimeError("DataManager class not available")
        
        try:
            return self._classes['DataManager'](settings)
        except Exception as e:
            logger.error(f"Failed to create DataManager instance: {e}")
            raise

    def create_orchestrator(self, data_manager: Any, settings: Any) -> Any:
        """Create MonitoringOrchestrator instance."""
        if 'MonitoringOrchestrator' not in self._classes:
            raise RuntimeError("MonitoringOrchestrator class not available")
        
        try:
            return self._classes['MonitoringOrchestrator'](data_manager, settings)
        except Exception as e:
            logger.error(f"Failed to create MonitoringOrchestrator instance: {e}")
            raise

    def convert_session_block(self, monitor_session: Any) -> SessionBlock:
        """Convert Claude Monitor SessionBlock to API SessionBlock with dynamic property reading."""
        if not monitor_session:
            return SessionBlock(
                id='unknown',
                start_time=datetime.utcnow(),
                end_time=datetime.utcnow()
            )

        try:
            # Use dynamic property reader
            reader = DynamicPropertyReader()
            
            # Basic properties mapping
            basic_props = reader.extract_properties(monitor_session, {
                'id': 'id',
                'is_active': 'is_active',
                'cost_usd': 'cost_usd',
                'sent_messages_count': 'sent_messages_count',
            })

            # Handle datetime conversion
            start_time = reader.convert_datetime(reader.safe_getattr(monitor_session, 'start_time', datetime.utcnow()))
            end_time = reader.convert_datetime(reader.safe_getattr(monitor_session, 'end_time', datetime.utcnow()))

            # Convert token counts
            token_counts = TokenCounts()
            monitor_token_counts = reader.safe_getattr(monitor_session, 'token_counts')
            if monitor_token_counts:
                token_counts = TokenCounts(
                    input_tokens=reader.safe_getattr(monitor_token_counts, 'input_tokens', 0),
                    output_tokens=reader.safe_getattr(monitor_token_counts, 'output_tokens', 0),
                    cache_creation_tokens=reader.safe_getattr(monitor_token_counts, 'cache_creation_tokens', 0),
                    cache_read_tokens=reader.safe_getattr(monitor_token_counts, 'cache_read_tokens', 0)
                )

            # Convert burn rate
            burn_rate = None
            monitor_burn_rate = reader.safe_getattr(monitor_session, 'burn_rate')
            if monitor_burn_rate:
                burn_rate = BurnRate(
                    tokens_per_minute=reader.safe_getattr(monitor_burn_rate, 'tokens_per_minute', 0.0),
                    cost_per_hour=reader.safe_getattr(monitor_burn_rate, 'cost_per_hour', 0.0)
                )

            # Extract lists and dictionaries safely
            models = reader.safe_getattr(monitor_session, 'models', []) or []
            per_model_stats = reader.safe_getattr(monitor_session, 'per_model_stats', {}) or {}

            return SessionBlock(
                id=basic_props.get('id', 'unknown'),
                start_time=start_time or datetime.utcnow(),
                end_time=end_time or datetime.utcnow(),
                is_active=basic_props.get('is_active', False),
                token_counts=token_counts,
                cost_usd=basic_props.get('cost_usd', 0.0),
                burn_rate=burn_rate,
                models=models,
                sent_messages_count=basic_props.get('sent_messages_count', 0),
                per_model_stats=per_model_stats
            )
            
        except Exception as e:
            logger.error(f"Error converting session block: {e}")
            # Return minimal session data as fallback
            return SessionBlock(
                id=str(getattr(monitor_session, 'id', 'error')),
                start_time=datetime.utcnow(),
                end_time=datetime.utcnow()
            )

    def get_usage_statistics(self, config_params: Optional[UsageConfig] = None) -> UsageStats:
        """Get comprehensive usage statistics with dynamic property extraction."""
        if not self.is_available:
            logger.warning("Claude Monitor not available, returning empty stats")
            return UsageStats(
                recent_sessions=[],
                predictions=UsagePredictions(),
                burn_rate=BurnRate(tokens_per_minute=0.0, cost_per_hour=0.0),
                totals=UsageTotals()
            )

        try:
            # Create settings from config parameters
            settings_kwargs = self._build_settings_kwargs(config_params)
            settings = self.create_settings(**settings_kwargs)
            
            # Create data manager and orchestrator
            data_manager = self.create_data_manager(settings)
            orchestrator = self.create_orchestrator(data_manager, settings)

            # Update and get current data
            orchestrator.update()
            current_data = orchestrator.get_current_data()

            # Build usage stats response
            usage_stats = UsageStats(
                recent_sessions=[],
                predictions=UsagePredictions(),
                burn_rate=BurnRate(tokens_per_minute=0.0, cost_per_hour=0.0),
                totals=UsageTotals()
            )

            # Extract current session
            current_session = DynamicPropertyReader.safe_getattr(current_data, 'current_session')
            if current_session:
                usage_stats.current_session = self.convert_session_block(current_session)

            # Extract recent sessions
            recent_sessions = DynamicPropertyReader.safe_getattr(current_data, 'recent_sessions', [])
            if recent_sessions:
                usage_stats.recent_sessions = [
                    self.convert_session_block(session) for session in recent_sessions
                ]

            # Extract burn rate
            monitor_burn_rate = DynamicPropertyReader.safe_getattr(current_data, 'burn_rate')
            if monitor_burn_rate:
                usage_stats.burn_rate = BurnRate(
                    tokens_per_minute=DynamicPropertyReader.safe_getattr(monitor_burn_rate, 'tokens_per_minute', 0.0),
                    cost_per_hour=DynamicPropertyReader.safe_getattr(monitor_burn_rate, 'cost_per_hour', 0.0)
                )

            # Extract predictions
            predictions_data = DynamicPropertyReader.safe_getattr(current_data, 'predictions')
            if predictions_data:
                usage_stats.predictions = UsagePredictions(
                    tokens_run_out=DynamicPropertyReader.convert_datetime(
                        DynamicPropertyReader.safe_getattr(predictions_data, 'tokens_run_out')
                    ),
                    limit_resets_at=DynamicPropertyReader.convert_datetime(
                        DynamicPropertyReader.safe_getattr(predictions_data, 'limit_resets_at')
                    )
                )

            # Extract totals/percentages
            totals_data = DynamicPropertyReader.safe_getattr(current_data, 'totals')
            if totals_data:
                usage_stats.totals = UsageTotals(
                    cost_percentage=DynamicPropertyReader.safe_getattr(totals_data, 'cost_percentage', 0.0),
                    token_percentage=DynamicPropertyReader.safe_getattr(totals_data, 'token_percentage', 0.0),
                    message_percentage=DynamicPropertyReader.safe_getattr(totals_data, 'message_percentage', 0.0),
                    time_to_reset_percentage=DynamicPropertyReader.safe_getattr(totals_data, 'time_to_reset_percentage', 0.0)
                )

            return usage_stats

        except Exception as e:
            logger.error(f"Error getting usage statistics: {e}")
            return UsageStats(
                recent_sessions=[],
                predictions=UsagePredictions(),
                burn_rate=BurnRate(tokens_per_minute=0.0, cost_per_hour=0.0),
                totals=UsageTotals()
            )

    def get_session_history(self, hours_back: int = 24) -> List[SessionBlock]:
        """Get session history with dynamic property extraction."""
        if not self.is_available:
            logger.warning("Claude Monitor not available, returning empty history")
            return []

        try:
            # Create minimal settings for data access
            settings = self.create_settings()
            data_manager = self.create_data_manager(settings)

            # Get session history
            sessions = data_manager.get_recent_sessions(hours_back=hours_back)
            
            # Convert to API format
            return [self.convert_session_block(session) for session in sessions]

        except Exception as e:
            logger.error(f"Error getting session history: {e}")
            return []

    def validate_configuration(self, config_data: UsageConfig) -> Dict[str, Any]:
        """Validate configuration using Claude Monitor's validation with dynamic property checking."""
        if not self.is_available:
            return {"valid": False, "error": "Claude Monitor not available"}

        try:
            # Build settings kwargs and validate
            settings_kwargs = self._build_settings_kwargs(config_data)
            settings = self.create_settings(**settings_kwargs)
            
            # Extract settings properties dynamically for validation
            reader = DynamicPropertyReader()
            settings_dict = {}
            
            # Get available fields from settings object
            if hasattr(settings, 'model_dump'):
                settings_dict = settings.model_dump()
            elif hasattr(settings, 'dict'):
                settings_dict = settings.dict()
            else:
                # Fallback: extract common properties
                common_props = ['plan', 'view', 'timezone', 'theme', 'refresh_rate', 'custom_limit_tokens']
                for prop in common_props:
                    settings_dict[prop] = reader.safe_getattr(settings, prop)

            return {"valid": True, "settings": settings_dict}

        except Exception as e:
            return {"valid": False, "error": str(e)}

    def _build_settings_kwargs(self, config_params: Optional[UsageConfig] = None) -> Dict[str, Any]:
        """Build settings kwargs from config parameters."""
        settings_kwargs = {}
        
        if config_params:
            # Map API config to Claude Monitor settings
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

        return settings_kwargs

    def get_monitor_info(self) -> Dict[str, Any]:
        """Get comprehensive information about the loaded Claude Monitor library."""
        info = {
            'available': self.is_available,
            'config_path': str(config.claude_monitor_path) if config.claude_monitor_path else None,
            'modules_loaded': self.get_available_modules(),
            'classes_available': self.get_available_classes(),
            'functions_available': list(self._functions.keys()),
        }

        if self.is_available:
            try:
                # Try to get version information
                if 'models' in self._modules:
                    module = self._modules['models']
                    info['version'] = getattr(module, '__version__', 'unknown')
                
                # Get module file paths for debugging
                info['module_paths'] = {}
                for name, module in self._modules.items():
                    info['module_paths'][name] = getattr(module, '__file__', 'unknown')
                    
            except Exception as e:
                logger.debug(f"Error getting monitor info: {e}")

        return info


# Global enhanced wrapper instance
claude_monitor = ClaudeMonitorWrapper()