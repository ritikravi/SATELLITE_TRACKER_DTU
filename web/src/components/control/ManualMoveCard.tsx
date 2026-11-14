'use client';

import React, { useState } from 'react';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import {
  Compass,
  Radio,
  Sliders,
  AlertTriangle,
  Navigation
} from '@/components/ui/icons';
import { ConfirmModal } from './ConfirmModal';

interface ManualMoveCardProps {
  disabled: boolean;
  disabledReason?: string;
  onError: (err: string) => void;
  onSuccess: (msg: string) => void;
}

export function ManualMoveCard({ disabled, disabledReason, onError, onSuccess }: ManualMoveCardProps) {
  const { status, telemetry, refreshStatus, connectionStatus } = useTracker();
  const isConnected = connectionStatus === 'connected';

  const curAz = isConnected
    ? (telemetry?.currentAngles.azimuth ?? status?.currentAngles.azimuth ?? 0)
    : null;
  const curEl = isConnected
    ? (telemetry?.currentAngles.elevation ?? status?.currentAngles.elevation ?? 0)
    : null;

  const [targetAz, setTargetAz] = useState<number>(180);
  const [targetEl, setTargetEl] = useState<number>(45);
  const [speed, setSpeed] = useState<number>(2.5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Large Move Confirmation Dialog state (>30°)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const calculateDelta = (az: number, el: number) => {
    const baseAz = curAz ?? 0;
    const baseEl = curEl ?? 0;
    const dAz = Math.abs(az - baseAz);
    const dEl = Math.abs(el - baseEl);
    return Math.sqrt(dAz * dAz + dEl * dEl);
  };

  const handleExecuteMove = async () => {
    setIsSubmitting(true);
    try {
      await trackerApi.move({
        azimuth: targetAz,
        elevation: targetEl,
        speedDegS: speed
      });
      await refreshStatus();
      onSuccess(`Moving antenna to Azimuth: ${targetAz.toFixed(0)}°, Elevation: ${targetEl.toFixed(0)}°`);
    } catch (err: any) {
      onError(`Could not move motors: ${err.message}. Check your token.`);
    } finally {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    if (targetAz < 0 || targetAz > 360) {
      onError('Azimuth angle must be between 0° and 360°');
      return;
    }
    if (targetEl < 0 || targetEl > 90) {
      onError('Elevation angle must be between 0° and 90°');
      return;
    }
    if (speed <= 0 || speed > 5.0) {
      onError('Speed must be between 0.5°/s and 5.0°/s to avoid motor stall');
      return;
    }

    const delta = calculateDelta(targetAz, targetEl);
    if (delta > 30.0) {
      setIsConfirmOpen(true);
    } else {
      handleExecuteMove();
    }
  };

  const adjustAz = (delta: number) => {
    setTargetAz((prev) => Math.min(360, Math.max(0, Math.round(prev + delta))));
  };

  const adjustEl = (delta: number) => {
    setTargetEl((prev) => Math.min(90, Math.max(0, Math.round(prev + delta))));
  };

  const currentDelta = calculateDelta(targetAz, targetEl);

  return (
    <>
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Manual Positioning</h2>
              <p className="text-xs text-slate-500">Direct dual-axis stepper motor aiming</p>
            </div>
          </div>

          {/* Current Angles readout */}
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Current Angles</span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {isConnected && curAz !== null && curEl !== null
                ? `Az ${curAz.toFixed(1)}° / El ${curEl.toFixed(1)}°`
                : '— / —'}
            </span>
          </div>
        </div>

        <form onSubmit={onSubmitForm} className="space-y-5">
          {/* 1. Azimuth (Pan / Yaw) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-600" />
                Azimuth / Yaw (0° &ndash; 360°)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-sky-600 font-mono px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200">
                  {targetAz}°
                </span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={targetAz}
              onChange={(e) => setTargetAz(Number(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50"
            />

            {/* Steppers & Presets */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
              <div className="flex items-center gap-1">
                {[
                  { label: 'N (0°)', az: 0 },
                  { label: 'E (90°)', az: 90 },
                  { label: 'S (180°)', az: 180 },
                  { label: 'W (270°)', az: 270 }
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setTargetAz(p.az)}
                    disabled={disabled}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                      targetAz === p.az
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Fine nudge */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustAz(-10)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  -10°
                </button>
                <button
                  type="button"
                  onClick={() => adjustAz(-1)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  -1°
                </button>
                <button
                  type="button"
                  onClick={() => adjustAz(1)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  +1°
                </button>
                <button
                  type="button"
                  onClick={() => adjustAz(10)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  +10°
                </button>
              </div>
            </div>
          </div>

          {/* 2. Elevation (Tilt / Pitch) */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-600" />
                Elevation / Tilt (0° &ndash; 90°)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-emerald-600 font-mono px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                  {targetEl}°
                </span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="90"
              step="1"
              value={targetEl}
              onChange={(e) => setTargetEl(Number(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
            />

            {/* Steppers & Presets */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
              <div className="flex items-center gap-1">
                {[
                  { label: 'Park (0°)', el: 0 },
                  { label: '30°', el: 30 },
                  { label: '45°', el: 45 },
                  { label: 'Zenith (90°)', el: 90 }
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setTargetEl(p.el)}
                    disabled={disabled}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                      targetEl === p.el
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Fine nudge */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustEl(-5)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  -5°
                </button>
                <button
                  type="button"
                  onClick={() => adjustEl(-1)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  -1°
                </button>
                <button
                  type="button"
                  onClick={() => adjustEl(1)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  +1°
                </button>
                <button
                  type="button"
                  onClick={() => adjustEl(5)}
                  disabled={disabled}
                  className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600"
                >
                  +5°
                </button>
              </div>
            </div>
          </div>

          {/* Slew Speed & Delta summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Slew Speed:</span>
              {[
                { label: '1.0°/s', val: 1.0 },
                { label: '2.5°/s', val: 2.5 },
                { label: '4.0°/s', val: 4.0 }
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSpeed(s.val)}
                  disabled={disabled}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border transition-colors ${
                    speed === s.val
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {isConnected && (
              <span className="text-slate-500 font-mono text-[11px]">
                Travel Delta: &Delta;{currentDelta.toFixed(0)}°
              </span>
            )}
          </div>

          {/* Large Move Warning Badge */}
          {currentDelta > 30.0 && isConnected && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Large angle change (&Delta;{currentDelta.toFixed(0)}°): Confirmation required before moving.</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={disabled || isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-sm transition-all shadow-sm shadow-sky-500/20 cursor-pointer disabled:cursor-not-allowed"
          >
            <Navigation className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Sending move command...'
                : `Drive Antenna to Az ${targetAz}°, El ${targetEl}°`}
            </span>
          </button>
        </form>
      </div>

      {/* Confirmation Dialog for Moves > 30 Degrees */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Confirm Large Antenna Move"
        message={`The antenna will rotate by approximately ${currentDelta.toFixed(0)}° to Azimuth ${targetAz}° and Elevation ${targetEl}°. Confirm your RF cables are clear and unobstructed.`}
        confirmLabel="Yes, Move Motors"
        variant="warning"
        onConfirm={handleExecuteMove}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}