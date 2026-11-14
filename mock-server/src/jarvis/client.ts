/**
 * OpenJarvis Service Client for NAVIC-TRACK
 * Handles HTTP communication, timeouts, and circuit-breaker fallback when OpenJarvis is offline.
 */

const JARVIS_URL = process.env.JARVIS_SERVICE_URL || 'http://127.0.0.1:8100';
const REQUEST_TIMEOUT_MS = 15000;

export interface JarvisChatPayload {
  message: string;
  sessionId?: string;
  history?: Array<{ role: string; content: string }>;
  backendData?: Record<string, any>;
}

export interface JarvisChatResult {
  available: boolean;
  reply: string;
  toolCall?: {
    name: string;
    arguments: Record<string, any>;
  } | null;
  sessionId: string;
  source: string;
}

/**
 * Health check to verify whether OpenJarvis service is currently responding
 */
export async function checkJarvisHealth(): Promise<{ available: boolean; details?: any }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${JARVIS_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { available: true, details: data };
    }
  } catch (err) {
    // Service offline or unreachable
  }
  return { available: false };
}

/**
 * Sends a user message to OpenJarvis service with circuit-breaker protection.
 * If OpenJarvis is offline or times out, returns a graceful fallback without crashing.
 */
export async function sendJarvisMessage(payload: JarvisChatPayload): Promise<JarvisChatResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(`${JARVIS_URL}/api/v1/jarvis/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return {
        available: true,
        reply: data.reply,
        toolCall: data.toolCall,
        sessionId: data.sessionId,
        source: data.source || 'openjarvis-service'
      };
    }
  } catch (err: any) {
    // OpenJarvis is offline, not running, or timed out
  }

  // Graceful fallback when OpenJarvis is offline
  return {
    available: false,
    reply: "JARVIS assistant is currently offline. You can start the OpenJarvis service with 'npm run dev:jarvis' or continue operating the station manually.",
    toolCall: null,
    sessionId: payload.sessionId || 'fallback-session',
    source: 'offline-fallback'
  };
}

export interface VoiceStatus {
  available: boolean;
  stt: {
    available: boolean;
    backend: string;
    formats?: string[];
    sample_rate?: number;
    reason?: string;
  };
  tts: {
    available: boolean;
    backend: string;
    voice_id?: string;
    speed?: number;
    reason?: string;
  };
}

export interface TranscriptionResponse {
  success: boolean;
  text: string;
  language?: string;
  confidence?: number;
  duration_seconds?: number;
  error?: string;
}

/**
 * Checks voice STT and TTS status from OpenJarvis service
 */
export async function checkJarvisVoiceStatus(): Promise<VoiceStatus> {
  const fallbackStatus: VoiceStatus = {
    available: false,
    stt: { available: false, backend: 'none', reason: 'OpenJarvis service offline' },
    tts: { available: false, backend: 'none', reason: 'OpenJarvis service offline' }
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const [sttRes, ttsRes] = await Promise.allSettled([
      fetch(`${JARVIS_URL}/v1/speech/health`, { signal: controller.signal }),
      fetch(`${JARVIS_URL}/v1/speech/tts/health`, { signal: controller.signal })
    ]);
    clearTimeout(timeout);

    let stt = fallbackStatus.stt;
    let tts = fallbackStatus.tts;

    if (sttRes.status === 'fulfilled' && sttRes.value.ok) {
      stt = await sttRes.value.json();
    }
    if (ttsRes.status === 'fulfilled' && ttsRes.value.ok) {
      tts = await ttsRes.value.json();
    }

    return {
      available: !!(stt.available || tts.available),
      stt,
      tts
    };
  } catch (err) {
    return fallbackStatus;
  }
}

/**
 * Transcribes audio buffer by forwarding to OpenJarvis /v1/speech/transcribe
 */
export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  filename = 'speech.wav',
  language = 'en-US'
): Promise<TranscriptionResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, filename);
    if (language) {
      formData.append('language', language);
    }

    const res = await fetch(`${JARVIS_URL}/v1/speech/transcribe`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        text: data.text || '',
        language: data.language || language,
        confidence: data.confidence ?? 0.95,
        duration_seconds: data.duration_seconds ?? 0
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        text: '',
        error: `Transcription error (${res.status}): ${errText}`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      text: '',
      error: `Transcription failed: ${err.message || 'Service offline'}`
    };
  }
}

/**
 * Synthesizes voice audio via OpenJarvis TTS /v1/speech/synthesize
 */
export async function generateJarvisAudio(
  text: string,
  voice = 'en-GB-RyanNeural',
  speed = 1.0
): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${JARVIS_URL}/v1/speech/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voice, speed }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
  } catch (err) {
    // Fall back to /api/v1/jarvis/tts if needed
    try {
      const res = await fetch(`${JARVIS_URL}/api/v1/jarvis/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice })
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
    } catch {
      // Ignored
    }
  }
  return null;
}

