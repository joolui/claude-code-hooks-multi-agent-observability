#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "requests",
#     "python-dotenv",
# ]
# ///

import os
import sys
import json
import requests
import subprocess
from pathlib import Path
from dotenv import load_dotenv

def get_access_token():
    """Get Google Cloud access token using gcloud CLI."""
    try:
        result = subprocess.run(
            ['gcloud', 'auth', 'print-access-token'],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"❌ gcloud auth failed: {result.stderr}")
            return None
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        print("❌ gcloud CLI not found or not authenticated")
        print("Please install gcloud CLI and run: gcloud auth application-default login")
        return None

def main():
    """
    Google Cloud Text-to-Speech Script
    
    Uses Google Cloud TTS API for high-quality text-to-speech synthesis.
    Accepts optional text prompt as command-line argument.
    
    Usage:
    - ./google_cloud_tts.py                    # Uses default text
    - ./google_cloud_tts.py "Your custom text" # Uses provided text
    
    Features:
    - High-quality neural voices
    - Multiple languages and voices
    - Configurable audio formats
    - Integration with Google Cloud ecosystem
    
    Authentication:
    - Requires gcloud CLI: gcloud auth application-default login
    - Or set GOOGLE_APPLICATION_CREDENTIALS environment variable
    """
    
    # Load environment variables
    load_dotenv()
    
    # Get configuration from environment
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT_ID', '')
    language_code = os.getenv('GOOGLE_CLOUD_TTS_LANGUAGE', 'en-US')
    voice_name = os.getenv('GOOGLE_CLOUD_TTS_VOICE', 'en-US-Journey-D')
    voice_gender = os.getenv('GOOGLE_CLOUD_TTS_GENDER', 'NEUTRAL')
    audio_encoding = os.getenv('GOOGLE_CLOUD_TTS_ENCODING', 'MP3')
    
    print("🎙️  Google Cloud Text-to-Speech")
    print("=" * 40)
    
    # Get text from command line argument or use default
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])  # Join all arguments as text
    else:
        text = "The first move is what sets everything in motion."
    
    print(f"🎯 Text: {text}")
    print("🔊 Generating and playing...")
    
    # Get access token
    access_token = get_access_token()
    if not access_token:
        sys.exit(1)
    
    try:
        # Prepare the request payload
        payload = {
            "input": {
                "text": text
            },
            "voice": {
                "languageCode": language_code,
                "name": voice_name,
                "ssmlGender": voice_gender
            },
            "audioConfig": {
                "audioEncoding": audio_encoding
            }
        }
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Add project ID header if provided
        if project_id:
            headers["x-goog-user-project"] = project_id
        
        # Make request to Google Cloud TTS API
        response = requests.post(
            "https://texttospeech.googleapis.com/v1/text:synthesize",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            # Debug: Show response headers and data size
            print(f"📊 Response headers: {dict(response.headers)}")
            print(f"📊 Raw response size: {len(response.content)} bytes")
            
            # Parse JSON response
            try:
                json_response = response.json()
                print(f"📊 JSON response keys: {list(json_response.keys())}")
                
                # Google Cloud TTS returns audio in 'audioContent' field as base64
                if 'audioContent' in json_response:
                    import base64
                    audio_data = base64.b64decode(json_response['audioContent'])
                    print(f"✅ Found base64 audio data in field: audioContent")
                else:
                    print(f"📊 Available fields: {list(json_response.keys())}")
                    print("❌ Could not find audioContent in response")
                    return
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                return
            
            print(f"📊 Final audio data size: {len(audio_data)} bytes")
            
            # Determine file extension based on encoding
            if audio_encoding.upper() == 'MP3':
                ext = '.mp3'
            elif audio_encoding.upper() in ['LINEAR16', 'WAV']:
                ext = '.wav'
            elif audio_encoding.upper() == 'OGG_OPUS':
                ext = '.ogg'
            else:
                ext = '.mp3'  # Default
            
            # Save temporary audio file
            import tempfile
            temp_audio_file = f"/tmp/google_cloud_tts_output{ext}"
            with open(temp_audio_file, "wb") as f:
                f.write(audio_data)
            
            print(f"💾 Audio saved to: {temp_audio_file}")
            
            # For WSL, try multiple playback methods
            try:
                playback_success = False
                
                # Method 1: Try powershell.exe to play via Windows
                try:
                    # Convert WSL path to Windows path
                    windows_path = temp_audio_file.replace('/tmp/', '/mnt/c/tmp/')
                    # Create the directory if it doesn't exist
                    os.makedirs('/mnt/c/tmp', exist_ok=True)
                    # Copy file to Windows-accessible location
                    import shutil
                    shutil.copy2(temp_audio_file, windows_path)
                    
                    # Use PowerShell to play audio via Windows
                    if ext == '.mp3':
                        # For MP3, use Windows Media Player
                        ps_command = f'Add-Type -AssemblyName PresentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open([uri]"{windows_path.replace("/mnt/c/", "C:\\")}"); $player.Play(); Start-Sleep 5'
                    else:
                        # For WAV, use SoundPlayer
                        ps_command = f'(New-Object Media.SoundPlayer "{windows_path.replace("/mnt/c/", "C:\\")}").PlaySync()'
                    
                    subprocess.run(['powershell.exe', '-Command', ps_command], 
                                 check=True, capture_output=True, timeout=15)
                    playback_success = True
                    print("🔊 Played via Windows PowerShell")
                    
                    # Clean up Windows file
                    try:
                        os.unlink(windows_path)
                    except:
                        pass
                        
                except Exception as e:
                    print(f"⚠️  Windows playback failed: {e}")
                
                # Method 2: Try Linux audio players if Windows method failed
                if not playback_success:
                    players = ['aplay', 'paplay', 'afplay', 'play', 'mpg123', 'ffplay']
                    if ext == '.mp3':
                        # Prioritize MP3 players for MP3 files
                        players = ['mpg123', 'ffplay', 'play'] + players
                    
                    for player in players:
                        try:
                            subprocess.run([player, temp_audio_file], 
                                         check=True, capture_output=True, timeout=15)
                            playback_success = True
                            print(f"🔊 Played via {player}")
                            break
                        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                            continue
                
                if not playback_success:
                    print("⚠️  Audio generated but no working audio player found")
                    print(f"💡 You can manually play the file: {temp_audio_file}")
                
                # Clean up temporary file
                try:
                    os.unlink(temp_audio_file)
                except:
                    pass
                    
            except Exception as e:
                print(f"⚠️  Audio generated but playback failed: {e}")
            
            print("✅ Generation complete!")
            
        else:
            print(f"❌ Error: HTTP {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error details: {error_data}")
            except:
                print(f"Error response: {response.text}")
        
    except requests.exceptions.Timeout:
        print("❌ Error: Request timeout")
    except requests.exceptions.ConnectionError:
        print("❌ Error: Connection failed")
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: Request failed - {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()