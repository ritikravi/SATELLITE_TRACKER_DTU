import {
  ApiResponse,
  TrackerStatus,
  TrackerConfig,
  SelectSatelliteRequest,
  TleData,
  SetTleRequest,
  TrackControlRequest,
  ManualMoveRequest,
  HomeRequest,
  TimeSyncRequest,
  TimeSyncResponse,
  TelemetryLogEntry,
  SatelliteInfo,
  SatellitePass
} from '@shared/types/tracker';
import { setCachedSatelliteName } from './decoder';

export function getStoredTrackerUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('navic_tracker_url');
}

export function setStoredTrackerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('navic_tracker_url', url.trim());
}

export function clearStoredTrackerUrl(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('navic_tracker_url');
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customUrl = getStoredTrackerUrl();
    if (customUrl) {
      return customUrl.replace(/\/+$/, '');
    }
    const envUrl = process.env.NEXT_PUBLIC_TRACKER_URL?.trim();
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('navic-tracker-live.trycloudflare.com')) {
      return envUrl.replace(/\/+$/, '');
    }
    // Default to relative URL on current origin (Vercel Serverless API routes)
    return '';
  }
  const serverEnv = process.env.NEXT_PUBLIC_TRACKER_URL?.trim();
  if (serverEnv && !serverEnv.includes('navic-tracker-live.trycloudflare.com')) {
    return serverEnv.replace(/\/+$/, '');
  }
  return 'http://localhost:8080';
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('navic_auth_token');
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('navic_auth_token', token.trim());
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('navic_auth_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  const token = getStoredAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const body: ApiResponse<T> = await res.json().catch(() => ({
    success: false,
    error: `HTTP Error ${res.status}: ${res.statusText}`,
    timestamp: new Date().toISOString()
  }));

  if (!res.ok || !body.success) {
    throw new Error(body.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return body.data as T;
}

export interface JarvisVoiceStatusData {
  available: boolean;
  stt: { available: boolean; backend: string; formats?: string[]; reason?: string };
  tts: { available: boolean; backend: string; voice_id?: string; speed?: number; reason?: string };
}

export interface JarvisChatResult {
  reply: string;
  toolCall?: { name: string; arguments: Record<string, any> } | null;
  toolResult?: any;
  toolSummary?: string | null;
  online: boolean;
  sessionId: string;
  source: string;
}

export interface JarvisTranscribeResult {
  text: string;
  language: string;
  confidence: number;
  duration: number;
}

export const trackerApi = {
  // Status
  async getStatus(): Promise<TrackerStatus> {
    const status = await request<TrackerStatus>('/api/v1/status');
    if (status.satelliteName) {
      setCachedSatelliteName(status.satelliteName);
    }
    return status;
  },

  // Config
  async getConfig(): Promise<TrackerConfig> {
    return request<TrackerConfig>('/api/v1/config');
  },

  async updateConfig(config: Partial<TrackerConfig>): Promise<TrackerConfig> {
    return request<TrackerConfig>('/api/v1/config', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  // Satellite Selection
  async selectSatellite(payload: SelectSatelliteRequest): Promise<{ satelliteName: string; noradId: number }> {
    const res = await request<{ satelliteName: string; noradId: number }>('/api/v1/satellite', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setCachedSatelliteName(res.satelliteName);
    return res;
  },

  // TLE
  async getTle(): Promise<TleData> {
    return request<TleData>('/api/v1/tle');
  },

  async setTle(payload: SetTleRequest): Promise<TleData> {
    return request<TleData>('/api/v1/tle', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async refreshTle(): Promise<{ message: string; updatedAt: string; source: string; currentTle: TleData }> {
    return request<{ message: string; updatedAt: string; source: string; currentTle: TleData }>('/api/v1/tle/refresh', {
      method: 'POST'
    });
  },

  // Tracking
  async setTracking(action: TrackControlRequest['action']): Promise<{ state: string }> {
    return request<{ state: string }>('/api/v1/track', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
  },

  // Manual Move
  async move(payload: ManualMoveRequest): Promise<{ state: string }> {
    return request<{ state: string }>('/api/v1/move', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Homing
  async home(axis: HomeRequest['axis'] = 'ALL'): Promise<{ message: string; state: string }> {
    return request<{ message: string; state: string }>('/api/v1/home', {
      method: 'POST',
      body: JSON.stringify({ axis })
    });
  },

  // Time Sync
  async syncTime(payload: TimeSyncRequest): Promise<TimeSyncResponse> {
    return request<TimeSyncResponse>('/api/v1/time', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Logs
  async getLogs(limit = 50, since?: string): Promise<TelemetryLogEntry[]> {
    const query = new URLSearchParams({ limit: limit.toString() });
    if (since) query.append('since', since);
    return request<TelemetryLogEntry[]>(`/api/v1/logs?${query.toString()}`);
  },

  // Helpers
  async getSatellites(): Promise<SatelliteInfo[]> {
    return request<SatelliteInfo[]>('/api/v1/satellites');
  },

  async searchSatellites(query: string): Promise<SatelliteInfo[]> {
    return request<SatelliteInfo[]>(`/api/v1/satellites/search?q=${encodeURIComponent(query)}`);
  },

  async getPrediction(): Promise<SatellitePass | null> {
    return request<SatellitePass | null>('/api/v1/prediction');
  },

  // JARVIS AI Flight Director & Voice Assistant
  async getJarvisStatus(): Promise<{ online: boolean; tools: string[]; details?: any }> {
    return request<{ online: boolean; tools: string[]; details?: any }>('/api/v1/jarvis/status');
  },

  async getJarvisVoiceStatus(): Promise<{
    available: boolean;
    stt: { available: boolean; backend: string; formats?: string[]; reason?: string };
    tts: { available: boolean; backend: string; voice_id?: string; speed?: number; reason?: string };
  }> {
    return request<any>('/api/v1/jarvis/voice/status');
  },

  async sendJarvisMessage(message: string, sessionId = 'web-session', history: Array<{ role: string; content: string }> = []): Promise<{
    reply: string;
    toolCall?: { name: string; arguments: Record<string, any> } | null;
    toolResult?: any;
    toolSummary?: string | null;
    online: boolean;
    sessionId: string;
    source: string;
  }> {
    return request<any>('/api/v1/jarvis/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId, history })
    });
  },

  async transcribeAudio(audioBlob: Blob, language = 'en-US'): Promise<{
    text: string;
    language: string;
    confidence: number;
    duration: number;
  }> {
    const url = `${BASE_URL}/api/v1/jarvis/voice/transcribe`;
    const token = getStoredAuthToken();
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('language', language);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Audio transcription failed');
    }
    return data.data;
  },

  async synthesizeSpeech(text: string, voice = 'en-GB-RyanNeural', speed = 1.0): Promise<Blob> {
    const url = `${BASE_URL}/api/v1/jarvis/voice/synthesize`;
    const token = getStoredAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voice, speed })
    });

    if (!res.ok) {
      throw new Error(`Speech synthesis failed: HTTP ${res.status}`);
    }
    return await res.blob();
  }
};

