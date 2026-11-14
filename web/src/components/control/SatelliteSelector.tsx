'use client';

import React, { useEffect, useState } from 'react';
import { SatelliteInfo } from '@shared/types/tracker';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import {
  Satellite,
  ChevronDown,
  RefreshCw,
  Search,
  CheckCircle,
  Radio
} from '@/components/ui/icons';

interface SatelliteSelectorProps {
  disabled: boolean;
  disabledReason?: string;
  onError: (err: string) => void;
  onSuccess: (msg: string) => void;
}

const DEFAULT_SATELLITES: SatelliteInfo[] = [
  { name: 'METEOR-M2 4', noradId: 59051, group: 'WEATHER', tle: { line1: '', line2: '' } },
  { name: 'NOAA 19', noradId: 33591, group: 'WEATHER', tle: { line1: '', line2: '' } },
  { name: 'NOAA 18', noradId: 28654, group: 'WEATHER', tle: { line1: '', line2: '' } },
  { name: 'NOAA 15', noradId: 25338, group: 'WEATHER', tle: { line1: '', line2: '' } },
  { name: 'NavIC-1B', noradId: 39635, group: 'NAVIC', tle: { line1: '', line2: '' } },
  { name: 'NavIC-1C', noradId: 40269, group: 'NAVIC', tle: { line1: '', line2: '' } },
  { name: 'NavIC-1I', noradId: 43286, group: 'NAVIC', tle: { line1: '', line2: '' } },
  { name: 'ISS (ZARYA)', noradId: 25544, group: 'LEO', tle: { line1: '', line2: '' } }
];

type CategoryFilter = 'ALL' | 'WEATHER' | 'NAVIC' | 'LEO';

export function SatelliteSelector({ disabled, disabledReason, onError, onSuccess }: SatelliteSelectorProps) {
  const { status, refreshStatus } = useTracker();
  const [satellites, setSatellites] = useState<SatelliteInfo[]>(DEFAULT_SATELLITES);
  const [selectedNorad, setSelectedNorad] = useState<number | undefined>(status?.noradId || 59051);
  const [autoTrack, setAutoTrack] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search CelesTrak State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchList() {
      setLoading(true);
      try {
        const list = await trackerApi.getSatellites();
        if (isMounted && list && list.length > 0) {
          setSatellites(list);
          if (!selectedNorad) {
            setSelectedNorad(status?.noradId || list[0].noradId);
          }
        }
      } catch {
        // Silently use DEFAULT_SATELLITES when offline without loud alert banner
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchList();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (status?.noradId) {
      setSelectedNorad(status.noradId);
    }
  }, [status?.noradId]);

  const handleSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNorad) return;

    const sat = satellites.find(s => s.noradId === selectedNorad);
    if (!sat) return;

    setSubmitting(true);
    try {
      await trackerApi.selectSatellite({
        noradId: sat.noradId,
        name: sat.name
      });

      if (autoTrack) {
        await trackerApi.setTracking('START');
      }

      await refreshStatus();
      onSuccess(`Now following ${sat.name}!`);
    } catch (err: any) {
      onError(`Could not switch satellite: ${err.message}. Make sure your token is saved.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchCelestrak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchMsg(null);
    try {
      const results = await trackerApi.searchSatellites(searchQuery.trim());
      if (results && results.length > 0) {
        const found = results[0];
        if (!satellites.some(s => s.noradId === found.noradId)) {
          setSatellites(prev => [found, ...prev]);
        }
        setSelectedNorad(found.noradId);
        setSearchMsg(`Found "${found.name}" (NORAD ${found.noradId}) on CelesTrak! Selected below.`);
      } else {
        setSearchMsg(`No satellite matching "${searchQuery}" found on CelesTrak.`);
      }
    } catch (err: any) {
      setSearchMsg(`CelesTrak search error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  // Filter satellites by category
  const filteredSatellites = satellites.filter(s => {
    if (category === 'ALL') return true;
    if (category === 'WEATHER') {
      return s.group === 'WEATHER' || s.name.includes('METEOR') || s.name.includes('NOAA');
    }
    if (category === 'NAVIC') {
      return s.group === 'NAVIC' || s.name.includes('NavIC') || s.name.includes('IRNSS');
    }
    if (category === 'LEO') {
      return s.group === 'LEO' || s.name.includes('ISS') || s.name.includes('ZARYA');
    }
    return true;
  });

  const selectedSatObj = satellites.find(s => s.noradId === selectedNorad);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-600">
            <Satellite className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Target Satellite</h2>
            <p className="text-xs text-slate-500">Pick satellite from constellation catalog</p>
          </div>
        </div>

        {selectedSatObj && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></span>
            NORAD {selectedSatObj.noradId}
          </span>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
        {(
          [
            { id: 'ALL', label: 'All' },
            { id: 'WEATHER', label: 'Weather (137 MHz)' },
            { id: 'NAVIC', label: 'NavIC / IRNSS' },
            { id: 'LEO', label: 'LEO / Stations' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            className={`flex-1 min-w-[70px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
              category === tab.id
                ? 'bg-white text-sky-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSelect} className="space-y-4">
        {/* Dropdown Selector */}
        <div className="space-y-1.5">
          <label htmlFor="sat-select" className="block text-xs font-semibold text-slate-700">
            Choose Satellite
          </label>
          <div className="relative">
            <select
              id="sat-select"
              value={selectedNorad || ''}
              onChange={(e) => setSelectedNorad(Number(e.target.value))}
              disabled={disabled || loading}
              className="w-full appearance-none bg-slate-50/60 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:opacity-50 cursor-pointer shadow-2xs transition-colors"
            >
              {filteredSatellites.map((sat) => (
                <option key={sat.noradId} value={sat.noradId} className="text-slate-900 font-medium py-1">
                  {sat.name} &bull; NORAD {sat.noradId} {sat.noradId === status?.noradId ? '(Currently Aimed)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3.5 pointer-events-none text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Selected Satellite Mini-Card */}
        {selectedSatObj && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-sky-600">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">{selectedSatObj.name}</span>
                <span className="text-[11px] text-slate-500">
                  {selectedSatObj.name.includes('METEOR') ? '137.100 / 137.900 MHz (LRPT)' :
                   selectedSatObj.name.includes('NOAA') ? '137.620 / 137.912 MHz (APT)' :
                   selectedSatObj.name.includes('NavIC') ? 'L5 (1176.45 MHz) / S-band (2492.028 MHz)' :
                   'Telemetry & Downlink'}
                </span>
              </div>
            </div>
            {selectedSatObj.noradId === status?.noradId && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Aimed
              </span>
            )}
          </div>
        )}

        {/* Auto-track checkbox */}
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 select-none">
          <input
            type="checkbox"
            checked={autoTrack}
            onChange={(e) => setAutoTrack(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
          <span>Start autonomous tracking immediately after aiming</span>
        </label>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={disabled || submitting || !selectedNorad}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-bold transition-all shadow-sm shadow-sky-500/20 cursor-pointer disabled:cursor-not-allowed"
        >
          <Satellite className="w-4 h-4" />
          <span>{submitting ? 'Aiming at satellite...' : 'Aim Antenna at Satellite'}</span>
        </button>
      </form>

      {/* Expandable CelesTrak Search */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-600 transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{showSearch ? 'Hide CelesTrak live search' : 'Looking for another satellite? Search CelesTrak'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSearch ? 'rotate-180' : ''}`} />
        </button>

        {showSearch && (
          <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 animate-fadeIn">
            <p className="text-[11px] text-slate-600">
              Query online CelesTrak NORAD database by catalog ID or space vehicle name:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 59051, NOAA 20, or ISS"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={disabled || searching}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
              />
              <button
                type="button"
                onClick={handleSearchCelestrak}
                disabled={disabled || searching || !searchQuery.trim()}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
              >
                {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 text-slate-500" />}
                <span>{searching ? 'Searching...' : 'Find'}</span>
              </button>
            </div>
            {searchMsg && (
              <p className="text-xs text-sky-700 font-medium">
                {searchMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}