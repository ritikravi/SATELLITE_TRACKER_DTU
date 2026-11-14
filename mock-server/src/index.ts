import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

import {
  ApiResponse,
  LeanTelemetryPacket,
  TimeSyncResponse
} from '../../shared/types/tracker.js';
import { authMiddleware } from './auth.js';
import {
  trackerConfig,
  trackerStatus,
  currentTle,
  logsRingBuffer,
  setManualTarget,
  startHoming,
  selectSatellite,
  updateTle
} from './state.js';
import {
  getCachedCatalog,
  fetchCelestrakPresets,
  findSatelliteByNameOrNorad,
  fetchSatelliteFromCelestrak
} from './tle-data.js';
import { predictNextPass } from './simulator.js';
import {
  checkJarvisHealth,
  sendJarvisMessage,
  generateJarvisAudio,
  checkJarvisVoiceStatus,
  transcribeAudioBuffer
} from './jarvis/client.js';
import multer from 'multer';
import {
  JARVIS_TOOLS,
  executeJarvisTool
} from './jarvis/tools.js';

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB audio payload limit
});

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

app.use(cors());
app.use(express.json());

// Initialize satellite catalog from CelesTrak (with offline fallback)
fetchCelestrakPresets().then(() => {
  console.log('[TLE] Satellite catalog initialized from CelesTrak / offline cache');
});

// Helper for standard envelope
function successResponse<T>(res: Response, data: T, status = 200) {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  return res.status(status).json(payload);
}

function errorResponse(res: Response, message: string, status = 400) {
  const payload: ApiResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  return res.status(status).json(payload);
}

/* =========================================================
 * REST API Endpoints (/api/v1/*)
 * ========================================================= */

// 1. GET /api/v1/status
app.get('/api/v1/status', (req: Request, res: Response) => {
  return successResponse(res, trackerStatus);
});

// 2. GET /api/v1/config
app.get('/api/v1/config', (req: Request, res: Response) => {
  return successResponse(res, trackerConfig);
});

// 3. POST /api/v1/config (Auth required)
app.post('/api/v1/config', authMiddleware, (req: Request, res: Response) => {
  const { observer, motion } = req.body;

  if (observer) {
    if (typeof observer.latitude === 'number') {
      if (observer.latitude < -90 || observer.latitude > 90) {
        return errorResponse(res, 'Latitude must be between -90 and +90 degrees');
      }
      trackerConfig.observer.latitude = observer.latitude;
    }
    if (typeof observer.longitude === 'number') {
      if (observer.longitude < -180 || observer.longitude > 180) {
        return errorResponse(res, 'Longitude must be between -180 and +180 degrees');
      }
      trackerConfig.observer.longitude = observer.longitude;
    }
    if (typeof observer.altitudeMeters === 'number') {
      trackerConfig.observer.altitudeMeters = observer.altitudeMeters;
    }
    if (typeof observer.minElevationMaskDeg === 'number') {
      trackerConfig.observer.minElevationMaskDeg = Math.max(0, Math.min(45, observer.minElevationMaskDeg));
    }
  }

  if (motion) {
    if (typeof motion.maxAzimuthSpeedDegS === 'number') {
      if (motion.maxAzimuthSpeedDegS <= 0 || motion.maxAzimuthSpeedDegS > 5.0) {
        return errorResponse(res, 'Max azimuth speed must be between 0.1 and 5.0 deg/s for 28BYJ-48 stepper');
      }
      trackerConfig.motion.maxAzimuthSpeedDegS = motion.maxAzimuthSpeedDegS;
    }
    if (typeof motion.maxElevationSpeedDegS === 'number') {
      if (motion.maxElevationSpeedDegS <= 0 || motion.maxElevationSpeedDegS > 5.0) {
        return errorResponse(res, 'Max elevation speed must be between 0.1 and 5.0 deg/s');
      }
      trackerConfig.motion.maxElevationSpeedDegS = motion.maxElevationSpeedDegS;
    }
    if (typeof motion.azimuthStepsPerDegree === 'number') {
      trackerConfig.motion.azimuthStepsPerDegree = motion.azimuthStepsPerDegree;
    }
    if (typeof motion.elevationStepsPerDegree === 'number') {
      trackerConfig.motion.elevationStepsPerDegree = motion.elevationStepsPerDegree;
    }
    if (typeof motion.azimuthOffsetDeg === 'number') {
      trackerConfig.motion.azimuthOffsetDeg = motion.azimuthOffsetDeg;
    }
    if (typeof motion.elevationOffsetDeg === 'number') {
      trackerConfig.motion.elevationOffsetDeg = motion.elevationOffsetDeg;
    }
    if (typeof motion.backlashCompensationDeg === 'number') {
      trackerConfig.motion.backlashCompensationDeg = motion.backlashCompensationDeg;
    }
  }

  return successResponse(res, trackerConfig);
});

// 4. POST /api/v1/satellite (Auth required)
app.post('/api/v1/satellite', authMiddleware, async (req: Request, res: Response) => {
  const { name, noradId, autoTrack } = req.body;
  const target = noradId || name;
  if (!target) {
    return errorResponse(res, 'Missing satellite name or noradId');
  }

  const ok = await selectSatellite(target, !!autoTrack);
  if (!ok) {
    return errorResponse(res, `Satellite '${target}' not found in catalog or CelesTrak database`);
  }

  return successResponse(res, {
    satelliteName: trackerStatus.satelliteName,
    noradId: trackerStatus.noradId,
    targetAngles: trackerStatus.targetAngles,
    state: trackerStatus.state,
    satellitePosition: trackerStatus.satellitePosition,
    isVisible: trackerStatus.isVisible
  });
});

// 5. GET /api/v1/tle
app.get('/api/v1/tle', (req: Request, res: Response) => {
  return successResponse(res, currentTle);
});

// 5b. POST /api/v1/tle/refresh (Auth required - force fresh CelesTrak download)
app.post('/api/v1/tle/refresh', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await fetchCelestrakPresets(true);
    // If active satellite is in the refreshed catalog, update currentTle
    const found = result.satellites.find(s => s.noradId === currentTle.noradId);
    if (found) {
      currentTle.line1 = found.tle.line1;
      currentTle.line2 = found.tle.line2;
      currentTle.updatedAt = result.updatedAt;
      currentTle.source = 'CELESTRAK';
    }
    return successResponse(res, {
      message: `Successfully refreshed ${result.satellites.length} satellites from CelesTrak`,
      updatedAt: result.updatedAt,
      source: result.source,
      currentTle
    });
  } catch (err: any) {
    return errorResponse(res, `Failed to refresh from CelesTrak: ${err.message}`, 502);
  }
});

// 6. POST /api/v1/tle (Auth required)
app.post('/api/v1/tle', authMiddleware, (req: Request, res: Response) => {
  const { satelliteName, line1, line2 } = req.body;
  if (!satelliteName || !line1 || !line2) {
    return errorResponse(res, 'Missing satelliteName, line1, or line2');
  }

  if (!line1.startsWith('1 ') || !line2.startsWith('2 ') || line1.length < 60 || line2.length < 60) {
    return errorResponse(res, 'Invalid TLE format: Line 1 must begin with "1 " and Line 2 with "2 "');
  }

  updateTle(satelliteName, line1, line2);
  return successResponse(res, currentTle);
});

// 7. POST /api/v1/track (Auth required)
app.post('/api/v1/track', authMiddleware, (req: Request, res: Response) => {
  const { action } = req.body;
  if (action === 'START') {
    trackerStatus.state = 'TRACKING';
  } else if (action === 'STOP' || action === 'PAUSE') {
    trackerStatus.state = 'IDLE';
  } else {
    return errorResponse(res, 'Invalid action. Expected "START", "STOP", or "PAUSE"');
  }
  return successResponse(res, { state: trackerStatus.state });
});

// 8. POST /api/v1/move (Auth required - Manual jog/move)
app.post('/api/v1/move', authMiddleware, (req: Request, res: Response) => {
  const { azimuth, elevation, speedDegS } = req.body;

  if (typeof azimuth !== 'number' || typeof elevation !== 'number') {
    return errorResponse(res, 'Azimuth and elevation must be valid numbers');
  }

  // Validate limits strictly
  if (azimuth < 0 || azimuth > 360) {
    return errorResponse(res, 'Azimuth angle out of bounds: must be between 0.0 and 360.0 degrees');
  }
  if (elevation < 0 || elevation > 90) {
    return errorResponse(res, 'Elevation angle out of bounds: must be between 0.0 and 90.0 degrees');
  }

  if (speedDegS !== undefined) {
    if (typeof speedDegS !== 'number' || speedDegS <= 0 || speedDegS > trackerConfig.motion.maxAzimuthSpeedDegS) {
      return errorResponse(res, `Speed must be between 0.1 and ${trackerConfig.motion.maxAzimuthSpeedDegS} deg/s`);
    }
  }

  setManualTarget({ azimuth, elevation }, speedDegS);
  return successResponse(res, {
    state: trackerStatus.state,
    targetAngles: trackerStatus.targetAngles
  });
});

// 9. POST /api/v1/home (Auth required)
app.post('/api/v1/home', authMiddleware, (req: Request, res: Response) => {
  startHoming();
  return successResponse(res, {
    message: 'Homing sequence initiated',
    state: trackerStatus.state
  });
});

// 10. POST /api/v1/time (Auth required)
app.post('/api/v1/time', authMiddleware, (req: Request, res: Response) => {
  const { action, timestamp } = req.body;

  if (action === 'NTP_SYNC') {
    trackerStatus.timeSync = 'SYNCED';
    trackerStatus.lastTimeSync = new Date().toISOString();
    const data: TimeSyncResponse = {
      timeSync: 'SYNCED',
      currentTrackerTime: new Date().toISOString(),
      driftMs: Math.floor(Math.random() * 20) + 5,
      message: 'Time synchronized via simulated NTP successfully'
    };
    return successResponse(res, data);
  } else if (action === 'MANUAL') {
    if (!timestamp || isNaN(Date.parse(timestamp))) {
      return errorResponse(res, 'Invalid or missing ISO timestamp for MANUAL time sync');
    }
    trackerStatus.timeSync = 'MANUAL';
    trackerStatus.lastTimeSync = timestamp;
    const data: TimeSyncResponse = {
      timeSync: 'MANUAL',
      currentTrackerTime: timestamp,
      driftMs: 0,
      message: 'Manual time injected into tracker RTC clock successfully'
    };
    return successResponse(res, data);
  }

  return errorResponse(res, 'Invalid action. Expected "NTP_SYNC" or "MANUAL"');
});

// 11. GET /api/v1/logs
app.get('/api/v1/logs', (req: Request, res: Response) => {
  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const limit = Math.min(Math.max(1, limitParam), 200);
  const since = req.query.since ? new Date(req.query.since as string).getTime() : 0;

  let filtered = logsRingBuffer;
  if (since > 0 && !isNaN(since)) {
    filtered = filtered.filter(l => new Date(l.timestamp).getTime() > since);
  }

  const result = filtered.slice(-limit);
  return successResponse(res, result);
});

// 12. Helper: GET /api/v1/satellites
app.get('/api/v1/satellites', (req: Request, res: Response) => {
  return successResponse(res, getCachedCatalog());
});

// 12b. Helper: GET /api/v1/satellites/search?q=...
app.get('/api/v1/satellites/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) {
    return errorResponse(res, 'Query parameter "q" is required');
  }

  // First check cached catalog
  const localMatch = findSatelliteByNameOrNorad(query);
  if (localMatch) {
    return successResponse(res, [localMatch]);
  }

  // If not in local catalog, query CelesTrak directly
  try {
    const fetched = await fetchSatelliteFromCelestrak(query);
    if (fetched) {
      return successResponse(res, [fetched]);
    }
  } catch (err: any) {
    return errorResponse(res, `CelesTrak search error: ${err.message}`, 502);
  }

  return successResponse(res, []);
});

// 13. Helper: GET /api/v1/prediction
app.get('/api/v1/prediction', (req: Request, res: Response) => {
  const pass = predictNextPass(
    currentTle.line1,
    currentTle.line2,
    currentTle.satelliteName,
    currentTle.noradId,
    trackerConfig.observer
  );
  return successResponse(res, pass);
});

// 14. JARVIS: GET /api/v1/jarvis/status
app.get('/api/v1/jarvis/status', async (req: Request, res: Response) => {
  const health = await checkJarvisHealth();
  return successResponse(res, {
    online: health.available,
    tools: JARVIS_TOOLS.map(t => t.name),
    details: health.details || null
  });
});

// 15. JARVIS: POST /api/v1/jarvis/chat
app.post('/api/v1/jarvis/chat', async (req: Request, res: Response) => {
  const { message, sessionId, history } = req.body;
  if (!message || typeof message !== 'string') {
    return errorResponse(res, 'Message text is required');
  }

  // Send message to OpenJarvis service with circuit-breaker protection
  const jarvisRes = await sendJarvisMessage({
    message,
    sessionId,
    history,
    backendData: {
      currentSatellite: trackerStatus.satelliteName,
      trackingState: trackerStatus.state,
      azimuth: trackerStatus.currentAngles.azimuth,
      elevation: trackerStatus.currentAngles.elevation
    }
  });

  // If OpenJarvis requested a tool call, execute it safely on the backend!
  let toolResult = null;
  if (jarvisRes.toolCall) {
    toolResult = await executeJarvisTool(jarvisRes.toolCall.name, jarvisRes.toolCall.arguments);
  }

  return successResponse(res, {
    reply: jarvisRes.reply,
    toolCall: jarvisRes.toolCall || null,
    toolResult: toolResult || null,
    toolSummary: toolResult?.summary || null,
    online: jarvisRes.available,
    sessionId: jarvisRes.sessionId,
    source: jarvisRes.source
  });
});

// 16. JARVIS Voice Status: GET /api/v1/jarvis/voice/status
app.get('/api/v1/jarvis/voice/status', async (req: Request, res: Response) => {
  const voiceStatus = await checkJarvisVoiceStatus();
  return successResponse(res, voiceStatus);
});

// 17. JARVIS Voice Transcribe: POST /api/v1/jarvis/voice/transcribe
app.post('/api/v1/jarvis/voice/transcribe', upload.single('file'), async (req: Request, res: Response) => {
  let audioBuffer: Buffer | null = null;
  let filename = 'audio.wav';
  let language = (req.body?.language as string) || 'en-US';

  if (req.file) {
    audioBuffer = req.file.buffer;
    filename = req.file.originalname || 'audio.wav';
  } else if (req.body?.audioBase64) {
    const base64Str = req.body.audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    audioBuffer = Buffer.from(base64Str, 'base64');
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    return errorResponse(res, "Audio data is required (multipart 'file' or 'audioBase64')", 400);
  }

  const result = await transcribeAudioBuffer(audioBuffer, filename, language);
  if (!result.success && result.error && !result.text) {
    return errorResponse(res, result.error, 502);
  }

  return successResponse(res, {
    text: result.text,
    language: result.language || language,
    confidence: result.confidence ?? 0.95,
    duration: result.duration_seconds ?? 0
  });
});

// 18. JARVIS Voice Synthesize: POST /api/v1/jarvis/voice/synthesize
app.post('/api/v1/jarvis/voice/synthesize', async (req: Request, res: Response) => {
  const { text, voice, speed } = req.body;
  if (!text || typeof text !== 'string') {
    return errorResponse(res, 'Text is required for voice synthesis', 400);
  }

  const audioBuf = await generateJarvisAudio(text, voice, speed);
  if (!audioBuf) {
    return errorResponse(res, 'Speech synthesis unavailable or OpenJarvis service offline', 503);
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', audioBuf.length);
  res.setHeader('X-Voice-Id', voice || 'en-GB-RyanNeural');
  return res.send(audioBuf);
});

// 19. Backward-compatible alias: POST /api/v1/jarvis/tts
app.post('/api/v1/jarvis/tts', async (req: Request, res: Response) => {
  const { text, voice } = req.body;
  if (!text || typeof text !== 'string') {
    return errorResponse(res, 'Text is required for TTS synthesis', 400);
  }

  const audioBuf = await generateJarvisAudio(text, voice);
  if (!audioBuf) {
    return errorResponse(res, 'TTS synthesis unavailable or OpenJarvis service offline', 503);
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', audioBuf.length);
  return res.send(audioBuf);
});

/* =========================================================
 * HTTP & WebSocket Server Setup
 * ========================================================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Track connected WS clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket, req) => {
  clients.add(ws);
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}. Active clients: ${clients.size}`);

  // Send immediate initial packet
  sendTelemetryToClient(ws);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Active clients: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Client socket error:', err.message);
    clients.delete(ws);
  });
});

function sendTelemetryToClient(ws: WebSocket) {
  if (ws.readyState !== WebSocket.OPEN) return;

  const dAz = trackerStatus.targetAngles.azimuth - trackerStatus.currentAngles.azimuth;
  const dEl = trackerStatus.targetAngles.elevation - trackerStatus.currentAngles.elevation;
  const err = parseFloat(Math.sqrt(dAz * dAz + dEl * dEl).toFixed(2));

  // Lean telemetry packet (< 300 bytes)
  const packet: LeanTelemetryPacket = {
    t: Date.now(),
    st: trackerStatus.state,
    hm: trackerStatus.homed ? 1 : 0,
    c: [trackerStatus.currentAngles.azimuth, trackerStatus.currentAngles.elevation],
    tg: [trackerStatus.targetAngles.azimuth, trackerStatus.targetAngles.elevation],
    err,
    imu: [trackerStatus.imu.pitch, trackerStatus.imu.roll, trackerStatus.imu.isLevel ? 1 : 0],
    sat: trackerStatus.satelliteName?.substring(0, 14) || undefined,
    rssi: -55 - Math.floor(Math.random() * 8),
    vis: trackerStatus.isVisible ? 1 : 0,
    pos: trackerStatus.satellitePosition
      ? [
          trackerStatus.satellitePosition.latitude,
          trackerStatus.satellitePosition.longitude,
          trackerStatus.satellitePosition.altitudeKm
        ]
      : undefined
  };

  const payload = JSON.stringify(packet);
  ws.send(payload);
}

// Telemetry Broadcast Loop: 1 Hz (rate-limited for ESP32 radio budget)
setInterval(() => {
  if (clients.size === 0) return;
  for (const ws of clients) {
    sendTelemetryToClient(ws);
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` NAVIC-TRACK ESP32 Mock Tracker Server is running!`);
  console.log(` REST API:    http://localhost:${PORT}/api/v1`);
  console.log(` WebSocket:   ws://localhost:${PORT}/ws`);
  console.log(` Auth Token:  ${process.env.TRACKER_AUTH_TOKEN ? 'Loaded from environment' : 'NOT SET (requests will fail)'}`);
  console.log(`====================================================`);
});

