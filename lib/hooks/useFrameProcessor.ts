'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import type { FrameData } from '../ml/types';
import { logException } from '../error-logger';

interface UseFrameProcessorOptions {
  targetFps?: number;
  enabled?: boolean;
  downscale?: number;
}

interface UseFrameProcessorReturn {
  processFrame: (video: HTMLVideoElement) => FrameData | null;
  startProcessing: (video: HTMLVideoElement, onFrame: (frame: FrameData) => void) => void;
  stopProcessing: () => void;
  isProcessing: boolean;
  currentFps: number;
}

/**
 * Hook for extracting and processing video frames at a target FPS
 */
export function useFrameProcessor(options: UseFrameProcessorOptions = {}): UseFrameProcessorReturn {
  const {
    targetFps = 10,
    enabled = true,
    downscale = 1,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsStartTimeRef = useRef<number>(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFps, setCurrentFps] = useState(0);

  // Create canvas lazily
  const getCanvas = useCallback((width: number, height: number) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const scaledWidth = Math.floor(width / downscale);
    const scaledHeight = Math.floor(height / downscale);

    if (canvasRef.current.width !== scaledWidth || canvasRef.current.height !== scaledHeight) {
      canvasRef.current.width = scaledWidth;
      canvasRef.current.height = scaledHeight;
      ctxRef.current = canvasRef.current.getContext('2d', {
        willReadFrequently: true,
        alpha: false,
      });
    }

    return canvasRef.current;
  }, [downscale]);

  /**
   * Extract a single frame from video
   */
  const processFrame = useCallback((video: HTMLVideoElement): FrameData | null => {
    if (!video || video.readyState < 2) {
      return null;
    }

    const canvas = getCanvas(video.videoWidth, video.videoHeight);
    const ctx = ctxRef.current;

    if (!ctx) {
      return null;
    }

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      return {
        imageData,
        width: canvas.width,
        height: canvas.height,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[useFrameProcessor] Error extracting frame:', error);
      return null;
    }
  }, [getCanvas]);

  /**
   * Start continuous frame processing
   */
  const startProcessing = useCallback((
    video: HTMLVideoElement,
    onFrame: (frame: FrameData) => void
  ) => {
    if (!enabled) return;

    const frameInterval = 1000 / targetFps;
    setIsProcessing(true);
    fpsStartTimeRef.current = performance.now();
    frameCountRef.current = 0;

    const processLoop = (currentTime: number) => {
      // Check if video is still valid
      if (!video || video.readyState < 2) {
        rafIdRef.current = requestAnimationFrame(processLoop);
        return;
      }

      // Check if enough time has passed for next frame
      const elapsed = currentTime - lastFrameTimeRef.current;

      if (elapsed >= frameInterval) {
        try {
          const frame = processFrame(video);

          if (frame) {
            onFrame(frame);
            frameCountRef.current++;

            // Update FPS every second
            const fpsDuration = currentTime - fpsStartTimeRef.current;
            if (fpsDuration >= 1000) {
              setCurrentFps(Math.round((frameCountRef.current * 1000) / fpsDuration));
              frameCountRef.current = 0;
              fpsStartTimeRef.current = currentTime;
            }
          }
        } catch (error) {
          // Catch memory errors gracefully on mobile and log to Vercel
          logException(error instanceof Error ? error : new Error(String(error)), {
            component: 'useFrameProcessor',
            action: 'processLoop',
          });
        }

        lastFrameTimeRef.current = currentTime;
      }

      rafIdRef.current = requestAnimationFrame(processLoop);
    };

    rafIdRef.current = requestAnimationFrame(processLoop);
  }, [enabled, targetFps, processFrame]);

  /**
   * Stop frame processing
   */
  const stopProcessing = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsProcessing(false);
    setCurrentFps(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProcessing();
    };
  }, [stopProcessing]);

  return {
    processFrame,
    startProcessing,
    stopProcessing,
    isProcessing,
    currentFps,
  };
}

export default useFrameProcessor;
