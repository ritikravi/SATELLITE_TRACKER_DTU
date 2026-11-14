'use client';

import React from 'react';
import { useTracker } from '@/context/TrackerContext';
import { WifiOff, RefreshCw } from '@/components/ui/icons';

export function OfflineBanner() {
  const { connectionStatus, reconnectCountdown, reconnectNow } = useTracker();

  if (connectionStatus === 'connected') return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-sm flex items-center justify-between sticky top-0 z-50 backdrop-blur-md shadow-xs">
      <div className="flex items-center gap-2.5">
        <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong className="font-bold text-amber-950">
            {connectionStatus === 'connecting' ? 'Connecting to Tracker...' : 'Tracker Not Connected:'}
          </strong>{' '}
          {connectionStatus === 'connecting'
            ? 'Establishing connection to tracker...'
            : 'Make sure your tracker is switched on and on the same Wi-Fi.'}
          {reconnectCountdown !== null && (
            <span className="ml-1 text-amber-700 font-medium">
              Trying again in <strong>{reconnectCountdown}s</strong>...
            </span>
          )}
        </span>
      </div>
      <button
        onClick={reconnectNow}
        className="flex items-center gap-1.5 px-3 py-1 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
        <span>Try Now</span>
      </button>
    </div>
  );
}
