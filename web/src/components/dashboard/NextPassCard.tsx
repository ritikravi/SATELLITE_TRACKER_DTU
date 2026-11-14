'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SatellitePass } from '@shared/types/tracker';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import {
  Satellite,
  Play,
  Pause,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle
} from '@/components/ui/icons';

function NextPassCardComponent() {
  const { status, telemetry, refreshStatus, setTokenModalOpen, authToken } = useTracker();
  const [pass, setPass] = useState<SatellitePass | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackingActionLoading, setTrackingActionLoading] = useState(false);

  const satName = status?.satelliteName || telemetry?.satelliteName || 'METEOR-M2 4';
  const isTracking = (telemetry?.state ?? status?.state) === 'TRACKING';
  const isVisible = telemetry?.isVisible ?? status?.isVisible ?? false;

  useEffect(() => {
    let isMounted = true;
    async function loadPass() {
      try {
        setLoading(true);
        const data = await trackerApi.getPrediction();
        if (isMounted) setPass(data);
      } catch (err) {
        if (isMounted) setPass(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPass();
    const interval = setInterval(loadPass, 30000); // Re-check prediction every 30s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [status?.satelliteName, status?.noradId]);

  const toggleTracking = async () => {
    if (!authToken) {
      setTokenModalOpen(true);
      return;
    }

    setTrackingActionLoading(true);
    try {
      const nextAction = isTracking ? 'STOP' : 'START';
      await trackerApi.setTracking(nextAction);
      await refreshStatus();
    } catch (err: any) {
      alert(`Could not ${isTracking ? 'stop' : 'start'} tracking: ${err.message}`);
    } finally {
      setTrackingActionLoading(false);
    }
  };

  // Format countdown or active time
  const getPassTimeDescription = () => {
    if (!pass) return 'No visible pass found in next 48h';
    const now = Date.now();
    const aosTime = new Date(pass.aos).getTime();
    const losTime = new Date(pass.los).getTime();

    if (now >= aosTime && now <= losTime) {
      const minsLeft = Math.max(1, Math.round((losTime - now) / 60000));
      return `Active now! Ends in ~${minsLeft} min`;
    }

    if (now < aosTime) {
      const minsUntil = Math.round((aosTime - now) / 60000);
      if (minsUntil < 60) {
        return `Starts in ${minsUntil} min`;
      }
      const hoursUntil = (minsUntil / 60).toFixed(1);
      return `Starts in ~${hoursUntil} hours`;
    }

    return 'Pass completed';
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Satellite className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Satellite</div>
              <h3 className="text-lg font-bold text-white truncate" title={satName}>
                {satName}
              </h3>
            </div>
          </div>

          <Link
            href="/control"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <span>Change</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Live Sky Visibility Pill */}
        <div className="mb-3">
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            isVisible
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-300'
          }`}>
            <div className="flex items-center gap-2 text-xs font-semibold">
              {isVisible ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Visible in your sky (Above 10° mask)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Below horizon / elevation mask (&lt; 10°)</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {isVisible ? 'High signal' : 'Waiting for rise'}
            </span>
          </div>
        </div>

        {/* Next Pass Information */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-4 h-4 text-cyan-400" /> Next Pass Window:
            </span>
            <span className="text-cyan-300 font-bold text-xs sm:text-sm">
              {loading ? (
                'Calculating...'
              ) : pass ? (
                `${new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(pass.los).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              ) : (
                'No visible pass'
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span className="text-slate-400">Status & Timing:</span>
            <span className="font-semibold text-emerald-400">
              {loading ? '...' : getPassTimeDescription()}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300 text-xs">
            <span className="text-slate-400">Peak Angle (Max Elevation):</span>
            <span className="font-semibold text-white">
              {pass ? `${pass.maxElevation.toFixed(0)}° above horizon` : '---'}
            </span>
          </div>

          {pass && (
            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-900">
              <span>Pass Duration:</span>
              <span className="text-slate-300">
                {Math.round(pass.durationSeconds / 60)} minutes
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Big Button: Start / Stop Tracking */}
      <button
        onClick={toggleTracking}
        disabled={trackingActionLoading}
        className={`w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-base font-bold transition-all shadow-lg cursor-pointer ${
          isTracking
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
        }`}
      >
        {isTracking ? (
          <>
            <Pause className="w-5 h-5 fill-slate-950" />
            <span>{trackingActionLoading ? 'Stopping...' : 'Stop Tracking'}</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5 fill-slate-950" />
            <span>{trackingActionLoading ? 'Starting...' : 'Start Tracking'}</span>
          </>
        )}
      </button>
    </div>
  );
}

export const NextPassCard = React.memo(NextPassCardComponent);
