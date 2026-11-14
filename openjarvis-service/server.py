"""
NAVIC-TRACK OpenJarvis Dedicated Local AI Assistant Service
Runs independently on 127.0.0.1:8100.
Provides:
  - Health check: GET /health
  - OpenAI-compatible chat: POST /v1/chat/completions
  - High-level JARVIS assistant: POST /api/v1/jarvis/chat
  - High-fidelity voice synthesis (TTS): POST /api/v1/jarvis/tts
"""

import sys
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add openjarvis-repo/src to python path
REPO_SRC = Path(__file__).resolve().parent.parent / "openjarvis-repo" / "src"
if str(REPO_SRC) not in sys.path:
    sys.path.insert(0, str(REPO_SRC))

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("OpenJarvis-Service")

# Load environment variables from .env and mock-server/.env
for env_file in [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent / "mock-server" / ".env"
]:
    if env_file.exists():
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        if k.strip() not in os.environ:
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
            logger.info(f"Loaded environment from {env_file}")
        except Exception as e:
            logger.warning(f"Could not read {env_file}: {e}")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    logger.info("Gemini API key loaded successfully for JARVIS intelligence.")

app = FastAPI(
    title="OpenJarvis Assistant Service for NAVIC-TRACK",
    version="1.0.0",
    description="Local AI flight director and satellite tracking assistant"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JARVIS_SYSTEM_PROMPT = """You are J.A.R.V.I.S., an advanced AI flight director and satellite tracking assistant integrated into the NAVIC-TRACK ground station.
Your role is to assist operators with:
1. Monitoring satellite positions (e.g. METEOR-M2 4, NOAA weather satellites, NavIC/IRNSS constellation, ISS).
2. Reporting upcoming visible passes, AOS (Acquisition of Signal), peak elevation, and LOS (Loss of Signal).
3. Analyzing ground station weather and atmospheric conditions.
4. Explaining orbital mechanics, Doppler shift, frequencies (e.g., 137 MHz weather APT/LRPT, L5/S-band NavIC), and antenna alignment.
5. Executing safe antenna tracking and homing commands through official NAVIC-TRACK tools.

Tone and Personality:
- Refined, polite, confident, concise, and technically precise (like the classic J.A.R.V.I.S.).
- Call the user "Commander" or "Operator" where appropriate.
- Prioritize physical antenna safety: never invent angles, and acknowledge that all tracking commands are verified against mechanical limits by the NAVIC-TRACK backend.
"""

class ChatMessage(BaseModel):
    role: str
    content: str

class JarvisChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = "default-session"
    history: Optional[List[ChatMessage]] = []
    backendData: Optional[Dict[str, Any]] = None

class JarvisChatResponse(BaseModel):
    reply: str
    toolCall: Optional[Dict[str, Any]] = None
    sessionId: str
    source: str

class TtsRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-GB-RyanNeural"  # Refined JARVIS voice

class SpeechSynthesizeRequest(BaseModel):
    text: str
    voice_id: Optional[str] = "en-GB-RyanNeural"
    speed: Optional[float] = 1.0

@app.get("/health")
async def health_check():
    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    return {
        "status": "ok",
        "service": "OpenJarvis",
        "version": "1.0.0",
        "voiceSupported": True,
        "engine": "OpenJarvis Flight Director (Gemini 3.5 Flash Powered)" if has_gemini else "OpenJarvis Ground-Station ReAct Engine",
        "aiModel": "gemini-3.5-flash" if has_gemini else "local-rules",
        "geminiConnected": has_gemini
    }

@app.get("/v1/models")
async def list_models():
    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    return {
        "object": "list",
        "data": [
            {
                "id": "gemini-3.5-flash" if has_gemini else "openjarvis-flight-director",
                "object": "model",
                "created": 1700000000,
                "owned_by": "google" if has_gemini else "openjarvis"
            }
        ]
    }

# ============================================================================
# Official OpenJarvis Speech API Endpoints
# ============================================================================

@app.get("/v1/speech/health")
async def speech_health():
    """Check if speech recognition (STT) backend is available."""
    try:
        import speech_recognition as sr
        return {
            "available": True,
            "backend": "speech_recognition",
            "formats": ["wav", "pcm"],
            "sample_rate": 16000
        }
    except Exception as exc:
        return {
            "available": False,
            "backend": "none",
            "reason": str(exc)
        }

@app.post("/v1/speech/transcribe")
async def speech_transcribe(request: Request):
    """
    Transcribe uploaded audio file to text.
    Accepts multipart form with 'file' and optional 'language'.
    """
    form = await request.form()
    audio_file = form.get("file")
    if audio_file is None:
        raise HTTPException(status_code=400, detail="Missing 'file' field in form")

    audio_bytes = await audio_file.read()
    if not audio_bytes or len(audio_bytes) < 44:
        raise HTTPException(status_code=400, detail="Audio file empty or invalid")

    language = form.get("language") or "en-US"

    try:
        import io
        import speech_recognition as sr
        recognizer = sr.Recognizer()

        with sr.AudioFile(io.BytesIO(audio_bytes)) as source:
            audio_data = recognizer.record(source)

        duration = len(audio_data.get_raw_data()) / (audio_data.sample_rate * audio_data.sample_width)

        try:
            text = recognizer.recognize_google(audio_data, language=language)
            confidence = 0.95
        except sr.UnknownValueError:
            text = ""
            confidence = 0.0
            logger.info("Speech recognition: Silence or unrecognized audio")
        except Exception as api_err:
            logger.warning(f"Speech recognition service notice: {api_err}")
            text = ""
            confidence = 0.0

        return {
            "text": text,
            "language": language,
            "confidence": confidence,
            "duration_seconds": round(duration, 2)
        }
    except Exception as exc:
        logger.error(f"Speech transcription failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Audio transcription failed: {exc}")

@app.get("/v1/speech/tts/health")
async def tts_health():
    """Check if text-to-speech (TTS) backend is available."""
    return {
        "available": True,
        "backend": "edge-tts",
        "voice_id": "en-GB-RyanNeural",
        "speed": 1.0
    }

@app.post("/v1/speech/synthesize")
async def speech_synthesize(req: SpeechSynthesizeRequest):
    """
    Synthesize text to speech audio.
    Returns audio/mpeg stream with voice headers.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing 'text'")
    if len(text) > 5000:
        raise HTTPException(status_code=413, detail="Text exceeds 5000 characters")

    voice = req.voice_id or "en-GB-RyanNeural"
    rate_str = "+0%"
    if req.speed is not None and req.speed != 1.0:
        pct = int((req.speed - 1.0) * 100)
        rate_str = f"{'+' if pct >= 0 else ''}{pct}%"

    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice, rate=rate_str)
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])

        return Response(
            content=bytes(audio_data),
            media_type="audio/mpeg",
            headers={
                "X-Voice-Id": voice,
                "X-Sample-Rate": "24000"
            }
        )
    except Exception as exc:
        logger.error(f"Speech synthesis error: {exc}")
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {exc}")

def analyze_intent_and_tools(user_msg: str, backend_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Analyzes user intent to determine if an application tool should be invoked.
    """
    msg_clean = user_msg.lower().strip()

    # 1. Start Tracking Command
    if any(k in msg_clean for k in ["start track", "track ", "follow ", "aim at", "point at", "lock on"]):
        # Identify satellite target
        sat = "METEOR-M2 4"
        if "meteor" in msg_clean or "m2" in msg_clean:
            sat = "METEOR-M2 4"
        elif "noaa 19" in msg_clean:
            sat = "NOAA 19"
        elif "noaa 18" in msg_clean:
            sat = "NOAA 18"
        elif "noaa 15" in msg_clean:
            sat = "NOAA 15"
        elif "iss" in msg_clean or "station" in msg_clean:
            sat = "ISS (ZARYA)"
        elif "navic-1b" in msg_clean or "irnss-1b" in msg_clean:
            sat = "NavIC-1B (IRNSS-1B)"
        elif "navic-1c" in msg_clean or "irnss-1c" in msg_clean:
            sat = "NavIC-1C (IRNSS-1C)"
        elif "navic" in msg_clean or "irnss" in msg_clean:
            sat = "NavIC-1B (IRNSS-1B)"

        return {
            "tool": "start_satellite_tracking",
            "args": {"satelliteName": sat},
            "intent": "track"
        }

    # 2. Stop Tracking Command
    if any(k in msg_clean for k in ["stop track", "stop antenna", "stop motor", "halt track", "abort"]):
        return {
            "tool": "stop_antenna_movement",
            "args": {},
            "intent": "stop"
        }

    # 3. Next Pass Query
    if any(k in msg_clean for k in ["next pass", "pass time", "when will", "upcoming pass", "flyover", "aos", "los"]):
        sat = "METEOR-M2 4"
        if "noaa" in msg_clean:
            sat = "NOAA 19"
        elif "iss" in msg_clean:
            sat = "ISS (ZARYA)"
        return {
            "tool": "get_next_pass",
            "args": {"satelliteName": sat},
            "intent": "pass"
        }

    # 4. Current Satellite Position Query
    if any(k in msg_clean for k in ["where is", "position of", "coordinates of", "satellite position", "current location"]):
        sat = "METEOR-M2 4"
        if "noaa" in msg_clean:
            sat = "NOAA 19"
        elif "iss" in msg_clean:
            sat = "ISS (ZARYA)"
        return {
            "tool": "get_current_satellite_position",
            "args": {"satelliteName": sat},
            "intent": "position"
        }

    # 5. Satellite List Query
    if any(k in msg_clean for k in ["what satellites", "list satellite", "which satellite", "show satellite", "available satellite"]):
        return {
            "tool": "get_satellite_list",
            "args": {},
            "intent": "satellites"
        }

    # 6. Azimuth / Elevation Aim Query
    if any(k in msg_clean for k in ["azimuth", "elevation", "where are you pointing", "antenna aim", "current angle"]):
        return {
            "tool": "get_azimuth_elevation",
            "args": {},
            "intent": "angles"
        }

    # 7. Weather Query
    if any(k in msg_clean for k in ["weather", "temperature", "forecast", "wind", "rain", "humidity", "conditions"]):
        return {
            "tool": "get_weather_info",
            "args": {},
            "intent": "weather"
        }

    # 8. Hardware Status Query
    if any(k in msg_clean for k in ["hardware", "stand level", "imu", "arduino", "esp32", "stepper", "motors", "status"]):
        return {
            "tool": "get_hardware_status",
            "args": {},
            "intent": "hardware"
        }

    return {"tool": None, "args": {}, "intent": "general"}

async def query_gemini_flight_director(
    user_msg: str,
    intent_data: Dict[str, Any],
    backend_data: Optional[Dict[str, Any]] = None,
    history: Optional[List[ChatMessage]] = None
) -> Optional[str]:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None

    model = os.environ.get("JARVIS_MODEL", "gemini-3.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    context_lines = []
    if backend_data:
        if backend_data.get("currentSatellite"):
            context_lines.append(f"Target satellite: {backend_data['currentSatellite']}")
        if backend_data.get("trackingState"):
            context_lines.append(f"Mount state: {backend_data['trackingState']}")
        if backend_data.get("azimuth") is not None and backend_data.get("elevation") is not None:
            context_lines.append(f"Antenna orientation: Azimuth {backend_data['azimuth']}°, Elevation {backend_data['elevation']}°")

    tool_name = intent_data.get("tool")
    tool_args = intent_data.get("args")

    system_instruction = (
        f"{JARVIS_SYSTEM_PROMPT}\n\n"
        f"Ground Station Telemetry Context:\n"
        f"{chr(10).join(context_lines) if context_lines else 'Nominal standby, dual-axis rotator aligned.'}\n"
    )

    if tool_name:
        system_instruction += (
            f"\nCritical Operator Action: This command triggers backend tool '{tool_name}' with parameters {json.dumps(tool_args)}.\n"
            f"Acknowledge this action as J.A.R.V.I.S., confirming that SGP4 orbital calculations and mechanical safety checks are underway on the ground-station controller. "
            f"Keep your spoken response polite, confident, concise, and under 3 sentences."
        )

    user_prompt = f"Operator: {user_msg}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{ "text": f"{system_instruction}\n\n{user_prompt}" }]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 1024
        }
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    for part in parts:
                        txt = part.get("text")
                        if txt:
                            return txt.strip()
            else:
                logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
    except Exception as exc:
        logger.warning(f"Gemini API request notice: {exc}")

    return None

@app.post("/api/v1/jarvis/chat", response_model=JarvisChatResponse)
async def jarvis_chat(req: JarvisChatRequest):
    """
    Primary conversational endpoint for JARVIS in NAVIC-TRACK.
    Analyzes user message, formulates tool calls for the backend when needed,
    and returns a polished flight-director response.
    """
    logger.info(f"Incoming JARVIS request: '{req.message}' (Session: {req.sessionId})")
    
    intent_data = analyze_intent_and_tools(req.message, req.backendData)
    tool_call = None

    if intent_data["tool"]:
        tool_call = {
            "name": intent_data["tool"],
            "arguments": intent_data["args"]
        }

    # First attempt intelligent response via Gemini API
    reply = await query_gemini_flight_director(req.message, intent_data, req.backendData, req.history)
    source = "openjarvis-gemini"

    if not reply:
        # Graceful fallback to deterministic flight director response
        source = "openjarvis-react"
        msg_lower = req.message.lower()

        if intent_data["intent"] == "track":
            sat = intent_data["args"].get("satelliteName", "METEOR-M2 4")
            reply = (
                f"Understood, Commander. Initiating tracking sequence for {sat}. "
                f"I have dispatched the acquisition request to the NAVIC-TRACK backend for orbital SGP4 calculation and safety envelope verification."
            )
        elif intent_data["intent"] == "stop":
            reply = (
                "Immediately halting antenna rotation, Commander. Disengaging stepper motor drives and de-energizing coil phases for mechanical safety."
            )
        elif intent_data["intent"] == "pass":
            sat = intent_data["args"].get("satelliteName", "METEOR-M2 4")
            reply = (
                f"Accessing SGP4 orbital propagator for {sat} against our ground station coordinates. "
                f"Retrieving acquisition and loss of signal timestamps with elevation mask criteria."
            )
        elif intent_data["intent"] == "position":
            sat = intent_data["args"].get("satelliteName", "METEOR-M2 4")
            reply = (
                f"Calculating real-time geodetic sub-satellite point and topocentric look angles for {sat}. Stand by for telemetry readout."
            )
        elif intent_data["intent"] == "satellites":
            reply = (
                "Accessing the active CelesTrak catalog. We currently track 137 MHz weather satellites (METEOR-M2 4, NOAA 15, 18, 19), "
                "the Indian NavIC/IRNSS navigation constellation, and the International Space Station."
            )
        elif intent_data["intent"] == "weather":
            reply = (
                "Accessing meteorological station sensors for our ground coordinates. "
                "Retrieving local ambient temperature, wind vectors, precipitation probability, and atmospheric status."
            )
        elif intent_data["intent"] == "hardware":
            reply = (
                "Running telemetry diagnostics on the 2-axis mount: checking MPU-6050 tripod leveling, stepper driver thermals, and ESP32 serial bridge link."
            )
        elif intent_data["intent"] == "angles":
            reply = (
                "Querying current azimuth heading and elevation gimbal angle from the motor controller."
            )
        else:
            if "hello" in msg_lower or "hi" in msg_lower or "hey" in msg_lower:
                reply = (
                    "At your service, Commander. All ground station systems are online. "
                    "How may I assist with your satellite tracking or telemetry today?"
                )
            elif "who are you" in msg_lower or "what can you do" in msg_lower:
                reply = (
                    "I am J.A.R.V.I.S., your autonomous AI flight director for the NAVIC-TRACK ground station. "
                    "I can predict satellite passes, compute topocentric azimuth and elevation angles, track weather satellites and the NavIC constellation, "
                    "monitor station meteorological data, and safely command our dual-axis antenna rotator."
                )
            elif "meteor" in msg_lower or "weather satellite" in msg_lower:
                reply = (
                    "METEOR-M2 4 is a Russian polar-orbiting meteorological satellite operating around 137.1 MHz. "
                    "It transmits high-resolution multi-spectral Earth imagery using LRPT (Low Rate Picture Transmission). "
                    "Would you like me to calculate its next pass over our ground station?"
                )
            elif "navic" in msg_lower or "irnss" in msg_lower:
                reply = (
                    "NavIC (Navigation with Indian Constellation) is ISRO's regional satellite navigation system. "
                    "It consists of geostationary (GEO) and inclined geosynchronous (IGSO) satellites providing precise positioning "
                    "over India and an area extending 1,500 km around it. Would you like to lock onto one of the NavIC orbiters?"
                )
            else:
                reply = (
                    f"Acknowledged, Commander. Regarding '{req.message}': All orbital tracking models and ground-station sensors are at your disposal. "
                    "You may command me to track any satellite, compute upcoming passes, check station weather, or inspect hardware status."
                )

    return JarvisChatResponse(
        reply=reply,
        toolCall=tool_call,
        sessionId=req.sessionId or "default-session",
        source=source
    )

@app.post("/api/v1/jarvis/tts")
async def generate_tts(req: TtsRequest):
    """
    Synthesize speech audio using edge-tts. Returns audio/mpeg stream.
    """
    try:
        import edge_tts
        communicate = edge_tts.Communicate(req.text, req.voice or "en-GB-RyanNeural")
        audio_data = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])

        return Response(content=bytes(audio_data), media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("JARVIS_PORT", "8100"))
    logger.info(f"Starting OpenJarvis Service on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")

