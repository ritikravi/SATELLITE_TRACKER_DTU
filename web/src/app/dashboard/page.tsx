'use client';

import React, { useEffect, useState } from 'react';
import { useTracker } from '@/context/TrackerContext';
import { trackerApi } from '@/lib/api';
import { SatellitePass } from '@shared/types/tracker';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { SkyMapCard } from '@/components/dashboard/SkyMapCard';
import { AntennaPointingCard } from '@/components/dashboard/AntennaPointingCard';
import { PassProfileCard } from '@/components/dashboard/PassProfileCard';
import { UpcomingPassesCard } from '@/components/dashboard/UpcomingPassesCard';
import { TelemetryGauges } from '@/components/dashboard/TelemetryGauges';

export default function DashboardPage() {
  const { telemetry, status, connectionStatus } = useTracker();
  const [pass, setPass] = useState<SatellitePass | null>(null);
  const [loadingPass, setLoadingPass] = useState(false);

  const isConnected = connectionStatus === 'connected';

  // Real values only: DO NOT substitute fake angles or coordinates when disconnected!
  const currentAngles = isConnected ? (telemetry?.currentAngles || status?.currentAngles || null) : null;
  const targetAngles = isConnected ? (telemetry?.targetAngles || status?.targetAngles || null) : null;
  const satName = status?.satelliteName || telemetry?.satelliteName || null;
  const isVisible = isConnected ? (telemetry?.isVisible ?? status?.isVisible ?? null) : null;

  useEffect(() => {
    let isMounted = true;
    if (!isConnected) {
      setPass(null);
      return;
    }
    async function loadPrediction() {
      try {
        setLoadingPass(true);
        const data = await trackerApi.getPrediction();
        if (isMounted) setPass(data);
      } catch {
        if (isMounted) setPass(null);
      } finally {
        if (isMounted) setLoadingPass(false);
      }
    }
    loadPrediction();
    const interval = setInterval(loadPrediction, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConnected, status?.satelliteName, status?.noradId]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* 2-Column Dashboard Layout: Left Mission Sidebar (reduced width by 1/4) + Main Hero Visualizations */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Mission Control Sidebar: Reduced width by ~1/4 (280px) to give priority to 3D Earth */}
        <aside className="w-full lg:w-[270px] xl:w-[285px] shrink-0">
          <DashboardSidebar
            pass={pass}
            loadingPass={loadingPass}
            targetAngles={targetAngles}
            currentAngles={currentAngles}
          />
        </aside>

        {/* Main Dashboard Visualization Area: Expanded to fill remaining width */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Row 1: Real-time Aim & Pointing + Pass Schedule (Earth View 67% + Right Column 33%) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            {/* 3D Earth / Sky Map (xl:col-span-8) */}
            <div className="xl:col-span-8">
              <SkyMapCard
                current={currentAngles}
                target={targetAngles}
                satelliteName={satName}
                isVisible={isVisible}
                isConnected={isConnected}
              />
            </div>

            {/* Right Column: Antenna Pointing (Top Half) + Pass Schedule (Bottom Half) */}
            <div className="xl:col-span-4 flex flex-col gap-4 justify-between">
              <div className="flex-1 min-h-0">
                <AntennaPointingCard
                  current={currentAngles}
                  target={targetAngles}
                  isConnected={isConnected}
                />
              </div>
              <div className="flex-1 min-h-0">
                <UpcomingPassesCard
                  pass={pass}
                  loading={loadingPass}
                  isConnected={isConnected}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Orbit Trajectory Pass Profile (Full Width Widescreen Chart) */}
          <div className="w-full">
            <PassProfileCard
              pass={pass}
              loading={loadingPass}
              isConnected={isConnected}
            />
          </div>
        </main>
      </div>

      {/* Hardware Diagnostics & Telemetry Gauges Drawer */}
      <TelemetryGauges telemetry={telemetry} status={status} />
    </div>
  );
}