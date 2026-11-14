'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Key, Satellite, Play } from '@/components/ui/icons';
import { useTracker } from '@/context/TrackerContext';

export function WelcomeBanner() {
  const [show, setShow] = useState(false);
  const { setTokenModalOpen, authToken } = useTracker();

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('navic_welcome_dismissed');
      if (!dismissed) {
        setShow(true);
      }
    } catch (e) {}
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem('navic_welcome_dismissed', 'true');
    } catch (e) {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="bg-sky-50/90 border-b border-sky-200 text-slate-800 py-3 px-4 sm:px-6 relative shadow-xs">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl" role="img" aria-label="wave">👋</span>
          <div>
            <span className="font-bold text-slate-900 text-base mr-2">Welcome!</span>
            <span className="text-slate-600">
              Getting started is easy:
            </span>
            <ol className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 sm:mt-0 sm:ml-2 text-xs font-semibold text-slate-700">
              <li className="flex items-center gap-1.5 bg-white px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-2xs">
                <span className="w-4 h-4 rounded-full bg-sky-500 text-white font-bold inline-flex items-center justify-center text-[10px]">1</span>
                {!authToken ? (
                  <button
                    onClick={() => setTokenModalOpen(true)}
                    className="underline text-sky-600 hover:text-sky-700 cursor-pointer font-bold"
                  >
                    Enter your token
                  </button>
                ) : (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Token entered
                  </span>
                )}
              </li>
              <li className="flex items-center gap-1.5 bg-white px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-2xs">
                <span className="w-4 h-4 rounded-full bg-sky-500 text-white font-bold inline-flex items-center justify-center text-[10px]">2</span>
                <span>Pick a satellite</span>
              </li>
              <li className="flex items-center gap-1.5 bg-white px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-2xs">
                <span className="w-4 h-4 rounded-full bg-sky-500 text-white font-bold inline-flex items-center justify-center text-[10px]">3</span>
                <span>Press Start Tracking</span>
              </li>
            </ol>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="self-end sm:self-center flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold border border-slate-200 transition-colors cursor-pointer shadow-2xs"
        >
          <span>Got it</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
