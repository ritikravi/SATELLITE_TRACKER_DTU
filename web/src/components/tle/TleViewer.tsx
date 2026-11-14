'use client';

import React, { useState } from 'react';
import { TleData } from '@shared/types/tracker';
import { validateTle } from '@/lib/tle-validator';
import { useTracker } from '@/context/TrackerContext';
import { Satellite, CheckCircle, Check, Copy, Compass } from '@/components/ui/icons';

interface TleViewerProps {
  tle: TleData | null;
  loading: boolean;
}

export function TleViewer({ tle, loading }: TleViewerProps) {
  const { status, telemetry } = useTracker();
  const [copied, setCopied] = useState(false);

  if (loading || !tle) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-16 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-12 bg-slate-100 rounded" />
          <div className="h-12 bg-slate-100 rounded" />
          <div className="h-12 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  const parsed = validateTle(tle.satelliteName, tle.line1, tle.line2);
  const elements = parsed.extracted;

  const handleCopyTle = () => {
    const fullText = `${tle.satelliteName}\n${tle.line1}\n${tle.line2}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const periodMinutes = elements?.meanMotionRevsDay
    ? (1440 / elements.meanMotionRevsDay).toFixed(1)
    : null;

  const satPos = telemetry?.satellitePosition || status?.satellitePosition;
  const isVisible = telemetry?.isVisible ?? status?.isVisible ?? false;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
            <Satellite className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active Satellite Orbit
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{tle.satelliteName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-normal">
                NORAD #{tle.noradId}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>CelesTrak Verified</span>
          </span>
          <span className="px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold shadow-2xs">
            {tle.source || 'CELESTRAK'}
          </span>
        </div>
      </div>

      {/* Live Look Angles & Sub-Satellite Position */}
      {satPos && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
            <span className="flex items-center gap-1.5 text-sky-700">
              <Compass className="w-4 h-4 text-sky-600" />
              <span>Real-Time Sub-Satellite Position & Ground Aim</span>
            </span>
            <span className={isVisible ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
              {isVisible ? '● In Sky (Above 10° Mask)' : '○ Below Horizon'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[10px] block">Latitude</span>
              <strong className="text-slate-800 text-sm">{satPos.latitude.toFixed(2)}°</strong>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[10px] block">Longitude</span>
              <strong className="text-slate-800 text-sm">{satPos.longitude.toFixed(2)}°</strong>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[10px] block">Altitude</span>
              <strong className="text-sky-700 text-sm">{Math.round(satPos.altitudeKm)} km</strong>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[10px] block">Aim Azimuth</span>
              <strong className="text-slate-800 text-sm">{(telemetry?.targetAngles?.azimuth ?? 0).toFixed(1)}°</strong>
            </div>
            <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <span className="text-slate-400 text-[10px] block">Aim Elevation</span>
              <strong className="text-slate-800 text-sm">{(telemetry?.targetAngles?.elevation ?? 0).toFixed(1)}°</strong>
            </div>
          </div>
        </div>
      )}

      {/* Raw TLE Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Official Two-Line Element (TLE) Format:</span>
          <button
            onClick={handleCopyTle}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy TLE</span>
              </>
            )}
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs sm:text-sm text-slate-800 leading-relaxed overflow-x-auto select-all shadow-2xs">
          <div className="text-sky-700 font-bold mb-1">{tle.satelliteName}</div>
          <div className="text-slate-700 tracking-wide">{tle.line1}</div>
          <div className="text-slate-700 tracking-wide">{tle.line2}</div>
        </div>
      </div>

      {/* Keplerian Orbital Parameters Grid */}
      {elements && (
        <div className="space-y-2.5 pt-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Extracted Keplerian Orbital Parameters
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Inclination</span>
              <strong className="text-base font-bold text-slate-900">{elements.inclinationDeg.toFixed(2)}°</strong>
              <span className="text-[10px] text-slate-400 block">Angle to equator</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Eccentricity</span>
              <strong className="text-base font-bold text-slate-900">{elements.eccentricity.toFixed(5)}</strong>
              <span className="text-[10px] text-slate-400 block">{elements.eccentricity < 0.01 ? 'Circular orbit' : 'Elliptical orbit'}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Mean Motion</span>
              <strong className="text-base font-bold text-slate-900">{elements.meanMotionRevsDay.toFixed(2)}</strong>
              <span className="text-[10px] text-slate-400 block">revs / day</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Orbital Period</span>
              <strong className="text-base font-bold text-sky-700">{periodMinutes || '---'} min</strong>
              <span className="text-[10px] text-slate-400 block">Time for 1 orbit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
