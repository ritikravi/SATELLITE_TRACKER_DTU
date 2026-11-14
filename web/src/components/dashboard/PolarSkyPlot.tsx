'use client';

import React from 'react';
import { AngleCoordinates } from '@shared/types/tracker';

interface PolarSkyPlotProps {
  current: AngleCoordinates;
  target: AngleCoordinates;
  satelliteName?: string | null;
  state: string;
  isVisible?: boolean;
  minElevationMask?: number;
}

function PolarSkyPlotComponent({
  current,
  target,
  satelliteName,
  state,
  isVisible,
  minElevationMask = 10
}: PolarSkyPlotProps) {
  const size = 320;
  const center = size / 2;
  const maxRadius = center - 28; // Margin for labels

  // Convert (Azimuth, Elevation) to 2D coordinates
  // Azimuth 0 = North (Up), 90 = East (Right), 180 = South (Down), 270 = West (Left)
  // Elevation 90 = Center (Straight Up), Elevation 0 = Outer Ring (Horizon)
  const toXY = (az: number, el: number) => {
    const clampedEl = Math.max(0, Math.min(90, el));
    const r = maxRadius * (1 - clampedEl / 90.0);
    const azRad = (az - 90) * (Math.PI / 180.0);
    const x = center + r * Math.cos(azRad);
    const y = center + r * Math.sin(azRad);
    return { x, y };
  };

  const currentPos = toXY(current.azimuth, current.elevation);
  const targetPos = toXY(target.azimuth, target.elevation);
  const maskRadius = maxRadius * (1 - minElevationMask / 90.0);

  const satelliteVisible = isVisible ?? (target.elevation >= minElevationMask);

  return (
    <div className="flex flex-col items-center bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
      <div className="w-full flex items-center justify-between mb-3 text-xs">
        <span className="text-white font-bold text-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Sky Map
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
            satelliteVisible
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}>
            {satelliteVisible ? '● Satellite in Sky' : '○ Below Horizon'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            Center = 90° Up
          </span>
        </div>
      </div>

      <div className="relative">
        <svg width={size} height={size} className="select-none overflow-visible">
          {/* Subtle Background Glow */}
          <defs>
            <radialGradient id="skyGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={center} cy={center} r={maxRadius} fill="url(#skyGlow)" />

          {/* Elevation Concentric Circles (0° Horizon, 30°, 60°) */}
          {[0, 30, 60].map((el) => {
            const r = maxRadius * (1 - el / 90.0);
            return (
              <g key={el}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray={el === 0 ? 'none' : '3 3'}
                />
                <text
                  x={center + 4}
                  y={center - r + 11}
                  fill="#64748b"
                  fontSize="10"
                >
                  {el === 0 ? 'Horizon' : `${el}°`}
                </text>
              </g>
            );
          })}

          {/* 10° Minimum Elevation Mask Ring (Dashed Amber line) */}
          <circle
            cx={center}
            cy={center}
            r={maskRadius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.6"
          />
          <text
            x={center + 4}
            y={center - maskRadius + 11}
            fill="#d97706"
            fontSize="9"
            fontWeight="bold"
          >
            {minElevationMask}° Mask
          </text>

          {/* Crosshair Guides */}
          <line x1={center} y1={center - maxRadius} x2={center} y2={center + maxRadius} stroke="#1e293b" strokeWidth="1.5" />
          <line x1={center - maxRadius} y1={center} x2={center + maxRadius} y2={center} stroke="#1e293b" strokeWidth="1.5" />

          {/* Cardinal Direction Labels with safe padding */}
          <text x={center} y={center - maxRadius - 14} fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">North</text>
          <text x={center + maxRadius + 20} y={center + 4} fill="#94a3b8" fontSize="12" textAnchor="middle">East</text>
          <text x={center} y={center + maxRadius + 20} fill="#94a3b8" fontSize="12" textAnchor="middle">South</text>
          <text x={center - maxRadius - 20} y={center + 4} fill="#94a3b8" fontSize="12" textAnchor="middle">West</text>

          {/* Line Connecting Antenna Aim to Target Satellite */}
          <line
            x1={currentPos.x}
            y1={currentPos.y}
            x2={targetPos.x}
            y2={targetPos.y}
            stroke={satelliteVisible ? '#f59e0b' : '#64748b'}
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity={satelliteVisible ? 0.8 : 0.4}
          />

          {/* Target Satellite Marker */}
          <g transform={`translate(${targetPos.x}, ${targetPos.y})`}>
            <circle
              r={satelliteVisible ? '8' : '6'}
              fill={satelliteVisible ? '#f59e0b' : '#475569'}
              fillOpacity={satelliteVisible ? 0.3 : 0.2}
              stroke={satelliteVisible ? '#f59e0b' : '#94a3b8'}
              strokeWidth="1.5"
            />
            <circle r="2.5" fill={satelliteVisible ? '#f59e0b' : '#94a3b8'} />
            <text
              x="12"
              y="3"
              fill={satelliteVisible ? '#fbbf24' : '#94a3b8'}
              fontSize="11"
              fontWeight="bold"
            >
              {satelliteName ? satelliteName.split(' ')[0] : 'Satellite'}
              {!satelliteVisible ? ' (below 10°)' : ''}
            </text>
          </g>

          {/* Current Antenna Aim Marker (Crosshair showing where antenna is pointed) */}
          <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
            <circle r="12" fill="#06b6d4" fillOpacity="0.15" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="0" y1="-7" x2="0" y2="7" stroke="#38bdf8" strokeWidth="1.5" />
            <circle r="3" fill="#38bdf8" />
            {/* Position label below crosshair if near top to avoid overlapping 'North' */}
            <g transform={currentPos.y < center - maxRadius + 30 ? "translate(0, 22)" : "translate(0, -16)"}>
              <rect x="-16" y="-9" width="32" height="15" rx="4" fill="#020617" fillOpacity="0.85" stroke="#0284c7" strokeWidth="0.8" />
              <text x="0" y="2" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
                Aim
              </text>
            </g>
          </g>
        </svg>
      </div>

      <div className="w-full flex items-center justify-between mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-cyan-400" />
          <span>Antenna: <strong className="text-white">{current.azimuth.toFixed(0)}° / {current.elevation.toFixed(0)}°</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${satelliteVisible ? 'bg-amber-400' : 'bg-slate-500'}`} />
          <span>Satellite: <strong className={satelliteVisible ? 'text-amber-300' : 'text-slate-400'}>
            {target.azimuth.toFixed(0)}° / {target.elevation.toFixed(0)}°
          </strong></span>
        </div>
      </div>
    </div>
  );
}

export const PolarSkyPlot = React.memo(PolarSkyPlotComponent);
