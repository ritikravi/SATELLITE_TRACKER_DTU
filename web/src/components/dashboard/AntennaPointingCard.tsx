'use client';

import React, { useState } from 'react';
import { AngleCoordinates } from '@shared/types/tracker';
import { Target, Info, Navigation } from '@/components/ui/icons';

interface AntennaPointingCardProps {
  current: AngleCoordinates | null;
  target?: AngleCoordinates | null;
  isConnected: boolean;
}

export function AntennaPointingCard({ current, target, isConnected }: AntennaPointingCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Only display real values if connected and current angles exist
  const hasAngles = isConnected && current !== null && current !== undefined;
  const azText = hasAngles ? `${current.azimuth.toFixed(1)}°` : '—';
  const elText = hasAngles ? `${current.elevation.toFixed(1)}°` : '—';

  // Helper for cardinal abbreviation
  const getCardinal = (az: number) => {
    const val = Math.floor((az / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16];
  };

  const cardinal = hasAngles ? getCardinal(current.azimuth) : '';

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight leading-none">Antenna Pointing</h2>
            <p className="text-[11px] text-slate-500">Dual-axis motor rotator attitude</p>
          </div>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              aria-label="Info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute left-6 top-0 w-52 p-2 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl z-20 pointer-events-none leading-relaxed">
                Real-time motor pointing angles and 3D physical rotator attitude representation.
              </div>
            )}
          </div>
        </div>

        {!isConnected ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Offline
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Pose
          </span>
        )}
      </div>

      {/* Top 2 Compact Stat Boxes */}
      <div className="grid grid-cols-2 gap-2 mb-1.5">
        {/* Azimuth Box */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2 sm:p-2.5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-100/80 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
            <Navigation className="w-3.5 h-3.5 -rotate-45" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              Azimuth {cardinal ? `(${cardinal})` : ''}
            </div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight font-mono">
              {azText}
            </div>
          </div>
        </div>

        {/* Elevation Box */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2 sm:p-2.5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-100/80 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16" />
              <path d="m4 20 12-12" />
              <path d="M12 20a8 8 0 0 0-4-7" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">Elevation</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight font-mono">
              {elText}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Antenna Dish Rotator & Overlays */}
      <div className="relative w-full h-[125px] flex items-center justify-center select-none overflow-hidden">
        <div className="relative w-[260px] h-[120px] flex items-center justify-center">
          {/* Compressed Antenna Dish (WebP with PNG fallback, 39KB) */}
          <div className="relative w-[125px] h-[105px] flex items-center justify-center">
            <picture>
              <source srcSet="/antenna-dish.webp" type="image/webp" />
              <img
                src="/antenna-dish.png"
                alt="Antenna Dish Rotator"
                width={125}
                height={105}
                className={`object-contain drop-shadow-sm select-none pointer-events-none transition-all duration-300 ${
                  hasAngles ? 'filter-none' : 'grayscale-[40%] contrast-90'
                }`}
                loading="eager"
              />
            </picture>
          </div>

          {/* SVG Overlay for Direction Indicators */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            viewBox="0 0 260 120"
          >
            {/* Azimuth Rotation Curved Arrow around base */}
            <path
              d="M 75,108 A 45,11 0 0,0 170,108"
              fill="none"
              stroke={hasAngles ? '#0284c7' : '#94a3b8'}
              strokeWidth="1.8"
              strokeDasharray={hasAngles ? 'none' : '3 3'}
            />
            {/* Arrowhead */}
            <polygon
              points="168,103 177,109 167,113"
              fill={hasAngles ? '#0284c7' : '#94a3b8'}
            />

            {/* Azimuth Readout Badge */}
            <g transform="translate(182, 109)">
              <rect
                x="0"
                y="-9"
                width="64"
                height="18"
                rx="5"
                fill={hasAngles ? '#f0f9ff' : '#f8fafc'}
                stroke={hasAngles ? '#bae6fd' : '#cbd5e1'}
                strokeWidth="1"
              />
              <text
                x="32"
                y="3.5"
                fill={hasAngles ? '#0284c7' : '#64748b'}
                fontSize="9"
                fontWeight="extrabold"
                textAnchor="middle"
              >
                Az {azText}
              </text>
            </g>

            {/* Elevation Angle Indicator Line to the Dish */}
            <line
              x1="172"
              y1="28"
              x2="172"
              y2="45"
              stroke={hasAngles ? '#0284c7' : '#94a3b8'}
              strokeWidth="1.2"
              strokeDasharray={hasAngles ? 'none' : '3 3'}
            />
            <line
              x1="172"
              y1="28"
              x2="182"
              y2="28"
              stroke={hasAngles ? '#0284c7' : '#94a3b8'}
              strokeWidth="1.2"
            />

            {/* Elevation Readout Badge */}
            <g transform="translate(184, 28)">
              <rect
                x="0"
                y="-9"
                width="60"
                height="18"
                rx="5"
                fill={hasAngles ? '#f0f9ff' : '#f8fafc'}
                stroke={hasAngles ? '#bae6fd' : '#cbd5e1'}
                strokeWidth="1"
              />
              <text
                x="30"
                y="3.5"
                fill={hasAngles ? '#0284c7' : '#64748b'}
                fontSize="9"
                fontWeight="extrabold"
                textAnchor="middle"
              >
                El {elText}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}