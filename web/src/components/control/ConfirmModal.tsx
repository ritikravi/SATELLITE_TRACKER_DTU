'use client';

import React from 'react';
import { AlertTriangle, X } from '@/components/ui/icons';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  details?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
  details
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 text-slate-800 relative">
        <button
          onClick={onCancel}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-2.5 rounded-xl border ${
              isDanger
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">Safety Confirmation</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-4">{message}</p>

        {details && (
          <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            {details}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
