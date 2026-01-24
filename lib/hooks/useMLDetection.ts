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
} from '../ml';
import { useFrameProcessor } from './useFrameProcessor';

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

  const mergedConfig = { ...DEFAULT_DETECTION_CONFIG, ...config };

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
  const {
    startProcessing,
    stopProcessing,
    isProcessing,
    currentFps,
  } = useFrameProcessor({
    targetFps: mergedConfig.frameRateTarget,
    enabled,
    downscale: 2, // Downscale for faster processing
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
          console.log('[useMLDetection] Analyzer initialized');
        } else {
          setError('Failed to initialize ML analyzer');
          console.error('[useMLDetection] Analyzer initialization failed');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to initialize ML');
        console.error('[useMLDetection] Initialization error:', err);
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
      console.error('[useMLDetection] Detection error:', err);
    }
  }, [mergedConfig]);

  // Start detection on video
  const startDetection = useCallback((video: HTMLVideoElement) => {
    if (!enabled) return;

    videoRef.current = video;

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
