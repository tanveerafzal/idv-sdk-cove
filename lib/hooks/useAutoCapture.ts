'use client';

import { useState, useCallback, useRef } from 'react';
import type { DetectionResult, AutoCaptureState } from '../ml/types';

interface UseAutoCaptureOptions {
  delayMs?: number;
  enabled?: boolean;
  onCapture?: () => void;
  minStableFrames?: number;
  gracePeriodFrames?: number; // Allow N unstable frames before resetting
}

interface UseAutoCaptureReturn {
  state: AutoCaptureState;
  updateDetectionResult: (result: DetectionResult) => void;
  reset: () => void;
  cancel: () => void;
}

/**
 * Hook for auto-capture countdown based on stable detection
 * More tolerant of brief instabilities to prevent constant resets
 */
export function useAutoCapture(options: UseAutoCaptureOptions = {}): UseAutoCaptureReturn {
  const {
    delayMs = 2500,
    enabled = true,
    onCapture,
    minStableFrames = 3,
    gracePeriodFrames = 4,
  } = options;

  const [state, setState] = useState<AutoCaptureState>({
    isCountingDown: false,
    countdownProgress: 0,
    remainingMs: delayMs,
    shouldCapture: false,
  });

  // Use refs to avoid dependency issues
  const countdownStartRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const stableFrameCountRef = useRef(0);
  const unstableFrameCountRef = useRef(0);
  const hasCapturedRef = useRef(false);

  // Store options in refs to avoid callback dependencies
  const optionsRef = useRef({ delayMs, enabled, onCapture, minStableFrames, gracePeriodFrames });
  optionsRef.current = { delayMs, enabled, onCapture, minStableFrames, gracePeriodFrames };

  /**
   * Stop countdown (stable reference)
   */
  const stopCountdown = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    countdownStartRef.current = null;
    stableFrameCountRef.current = 0;
    unstableFrameCountRef.current = 0;

    setState({
      isCountingDown: false,
      countdownProgress: 0,
      remainingMs: optionsRef.current.delayMs,
      shouldCapture: false,
    });
  }, []);

  /**
   * Start countdown animation (stable reference)
   */
  const startCountdown = useCallback(() => {
    const { enabled: isEnabled, delayMs: delay } = optionsRef.current;
    if (!isEnabled || countdownStartRef.current !== null) return;

    countdownStartRef.current = performance.now();
    hasCapturedRef.current = false;
    unstableFrameCountRef.current = 0;

    const animate = (currentTime: number) => {
      if (countdownStartRef.current === null) return;

      const elapsed = currentTime - countdownStartRef.current;
      const remaining = Math.max(0, delay - elapsed);
      const progress = Math.min(elapsed / delay, 1);

      setState({
        isCountingDown: true,
        countdownProgress: progress,
        remainingMs: remaining,
        shouldCapture: false,
      });

      if (elapsed >= delay) {
        setState(prev => ({
          ...prev,
          shouldCapture: true,
          countdownProgress: 1,
          remainingMs: 0,
        }));

        if (!hasCapturedRef.current) {
          hasCapturedRef.current = true;
          optionsRef.current.onCapture?.();
        }

        countdownStartRef.current = null;
        rafIdRef.current = null;
      } else {
        rafIdRef.current = requestAnimationFrame(animate);
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);
  }, []);

  /**
   * Update with new detection result (stable reference)
   */
  const updateDetectionResult = useCallback((result: DetectionResult) => {
    const { enabled: isEnabled, minStableFrames: minFrames, gracePeriodFrames: graceFrames } = optionsRef.current;

    if (!isEnabled || hasCapturedRef.current) return;

    if (result.readyForCapture) {
      unstableFrameCountRef.current = 0;
      stableFrameCountRef.current++;

      if (stableFrameCountRef.current >= minFrames && countdownStartRef.current === null) {
        startCountdown();
      }
    } else {
      unstableFrameCountRef.current++;

      if (unstableFrameCountRef.current >= graceFrames) {
        stableFrameCountRef.current = 0;
        if (countdownStartRef.current !== null) {
          stopCountdown();
        }
      }
    }
  }, [startCountdown, stopCountdown]);

  /**
   * Reset auto-capture state
   */
  const reset = useCallback(() => {
    stopCountdown();
    hasCapturedRef.current = false;
  }, [stopCountdown]);

  /**
   * Cancel auto-capture (user wants manual capture)
   */
  const cancel = useCallback(() => {
    stopCountdown();
  }, [stopCountdown]);

  return {
    state,
    updateDetectionResult,
    reset,
    cancel,
  };
}

export default useAutoCapture;
