'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { TelemetryLogEntry } from '@shared/types/tracker';
import { trackerApi } from '@/lib/api';
import { cacheLogsInIndexedDB, getCachedLogsFromIndexedDB, clearIndexedDBLogs } from '@/lib/idb-logs';
import { AngleHistoryChart } from '@/components/logs/AngleHistoryChart';
import { CsvExportButton } from '@/components/logs/CsvExportButton';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Trash2
} from '@/components/ui/icons';

export default function HistoryPage() {
  const [logs, setLogs] = useState<TelemetryLogEntry[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const loadInitialLogs = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await getCachedLogsFromIndexedDB();
      if (cached && cached.length > 0) {
        setLogs(cached);
      }

      const latest = await trackerApi.getLogs(100);
      if (latest && latest.length > 0) {
        cacheLogsInIndexedDB(latest);
        setLogs((prev) => {
          const map = new Map<string, TelemetryLogEntry>();
          for (const item of prev) map.set(item.id, item);
          for (const item of latest) map.set(item.id, item);
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });
      }
    } catch (err) {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialLogs();
  }, [loadInitialLogs]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latest = await trackerApi.getLogs(30);
        if (latest && latest.length > 0) {
          cacheLogsInIndexedDB(latest);
          setLogs((prev) => {
            const map = new Map<string, TelemetryLogEntry>();
            for (const item of prev) map.set(item.id, item);
            for (const item of latest) map.set(item.id, item);
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      } catch (err) {}
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    if (confirm('Clear saved tracking history from your browser?')) {
      await clearIndexedDBLogs();
      setLogs([]);
      loadInitialLogs();
    }
  };

  const filteredLogs = stateFilter === 'ALL'
    ? logs
    : logs.filter((l) => l.state === stateFilter);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-sky-600" />
            Tracking History
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Review how accurately the antenna followed satellites over time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <CsvExportButton logs={logs} />
          <button
            onClick={handleClearCache}
            title="Clear stored local history"
            className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Angle Accuracy Chart */}
      <AngleHistoryChart logs={logs} />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Total Telemetry Frames</span>
          <span className="text-2xl font-bold text-slate-900">{logs.length}</span>
          <p className="text-[11px] text-slate-400 mt-1">Saved automatically in your browser.</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Average Pointing Error</span>
          <span className="text-2xl font-bold text-emerald-600">
            {logs.length > 0
              ? (logs.reduce((acc, curr) => acc + (curr.trackingErrorDeg || 0), 0) / logs.length).toFixed(1) + '°'
              : '0.0°'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Lower than 3° gives optimal signal.</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block">Current Operating Mode</span>
          <span className="text-2xl font-bold text-sky-600">
            {logs.length > 0 ? logs[logs.length - 1].state : 'IDLE'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Real-time tracker state machine.</p>
        </div>
      </div>

      {/* Collapsed Table Toggle */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm transition-all">
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900">Numerical Data Table</h3>
            <p className="text-xs text-slate-500">View individual degree readings with timestamps.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{showTable ? 'Hide Table' : 'Show Table'}</span>
            {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showTable && (
          <div className="p-5 pt-0 border-t border-slate-100 space-y-4">
            {/* Filter buttons */}
            <div className="flex items-center gap-2 pt-4 text-xs">
              <span className="text-slate-500 font-medium">Filter by mode:</span>
              {['ALL', 'TRACKING', 'SLEWING', 'IDLE'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStateFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    stateFilter === s
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Actual Azimuth</th>
                    <th className="py-2.5 px-3">Target Azimuth</th>
                    <th className="py-2.5 px-3">Actual Elevation</th>
                    <th className="py-2.5 px-3">Target Elevation</th>
                    <th className="py-2.5 px-3">Off-Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredLogs.slice(-100).reverse().map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 text-slate-500">
                        {new Date(row.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.state === 'TRACKING'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.state === 'SLEWING'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {row.state}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold">{row.actualAzimuth.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-slate-500">{row.commandedAzimuth.toFixed(1)}°</td>
                      <td className="py-2 px-3 font-semibold">{row.actualElevation.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-slate-500">{row.commandedElevation.toFixed(1)}°</td>
                      <td className="py-2 px-3">
                        <span className={row.trackingErrorDeg > 3 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                          {row.trackingErrorDeg.toFixed(1)}°
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
