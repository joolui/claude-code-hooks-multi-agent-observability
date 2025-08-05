#!/usr/bin/env python3
"""
Test script specifically for verifying Claude Monitor submodule integration.
Tests dynamic property reading and library wrapper functionality.
"""

import sys
import json
from pathlib import Path

# Add the current directory to Python path for imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

try:
    from claude_monitor_wrapper import claude_monitor, DynamicPropertyReader
    from config import config
except ImportError:
    # Handle relative imports when running as script
    import importlib.util
    import os
    
    # Load config module
    config_path = current_dir / "config.py"
    spec = importlib.util.spec_from_file_location("config", config_path)
    config_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(config_module)
    config = config_module.config
    
    # Load wrapper module
    wrapper_path = current_dir / "claude_monitor_wrapper.py"
    spec = importlib.util.spec_from_file_location("claude_monitor_wrapper", wrapper_path)
    wrapper_module = importlib.util.module_from_spec(spec)
    
    # Patch the relative import
    sys.modules['claude_monitor_wrapper.config'] = config_module
    spec.loader.exec_module(wrapper_module)
    
    claude_monitor = wrapper_module.claude_monitor
    DynamicPropertyReader = wrapper_module.DynamicPropertyReader


def test_config_detection():
    """Test configuration detection and path resolution."""
    print("🔍 Testing Configuration Detection")
    print("-" * 40)
    
    print(f"Claude Monitor Path: {config.claude_monitor_path}")
    print(f"Claude Monitor Source Path: {config.claude_monitor_src_path}")
    print(f"Is Available: {config.is_claude_monitor_available}")
    
    if config.claude_monitor_path:
        submodule_path = config.claude_monitor_path
        print(f"Detected path: {submodule_path}")
        print(f"Path exists: {submodule_path.exists()}")
        if submodule_path.exists():
            print(f"Source dir exists: {(submodule_path / 'src').exists()}")
            print(f"Claude monitor dir exists: {(submodule_path / 'src' / 'claude_monitor').exists()}")
    
    print()


def test_dynamic_property_reader():
    """Test the dynamic property reader utility."""
    print("🔧 Testing Dynamic Property Reader")
    print("-" * 40)
    
    # Create a test object
    class TestObject:
        def __init__(self):
            self.simple_prop = "test_value"
            self.numeric_prop = 42
            self.nested_obj = TestNestedObject()
            self.missing_prop = None
            
    class TestNestedObject:
        def __init__(self):
            self.nested_value = "nested_test"
            self.nested_number = 123
    
    test_obj = TestObject()
    reader = DynamicPropertyReader()
    
    # Test safe attribute access
    print(f"✅ Safe getattr (existing): {reader.safe_getattr(test_obj, 'simple_prop')}")
    print(f"✅ Safe getattr (missing): {reader.safe_getattr(test_obj, 'nonexistent', 'default')}")
    
    # Test property extraction
    property_map = {
        'simple': 'simple_prop',
        'numeric': 'numeric_prop',
        'nested': 'nested_obj.nested_value',
        'nested_num': 'nested_obj.nested_number',
        'missing': 'nonexistent_prop'
    }
    
    extracted = reader.extract_properties(test_obj, property_map)
    print(f"✅ Extracted properties: {json.dumps(extracted, indent=2)}")
    
    print()


def test_wrapper_initialization():
    """Test Claude Monitor wrapper initialization."""
    print("🚀 Testing Wrapper Initialization")
    print("-" * 40)
    
    print(f"Wrapper available: {claude_monitor.is_available}")
    print(f"Available modules: {claude_monitor.get_available_modules()}")
    print(f"Available classes: {claude_monitor.get_available_classes()}")
    
    # Get comprehensive monitor info
    info = claude_monitor.get_monitor_info()
    print(f"Monitor info: {json.dumps(info, indent=2, default=str)}")
    
    print()


def test_settings_creation():
    """Test dynamic settings creation."""
    print("⚙️  Testing Settings Creation")
    print("-" * 40)
    
    if not claude_monitor.is_available:
        print("❌ Claude Monitor not available, skipping settings test")
        return
    
    try:
        # Test settings creation with various parameters
        settings = claude_monitor.create_settings(
            plan='custom',
            custom_limit_tokens=50000,
            view='realtime',
            timezone='UTC',
            theme='dark'
        )
        
        print("✅ Settings created successfully")
        
        # Test dynamic property reading from settings
        reader = DynamicPropertyReader()
        print(f"Settings plan: {reader.safe_getattr(settings, 'plan')}")
        print(f"Settings view: {reader.safe_getattr(settings, 'view')}")
        print(f"Settings timezone: {reader.safe_getattr(settings, 'timezone')}")
        
    except Exception as e:
        print(f"❌ Error creating settings: {e}")
    
    print()


def test_integration_components():
    """Test integration of all wrapper components."""
    print("🔗 Testing Integration Components")
    print("-" * 40)
    
    if not claude_monitor.is_available:
        print("❌ Claude Monitor not available, skipping integration test")
        return
    
    try:
        # Test full integration workflow
        from models import UsageConfig
        
        test_config = UsageConfig(
            plan='custom',
            custom_limit_tokens=25000,
            view='realtime',
            timezone='America/New_York',
            theme='light',
            refresh_rate=5
        )
        
        print("✅ Created test configuration")
        
        # Test configuration validation
        validation_result = claude_monitor.validate_configuration(test_config)
        print(f"Configuration validation: {validation_result.get('valid', False)}")
        
        # Test usage statistics retrieval
        usage_stats = claude_monitor.get_usage_statistics(test_config)
        print(f"✅ Retrieved usage statistics (sessions: {len(usage_stats.recent_sessions)})")
        
        # Test session history
        session_history = claude_monitor.get_session_history(hours_back=24)
        print(f"✅ Retrieved session history ({len(session_history)} sessions)")
        
    except Exception as e:
        print(f"❌ Error in integration test: {e}")
        import traceback
        traceback.print_exc()
    
    print()


def test_error_handling():
    """Test error handling and graceful degradation."""
    print("🛡️  Testing Error Handling")
    print("-" * 40)
    
    reader = DynamicPropertyReader()
    
    # Test with None object
    result = reader.safe_getattr(None, 'any_attr', 'default')
    print(f"✅ None object handling: {result}")
    
    # Test with invalid attribute path
    class TestObj:
        pass
    
    test_obj = TestObj()
    properties = reader.extract_properties(test_obj, {
        'missing': 'nonexistent.nested.path',
        'invalid': 'bad.attribute'
    })
    print(f"✅ Invalid properties handling: {properties}")
    
    # Test datetime conversion with various inputs
    test_dates = [None, "2024-01-01T12:00:00Z", 1704110400, "invalid_date"]
    for date_input in test_dates:
        converted = reader.convert_datetime(date_input)
        print(f"✅ Date conversion ({date_input}): {converted}")
    
    print()


def main():
    """Run all submodule integration tests."""
    print("🧪 Claude Monitor Submodule Integration Tests")
    print("=" * 60)
    print()
    
    tests = [
        test_config_detection,
        test_dynamic_property_reader,
        test_wrapper_initialization,
        test_settings_creation,
        test_integration_components,
        test_error_handling
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            test_func()
            passed += 1
        except Exception as e:
            print(f"❌ Test {test_func.__name__} failed: {e}")
            import traceback
            traceback.print_exc()
            print()
    
    # Summary
    print("=" * 60)
    print(f"Integration Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All integration tests passed! Submodule integration is working correctly.")
        return 0
    else:
        print("⚠️  Some integration tests failed. Check the output above for details.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)