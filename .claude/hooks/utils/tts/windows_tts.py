#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import sys
import subprocess
import random

def main():
    """
    Windows TTS Script for WSL
    
    Uses Windows PowerShell's built-in Speech Synthesis for TTS.
    Works great in WSL by calling Windows commands directly.
    
    Usage:
    - ./windows_tts.py                    # Uses default text
    - ./windows_tts.py "Your custom text" # Uses provided text
    
    Features:
    - No API key required
    - Works perfectly in WSL
    - Uses Windows native TTS engine
    - Fast and reliable
    """
    
    try:
        print("🔊 Windows TTS")
        print("=" * 15)
        
        # Get text from command line argument or use default
        if len(sys.argv) > 1:
            text = " ".join(sys.argv[1:])  # Join all arguments as text
        else:
            # Default completion messages
            completion_messages = [
                "Work complete!",
                "All done!",
                "Task finished!",
                "Job complete!",
                "Ready for next task!"
            ]
            text = random.choice(completion_messages)
        
        print(f"🎯 Text: {text}")
        print("🔊 Speaking via Windows...")
        
        # Escape quotes in the text for PowerShell
        escaped_text = text.replace('"', '""')
        
        # PowerShell command to use Windows Speech Synthesis
        ps_command = f'''
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.Rate = 1;
        $synth.Volume = 80;
        $synth.Speak("{escaped_text}");
        '''
        
        # Execute PowerShell command
        result = subprocess.run([
            "powershell.exe", "-Command", ps_command
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Playback complete!")
        else:
            print(f"❌ Error: {result.stderr}")
            sys.exit(1)
        
    except subprocess.TimeoutExpired:
        print("❌ Error: TTS timeout")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ Error: PowerShell not found")
        print("This script requires Windows PowerShell (should be available in WSL)")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()