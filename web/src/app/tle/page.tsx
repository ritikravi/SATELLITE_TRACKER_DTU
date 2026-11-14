'use client';

import React, { useEffect, useState } from 'react';
import { TleData, SatelliteInfo } from '@shared/types/tracker';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import { TleViewer } from '@/components/tle/TleViewer';
import { TlePresets } from '@/components/tle/TlePresets';
import { TleEditor } from '@/components/tle/TleEditor';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  X
} from '@/components/ui/icons';

export default function TlePage() {
  const { authToken, setTokenModalOpen, refreshStatus } = useTracker();
  const [activeTle, setActiveTle] = useState<TleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchCurrentTle = async () => {
    try {
      setLoading(true);
      const data = await trackerApi.getTle();
      setActiveTle(data);
    } catch (err: any) {
      setErrorMessage(`Could not load satellite data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentTle();
  }, []);

  const handleUpdateNow = async () => {
    if (!authToken) {
      setTokenModalOpen(true);
      return;
    }

    setUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await trackerApi.refreshTle();
      if (result.currentTle) {
        setActiveTle(result.currentTle);
      } else {
        await fetchCurrentTle();
      }
      await refreshStatus();
      setSuccessMessage(`Live orbital data updated directly from CelesTrak! ${result.message}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(`Update failed: ${err.message}. Check your token and network.`);
    } finally {
      setUpdating(false);
    }
  };

  const getTimeAgo = (timestamp?: string) => {
    if (!timestamp) return 'Recently';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Source Attribution */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-sky-600" />
            Satellite Data & Orbital Elements
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Real Two-Line Elements (TLE) synchronized directly from official CelesTrak NORAD tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleUpdateNow}
            disabled={updating || loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/15 cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
            <span>{updating ? 'Downloading fresh data...' : 'Refresh from CelesTrak'}</span>
          </button>
        </div>
      </div>

      {/* Freshness Status Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orbit Data Age</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Last updated: {getTimeAgo(activeTle?.updatedAt)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Live CelesTrak
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              The tracker automatically keeps TLE data up-to-date every 24 hours so antenna aim stays precise.
            </p>
          </div>
        </div>

        <a
          href="https://celestrak.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors shrink-0 shadow-2xs"
        >
          <span>celestrak.org</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>

      {/* Error & Success Messages */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded-lg text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Satellite TLE & Keplerian Elements */}
      <TleViewer tle={activeTle} loading={loading} />

      {/* Pre-Loaded Satellite Presets (NavIC, Weather, LEO) */}
      <TlePresets
        onSelectPreset={(sat) => {
          setSuccessMessage(`Selected ${sat.name}!`);
          setTimeout(() => setSuccessMessage(null), 4000);
        }}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
        onError={(err) => setErrorMessage(err)}
      />

      {/* Collapsed Advanced: Upload Custom TLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FileText className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Advanced: Upload Custom Two-Line Element (TLE)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Manual</span>
              </div>
              <div className="text-xs text-slate-500">Paste your own raw TLE lines from Celestrak or Space-Track.</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{isAdvancedOpen ? 'Hide' : 'Show'}</span>
            {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAdvancedOpen && (
          <div className="p-5 pt-0 border-t border-slate-100">
            <div className="pt-4">
              <TleEditor
                onSuccess={(msg) => {
                  setSuccessMessage(msg);
                  fetchCurrentTle();
                }}
                onError={(err) => setErrorMessage(err)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
