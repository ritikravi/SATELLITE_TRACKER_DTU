'use client';

import React, { useState } from 'react';
import { TelemetryData, TrackerStatus } from '@shared/types/tracker';
import { useTracker } from '@/context/TrackerContext';
import {
  Compass,
  Radio,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  WifiOff
} from '@/components/ui/icons';

interface TelemetryGaugesProps {
  telemetry: TelemetryData | null;
  status: TrackerStatus | null;
}

export function TelemetryGauges({ telemetry, status }: TelemetryGaugesProps) {
  const { syncTime, connectionStatus } = useTracker();
  const [showDetails, setShowDetails] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const isConnected = connectionStatus === 'connected';
  const errorDeg = telemetry?.trackingErrorDeg ?? null;
  const pitch = isConnected ? (telemetry?.imu.pitch ?? status?.imu.pitch ?? 0) : null;
  const isLevel = isConnected ? (telemetry?.imu.isLevel ?? status?.imu.isLevel ?? true) : null;
  const timeSync = isConnected ? (status?.timeSync ?? 'SYNCED') : null;

  const handleSyncTime = async () => {
    if (!isConnected) {
      alert('Cannot sync time: Tracker hardware is offline.');
      return;
    }
    setIsSyncing(true);
    setSyncMsg(null);
    try {
      await syncTime('NTP_SYNC');
      setSyncMsg('Clock updated successfully');
      setTimeout(() => setSyncMsg(null), 3500);
    } catch (e: any) {
      setSyncMsg(e.message || 'Clock update failed');
      setTimeout(() => setSyncMsg(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="pt-2">
      {/* Show Details Toggle Button */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
        >
          {showDetails ? (
            <>
              <span>Hide hardware diagnostics</span>
              <ChevronUp className="w-4 h-4 text-slate-400" />
            </>
          ) : (
            <>
              <span>Show hardware diagnostics (IMU stand level, time sync, pointing accuracy)</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </>
          )}
        </button>
      </div>

      {/* Collapsed Details Section */}
      {showDetails && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {/* Is the stand level? */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500">Is the stand level?</div>
            <div className="flex items-center gap-2 pt-0.5">
              {!isConnected ? (
                <>
                  <WifiOff className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-bold text-slate-500">— (Offline)</span>
                </>
              ) : isLevel ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-800">Yes, stand is level</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-700">Slightly tilted</span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {isConnected && pitch !== null
                ? `Internal IMU sensor tilt: (${Math.abs(pitch).toFixed(1)}°).`
                : 'Sensor telemetry unavailable while offline.'}
            </p>
          </div>

          {/* Aim accuracy */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500">Pointing Error</div>
            <div className="flex items-center gap-2 pt-0.5">
              {!isConnected || errorDeg === null ? (
                <>
                  <WifiOff className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-bold text-slate-500">— (Offline)</span>
                </>
              ) : (
                <span className={`text-base font-bold ${errorDeg <= 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {errorDeg <= 1 ? 'Aim is directly on target' : `Off by ${errorDeg.toFixed(1)}°`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {isConnected
                ? 'Antenna beam covers up to 10°, so small differences do not hurt reception.'
                : 'Connect tracker hardware to measure beam alignment.'}
            </p>
          </div>

          {/* Internal clock */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Internal Clock</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                !isConnected
                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {!isConnected ? 'Offline' : timeSync === 'SYNCED' ? 'On Time' : timeSync}
              </span>
            </div>
            <button
              onClick={handleSyncTime}
              disabled={isSyncing || !isConnected}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Updating clock...' : 'Update clock'}</span>
            </button>
            {syncMsg && <div className="text-[11px] text-sky-600 font-medium text-center">{syncMsg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}