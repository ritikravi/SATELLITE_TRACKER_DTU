'use client';

import React, { useEffect, useState } from 'react';
import { TrackerConfig } from '@shared/types/tracker';
import { trackerApi } from '@/lib/api';
import { useTracker } from '@/context/TrackerContext';
import {
  Sliders,
  Compass,
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from '@/components/ui/icons';

const LOCATION_PRESETS = [
  { name: 'New Delhi (DTU)', lat: 28.6139, lon: 77.2090, alt: 216 },
  { name: 'Bengaluru (ISRO)', lat: 12.9716, lon: 77.5946, alt: 920 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, alt: 14 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, alt: 6 },
];

export default function SettingsPage() {
  const { authToken, setTokenModalOpen } = useTracker();

  const [config, setConfig] = useState<TrackerConfig | null>(null);
  const [initialConfig, setInitialConfig] = useState<TrackerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await trackerApi.getConfig();
      setConfig(data);
      setInitialConfig(JSON.parse(JSON.stringify(data)));
    } catch (err: any) {
      setErrorMessage(`Could not load settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(initialConfig);

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Your browser does not support automatic location detection.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!config) return;
        const newLat = parseFloat(pos.coords.latitude.toFixed(4));
        const newLon = parseFloat(pos.coords.longitude.toFixed(4));
        const newAlt = pos.coords.altitude ? Math.round(pos.coords.altitude) : config.observer.altitudeMeters;

        setConfig({
          ...config,
          observer: {
            ...config.observer,
            latitude: newLat,
            longitude: newLon,
            altitudeMeters: newAlt
          }
        });
        setSuccessMessage('Location detected from your browser! Remember to click "Save Settings".');
        setTimeout(() => setSuccessMessage(null), 4000);
      },
      (err) => {
        setErrorMessage(`Could not get GPS location: ${err.message}. Please enter coordinates manually.`);
      },
      { timeout: 10000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!authToken) {
      setTokenModalOpen(true);
      return;
    }

    // Client-side validations
    if (config.observer.latitude < -90 || config.observer.latitude > 90) {
      setErrorMessage('Latitude must be between -90° and +90°');
      return;
    }
    if (config.observer.longitude < -180 || config.observer.longitude > 180) {
      setErrorMessage('Longitude must be between -180° and +180°');
      return;
    }
    if (config.motion.maxAzimuthSpeedDegS <= 0 || config.motion.maxAzimuthSpeedDegS > 5.0) {
      setErrorMessage('Left/Right speed must be between 0.5°/s and 5.0°/s');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = await trackerApi.updateConfig(config);
      setConfig(updated);
      setInitialConfig(JSON.parse(JSON.stringify(updated)));
      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Failed to save settings: ${err.message}. Check your token.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (initialConfig) {
      setConfig(JSON.parse(JSON.stringify(initialConfig)));
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  };

  if (loading || !config) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-sky-600" />
        <p className="text-sm">Loading tracker settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-sky-600" />
          Settings & Calibration
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Tell the tracker where it is set up so it can accurately calculate satellite angles.
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <strong className="font-bold text-rose-950 block">Cannot Save Settings</strong>
              <span className="text-xs">{errorMessage}</span>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded-lg text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Message */}
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: My Location */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-sky-600" />
                My Location (Where the Tracker Is Placed)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                The tracker needs your coordinates on Earth to know where satellites appear in your sky.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUseBrowserGps}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
            >
              <Compass className="w-4 h-4 text-sky-600" />
              <span>Use My Current Location</span>
            </button>
          </div>

          {/* Quick City Presets */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500">Or pick a nearby preset:</span>
            <div className="flex flex-wrap gap-2">
              {LOCATION_PRESETS.map((city, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setConfig({
                      ...config,
                      observer: {
                        latitude: city.lat,
                        longitude: city.lon,
                        altitudeMeters: city.alt
                      }
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Latitude (° North / South)
              </label>
              <input
                type="number"
                step="0.0001"
                value={config.observer.latitude}
                onChange={(e) => setConfig({
                  ...config,
                  observer: { ...config.observer, latitude: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
              />
              <p className="text-[11px] text-slate-400">Values between -90° and +90°.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Longitude (° East / West)
              </label>
              <input
                type="number"
                step="0.0001"
                value={config.observer.longitude}
                onChange={(e) => setConfig({
                  ...config,
                  observer: { ...config.observer, longitude: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
              />
              <p className="text-[11px] text-slate-400">Values between -180° and +180°.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Height (meters ASL)
              </label>
              <input
                type="number"
                step="1"
                value={config.observer.altitudeMeters}
                onChange={(e) => setConfig({
                  ...config,
                  observer: { ...config.observer, altitudeMeters: parseFloat(e.target.value) || 0 }
                })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
              />
              <p className="text-[11px] text-slate-400">Ground height in meters.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Min Elevation Mask (°)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="45"
                value={config.observer.minElevationMaskDeg ?? 10}
                onChange={(e) => setConfig({
                  ...config,
                  observer: { ...config.observer, minElevationMaskDeg: parseFloat(e.target.value) || 10 }
                })}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
              />
              <p className="text-[11px] text-slate-400">Ignore passes below this angle (default 10°).</p>
            </div>
          </div>
        </div>

        {/* Section 2: Advanced Calibration (Collapsed by default) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="w-full flex items-center justify-between p-5 sm:p-6 text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Advanced Calibration (Motor Steps & Speed)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Optional</span>
              </div>
              <div className="text-xs text-slate-500">
                Fine-tune motor gear ratios, maximum speeds, and zero-angle offsets.
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>{isAdvancedOpen ? 'Hide' : 'Show'}</span>
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isAdvancedOpen && (
            <div className="p-5 sm:p-6 pt-0 border-t border-slate-100 space-y-5">
              {/* Caution Banner */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mt-4">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Warning:</strong> The default settings match the official 3D-printed gears (3.57:1) and 28BYJ-48 motors. Changing these incorrectly will cause the antenna to point in the wrong direction.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Left/Right Motor Steps Per Degree
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.motion.azimuthStepsPerDegree}
                    onChange={(e) => setConfig({
                      ...config,
                      motion: { ...config.motion, azimuthStepsPerDegree: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Default is ~40.25 steps per degree.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Up/Down Motor Steps Per Degree
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.motion.elevationStepsPerDegree}
                    onChange={(e) => setConfig({
                      ...config,
                      motion: { ...config.motion, elevationStepsPerDegree: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Default is ~40.42 steps per degree.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Max Movement Speed (°/second)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    max="5.0"
                    min="0.5"
                    value={config.motion.maxAzimuthSpeedDegS}
                    onChange={(e) => setConfig({
                      ...config,
                      motion: {
                        ...config.motion,
                        maxAzimuthSpeedDegS: parseFloat(e.target.value) || 0,
                        maxElevationSpeedDegS: parseFloat(e.target.value) || 0
                      }
                    })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Keep under 5.0°/s to prevent stepper stall.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Gear Slack Compensation (Backlash °)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.motion.backlashCompensationDeg}
                    onChange={(e) => setConfig({
                      ...config,
                      motion: { ...config.motion, backlashCompensationDeg: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400">Extra rotation when reversing direction (~0.5°).</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="text-xs text-slate-600 text-center sm:text-left">
            {hasUnsavedChanges ? (
              <span className="text-amber-700 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> You have unsaved changes.
              </span>
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Settings are up to date.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                Discard
              </button>
            )}

            <button
              type="submit"
              disabled={saving || !hasUnsavedChanges}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-bold shadow-md shadow-sky-500/15 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
