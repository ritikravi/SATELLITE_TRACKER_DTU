'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  TrackerStatus,
  TelemetryData,
  LeanTelemetryPacket,
  TimeSyncRequest,
  TimeSyncResponse
} from '@shared/types/tracker';
import { trackerApi, getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken } from '@/lib/api';
import { decodeTelemetryPacket, setCachedSatelliteName } from '@/lib/decoder';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

interface TrackerContextType {
  connectionStatus: ConnectionState;
  reconnectCountdown: number | null;
  reconnectNow: () => void;
  telemetry: TelemetryData | null;
  status: TrackerStatus | null;
  authToken: string | null;
  setAuthToken: (token: string) => void;
  clearAuthToken: () => void;
  isTokenModalOpen: boolean;
  setTokenModalOpen: (open: boolean) => void;
  refreshStatus: () => Promise<void>;
  syncTime: (action: TimeSyncRequest['action'], customTimestamp?: string) => Promise<TimeSyncResponse>;
  lastPacketTime: number | null;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

function getValidWsUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const envWs = process.env.NEXT_PUBLIC_TRACKER_WS_URL;
  if (envWs && envWs.trim() !== '') {
    if (envWs.includes('navic-tracker-live.trycloudflare.com')) return null;
    return envWs;
  }
  // On HTTPS (production Vercel), do not attempt ws://localhost (blocked by browser mixed-content)
  if (window.location.protocol === 'https:') {
    return null;
  }
  return 'ws://localhost:8080/ws';
}

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('connecting');
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [status, setStatus] = useState<TrackerStatus | null>(null);
  const [authToken, setAuthTokenState] = useState<string | null>(null);
  const [isTokenModalOpen, setTokenModalOpen] = useState(false);
  const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000); // Start at 1s backoff
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const lastPacketTimeRef = useRef<number>(0);

  // Initialize stored token on mount
  useEffect(() => {
    const saved = getStoredAuthToken();
    if (saved) {
      setAuthTokenState(saved);
    }
  }, []);

  const setAuthToken = useCallback((token: string) => {
    setStoredAuthToken(token);
    setAuthTokenState(token);
  }, []);

  const clearAuthToken = useCallback(() => {
    clearStoredAuthToken();
    setAuthTokenState(null);
  }, []);

  // Fetch full status
  const refreshStatus = useCallback(async () => {
    try {
      const data = await trackerApi.getStatus();
      setStatus(data);
      if (data.satelliteName) {
        setCachedSatelliteName(data.satelliteName);
      }
      // When WebSocket is not open (e.g. on serverless Vercel deployment), synthesize telemetry from HTTP
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setConnectionStatus('connected');
        setTelemetry({
          timestamp: Date.now(),
          state: data.state,
          homed: data.homed,
          currentAngles: data.currentAngles,
          targetAngles: data.targetAngles,
          trackingErrorDeg: Math.abs(data.targetAngles.azimuth - data.currentAngles.azimuth),
          satelliteName: data.satelliteName,
          satellitePosition: data.satellitePosition,
          isVisible: data.isVisible,
          imu: data.imu
        });
        lastPacketTimeRef.current = Date.now();
        setLastPacketTime(Date.now());
      }
    } catch {
      const hasRecentTelemetry = Date.now() - lastPacketTimeRef.current < 4000;
      if (!hasRecentTelemetry && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        setConnectionStatus('disconnected');
      }
    }
  }, []);

  // Time sync action
  const syncTime = useCallback(async (action: TimeSyncRequest['action'], customTimestamp?: string): Promise<TimeSyncResponse> => {
    const res = await trackerApi.syncTime({
      action,
      timestamp: customTimestamp || (action === 'MANUAL' ? new Date().toISOString() : undefined)
    });
    await refreshStatus();
    return res;
  }, [refreshStatus]);

  const cleanupSocket = useCallback(() => {
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch (e) {}
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setReconnectCountdown(null);
  }, []);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (isUnmountedRef.current) return;

    const wsUrl = getValidWsUrl();
    if (!wsUrl) {
      // In serverless / cloud mode without external WebSocket, rely directly on HTTP polling
      return;
    }

    // If socket is already OPEN or CONNECTING, do not reopen!
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearTimers();
    cleanupSocket();

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setConnectionStatus('connected');
        backoffRef.current = 1000; // Reset backoff
        clearTimers();
        refreshStatus();
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const packet: LeanTelemetryPacket = JSON.parse(event.data);
          const decoded = decodeTelemetryPacket(packet);
          setTelemetry(decoded);
          lastPacketTimeRef.current = Date.now();
          setLastPacketTime(Date.now());
        } catch (e) {
          console.error('Failed to parse telemetry packet:', e);
        }
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        const hasRecentTelemetry = Date.now() - lastPacketTimeRef.current < 4000;
        if (!hasRecentTelemetry) {
          setConnectionStatus('disconnected');
        }

        // Only schedule reconnect if not already scheduled
        if (!reconnectTimerRef.current) {
          const delay = Math.min(backoffRef.current, 10000);
          backoffRef.current = Math.min(delay * 1.5, 10000);

          let remainingSeconds = Math.ceil(delay / 1000);
          setReconnectCountdown(remainingSeconds);

          countdownTimerRef.current = setInterval(() => {
            remainingSeconds -= 1;
            if (remainingSeconds <= 0) {
              if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
              setReconnectCountdown(null);
            } else {
              setReconnectCountdown(remainingSeconds);
            }
          }, 1000);

          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectWs();
          }, delay);
        }
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        const hasRecentTelemetry = Date.now() - lastPacketTimeRef.current < 4000;
        if (!hasRecentTelemetry) {
          setConnectionStatus('disconnected');
        }
      };
    } catch (err) {
      if (isUnmountedRef.current) return;
      const hasRecentTelemetry = Date.now() - lastPacketTimeRef.current < 4000;
      if (!hasRecentTelemetry) {
        setConnectionStatus('disconnected');
      }
    }
  }, [clearTimers, cleanupSocket, refreshStatus]);

  const reconnectNow = useCallback(() => {
    backoffRef.current = 1000;
    clearTimers();
    cleanupSocket();
    connectWs();
  }, [clearTimers, cleanupSocket, connectWs]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connectWs();
    refreshStatus();

    // Poll status periodically (every 1.5 seconds) to keep telemetry live when WebSockets are unavailable (e.g. on Vercel)
    const statusInterval = setInterval(refreshStatus, 1500);

    return () => {
      isUnmountedRef.current = true;
      clearInterval(statusInterval);
      clearTimers();
      cleanupSocket();
    };
  }, [connectWs, refreshStatus, clearTimers, cleanupSocket]);

  const contextValue = useMemo<TrackerContextType>(() => ({
    connectionStatus,
    reconnectCountdown,
    reconnectNow,
    telemetry,
    status,
    authToken,
    setAuthToken,
    clearAuthToken,
    isTokenModalOpen,
    setTokenModalOpen,
    refreshStatus,
    syncTime,
    lastPacketTime
  }), [
    connectionStatus,
    reconnectCountdown,
    reconnectNow,
    telemetry,
    status,
    authToken,
    setAuthToken,
    clearAuthToken,
    isTokenModalOpen,
    refreshStatus,
    syncTime,
    lastPacketTime
  ]);

  return (
    <TrackerContext.Provider value={contextValue}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error('useTracker must be used within a TrackerProvider');
  }
  return context;
}

