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
  WifiOff
} from '@/components/ui/icons';

interface DashboardTopBarProps {
  pass: SatellitePass | null;
  loadingPass: boolean;
  targetAngles: AngleCoordinates | null;
}

export function DashboardTopBar({ pass, loadingPass, targetAngles }: DashboardTopBarProps) {
  const { status, telemetry, connectionStatus, authToken, setTokenModalOpen, refreshStatus } = useTracker();
  const [satellites, setSatellites] = useState<SatelliteInfo[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus === 'connected';
  const satName = status?.satelliteName || telemetry?.satelliteName || null;
  const state = telemetry?.state || status?.state || 'IDLE';
  const isTracking = state === 'TRACKING';
  const isVisible = telemetry?.isVisible ?? status?.isVisible ?? null;

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
      alert('Tracker hardware is offline. Please switch on your tracker before commanding satellite selection.');
      return;
    }
    try {
      await trackerApi.selectSatellite({ name: sat.name, noradId: sat.noradId });
      await refreshStatus();
    } catch (e: any) {
      alert(`Could not select satellite: ${e.message}`);
    }
  };

  const handleToggleTracking = async () => {
    if (!isConnected) {
      alert('Tracker is offline. Please power on the tracker or start the local service first.');
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
    } catch (err: any) {
      alert(`Tracking action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
      {/* 1. Target Satellite Selector */}
      <div className="relative" ref={dropdownRef}>
        <div className="text-[11px] font-medium text-slate-500 mb-1">Target Satellite</div>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full sm:w-auto min-w-[210px] flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/90 rounded-xl text-slate-900 font-bold text-sm transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[160px]">
              {satName || 'Select Satellite'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 max-h-72 overflow-y-auto">
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Available Satellites
            </div>
            {satellites.map((s) => (
              <button
                key={s.noradId || s.name}
                onClick={() => handleSelectSat(s)}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between hover:bg-sky-50 transition-colors cursor-pointer ${
                  s.name === satName ? 'text-sky-700 bg-sky-50/70 font-bold' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {s.group}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Horizon / Status Badge */}
      <div className="flex items-center">
        {!isConnected ? (
          <div className="w-full sm:w-auto flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <WifiOff className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-700 leading-tight">Tracker Offline</div>
              <div className="text-[11px] text-slate-400 leading-tight">No live telemetry</div>
            </div>
          </div>
        ) : !targetAngles ? (
          <div className="w-full sm:w-auto flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-700 leading-tight">No Satellite Selected</div>
              <div className="text-[11px] text-slate-500 leading-tight">Pick a satellite above</div>
            </div>
          </div>
        ) : isVisible ? (
          <div className="w-full sm:w-auto flex items-center gap-3 px-4 py-2 bg-emerald-50/80 border border-emerald-200/80 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900 leading-tight">In Sky View</div>
              <div className="text-[11px] text-emerald-700 leading-tight">
                Elevation &gt; 10° ({targetAngles.elevation.toFixed(1)}°)
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full sm:w-auto flex items-center gap-3 px-4 py-2 bg-amber-50/80 border border-amber-200/80 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-900 leading-tight">Below Horizon</div>
              <div className="text-[11px] text-amber-700 leading-tight">
                Elevation &lt; 10° ({targetAngles.elevation.toFixed(1)}°)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Next Pass Info */}
      <div className="flex items-center gap-3 px-2 sm:px-3">
        <Calendar className="w-5 h-5 text-slate-500 shrink-0" />
        <div>
          <div className="text-[11px] font-medium text-slate-500 leading-tight">Next Pass</div>
          <div className="text-xs font-bold text-slate-900 leading-tight">
            {!isConnected ? (
              'Offline'
            ) : loadingPass ? (
              'Calculating...'
            ) : pass && pass.maxElevation > 0 ? (
              new Date(pass.aos).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            ) : (
              'No visible pass'
            )}
          </div>
          <div className="text-[11px] text-slate-500 leading-tight">
            {!isConnected ? 'connect tracker' : pass && pass.maxElevation > 0 ? 'starts soon' : 'in next 48 h'}
          </div>
        </div>
      </div>

      {/* 4. Tracker Status */}
      <div className="flex flex-col justify-center px-2 sm:px-3">
        <div className="text-[11px] font-medium text-slate-500 leading-tight">Tracker Status</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              !isConnected
                ? 'bg-rose-500'
                : isTracking
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-emerald-500'
            }`}
          />
          <span className="text-xs font-bold text-slate-800">
            {!isConnected
              ? 'Offline'
              : isTracking
              ? 'Tracking'
              : state === 'SLEWING'
              ? 'Moving'
              : 'Idle'}
          </span>
        </div>
      </div>

      {/* 5. Start / Stop Tracking Button */}
      <div className="flex items-center">
        <button
          onClick={handleToggleTracking}
          disabled={!isConnected || actionLoading}
          title={!isConnected ? 'Connect tracker hardware first' : undefined}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
            isTracking
              ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20'
              : 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 shadow-sky-500/20'
          }`}
        >
          {isTracking ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>{actionLoading ? 'Stopping...' : 'Stop Tracking'}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>{actionLoading ? 'Starting...' : 'Start Tracking'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
