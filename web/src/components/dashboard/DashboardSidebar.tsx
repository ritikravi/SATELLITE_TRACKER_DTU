'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTracker } from '@/context/TrackerContext';
import { trackerApi } from '@/lib/api';
import { SatelliteInfo, SatellitePass, AngleCoordinates } from '@shared/types/tracker';
import {
  Satellite,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Play,
  Pause,
  ChevronDown,
  WifiOff,
  Radio,
  Compass,
  X
} from '@/components/ui/icons';

interface DashboardSidebarProps {
  pass: SatellitePass | null;
  loadingPass: boolean;
  targetAngles: AngleCoordinates | null;
  currentAngles: AngleCoordinates | null;
}

export function DashboardSidebar({
  pass,
  loadingPass,
  targetAngles,
  currentAngles
}: DashboardSidebarProps) {
  const { status, telemetry, connectionStatus, authToken, setTokenModalOpen, refreshStatus } = useTracker();
  const [satellites, setSatellites] = useState<SatelliteInfo[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'error' | 'info' | 'success' } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus === 'connected';
  const satName = status?.satelliteName || telemetry?.satelliteName || null;
  const state = telemetry?.state || status?.state || 'IDLE';
  const isTracking = state === 'TRACKING';
  const isVisible = telemetry?.isVisible ?? status?.isVisible ?? null;

  const showNotice = (text: string, type: 'error' | 'info' | 'success' = 'info') => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice(null);
    }, 4500);
  };

  // Load available satellites for dropdown
  useEffect(() => {
    let mounted = true;
    trackerApi.getSatellites()
      .then(list => {
        if (mounted && list && list.length > 0) {
          setSatellites(list);
        }
      })
      .catch(() => {
        if (mounted) {
          setSatellites([
            { name: 'METEOR-M2 4', noradId: 59051, group: 'WEATHER', tle: { line1: '', line2: '' } },
            { name: 'NOAA 19', noradId: 33591, group: 'WEATHER', tle: { line1: '', line2: '' } },
            { name: 'NOAA 18', noradId: 28654, group: 'WEATHER', tle: { line1: '', line2: '' } },
            { name: 'NOAA 15', noradId: 25338, group: 'WEATHER', tle: { line1: '', line2: '' } },
            { name: 'NavIC-1B', noradId: 39635, group: 'NAVIC', tle: { line1: '', line2: '' } },
            { name: 'NavIC-1C', noradId: 40269, group: 'NAVIC', tle: { line1: '', line2: '' } },
            { name: 'NavIC-1I', noradId: 43286, group: 'NAVIC', tle: { line1: '', line2: '' } },
            { name: 'ISS (ZARYA)', noradId: 25544, group: 'LEO', tle: { line1: '', line2: '' } }
          ]);
        }
      });
    return () => { mounted = false; };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSat = async (sat: SatelliteInfo) => {
    setDropdownOpen(false);
    if (!isConnected) {
      showNotice(`Offline: Target set to ${sat.name} (preview only). Connect tracker to aim hardware.`, 'info');
      return;
    }
    try {
      await trackerApi.selectSatellite({ name: sat.name, noradId: sat.noradId });
      await refreshStatus();
      showNotice(`Target switched to ${sat.name}`, 'success');
    } catch (e: any) {
      showNotice(`Could not select satellite: ${e.message}`, 'error');
    }
  };

  const handleToggleTracking = async () => {
    if (!isConnected) {
      showNotice('Tracker is offline. Please power on tracker hardware to track.', 'error');
      return;
    }
    if (!authToken) {
      setTokenModalOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      await trackerApi.setTracking(isTracking ? 'STOP' : 'START');
      await refreshStatus();
      showNotice(isTracking ? 'Tracking stopped' : 'Started tracking satellite', 'success');
    } catch (err: any) {
      showNotice(`Tracking action failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedSatObj = satellites.find(s => s.name === satName) || (satellites.length > 0 ? satellites[0] : null);

  const getDownlinkBand = (name: string) => {
    if (name.includes('METEOR')) return '137.100 MHz';
    if (name.includes('NOAA 19') || name.includes('NOAA 18')) return '137.9125 MHz';
    if (name.includes('NOAA 15')) return '137.620 MHz';
    if (name.includes('NavIC') || name.includes('IRNSS')) return '1176.45 MHz (L5)';
    if (name.includes('ISS')) return '145.800 MHz';
    return '137.100 MHz';
  };

  const getNextPassMinutes = () => {
    if (!isConnected) return 'Offline';
    if (loadingPass) return 'Computing...';
    if (!pass || pass.maxElevation <= 0) return 'No pass in 48h';
    const diffMs = new Date(pass.aos).getTime() - Date.now();
    if (diffMs <= 0) return 'In Progress';
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `in ${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `in ${hrs}h ${remMins}m`;
  };

  return (
    <div className="space-y-3.5">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-xs transition-all animate-fadeIn ${
            notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Target Satellite Card (With Isometric Satellite Avatar) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center gap-3">
          {/* Satellite Image Avatar */}
          <div className="relative w-12 h-12 shrink-0 flex items-center justify-center p-1 rounded-xl bg-sky-50/60 border border-sky-100 shadow-2xs">
            <img
              src="/satellite-isometric.png"
              alt="Satellite"
              className="w-full h-full object-contain select-none"
            />
          </div>

          {/* Satellite Selector Dropdown */}
          <div className="flex-1 min-w-0 relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between gap-1 text-left group cursor-pointer"
            >
              <div className="min-w-0">
                <div className="font-extrabold text-slate-900 text-sm sm:text-base group-hover:text-sky-600 transition-colors flex items-center gap-1">
                  <span className="truncate">{satName || (selectedSatObj ? selectedSatObj.name : 'METEOR-M2 4')}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                <div className="text-[11px] font-mono font-medium text-slate-500">
                  NORAD {selectedSatObj?.noradId || '59851'}
                </div>
              </div>
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 max-h-72 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Constellation / Satellite
                </div>
                {satellites.map((s) => (
                  <button
                    key={s.noradId || s.name}
                    type="button"
                    onClick={() => handleSelectSat(s)}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between hover:bg-sky-50 transition-colors cursor-pointer ${
                      s.name === (satName || 'METEOR-M2 4') ? 'text-sky-700 bg-sky-50/70 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {s.group}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Downlink Band */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-sky-600 font-semibold text-[11px]">
            <Radio className="w-3.5 h-3.5" />
            <span>Downlink Band</span>
          </div>
          <span className="font-mono font-bold text-slate-900 text-xs">
            {getDownlinkBand(satName || selectedSatObj?.name || 'METEOR-M2 4')}
          </span>
        </div>
      </div>

      {/* 2. Tracker Connected & Start Tracking Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  !isConnected
                    ? 'bg-rose-500'
                    : isTracking
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <span>{isConnected ? 'Tracker Connected' : 'Tracker Disconnected'}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {!isConnected
                ? 'Offline status: —'
                : isTracking
                ? `Tracking: ${satName || 'Active'}`
                : 'Standby: Ready'}
            </div>
          </div>

          {/* Sparkline Visual Graphic */}
          <div className="w-16 h-8 shrink-0 flex items-center justify-end">
            <svg viewBox="0 0 64 24" className="w-full h-full overflow-visible">
              <path
                d="M 2,16 Q 16,8 30,14 T 62,6"
                fill="none"
                stroke={isConnected ? '#10b981' : '#cbd5e1'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M 2,16 Q 16,8 30,14 T 62,6 L 62,24 L 2,24 Z"
                fill={isConnected ? 'url(#sparklineGrad)' : 'none'}
                opacity="0.25"
              />
              <defs>
                <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Primary Start / Stop Tracking Action Button */}
        <button
          type="button"
          onClick={handleToggleTracking}
          disabled={!isConnected || actionLoading}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
            isTracking
              ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20'
              : 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 shadow-sky-500/20'
          }`}
        >
          {isTracking ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-white" />
              <span>{actionLoading ? 'Stopping...' : 'Stop Tracking'}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{actionLoading ? 'Starting...' : 'Start Tracking'}</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Quick Info Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Quick Info</h3>
        <div className="space-y-2.5 text-xs">
          {/* Elevation Mask */}
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Compass className="w-3.5 h-3.5 text-sky-500" />
              <span>Elevation Mask</span>
            </span>
            <span className="font-bold text-slate-900 text-xs font-mono">10.0° (Horizon)</span>
          </div>

          {/* Orbit Propagator */}
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Satellite className="w-3.5 h-3.5 text-sky-500" />
              <span>Orbit Propagator</span>
            </span>
            <span className="font-bold text-slate-900 text-xs font-mono">SGP4 / SDP4</span>
          </div>

          {/* Next Pass */}
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />
              <span>Next Pass</span>
            </span>
            <span className="font-bold text-slate-900 text-xs font-mono">
              {getNextPassMinutes()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}