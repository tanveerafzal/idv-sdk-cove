/**
 * Frame Analyzer - Combines all detection modules
 *
 * Orchestrates document, blur, glare, and face detection
 * to provide a unified detection result for each frame.
 */

import type {
  DetectionResult,
  DetectionConfig,
  QualityLevel,
  FaceDetectionResult,
  DEFAULT_DETECTION_CONFIG,
} from './types';
import { initializeTensorFlow, isTensorFlowReady } from './model-loader';
import { detectBlurFast } from './blur-detector';
import { detectGlareFast } from './glare-detector';
import { detectFace, initFaceDetector, isFaceDetectorReady } from './face-detector';
import { detectDocumentFast } from './document-detector';

// Import default config
import { DEFAULT_DETECTION_CONFIG as defaultConfig } from './types';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize all ML components
 */
export async function initializeAnalyzer(): Promise<boolean> {
  if (isInitialized) return true;

  if (initPromise) {
    await initPromise;
    return isInitialized;
  }

  initPromise = (async () => {
    try {
      console.log('[FrameAnalyzer] Initializing ML components...');

      // Initialize TensorFlow.js
      await initializeTensorFlow();

      // Initialize face detector (async, non-blocking)
      initFaceDetector().catch(err => {
        console.warn('[FrameAnalyzer] Face detector init failed, will skip face detection:', err);
      });

      isInitialized = true;
      console.log('[FrameAnalyzer] Initialization complete');
    } catch (error) {
      console.error('[FrameAnalyzer] Initialization failed:', error);
      isInitialized = false;
    }
  })();

  await initPromise;
  return isInitialized;
}

/**
 * Analyze a single video frame
 */
export async function analyzeFrame(
  imageData: ImageData,
  config: Partial<DetectionConfig> = {}
): Promise<DetectionResult> {
  const mergedConfig = { ...defaultConfig, ...config };

  // Initialize if needed
  if (!isInitialized && !initPromise) {
    initializeAnalyzer();
  }

  const timestamp = Date.now();

  // Create default result
  let result: DetectionResult = {
    documentDetected: false,
    documentConfidence: 0,
    documentBounds: null,
    isBlurry: false,
    blurScore: 1,
    hasGlare: false,
    glareScore: 0,
    faceDetected: false,
    faceConfidence: 0,
    faceBounds: null,
    readyForCapture: false,
    overallQuality: 'poor',
    timestamp,
  };

  // If TensorFlow not ready, return basic result
  if (!isTensorFlowReady()) {
    return result;
  }

  try {
    // Run detections in parallel for better performance
    const [documentResult, blurResult, glareResult] = await Promise.all([
      mergedConfig.enableDocumentDetection
        ? detectDocumentFast(imageData)
        : Promise.resolve({ detected: true, confidence: 1, bounds: null, corners: null, aspectRatio: null }),
      mergedConfig.enableBlurDetection
        ? detectBlurFast(imageData)
        : Promise.resolve({ isBlurry: false, score: 1, variance: 0 }),
      mergedConfig.enableGlareDetection
        ? detectGlareFast(imageData)
        : Promise.resolve({ hasGlare: false, score: 0, hotspotCount: 0, brightnessHistogram: [] }),
    ]);

    // Face detection - only if document detected and face detector ready
    let faceResult: FaceDetectionResult = { detected: false, confidence: 0, bounds: null, landmarks: null };
    if (mergedConfig.enableFaceDetection && documentResult.detected && isFaceDetectorReady()) {
      try {
        faceResult = await detectFace(imageData);
      } catch (error) {
        console.warn('[FrameAnalyzer] Face detection failed:', error);
      }
    }

    // Compile results
    result = {
      documentDetected: documentResult.detected,
      documentConfidence: documentResult.confidence,
      documentBounds: documentResult.bounds,
      isBlurry: blurResult.isBlurry,
      blurScore: blurResult.score,
      hasGlare: glareResult.hasGlare,
      glareScore: glareResult.score,
      faceDetected: faceResult.detected,
      faceConfidence: faceResult.confidence,
      faceBounds: faceResult.bounds,
      readyForCapture: false,
      overallQuality: 'poor',
      timestamp,
    };

    // Determine if ready for capture
    result.readyForCapture = isReadyForCapture(result, mergedConfig);

    // Calculate overall quality
    result.overallQuality = calculateOverallQuality(result, mergedConfig);

    return result;
  } catch (error) {
    console.error('[FrameAnalyzer] Frame analysis error:', error);
    return result;
  }
}

/**
 * Analyze frame from video element directly
 */
export async function analyzeVideoFrame(
  video: HTMLVideoElement,
  config: Partial<DetectionConfig> = {}
): Promise<DetectionResult> {
  // Create canvas to extract frame
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return createEmptyResult();
  }

  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return analyzeFrame(imageData, config);
}

/**
 * Check if frame meets capture criteria
 */
function isReadyForCapture(result: DetectionResult, config: DetectionConfig): boolean {
  // Must have document detected
  if (!result.documentDetected || result.documentConfidence < config.minDocumentConfidence) {
    return false;
  }

  // Check blur
  if (config.enableBlurDetection && result.isBlurry) {
    return false;
  }

  // Check glare
  if (config.enableGlareDetection && result.hasGlare) {
    return false;
  }

  // Check face (if enabled)
  if (config.enableFaceDetection && !result.faceDetected) {
    // Don't block on face if detector not ready
    if (isFaceDetectorReady() && result.faceConfidence < config.minFaceConfidence) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate overall quality level
 */
function calculateOverallQuality(result: DetectionResult, config: DetectionConfig): QualityLevel {
  let score = 0;
  let maxScore = 0;

  // Document detection (weight: 3)
  maxScore += 3;
  if (result.documentDetected) {
    score += Math.min(result.documentConfidence * 3, 3);
  }

  // Blur (weight: 2)
  if (config.enableBlurDetection) {
    maxScore += 2;
    if (!result.isBlurry) {
      score += result.blurScore * 2;
    }
  }

  // Glare (weight: 2)
  if (config.enableGlareDetection) {
    maxScore += 2;
    if (!result.hasGlare) {
      score += (1 - result.glareScore) * 2;
    }
  }

  // Face detection (weight: 1)
  if (config.enableFaceDetection) {
    maxScore += 1;
    if (result.faceDetected) {
      score += result.faceConfidence;
    }
  }

  const normalizedScore = score / maxScore;

  if (normalizedScore >= 0.85) return 'excellent';
  if (normalizedScore >= 0.65) return 'good';
  if (normalizedScore >= 0.4) return 'fair';
  return 'poor';
}

/**
 * Create empty result for error cases
 */
function createEmptyResult(): DetectionResult {
  return {
    documentDetected: false,
    documentConfidence: 0,
    documentBounds: null,
    isBlurry: false,
    blurScore: 0,
    hasGlare: false,
    glareScore: 0,
    faceDetected: false,
    faceConfidence: 0,
    faceBounds: null,
    readyForCapture: false,
    overallQuality: 'poor',
    timestamp: Date.now(),
  };
}

/**
 * Get status message based on detection result
 */
export function getStatusMessage(result: DetectionResult, config: DetectionConfig): string {
  if (!result.documentDetected) {
    return 'Position ID card in frame';
  }

  if (result.isBlurry && config.enableBlurDetection) {
    return 'Hold camera still - image is blurry';
  }

  if (result.hasGlare && config.enableGlareDetection) {
    return 'Tilt document to reduce glare';
  }

  if (!result.faceDetected && config.enableFaceDetection && isFaceDetectorReady()) {
    return 'Ensure face on ID is visible';
  }

  if (result.readyForCapture) {
    return 'Perfect! Hold still...';
  }

  return 'Adjusting...';
}

/**
 * Check if analyzer is ready
 */
export function isAnalyzerReady(): boolean {
  return isInitialized && isTensorFlowReady();
}

/**
 * Dispose analyzer resources
 */
export async function disposeAnalyzer(): Promise<void> {
  isInitialized = false;
  initPromise = null;
}
