'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DetectionResult, DetectionConfig, DetectionStatusMessage } from '../ml/types';
import { DEFAULT_DETECTION_CONFIG } from '../ml/types';
import {
  initializeAnalyzer,
  analyzeFrame,
  getStatusMessage,
  isAnalyzerReady,
  disposeAnalyzer,
  resetMotionHistory,
} from '../ml';
import { useFrameProcessor } from './useFrameProcessor';
import { logError, logException, logInfo } from '../error-logger';

// Detect mobile device for performance optimization
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

interface UseMLDetectionOptions {
  config?: Partial<DetectionConfig>;
  enabled?: boolean;
  onDetectionResult?: (result: DetectionResult) => void;
}

interface UseMLDetectionReturn {
  result: DetectionResult | null;
  statusMessage: DetectionStatusMessage;
  isReady: boolean;
  isProcessing: boolean;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
  fps: number;
}

/**
 * Main hook for ML-based ID card detection
 */
export function useMLDetection(options: UseMLDetectionOptions = {}): UseMLDetectionReturn {
  const {
    config = {},
    enabled = true,
    onDetectionResult,
  } = options;

  // Use lower frame rate, downscaled frames, and no face detection on mobile to prevent memory crashes
  const isMobile = isMobileDevice();
  const mobileFrameRate = isMobile ? 3 : (config.frameRateTarget ?? DEFAULT_DETECTION_CONFIG.frameRateTarget);
  const mergedConfig = {
    ...DEFAULT_DETECTION_CONFIG,
    ...config,
    frameRateTarget: mobileFrameRate,
    // Disable face detection on mobile - saves ~50MB (BlazeFace model)
    enableFaceDetection: isMobile ? false : (config.enableFaceDetection ?? DEFAULT_DETECTION_CONFIG.enableFaceDetection),
  };

  const [result, setResult] = useState<DetectionResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<DetectionStatusMessage>('Position ID card in frame');
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInitializingRef = useRef(false);
  const onDetectionResultRef = useRef(onDetectionResult);

  // Keep callback ref updated
  useEffect(() => {
    onDetectionResultRef.current = onDetectionResult;
  }, [onDetectionResult]);

  // Frame processor for extracting video frames
  // Mobile: downscale 4x to reduce memory (1920x1080 -> 480x270, ~0.5MB vs ~8MB per frame)
  const {
    startProcessing,
    stopProcessing,
    isProcessing,
    currentFps,
  } = useFrameProcessor({
    targetFps: mergedConfig.frameRateTarget,
    enabled,
    downscale: isMobile ? 4 : 2,
  });

  // Initialize ML analyzer
  useEffect(() => {
    if (!enabled || isInitializingRef.current) return;

    isInitializingRef.current = true;

    initializeAnalyzer()
      .then((success) => {
        if (success) {
          setIsReady(true);
          setError(null);
          logInfo('ML Analyzer initialized', { component: 'useMLDetection', isMobile });
        } else {
          setError('Failed to initialize ML analyzer');
          logError('ML Analyzer initialization failed', { component: 'useMLDetection', isMobile });
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to initialize ML');
        logException(err instanceof Error ? err : new Error(String(err)), {
          component: 'useMLDetection',
          action: 'initializeAnalyzer',
          isMobile,
        });
      })
      .finally(() => {
        isInitializingRef.current = false;
      });

    return () => {
      // Don't dispose on unmount - models are cached globally
    };
  }, [enabled]);

  // Process frame callback
  const processDetection = useCallback(async (frame: { imageData: ImageData }) => {
    if (!isAnalyzerReady()) return;

    try {
      const detectionResult = await analyzeFrame(frame.imageData, mergedConfig);
      setResult(detectionResult);

      const message = getStatusMessage(detectionResult, mergedConfig) as DetectionStatusMessage;
      setStatusMessage(message);

      // Call external callback
      onDetectionResultRef.current?.(detectionResult);
    } catch (err) {
      logException(err instanceof Error ? err : new Error(String(err)), {
        component: 'useMLDetection',
        action: 'processDetection',
      });
    }
  }, [mergedConfig]);

  // Start detection on video
  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (!enabled) return;

    videoRef.current = video;
    resetMotionHistory(); // Clear motion history for new session

    // Wait for analyzer to be ready
    const startWhenReady = () => {
      if (isAnalyzerReady()) {
        startProcessing(video, processDetection);
      } else {
        // Retry after short delay
        setTimeout(startWhenReady, 100);
      }
    };

    startWhenReady();
  }, [enabled, startProcessing, processDetection]);

  // Stop detection
  const stopDetection = useCallback(() => {
    stopProcessing();
    resetMotionHistory(); // Clear motion history
    videoRef.current = null;
    setResult(null);
    setStatusMessage('Position ID card in frame');
  }, [stopProcessing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    result,
    statusMessage,
    isReady,
    isProcessing,
    error,
    startDetection,
    stopDetection,
    fps: currentFps,
  };
}

export default useMLDetection;
