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
from pathlib import Path
from dotenv import load_dotenv

def main():
    """
    Rime AI TTS Script
    
    Uses Rime AI's TTS API for personalized, context-aware text-to-speech.
    Accepts optional text prompt as command-line argument.
    
    Usage:
    - ./rime_tts.py                    # Uses default text
    - ./rime_tts.py "Your custom text" # Uses provided text
    
    Features:
    - Personalized voice synthesis
    - Context-aware speech patterns
    - Configurable guidance and addressing
    - Real-time audio playback
    """
    
    # Load environment variables
    load_dotenv()
    
    # Get API key from environment
    api_key = os.getenv('RIME_API_KEY')
    if not api_key:
        print("❌ Error: RIME_API_KEY not found in environment variables")
        print("Please add your Rime AI API key to .env file:")
        print("RIME_API_KEY=your_api_key_here")
        sys.exit(1)
    
    # Get configuration from environment
    guidance = os.getenv('RIME_GUIDANCE', '')
    who_to_address = os.getenv('ENGINEER_NAME', '')
    when_to_speak = os.getenv('RIME_WHEN_TO_SPEAK', '')
    speaker = os.getenv('RIME_VOICE', 'marsh')
    
    print("🎙️  Rime AI TTS")
    print("=" * 40)
    
    # Get text from command line argument or use default
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])  # Join all arguments as text
    else:
        text = "The first move is what sets everything in motion."
    
    print(f"🎯 Text: {text}")
    print("🔊 Generating and playing...")
    
    try:
        # Prepare the request payload
        payload = {
            "text": text,
            "speaker": speaker,
            "guidance": guidance,
            "who_to_address": who_to_address,
            "when_to_speak": when_to_speak
        }
        
        # Remove empty values to avoid sending unnecessary parameters
        payload = {k: v for k, v in payload.items() if v}
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Make request to Rime AI API
        response = requests.post(
            "https://users.rime.ai/v1/rime-tts",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            # Debug: Show response headers and data size
            print(f"📊 Response headers: {dict(response.headers)}")
            print(f"📊 Raw response size: {len(response.content)} bytes")
            
            # Check if response is JSON (contains audio URL/data) or direct audio
            content_type = response.headers.get('content-type', '').lower()
            
            if 'application/json' in content_type:
                # Response is JSON, need to extract audio data/URL
                try:
                    json_response = response.json()
                    print(f"📊 JSON response keys: {list(json_response.keys())}")
                    
                    # Check for different possible audio data fields
                    audio_data = None
                    audio_url = None
                    
                    # Look for common field names first
                    for field_name in ['audio', 'data', 'audioData', 'content', 'file']:
                        if field_name in json_response:
                            if isinstance(json_response[field_name], str):
                                # Try to decode as base64
                                import base64
                                try:
                                    audio_data = base64.b64decode(json_response[field_name])
                                    print(f"✅ Found base64 audio data in field: {field_name}")
                                    break
                                except:
                                    # Might be URL
                                    if json_response[field_name].startswith(('http', 'https')):
                                        audio_url = json_response[field_name]
                                        print(f"✅ Found audio URL in field: {field_name}")
                                        break
                            else:
                                audio_data = json_response[field_name]
                                print(f"✅ Found binary audio data in field: {field_name}")
                                break
                    
                    # If no common fields found, look for any string field that might be base64 audio
                    if not audio_data and not audio_url:
                        for key, value in json_response.items():
                            if isinstance(value, str) and len(value) > 1000:  # Likely base64 audio data
                                import base64
                                try:
                                    decoded = base64.b64decode(value)
                                    # Check if decoded data looks like audio (size check)
                                    if len(decoded) > 1000:
                                        audio_data = decoded
                                        print(f"✅ Found base64 audio data in field: {key}")
                                        break
                                except:
                                    continue
                    
                    if not audio_data and not audio_url:
                        print(f"📊 Available fields: {list(json_response.keys())}")
                        # Show first 200 chars of each field to help debug
                        for key, value in json_response.items():
                            if isinstance(value, str):
                                preview = value[:200] + "..." if len(value) > 200 else value
                                print(f"📊 {key}: {preview}")
                        print("❌ Could not find audio data in JSON response")
                        return
                    
                    # If we have a URL, download the audio
                    if audio_url and not audio_data:
                        print(f"🌐 Downloading audio from: {audio_url}")
                        audio_response = requests.get(audio_url, timeout=30)
                        if audio_response.status_code == 200:
                            audio_data = audio_response.content
                            # Determine extension from URL or content type
                            if '.mp3' in audio_url.lower():
                                ext = '.mp3'
                            elif '.wav' in audio_url.lower():
                                ext = '.wav'
                            else:
                                audio_content_type = audio_response.headers.get('content-type', '').lower()
                                if 'mp3' in audio_content_type:
                                    ext = '.mp3'
                                elif 'wav' in audio_content_type:
                                    ext = '.wav'
                                else:
                                    ext = '.mp3'
                        else:
                            print(f"❌ Failed to download audio: HTTP {audio_response.status_code}")
                            return
                    else:
                        # Determine extension (default to mp3 for JSON responses)
                        ext = '.mp3'
                    
                    if not audio_data:
                        print("❌ No audio data found")
                        return
                        
                except json.JSONDecodeError as e:
                    print(f"❌ Failed to parse JSON response: {e}")
                    return
            else:
                # Direct audio response
                audio_data = response.content
                if 'mp3' in content_type:
                    ext = '.mp3'
                elif 'wav' in content_type:
                    ext = '.wav'
                elif 'mpeg' in content_type:
                    ext = '.mp3'
                else:
                    ext = '.mp3'  # Default to mp3
            
            print(f"📊 Final audio data size: {len(audio_data)} bytes")
            
            # Save temporary audio file in Windows-accessible location for WSL
            import tempfile
            temp_audio_file = f"/tmp/rime_tts_output{ext}"
            with open(temp_audio_file, "wb") as f:
                f.write(audio_data)
            
            print(f"💾 Audio saved to: {temp_audio_file}")
            
            # For WSL, try multiple playback methods
            try:
                import subprocess
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
                    for player in ['aplay', 'paplay', 'afplay', 'play', 'mpg123', 'ffplay']:
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