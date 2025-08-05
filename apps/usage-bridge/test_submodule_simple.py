#!/usr/bin/env python3
"""
Simple test script to verify Claude Monitor submodule integration.
Tests basic path detection and structure without requiring dependencies.
"""

import sys
from pathlib import Path


def test_submodule_structure():
    """Test that the submodule has the expected structure."""
    print("🔍 Testing Submodule Structure")
    print("-" * 40)
    
    # Get path to submodule
    current_dir = Path(__file__).parent
    submodule_path = current_dir.parent.parent / "Claude-Code-Usage-Monitor"
    
    print(f"Submodule path: {submodule_path}")
    print(f"Submodule exists: {submodule_path.exists()}")
    
    if not submodule_path.exists():
        print("❌ Submodule directory not found")
        return False
    
    # Check expected structure
    expected_files = [
        "pyproject.toml",
        "README.md",
        "src/claude_monitor/__init__.py",
        "src/claude_monitor/core/settings.py",
        "src/claude_monitor/core/models.py",
        "src/claude_monitor/monitoring/data_manager.py",
        "src/claude_monitor/monitoring/orchestrator.py"
    ]
    
    all_files_exist = True
    for file_path in expected_files:
        full_path = submodule_path / file_path
        exists = full_path.exists()
        status = "✅" if exists else "❌"
        print(f"{status} {file_path}: {exists}")
        if not exists:
            all_files_exist = False
    
    return all_files_exist


def test_config_path_detection():
    """Test the path detection logic."""
    print("\n🔧 Testing Path Detection Logic")
    print("-" * 40)
    
    current_dir = Path(__file__).parent
    
    # Test paths (same logic as in config.py)
    submodule_path = current_dir.parent.parent / "Claude-Code-Usage-Monitor"
    fallback_path = current_dir.parent.parent.parent / "Claude-Code-Usage-Monitor"
    
    print(f"Primary (submodule) path: {submodule_path}")
    print(f"Primary exists: {submodule_path.exists()}")
    print(f"Primary has claude_monitor: {(submodule_path / 'src' / 'claude_monitor').exists()}")
    
    print(f"\nFallback path: {fallback_path}")
    print(f"Fallback exists: {fallback_path.exists()}")
    print(f"Fallback has claude_monitor: {(fallback_path / 'src' / 'claude_monitor').exists()}")
    
    # Determine which path would be selected
    if submodule_path.exists() and (submodule_path / "src" / "claude_monitor").exists():
        selected_path = submodule_path
        print(f"\n✅ Would select submodule path: {selected_path}")
        return True
    elif fallback_path.exists() and (fallback_path / "src" / "claude_monitor").exists():
        selected_path = fallback_path
        print(f"\n✅ Would select fallback path: {selected_path}")
        return True
    else:
        print("\n❌ No valid Claude Monitor path found")
        return False


def test_python_import_path():
    """Test that the Python path would work for imports."""
    print("\n🐍 Testing Python Import Path")
    print("-" * 40)
    
    current_dir = Path(__file__).parent
    submodule_path = current_dir.parent.parent / "Claude-Code-Usage-Monitor"
    
    if not submodule_path.exists():
        print("❌ Submodule path doesn't exist")
        return False
    
    src_path = submodule_path / "src"
    if not src_path.exists():
        print("❌ Source directory doesn't exist")
        return False
    
    # Add to Python path temporarily
    sys.path.insert(0, str(src_path))
    
    try:
        # Try to import the main module
        import claude_monitor
        print(f"✅ Successfully imported claude_monitor")
        print(f"Module path: {claude_monitor.__file__}")
        
        # Try to import specific submodules
        try:
            from claude_monitor.core import settings
            print("✅ Successfully imported settings module")
        except ImportError as e:
            print(f"⚠️  Could not import settings: {e}")
        
        try:
            from claude_monitor.core import models
            print("✅ Successfully imported models module")
        except ImportError as e:
            print(f"⚠️  Could not import models: {e}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Could not import claude_monitor: {e}")
        return False
    finally:
        # Remove from path
        if str(src_path) in sys.path:
            sys.path.remove(str(src_path))


def test_git_submodule_info():
    """Test git submodule information."""
    print("\n📚 Testing Git Submodule Info")
    print("-" * 40)
    
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent
    
    gitmodules_path = project_root / ".gitmodules"
    print(f"Gitmodules file: {gitmodules_path}")
    print(f"Gitmodules exists: {gitmodules_path.exists()}")
    
    if gitmodules_path.exists():
        try:
            content = gitmodules_path.read_text()
            print(f"Gitmodules content:\n{content}")
            
            # Check if it contains Claude-Code-Usage-Monitor
            if "Claude-Code-Usage-Monitor" in content:
                print("✅ Submodule properly defined in .gitmodules")
                return True
            else:
                print("❌ Claude-Code-Usage-Monitor not found in .gitmodules")
                return False
        except Exception as e:
            print(f"❌ Error reading .gitmodules: {e}")
            return False
    else:
        print("❌ .gitmodules file not found")
        return False


def main():
    """Run all simple integration tests."""
    print("🧪 Claude Monitor Submodule Simple Integration Tests")
    print("=" * 60)
    print()
    
    tests = [
        test_submodule_structure,
        test_config_path_detection,
        test_python_import_path,
        test_git_submodule_info
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            success = test_func()
            if success:
                passed += 1
            else:
                print("❌ Test failed")
        except Exception as e:
            print(f"❌ Test {test_func.__name__} failed with exception: {e}")
            import traceback
            traceback.print_exc()
        print()
    
    # Summary
    print("=" * 60)
    print(f"Simple Integration Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All simple integration tests passed! Submodule is properly set up.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the submodule setup.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)