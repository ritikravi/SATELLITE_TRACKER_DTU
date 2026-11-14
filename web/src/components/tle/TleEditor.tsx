'use client';

import React, { useState } from 'react';
import { trackerApi } from '@/lib/api';
import { validateTle } from '@/lib/tle-validator';
import { useTracker } from '@/context/TrackerContext';
import { FileText, CheckCircle, AlertTriangle, Download, RefreshCw } from '@/components/ui/icons';

interface TleEditorProps {
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
}

export function TleEditor({ onSuccess, onError }: TleEditorProps) {
  const { authToken, setTokenModalOpen, refreshStatus } = useTracker();

  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-line paste area state
  const [rawPaste, setRawPaste] = useState('');

  const handleParseRawPaste = (text: string) => {
    setRawPaste(text);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length >= 2) {
      if (lines.length >= 3 && !lines[0].startsWith('1 ') && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
        setName(lines[0]);
        setLine1(lines[1]);
        setLine2(lines[2]);
      } else if (lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
        setLine1(lines[0]);
        setLine2(lines[1]);
        const norad = lines[0].substring(2, 7).trim();
        setName(`SAT-${norad}`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) handleParseRawPaste(content);
    };
    reader.readAsText(file);
  };

  const validation = validateTle(name, line1, line2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authToken) {
      setTokenModalOpen(true);
      return;
    }

    if (!validation.isValid) {
      onError(`Invalid TLE format: ${validation.errors.join(' ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await trackerApi.setTle({
        satelliteName: name.trim(),
        line1: line1.trim(),
        line2: line2.trim()
      });
      await refreshStatus();
      onSuccess(`New TLE for ${res.satelliteName} uploaded and written to tracker flash memory successfully!`);
      setRawPaste('');
    } catch (err: any) {
      onError(err.message || 'Failed to upload TLE to tracker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-mono">Upload / Paste New TLE</h3>
            <p className="text-xs text-slate-500">Inject custom orbital elements with strict checksum and length verification</p>
          </div>
        </div>

        {/* File upload button */}
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs">
          <Download className="w-3.5 h-3.5 text-sky-600" />
          <span>Upload .txt/.tle file</span>
          <input
            type="file"
            accept=".txt,.tle"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Paste Box */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700">
          Fast Paste (2 or 3 lines from CelesTrak):
        </label>
        <textarea
          rows={3}
          value={rawPaste}
          onChange={(e) => handleParseRawPaste(e.target.value)}
          placeholder={`Paste standard 2 or 3 line TLE block here:\nMETEOR-M2 4\n1 59051U 24039A   24318.84722222 ...\n2 59051  98.7123 210.1234 ...`}
          className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Satellite Name:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. NOAA 19"
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Line 1 (69 characters):
          </label>
          <input
            type="text"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="1 33591U 09005A   24318.52981329 ..."
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Line 2 (69 characters):
          </label>
          <input
            type="text"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="2 33591  99.1821  45.3123 ..."
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
          />
        </div>

        {/* Validation Feedback */}
        {line1 && line2 && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            validation.isValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {validation.isValid ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Valid TLE format. Checksums and column alignments verified!</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validation.errors.join('; ')}</span>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!validation.isValid || isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/15 cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          <span>{isSubmitting ? 'Uploading to Tracker Flash...' : 'Write TLE to Tracker Memory'}</span>
        </button>
      </form>
    </div>
  );
}
