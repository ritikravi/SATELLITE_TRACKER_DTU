'use client';

import React, { useState } from 'react';
import { useTracker } from '@/context/TrackerContext';
import { SatelliteSelector } from '@/components/control/SatelliteSelector';
import { ManualMoveCard } from '@/components/control/ManualMoveCard';
import { HomingCard } from '@/components/control/HomingCard';
import {
  Radio,
  Lock,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  Activity,
  X,
  Compass,
  Check
} from '@/components/ui/icons';

export default function ControlPage() {
  const { connectionStatus, authToken, setTokenModalOpen, status } = useTracker();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isOffline = connectionStatus !== 'connected';
  const isUnauthenticated = !authToken;
  const isMoving = status?.state === 'SLEWING' || status?.state === 'HOMING';
  const isTracking = status?.state === 'TRACKING';
  const isHomed = status?.homed;

  const isDisabled = isOffline || isUnauthenticated || isMoving;

  let disabledReason: string | undefined;
  if (isOffline) {
    disabledReason = 'Tracker offline. Connect your tracker to the network to enable controls.';
  } else if (isUnauthenticated) {
    disabledReason = 'Motor control is locked for safety. Please enter password token.';
  } else if (isMoving) {
    disabledReason = `Antenna is currently ${status?.state === 'HOMING' ? 'calibrating limits' : 'moving'}. Please wait.`;
  }

  const handleError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
  };

  const handleSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-sky-600">
              <Radio className="w-5 h-5" />
            </div>
            Antenna Control Station
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Autonomous orbit tracking, constellation mission selection, and manual axis positioning.
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Connection */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                !isOffline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="font-semibold">{!isOffline ? 'Connected' : 'Offline'}</span>
          </div>

          {/* Mount State */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            <span className="text-slate-400 font-medium">State:</span>
            <strong className="text-slate-900 font-bold">
              {isTracking ? 'Tracking' : status?.state === 'SLEWING' ? 'Moving' : status?.state === 'HOMING' ? 'Calibrating' : 'Ready'}
            </strong>
          </div>

          {/* Limit switches */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            {isHomed ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                <span className="font-semibold text-emerald-700">0° Calibrated</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-amber-700">Not Calibrated</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unauthenticated Security Banner (only when connected but locked) */}
      {!isOffline && isUnauthenticated && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong className="font-bold text-amber-950 block">Motor Controls Locked for Safety</strong>
              <span className="text-xs text-amber-800">
                Enter your password token to authenticate and activate motor movement controls.
              </span>
            </div>
          </div>

          <button
            onClick={() => setTokenModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            Enter Password Token
          </button>
        </div>
      )}

      {/* Runtime Action Error Alert (only upon action failures) */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <strong className="font-bold text-rose-950 block">Command Notice</strong>
              <span className="text-xs">{errorMessage}</span>
            </div>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-600 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium text-xs sm:text-sm">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Mission Tracking & Satellite Target Selection */}
        <div className="lg:col-span-6 space-y-6">
          <HomingCard
            disabled={isDisabled}
            disabledReason={disabledReason}
            onError={handleError}
            onSuccess={handleSuccess}
          />

          <SatelliteSelector
            disabled={isDisabled}
            disabledReason={disabledReason}
            onError={handleError}
            onSuccess={handleSuccess}
          />
        </div>

        {/* Right Column: Manual Axis Positioning & Motor Calibration */}
        <div className="lg:col-span-6 space-y-6">
          <ManualMoveCard
            disabled={isDisabled}
            disabledReason={disabledReason}
            onError={handleError}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </div>
  );
}