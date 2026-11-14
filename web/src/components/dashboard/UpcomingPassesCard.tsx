'use client';

import React from 'react';
import Link from 'next/link';
import { SatellitePass } from '@shared/types/tracker';
import { Calendar, List, Info, Clock, ExternalLink } from '@/components/ui/icons';

interface UpcomingPassesCardProps {
  pass: SatellitePass | null;
  loading?: boolean;
  isConnected: boolean;
}

export function UpcomingPassesCard({ pass, loading, isConnected }: UpcomingPassesCardProps) {
  const hasPass = isConnected && pass && pass.maxElevation > 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight leading-none">Pass Schedule</h2>
            <p className="text-[11px] text-slate-500">Upcoming visibility windows & look angles</p>
          </div>
        </div>

        {!isConnected ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Offline
          </span>
        ) : (
          <Link
            href="/tle"
            className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>TLE Ephemeris</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Next Pass Spotlight Banner */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 mb-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-sky-600" />
            Next Visibility Window
          </span>
          {hasPass && (
            <span className="px-1.5 py-0.5 rounded-full bg-sky-100/80 text-sky-700 font-extrabold text-[10px]">
              Peak {pass.maxElevation.toFixed(0)}°
            </span>
          )}
        </div>

        <div className="text-xs text-slate-600">
          {!isConnected ? (
            <p className="text-slate-500 text-[11px]">Connect tracker to compute look-angle ephemeris and pass schedule.</p>
          ) : loading ? (
            <p className="text-sky-600 font-medium text-[11px]">Computing SGP4 trajectory...</p>
          ) : hasPass ? (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div>
                <span className="font-extrabold text-slate-900 block text-xs">
                  {new Date(pass.aos).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                </span>
                <span className="text-[10px] text-slate-500">
                  Duration: ~{Math.round(pass.durationSeconds / 60)} min &bull; Peak: {pass.maxElevation.toFixed(0)}°
                </span>
              </div>
              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-2.5 shrink-0">
                <span className="text-[9px] text-slate-400 block uppercase font-medium">LOS</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {new Date(pass.los).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-[11px]">No pass above 10° elevation predicted in the next 48 hours.</p>
          )}
        </div>
      </div>

      {/* Passes Table */}
      <div className="w-full overflow-x-auto my-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
              <th className="py-1.5 px-2 w-6">#</th>
              <th className="py-1.5 px-2">AOS (UTC)</th>
              <th className="py-1.5 px-2">LOS (UTC)</th>
              <th className="py-1.5 px-2 text-center">Peak El.</th>
              <th className="py-1.5 px-2 text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium text-[11px]">
            {hasPass ? (
              <>
                <tr className="bg-sky-50/50 hover:bg-sky-50 transition-colors">
                  <td className="py-1.5 px-2 font-bold text-sky-700">1</td>
                  <td className="py-1.5 px-2 font-bold text-slate-900">
                    {new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">
                    {new Date(pass.los).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1.5 px-2 text-center font-extrabold text-sky-600">
                    {pass.maxElevation.toFixed(0)}°
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold text-slate-600">
                    {Math.round(pass.durationSeconds / 60)} min
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/80 transition-colors text-slate-400">
                  <td className="py-1.5 px-2 font-bold text-slate-500">2</td>
                  <td className="py-1.5 px-2">—</td>
                  <td className="py-1.5 px-2">—</td>
                  <td className="py-1.5 px-2 text-center">—</td>
                  <td className="py-1.5 px-2 text-right">—</td>
                </tr>
              </>
            ) : (
              [1, 2].map((rowNum) => (
                <tr key={rowNum} className="hover:bg-slate-50/80 transition-colors text-slate-400">
                  <td className="py-1.5 px-2 font-bold text-slate-500">{rowNum}</td>
                  <td className="py-1.5 px-2">—</td>
                  <td className="py-1.5 px-2">—</td>
                  <td className="py-1.5 px-2 text-center">—</td>
                  <td className="py-1.5 px-2 text-right">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom SGP4 Info Note */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-400 shrink-0" />
          <span>SGP4 propagator &bull; 10° horizon mask</span>
        </span>
        <span className="font-mono text-slate-400 text-[10px]">WGS-84</span>
      </div>
    </div>
  );
}