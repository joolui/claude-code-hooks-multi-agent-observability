#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "python-dotenv",
# ]
# ///

import argparse
import json
import os
import sys
import subprocess
import random
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

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def get_tts_script_path():
    """
    Determine which TTS script to use based on available API keys.
    Priority order: Rime > Google Cloud > ElevenLabs > OpenAI > pyttsx3
    """
    # Get current script directory and construct utils/tts path
    script_dir = Path(__file__).parent
    tts_dir = script_dir / "utils" / "tts"
    
    # Check for Rime API key (highest priority)
    if os.getenv('RIME_API_KEY'):
        rime_script = tts_dir / "rime_tts.py"
        if rime_script.exists():
            return str(rime_script)
    
    # Check for Google Cloud TTS (second priority)
    # Google Cloud can use gcloud auth or GOOGLE_APPLICATION_CREDENTIALS
    try:
        import subprocess
        result = subprocess.run(
            ['gcloud', 'auth', 'print-access-token'],
            capture_output=True, timeout=5
        )
        if result.returncode == 0 or os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
            google_cloud_script = tts_dir / "google_cloud_tts.py"
            if google_cloud_script.exists():
                return str(google_cloud_script)
    except:
        pass  # gcloud not available or not authenticated
    
    # Check for ElevenLabs API key (third priority)
    if os.getenv('ELEVENLABS_API_KEY'):
        elevenlabs_script = tts_dir / "elevenlabs_tts.py"
        if elevenlabs_script.exists():
            return str(elevenlabs_script)
    
    # Check for OpenAI API key (fourth priority)
    if os.getenv('OPENAI_API_KEY'):
        openai_script = tts_dir / "openai_tts.py"
        if openai_script.exists():
            return str(openai_script)
    
    # Fall back to pyttsx3 (no API key required)
    pyttsx3_script = tts_dir / "pyttsx3_tts.py"
    if pyttsx3_script.exists():
        return str(pyttsx3_script)
    
    return None


def announce_notification():
    """Announce that the agent needs user input."""
    try:
        tts_script = get_tts_script_path()
        if not tts_script:
            return  # No TTS scripts available
        
        # Get engineer name if available
        engineer_name = os.getenv('ENGINEER_NAME', '').strip()
        
        # Create notification message with 30% chance to include name
        if engineer_name and random.random() < 0.3:
            notification_message = f"{engineer_name}, your agent needs your input"
        else:
            notification_message = "Your agent needs your input"
        
        # Call the TTS script with the notification message
        subprocess.run([
            "uv", "run", tts_script, notification_message
        ], 
        capture_output=True,  # Suppress output
        timeout=10  # 10-second timeout
        )
        
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        # Fail silently if TTS encounters issues
        pass
    except Exception:
        # Fail silently for any other errors
        pass


def main():
    try:
        # Parse command line arguments
        parser = argparse.ArgumentParser()
        parser.add_argument('--notify', action='store_true', help='Enable TTS notifications')
        args = parser.parse_args()
        
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        
        # Extract session_id
        session_id = input_data.get('session_id', 'unknown')
        
        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_file = log_dir / 'notification.json'
        
        # Read existing log data or initialize empty list
        if log_file.exists():
            with open(log_file, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []
        
        # Append new data
        log_data.append(input_data)
        
        # Write back to file with formatting
        with open(log_file, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        # Announce notification via TTS only if --notify flag is set
        # Skip TTS for the generic "Claude is waiting for your input" message
        if args.notify and input_data.get('message') != 'Claude is waiting for your input':
            announce_notification()
        
        sys.exit(0)
        
    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Handle any other errors gracefully
        sys.exit(0)

if __name__ == '__main__':
    main()