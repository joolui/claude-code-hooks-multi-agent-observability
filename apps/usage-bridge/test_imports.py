#!/usr/bin/env python3
"""Test script to isolate the import issue."""

import sys
import os
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set environment variable to prevent CLI execution
os.environ["CLAUDE_MONITOR_DISABLE_CLI"] = "1"

# Save original argv
original_argv = sys.argv.copy()
sys.argv = [sys.argv[0]]  # Keep only script name

print("Testing Claude Monitor imports...")

try:
    print("1. Testing basic config import...")
    from config import config
    print(f"   ✓ Config loaded, Claude Monitor available: {config.is_claude_monitor_available}")
    
    print("2. Testing wrapper import...")
    from claude_monitor_wrapper import claude_monitor
    print(f"   ✓ Wrapper loaded, available: {claude_monitor.is_available}")
    
    print("3. Testing monitor integration...")
    from monitor import monitor
    print(f"   ✓ Monitor integration loaded, available: {monitor.is_available}")
    
    print("4. Testing usage stats call...")
    stats = monitor.get_usage_stats()
    print(f"   ✓ Usage stats retrieved: {type(stats)}")
    
except Exception as e:
    print(f"   ✗ Error: {e}")
    import traceback
    traceback.print_exc()

finally:
    # Restore original argv
    sys.argv = original_argv

print("Test complete.")