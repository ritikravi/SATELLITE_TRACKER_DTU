'use client';

import React from 'react';
import Link from 'next/link';
import { SatellitePass } from '@shared/types/tracker';
import { Calendar, Satellite, List, WifiOff } from '@/components/ui/icons';

interface NextPassDetailsCardProps {
  pass: SatellitePass | null;
  loading?: boolean;
  isConnected: boolean;
  onViewAll?: () => void;
}

export function NextPassDetailsCard({ pass, loading, isConnected, onViewAll }: NextPassDetailsCardProps) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
            <Calendar className="w-5 h-5" />
          </div>
          <h2 className="font-bold text-slate-900 text-base">Next Pass</h2>
        </div>

        {!isConnected && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Offline
          </span>
        )}
      </div>

      {/* Main Center Content */}
      <div className="flex flex-col items-center justify-center text-center my-auto py-4 px-2 space-y-3">
        {/* Soft Circular Icon Container */}
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          {!isConnected ? <WifiOff className="w-7 h-7 text-slate-400" /> : <Satellite className="w-7 h-7 text-slate-500" />}
        </div>

        {/* Heading */}
        <div className="space-y-1 max-w-[280px]">
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {!isConnected ? (
              'Tracker Offline'
            ) : loading ? (
              'Calculating upcoming pass...'
            ) : pass && pass.maxElevation > 0 ? (
              `Pass on ${new Date(pass.aos).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC`
            ) : (
              'No visible pass in next 48 hours'
            )}
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed">
            {!isConnected ? (
              'Connect your tracker hardware or local server to calculate satellite passes and visibility windows.'
            ) : loading ? (
              'Retrieving orbital elements and computing look angles...'
            ) : pass && pass.maxElevation > 0 ? (
              `Satellite will reach peak elevation of ${pass.maxElevation.toFixed(0)}° above the horizon with ~${Math.round(pass.durationSeconds / 60)} min duration.`
            ) : (
              'The satellite will not rise above 10° elevation from your location in the next 48 hours.'
            )}
          </p>
        </div>

        {/* Button: View All Passes */}
        <div className="pt-2">
          {onViewAll ? (
            <button
              onClick={onViewAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <List className="w-4 h-4 text-sky-600" />
              <span>View All Passes</span>
            </button>
          ) : (
            <Link
              href="/control"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <List className="w-4 h-4 text-sky-600" />
              <span>View All Passes</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
