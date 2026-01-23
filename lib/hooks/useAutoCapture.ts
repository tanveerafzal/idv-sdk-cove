'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
    minStableFrames = 2, // Reduced - start faster
    gracePeriodFrames = 5, // Allow 5 "bad" frames before resetting countdown
  } = options;

  const [state, setState] = useState<AutoCaptureState>({
    isCountingDown: false,
    countdownProgress: 0,
    remainingMs: delayMs,
    shouldCapture: false,
  });

  const countdownStartRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const stableFrameCountRef = useRef(0);
  const unstableFrameCountRef = useRef(0); // Track consecutive unstable frames
  const onCaptureRef = useRef(onCapture);
  const hasCapturedRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  // Reset capture flag when enabled changes
  useEffect(() => {
    if (enabled) {
      hasCapturedRef.current = false;
    }
  }, [enabled]);

  /**
   * Start countdown animation
   */
  const startCountdown = useCallback(() => {
    if (!enabled || countdownStartRef.current !== null) return;

    countdownStartRef.current = performance.now();
    hasCapturedRef.current = false;
    unstableFrameCountRef.current = 0; // Reset unstable counter when starting

    const animate = (currentTime: number) => {
      if (countdownStartRef.current === null) return;

      const elapsed = currentTime - countdownStartRef.current;
      const remaining = Math.max(0, delayMs - elapsed);
      const progress = Math.min(elapsed / delayMs, 1);

      setState({
        isCountingDown: true,
        countdownProgress: progress,
        remainingMs: remaining,
        shouldCapture: false,
      });

      if (elapsed >= delayMs) {
        // Countdown complete - trigger capture
        setState(prev => ({
          ...prev,
          shouldCapture: true,
          countdownProgress: 1,
          remainingMs: 0,
        }));

        if (!hasCapturedRef.current) {
          hasCapturedRef.current = true;
          onCaptureRef.current?.();
        }

        countdownStartRef.current = null;
        rafIdRef.current = null;
      } else {
        rafIdRef.current = requestAnimationFrame(animate);
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);
  }, [enabled, delayMs]);

  /**
   * Stop countdown
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
      remainingMs: delayMs,
      shouldCapture: false,
    });
  }, [delayMs]);

  /**
   * Update with new detection result
   * Uses grace period to avoid resetting on brief instabilities
   */
  const updateDetectionResult = useCallback((result: DetectionResult) => {
    if (!enabled || hasCapturedRef.current) return;

    if (result.readyForCapture) {
      // Good frame - reset unstable counter, increment stable counter
      unstableFrameCountRef.current = 0;
      stableFrameCountRef.current++;

      // Start countdown after stable frames threshold
      if (stableFrameCountRef.current >= minStableFrames && countdownStartRef.current === null) {
        startCountdown();
      }
    } else {
      // Bad frame - but don't reset immediately
      unstableFrameCountRef.current++;

      // Only reset if we exceed grace period
      if (unstableFrameCountRef.current >= gracePeriodFrames) {
        stableFrameCountRef.current = 0;
        if (countdownStartRef.current !== null) {
          stopCountdown();
        }
      }
      // During grace period, keep counting down (don't reset)
    }
  }, [enabled, minStableFrames, gracePeriodFrames, startCountdown, stopCountdown]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    state,
    updateDetectionResult,
    reset,
    cancel,
  };
}

export default useAutoCapture;
