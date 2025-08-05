#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import os
import sys
from pathlib import Path

# Import utils.constants with proper path resolution
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

try:
    from utils.constants import ensure_session_log_dir
except ImportError:
    # Fallback implementation if utils.constants is not available
    def ensure_session_log_dir(session_id: str) -> Path:
        """
        Fallback implementation for ensure_session_log_dir.
        """
        log_base_dir = os.environ.get("CLAUDE_HOOKS_LOG_DIR", "logs")
        log_dir = Path(log_base_dir) / session_id
        log_dir.mkdir(parents=True, exist_ok=True)
        return log_dir

def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        
        # Extract session_id
        session_id = input_data.get('session_id', 'unknown')
        
        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_path = log_dir / 'post_tool_use.json'
        
        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []
        
        # Append new data
        log_data.append(input_data)
        
        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Exit cleanly on any other error
        sys.exit(0)

if __name__ == '__main__':
    main()