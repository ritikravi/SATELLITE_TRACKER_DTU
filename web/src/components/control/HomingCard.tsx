'use client';

import React, { useState } from 'react';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import {
  HomeIcon,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Radio,
  Navigation
} from '@/components/ui/icons';
import { ConfirmModal } from './ConfirmModal';

interface HomingCardProps {
  disabled: boolean;
  disabledReason?: string;
  onError: (err: string) => void;
  onSuccess: (msg: string) => void;
}

export function HomingCard({ disabled, disabledReason, onError, onSuccess }: HomingCardProps) {
  const { status, telemetry, refreshStatus, connectionStatus } = useTracker();
  const [isConfirmHomeOpen, setIsConfirmHomeOpen] = useState(false);
  const [isHomingLoading, setIsHomingLoading] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  const isConnected = connectionStatus === 'connected';
  const isTracking = status?.state === 'TRACKING';
  const isHomed = status?.homed;
  const currentTarget = status?.satelliteName || telemetry?.satelliteName || 'METEOR-M2 4';

  const handleExecuteHome = async () => {
    setIsHomingLoading(true);
    try {
      const res = await trackerApi.home('ALL');
      await refreshStatus();
      onSuccess(res.message || 'Calibration sequence started. The mount is rotating to physical limit stops.');
    } catch (err: any) {
      onError(`Could not reset position: ${err.message}. Check your token.`);
    } finally {
      setIsHomingLoading(false);
      setIsConfirmHomeOpen(false);
    }
  };

  const handleStartTracking = async () => {
    setIsTrackingLoading(true);
    try {
      await trackerApi.setTracking('START');
      await refreshStatus();
      onSuccess(`Started autonomous tracking for ${currentTarget}!`);
    } catch (err: any) {
      onError(`Could not start tracking: ${err.message}`);
    } finally {
      setIsTrackingLoading(false);
    }
  };

  const handleStopTracking = async () => {
    setIsTrackingLoading(true);
    try {
      await trackerApi.setTracking('STOP');
      await refreshStatus();
      onSuccess('Tracking stopped. Antenna holding current coordinates.');
    } catch (err: any) {
      onError(`Could not stop tracking: ${err.message}`);
    } finally {
      setIsTrackingLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-600">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Tracking & Calibration</h2>
              <p className="text-xs text-slate-500">Autonomous orbit follower & limit homing</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                !isConnected
                  ? 'bg-slate-400'
                  : isTracking
                  ? 'bg-emerald-500 animate-pulse'
                  : status?.state === 'SLEWING'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-sky-500'
              }`}
            />
            <span>
              {!isConnected
                ? 'Offline'
                : isTracking
                ? 'Tracking'
                : status?.state === 'SLEWING'
                ? 'Moving'
                : status?.state === 'HOMING'
                ? 'Calibrating'
                : 'Ready'}
            </span>
          </div>
        </div>

        {/* Target & Calibration Status Chip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Target Satellite</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Radio className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-xs font-bold text-slate-900 truncate">
                {isConnected ? currentTarget : '— (Connect Tracker)'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Mount Calibration</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isHomed ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-700">Limit Switches Set (0° Ref)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-amber-700">Calibration Needed</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Start / Stop Tracking */}
          {isTracking ? (
            <button
              type="button"
              onClick={handleStopTracking}
              disabled={disabled || isTrackingLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm shadow-sm shadow-amber-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Pause className="w-4 h-4 fill-white" />
              <span>{isTrackingLoading ? 'Stopping...' : 'Stop Tracking'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTracking}
              disabled={disabled || isTrackingLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm shadow-sm shadow-sky-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isTrackingLoading ? 'Starting...' : 'Start Tracking'}</span>
            </button>
          )}

          {/* Reset Position (Calibrate) */}
          <button
            type="button"
            onClick={() => setIsConfirmHomeOpen(true)}
            disabled={disabled || isHomingLoading}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 font-bold text-sm border border-slate-200 shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <HomeIcon className="w-4 h-4 text-amber-500" />
            <span>{isHomingLoading ? 'Resetting...' : 'Calibrate Home (0°)'}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Calibrating moves azimuth and elevation axes to their limit switches to establish a hardware reference at 0° Azimuth and 0° Elevation.
        </p>
      </div>

      {/* Confirmation Dialog for Reset Position */}
      <ConfirmModal
        isOpen={isConfirmHomeOpen}
        title="Recalibrate Limit Switches?"
        message="This will slowly move both azimuth and elevation axes until they hit physical limit switches to re-synchronize 0° home coordinates. The tracker will pause any active tracking."
        confirmLabel="Yes, Calibrate Home"
        variant="warning"
        onConfirm={handleExecuteHome}
        onCancel={() => setIsConfirmHomeOpen(false)}
      />
    </>
  );
}