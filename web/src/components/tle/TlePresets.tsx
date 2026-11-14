'use client';

import React, { useState, useMemo } from 'react';
import { SatelliteInfo } from '@shared/types/tracker';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import { RefreshCw, Satellite, CheckCircle, Search } from '@/components/ui/icons';

interface TlePresetsProps {
  onSelectPreset?: (sat: SatelliteInfo) => void;
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
}

export function TlePresets({ onSelectPreset, onSuccess, onError }: TlePresetsProps) {
  const { authToken, setTokenModalOpen, refreshStatus, status } = useTracker();
  const [satellites, setSatellites] = useState<SatelliteInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'NAVIC' | 'WEATHER' | 'LEO'>('ALL');
  const [applyingNorad, setApplyingNorad] = useState<number | null>(null);

  const loadSatellites = async () => {
    try {
      setLoading(true);
      const list = await trackerApi.getSatellites();
      setSatellites(list);
    } catch (e: any) {
      onError(`Failed to load satellite catalog: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSatellites();
  }, []);

  const handleApplyDirect = async (sat: SatelliteInfo) => {
    if (!authToken) {
      setTokenModalOpen(true);
      return;
    }

    setApplyingNorad(sat.noradId);
    try {
      await trackerApi.selectSatellite({
        noradId: sat.noradId,
        name: sat.name
      });
      await trackerApi.setTracking('START');
      await refreshStatus();
      onSuccess(`Locked onto ${sat.name}! Mount is now tracking.`);
    } catch (err: any) {
      onError(err.message || 'Failed to apply satellite');
    } finally {
      setApplyingNorad(null);
    }
  };

  const handleRefreshCelestrak = async () => {
    setRefreshing(true);
    try {
      const res = await trackerApi.refreshTle();
      const list = await trackerApi.getSatellites();
      setSatellites(list);
      await refreshStatus();
      onSuccess(`Refreshed ${list.length} real satellites from CelesTrak!`);
    } catch (e: any) {
      onError('Failed to refresh live data from CelesTrak');
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered satellite list
  const filteredSats = useMemo(() => {
    return satellites.filter((sat) => {
      // Group filter
      if (activeTab === 'NAVIC' && sat.group !== 'NAVIC') return false;
      if (activeTab === 'WEATHER' && sat.group !== 'WEATHER') return false;
      if (activeTab === 'LEO' && sat.group !== 'LEO') return false;

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesName = sat.name.toLowerCase().includes(query);
        const matchesNorad = sat.noradId.toString().includes(query);
        return matchesName || matchesNorad;
      }
      return true;
    });
  }, [satellites, activeTab, search]);

  const activeNoradId = status?.noradId;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Official Satellite Catalog</h2>
          <p className="text-xs text-slate-500">Pick any real satellite to lock and begin tracking immediately.</p>
        </div>

        <button
          onClick={handleRefreshCelestrak}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Sync All CelesTrak</span>
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Satellites' },
            { id: 'WEATHER', label: 'Weather (137 MHz)' },
            { id: 'NAVIC', label: 'NavIC / IRNSS' },
            { id: 'LEO', label: 'LEO / Stations' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by name or NORAD..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Satellite Grid Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredSats.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          No satellites match your search. Try typing &quot;NavIC&quot;, &quot;NOAA&quot;, or &quot;METEOR&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSats.map((sat) => {
            const isCurrentlyAimed = sat.noradId === activeNoradId;
            const isApplying = applyingNorad === sat.noradId;

            return (
              <div
                key={sat.noradId}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                  isCurrentlyAimed
                    ? 'bg-sky-50/70 border-sky-300 shadow-xs'
                    : 'bg-white border-slate-200/90 hover:border-sky-200 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{sat.name}</h4>
                      <span className="text-[11px] text-slate-500 font-mono">NORAD #{sat.noradId}</span>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                      {sat.group}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                    {sat.group === 'WEATHER'
                      ? 'Low Earth Orbit (LEO) weather imaging downlink at 137.1 / 137.9 MHz.'
                      : sat.group === 'NAVIC'
                      ? 'Geosynchronous / inclined orbit navigation satellite from ISRO constellation.'
                      : 'Low Earth Orbit space research / amateur station.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {isCurrentlyAimed ? (
                    <span className="text-xs font-bold text-sky-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-sky-600" /> Aimed
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Ready</span>
                  )}

                  <button
                    onClick={() => handleApplyDirect(sat)}
                    disabled={isApplying}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isCurrentlyAimed
                        ? 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                        : 'bg-sky-500 hover:bg-sky-600 text-white shadow-xs'
                    }`}
                  >
                    {isApplying ? 'Aiming...' : isCurrentlyAimed ? 'Track Again' : 'Aim & Track'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
