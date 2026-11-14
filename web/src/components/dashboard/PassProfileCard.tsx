'use client';

import React, { useState } from 'react';
import { SatellitePass } from '@shared/types/tracker';
import { TrendingUp, Info, Calendar, WifiOff, Clock } from '@/components/ui/icons';

interface PassProfileCardProps {
  pass: SatellitePass | null;
  loading?: boolean;
  isConnected: boolean;
}

export function PassProfileCard({ pass, loading, isConnected }: PassProfileCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const width = 820;
  const height = 190;
  const paddingLeft = 44;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 24;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Y-axis levels: 90, 60, 30, 0
  const yLevels = [90, 60, 30, 0];

  const getY = (el: number) => {
    return paddingTop + chartHeight * (1 - el / 90.0);
  };

  const hasRealPass = isConnected && pass && pass.maxElevation > 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">Pass Profile</h2>
            <p className="text-xs text-slate-500">Elevation trajectory over pass window</p>
          </div>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              aria-label="Info"
            >
              <Info className="w-4 h-4" />
            </button>
            {showTooltip && (
              <div className="absolute left-6 top-0 w-56 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl z-20 pointer-events-none leading-relaxed">
                Predicted elevation curve vs. UTC time during the upcoming satellite pass computed from SGP4 orbital propagation.
              </div>
            )}
          </div>
        </div>

        {!isConnected && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Offline
          </span>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full rounded-xl overflow-hidden my-auto py-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block select-none">
          <defs>
            <linearGradient id="passCurveGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="emptyArcGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Y Axis Label (Elevation) */}
          <text
            x={12}
            y={height / 2 - 5}
            transform={`rotate(-90, 12, ${height / 2 - 5})`}
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            Elevation (deg)
          </text>

          {/* Y Gridlines and Labels */}
          {yLevels.map((lvl) => {
            const y = getY(lvl);
            return (
              <g key={lvl}>
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  fill="#64748b"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {lvl}°
                </text>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Left Y-axis border line */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={paddingTop + chartHeight}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />

          {/* X Axis Label */}
          <text
            x={paddingLeft + chartWidth / 2}
            y={height - 8}
            fill="#64748b"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            Time (UTC)
          </text>

          {/* Pass data or Empty state */}
          {hasRealPass ? (
            <g>
              {(() => {
                const maxEl = Math.min(90, pass.maxElevation);
                const peakY = getY(maxEl);
                const baseY = getY(0);
                const startX = paddingLeft + chartWidth * 0.15;
                const endX = paddingLeft + chartWidth * 0.85;
                const midX = (startX + endX) / 2;

                const pathD = `M ${startX},${baseY} Q ${midX},${peakY} ${endX},${baseY}`;
                const areaD = `${pathD} L ${endX},${baseY} L ${startX},${baseY} Z`;

                const aosTime = new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const losTime = new Date(pass.los).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <>
                    <path d={areaD} fill="url(#passCurveGradient2)" />
                    <path d={pathD} fill="none" stroke="#0284c7" strokeWidth="2.5" />
                    
                    {/* AOS Guide line & label */}
                    <line x1={startX} y1={baseY} x2={startX} y2={baseY - 15} stroke="#0284c7" strokeWidth="1" strokeDasharray="2 2" />
                    <text x={startX} y={baseY + 14} fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">
                      {aosTime}
                    </text>

                    {/* LOS Guide line & label */}
                    <line x1={endX} y1={baseY} x2={endX} y2={baseY - 15} stroke="#0284c7" strokeWidth="1" strokeDasharray="2 2" />
                    <text x={endX} y={baseY + 14} fill="#64748b" fontSize="9" fontWeight="bold" textAnchor="middle">
                      {losTime}
                    </text>

                    {/* Peak Elevation Point */}
                    <circle cx={midX} cy={peakY} r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                    <g transform={`translate(${midX}, ${peakY - 10})`}>
                      <rect x="-24" y="-12" width="48" height="15" rx="4" fill="#0284c7" />
                      <text
                        x="0"
                        y="-1.5"
                        fill="#ffffff"
                        fontSize="9"
                        fontWeight="extrabold"
                        textAnchor="middle"
                      >
                        {maxEl.toFixed(0)}° Max
                      </text>
                    </g>
                  </>
                );
              })()}
            </g>
          ) : (
            <g>
              <path
                d={`M ${paddingLeft},${getY(0)} Q ${paddingLeft + chartWidth / 2},${getY(55)} ${width - paddingRight},${getY(0)}`}
                fill="url(#emptyArcGradient2)"
                stroke="#bae6fd"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Empty state overlay message */}
        {!hasRealPass && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 mb-1.5 shadow-2xs">
              {!isConnected ? <WifiOff className="w-5 h-5 text-slate-400" /> : <Calendar className="w-5 h-5 text-slate-500" />}
            </div>
            <div className="text-xs font-bold text-slate-800">
              {!isConnected ? 'Tracker Offline' : 'No visible pass in 48h'}
            </div>
            <div className="text-[11px] text-slate-500">
              {!isConnected ? 'Connect tracker to predict passes' : 'Satellite remains below 10° mask'}
            </div>
          </div>
        )}
      </div>

      {/* Pass Summary Details Bar */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
          <span className="text-[10px] text-slate-400 block font-medium uppercase">Peak Elevation</span>
          <span className="text-sm font-bold text-sky-700 font-mono">
            {hasRealPass ? `${pass.maxElevation.toFixed(0)}°` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
          <span className="text-[10px] text-slate-400 block font-medium uppercase">Duration</span>
          <span className="text-sm font-bold text-slate-800 font-mono">
            {hasRealPass ? `${Math.round(pass.durationSeconds / 60)} min` : '—'}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
          <span className="text-[10px] text-slate-400 block font-medium uppercase">AOS Time</span>
          <span className="text-sm font-bold text-slate-800 font-mono">
            {hasRealPass ? new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}