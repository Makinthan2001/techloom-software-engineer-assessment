'use client';

import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export default function CountdownTimer({ expiresAt, onExpire, className = '' }: CountdownTimerProps) {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => {
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
  });

  useEffect(() => {
    const targetTime = new Date(expiresAt).getTime();

    const interval = setInterval(() => {
      const remaining = targetTime - Date.now();
      if (remaining <= 0) {
        setTimeLeftMs(0);
        clearInterval(interval);
        if (onExpire) {
          onExpire();
        }
      } else {
        setTimeLeftMs(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (timeLeftMs <= 0) {
    return (
      <div className={`inline-flex items-center space-x-2 text-red-400 bg-red-950/80 border border-red-800 px-3 py-1.5 rounded-xl font-bold text-xs ${className}`}>
        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>RESERVATION EXPIRED (00:00)</span>
      </div>
    );
  }

  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  return (
    <div className={`inline-flex items-center space-x-2 bg-amber-950/80 text-amber-300 border border-amber-700/80 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider shadow-md ${className}`}>
      <svg className="w-4 h-4 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        EXPIRING IN {formattedMinutes}:{formattedSeconds}
      </span>
    </div>
  );
}
