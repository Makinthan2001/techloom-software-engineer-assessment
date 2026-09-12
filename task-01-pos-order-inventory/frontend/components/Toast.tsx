'use client';

import React from 'react';

export interface ToastMessage {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss?: () => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  const typeStyles = {
    success: 'bg-emerald-950/80 border-emerald-700 text-emerald-200',
    error: 'bg-red-950/80 border-red-700 text-red-200',
    warning: 'bg-amber-950/80 border-amber-700 text-amber-200',
    info: 'bg-blue-950/80 border-blue-700 text-blue-200',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`p-4 rounded-xl border shadow-lg flex items-center justify-between space-x-3 transition-all ${typeStyles[toast.type]}`}>
      <div className="flex items-center space-x-3">
        {icons[toast.type]}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs font-semibold hover:opacity-80 transition cursor-pointer shrink-0 ml-2"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
