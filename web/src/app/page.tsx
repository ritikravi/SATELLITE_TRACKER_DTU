'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTracker } from '@/context/TrackerContext';
import { trackerApi } from '@/lib/api';
import { SatellitePass } from '@shared/types/tracker';
import {
  Compass,
  Radio,
  Satellite,
  Activity,
  Calendar,
  Play,
  ChevronRight
} from '@/components/ui/icons';

export default function HomePage() {
  const { status, telemetry, connectionStatus } = useTracker();
  const [pass, setPass] = useState<SatellitePass | null>(null);

  const hardwareMode = (status as any)?.hardware_mode;
  // Only show as connected when real ESP32 hardware is responding
  const isConnected = status?.hardwareConnected === true || hardwareMode === 'HARDWARE_CONNECTED';
  const isMockMode = !isConnected && connectionStatus === 'connected';
  const isTracking = (telemetry?.state || status?.state) === 'TRACKING';
  const isMoving = (telemetry?.state || status?.state) === 'SLEWING';
  const satName = status?.satelliteName || telemetry?.satelliteName || 'METEOR-M2 4';

  const targetAngles = isConnected ? (telemetry?.targetAngles || status?.targetAngles || null) : null;

  // Fetch upcoming pass prediction if connected
  useEffect(() => {
    let isMounted = true;
    if (!isConnected) {
      setPass(null);
      return;
    }
    async function loadPass() {
      try {
        const data = await trackerApi.getPrediction();
        if (isMounted) setPass(data);
      } catch {
        if (isMounted) setPass(null);
      }
    }
    loadPass();
    const interval = setInterval(loadPass, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConnected, satName]);

  // Compute pass countdown
  const getPassCountdown = () => {
    if (!isConnected) return 'Offline';
    if (!pass || pass.maxElevation <= 0) return 'No pass in 48h';
    const now = Date.now();
    const aos = new Date(pass.aos).getTime();
    const los = new Date(pass.los).getTime();

    if (now >= aos && now <= los) {
      return 'Active Now';
    }
    const diffMins = Math.round((aos - now) / 60000);
    if (diffMins <= 0) return 'Starting now';
    if (diffMins < 60) return `in ${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `in ${hours}h ${mins}m`;
  };

  // Satellite frequency helper
  const getFrequency = (name: string) => {
    if (name.includes('METEOR')) return '137.1 MHz';
    if (name.includes('NOAA 19') || name.includes('NOAA 18')) return '137.9 MHz';
    if (name.includes('NOAA 15')) return '137.6 MHz';
    if (name.includes('NavIC') || name.includes('IRNSS')) return '1176.45 MHz (L5)';
    if (name.includes('ISS')) return '145.800 MHz';
    return '137.1 MHz';
  };

  const hasRealPass = isConnected && pass && pass.maxElevation > 0;

  return (
    <div className="w-full max-w-[1600px] mx-auto flex-1 flex flex-col justify-between gap-3 py-1">
      {/* 1. Compact Hero Banner (Fitted to 100% screen height) */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-md shadow-sky-500/5 bg-gradient-to-r from-sky-50/95 via-sky-100/60 to-slate-900/10 min-h-[240px] max-h-[295px] lg:min-h-[260px] lg:max-h-[310px] flex flex-col justify-between p-4 sm:p-5 lg:p-6 flex-1">
        {/* Background Image: High-res Satellite orbiting Earth */}
        <picture className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <source srcSet="/hero-satellite.webp" type="image/webp" />
          <img
            src="/hero-satellite.jpg"
            alt="Satellite in orbit over Earth"
            className="w-full h-full object-cover object-right md:object-center opacity-95 transition-opacity"
            loading="eager"
          />
        </picture>

        {/* Soft Left Gradient Overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent w-full md:w-3/5 lg:w-1/2 pointer-events-none" />

        {/* SVG Orbital Trajectory Lines Overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible opacity-40 select-none"
          viewBox="0 0 1200 360"
          preserveAspectRatio="none"
        >
          <path
            d="M -100,240 C 300,130 800,70 1300,100"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <path
            d="M -50,320 C 400,190 900,130 1350,160"
            fill="none"
            stroke="#0284c7"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />
        </svg>

        {/* Top Section: Brand Title & Description (Compact) */}
        <div className="relative z-10 space-y-1 max-w-xl">
          <h1 className="text-2xl sm:text-3xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">
            NAVIC<span className="text-sky-500">-TRACK</span>
          </h1>
          <p className="text-slate-600 font-medium text-xs sm:text-sm leading-relaxed max-w-md pt-0.5">
            An automated, reliable system to track satellites and optimize your antenna performance.
          </p>
        </div>

        {/* Bottom Section: Floating Real-Time Action Cards (Compact & Proportionate) */}
        <div className="relative z-10 flex flex-col lg:flex-row items-stretch gap-3 pt-3 sm:pt-4">
          {/* Card 1: Main Status & Next Pass */}
          <div className="flex-1 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-md shadow-slate-900/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            {/* 1A. Circular Status Ring & Label */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                {/* Status Ring */}
                <svg className="w-10 h-10 -rotate-90 select-none" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" stroke="#e2e8f0" strokeWidth="3" fill="none" />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    stroke={
                      !isConnected
                        ? '#f43f5e'
                        : isTracking
                        ? '#10b981'
                        : isMoving
                        ? '#0284c7'
                        : '#10b981'
                    }
                    strokeWidth="3"
                    strokeDasharray="113"
                    strokeDashoffset={
                      !isConnected
                        ? '80'
                        : isTracking
                        ? '15'
                        : isMoving
                        ? '35'
                        : '20'
                    }
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Satellite className="w-4 h-4 text-sky-600" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !isConnected
                        ? 'bg-rose-500'
                        : isTracking
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span>Current Status</span>
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                  {!isConnected && !isMockMode
                    ? 'Not Connected'
                    : isMockMode
                    ? 'Simulation Mode'
                    : isTracking
                    ? 'Tracking Active'
                    : isMoving
                    ? 'Moving to Position'
                    : 'Hardware Ready'}
                </div>
                <div className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                  {!isConnected && !isMockMode
                    ? 'Hardware tracker is offline'
                    : isMockMode
                    ? `Orbital data live · No hardware`
                    : isTracking
                    ? `Tracking ${satName}`
                    : `ESP32 connected · ${satName}`}
                </div>
              </div>
            </div>

            {/* 1B. Next Pass Section */}
            <div className="sm:border-l sm:border-slate-200 sm:pl-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Next Pass
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight font-mono">
                  {getPassCountdown()}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {hasRealPass
                    ? `Elev. ${pass.maxElevation.toFixed(0)}° • Az. ${pass.aosAzimuth.toFixed(0)}°`
                    : !isConnected
                    ? 'Connect tracker'
                    : 'Elev. < 10°'}
                </div>
              </div>
            </div>

            {/* 1C. Action Button: View Details */}
            <div className="pt-1 sm:pt-0 sm:pl-2 shrink-0">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold text-xs shadow-sm shadow-sky-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>View Details &rarr;</span>
              </Link>
            </div>
          </div>

          {/* Card 2: Floating Satellite Info Card (Compact) */}
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-md shadow-slate-900/5 sm:min-w-[220px] lg:w-60 flex flex-col justify-between gap-1.5">
            {/* Header: Satellite Info + Wave Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <Satellite className="w-3.5 h-3.5 text-sky-600" />
                <span>Satellite Info</span>
              </div>
              <div className="p-0.5 rounded bg-sky-50 text-sky-600 border border-sky-100">
                <Activity className="w-3 h-3" />
              </div>
            </div>

            {/* Target Satellite Pill */}
            <div className="inline-flex items-center justify-between px-2.5 py-0.5 rounded-lg bg-sky-50/80 border border-sky-200/80 text-sky-700 text-xs font-bold">
              <span className="truncate">{satName}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ml-2 shrink-0 ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
            </div>

            {/* Telemetry Rows */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-300">&rarr;</span> Elevation
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {targetAngles
                    ? `${targetAngles.elevation.toFixed(1)}°`
                    : hasRealPass
                    ? `${pass.maxElevation.toFixed(1)}°`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-300">&rarr;</span> Azimuth
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {targetAngles
                    ? `${targetAngles.azimuth.toFixed(1)}°`
                    : hasRealPass
                    ? `${pass.aosAzimuth.toFixed(1)}°`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="text-slate-300">&rarr;</span> Frequency
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {getFrequency(satName)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Compact Navigation Grid (Fitting within 100% viewport height) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Dashboard */}
        <Link
          href="/dashboard"
          className="group bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between space-y-2"
        >
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition-colors">
                Topocentric Dashboard
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                Polar radar sky map, physical 3D dish rotator attitude, and SGP4 elevation trajectory curves.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-sky-600 pt-0.5">
            <span>Open Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Card 2: Control Tracker */}
        <Link
          href="/control"
          className="group bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between space-y-2"
        >
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition-colors">
                Motor Jog & Controls
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                Autonomous constellation tracking, 0° hardware limit switch homing, and dual-axis manual aiming.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-sky-600 pt-0.5">
            <span>Control Station</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Card 3: Satellite TLEs & Hardware */}
        <Link
          href="/about"
          className="group bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between space-y-2"
        >
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
              <Satellite className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition-colors">
                Hardware Specs & Parts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                3D printed dual-axis pan/tilt mount, ESP32 microcontroller, NEMA 17 steppers, and MPU-6050 IMU.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-sky-600 pt-0.5">
            <span>Project Specifications</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}