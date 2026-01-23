'use client';

import { memo } from 'react';
import type { AutoCaptureState } from '@/lib/ml/types';

interface AutoCaptureProgressProps {
  state: AutoCaptureState;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

/**
 * Circular progress indicator for auto-capture countdown
 */
export const AutoCaptureProgress = memo(function AutoCaptureProgress({
  state,
  size = 80,
  strokeWidth = 4,
  showText = true,
}: AutoCaptureProgressProps) {
  const { isCountingDown, countdownProgress, remainingMs } = state;

  if (!isCountingDown) {
    return null;
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - countdownProgress);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Background circle */}
      <svg
        className="absolute transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-100 ease-linear"
        />
      </svg>

      {/* Center content */}
      {showText && (
        <div className="relative flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {remainingSeconds}
          </span>
          <span className="text-xs text-white/70">
            sec
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * Compact inline progress indicator
 */
export const AutoCaptureProgressInline = memo(function AutoCaptureProgressInline({
  state,
}: {
  state: AutoCaptureState;
}) {
  const { isCountingDown, remainingMs } = state;

  if (!isCountingDown) {
    return null;
  }

  const remainingSeconds = (remainingMs / 1000).toFixed(1);

  return (
    <div className="flex items-center gap-2 text-emerald-400">
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-full" />
        <div
          className="absolute inset-0 border-2 border-emerald-400 rounded-full animate-spin"
          style={{ borderTopColor: 'transparent' }}
        />
      </div>
      <span className="text-sm font-medium">
        {remainingSeconds}s
      </span>
    </div>
  );
});

/**
 * Full-screen capturing overlay
 */
export const CapturingOverlay = memo(function CapturingOverlay({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 bg-white/20 flex items-center justify-center z-50 animate-pulse">
      <div className="bg-black/50 px-6 py-3 rounded-full">
        <span className="text-white font-medium">Capturing...</span>
      </div>
    </div>
  );
});

export default AutoCaptureProgress;
