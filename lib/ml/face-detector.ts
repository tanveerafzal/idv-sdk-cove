/**
 * Face Detection using BlazeFace
 *
 * Wrapper around TensorFlow.js BlazeFace model for detecting
 * faces on ID cards and documents.
 */

import type { FaceDetectionResult, BoundingBox, FaceLandmark, Point } from './types';
import { loadBlazeFaceModel, isTensorFlowReady } from './model-loader';

// BlazeFace model instance
let blazefaceModel: Awaited<ReturnType<typeof loadBlazeFaceModel>> | null = null;
let isLoading = false;
let loadError: Error | null = null;

// Confidence threshold for face detection on ID cards
// Lower than selfie detection since ID photos may be small/low quality
const MIN_FACE_CONFIDENCE = 0.5;

// Expected face size range on ID cards (relative to frame)
const MIN_FACE_RATIO = 0.02;  // Face should be at least 2% of frame
const MAX_FACE_RATIO = 0.25;  // Face shouldn't be more than 25% of frame

/**
 * Initialize face detector
 */
export async function initFaceDetector(): Promise<boolean> {
  if (blazefaceModel) return true;
  if (isLoading) return false;
  if (loadError) return false;

  isLoading = true;

  try {
    blazefaceModel = await loadBlazeFaceModel();
    isLoading = false;
    return true;
  } catch (error) {
    console.error('[FaceDetector] Failed to initialize:', error);
    loadError = error as Error;
    isLoading = false;
    return false;
  }
}

/**
 * Detect faces in an image
 * Optimized for ID card photos (small faces, potentially low quality)
 */
export async function detectFace(
  imageData: ImageData | HTMLVideoElement | HTMLCanvasElement
): Promise<FaceDetectionResult> {
  if (!isTensorFlowReady()) {
    return createEmptyResult();
  }

  if (!blazefaceModel) {
    const initialized = await initFaceDetector();
    if (!initialized) {
      return createEmptyResult();
    }
  }

  try {
    // Run face detection
    const predictions = await blazefaceModel!.estimateFaces(imageData, false);

    if (!predictions || predictions.length === 0) {
      return createEmptyResult();
    }

    // Find the most confident face that fits ID card constraints
    let bestFace: typeof predictions[0] | null = null;
    let bestConfidence = 0;

    const frameArea = 'width' in imageData
      ? imageData.width * imageData.height
      : (imageData as HTMLVideoElement).videoWidth * (imageData as HTMLVideoElement).videoHeight;

    for (const prediction of predictions) {
      const confidence = prediction.probability?.[0] ?? 0;

      if (confidence < MIN_FACE_CONFIDENCE) continue;

      // Calculate face area ratio
      const topLeft = prediction.topLeft as [number, number];
      const bottomRight = prediction.bottomRight as [number, number];
      const faceWidth = bottomRight[0] - topLeft[0];
      const faceHeight = bottomRight[1] - topLeft[1];
      const faceArea = faceWidth * faceHeight;
      const faceRatio = faceArea / frameArea;

      // Check if face size is reasonable for ID card
      if (faceRatio >= MIN_FACE_RATIO && faceRatio <= MAX_FACE_RATIO) {
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestFace = prediction;
        }
      }
    }

    if (!bestFace) {
      // No face matching ID card constraints, return best face anyway with warning
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bestFace = predictions.reduce((best: any, curr: any) => {
        const currConf = curr.probability?.[0] ?? 0;
        const bestConf = best.probability?.[0] ?? 0;
        return currConf > bestConf ? curr : best;
      }, predictions[0]);
      bestConfidence = bestFace.probability?.[0] ?? 0;
    }

    // Extract bounding box
    const topLeft = bestFace.topLeft as [number, number];
    const bottomRight = bestFace.bottomRight as [number, number];

    const bounds: BoundingBox = {
      x: topLeft[0],
      y: topLeft[1],
      width: bottomRight[0] - topLeft[0],
      height: bottomRight[1] - topLeft[1],
    };

    // Extract landmarks if available
    const landmarks = extractLandmarks(bestFace.landmarks as number[][] | undefined);

    return {
      detected: true,
      confidence: bestConfidence,
      bounds,
      landmarks,
    };
  } catch (error) {
    console.error('[FaceDetector] Detection error:', error);
    return createEmptyResult();
  }
}

/**
 * Detect multiple faces (for documents with multiple photos)
 */
export async function detectMultipleFaces(
  imageData: ImageData | HTMLVideoElement | HTMLCanvasElement,
  maxFaces: number = 5
): Promise<FaceDetectionResult[]> {
  if (!isTensorFlowReady() || !blazefaceModel) {
    await initFaceDetector();
    if (!blazefaceModel) return [];
  }

  try {
    const predictions = await blazefaceModel!.estimateFaces(imageData, false);

    return predictions
      .filter(p => (p.probability?.[0] ?? 0) >= MIN_FACE_CONFIDENCE)
      .slice(0, maxFaces)
      .map(prediction => {
        const topLeft = prediction.topLeft as [number, number];
        const bottomRight = prediction.bottomRight as [number, number];

        return {
          detected: true,
          confidence: prediction.probability?.[0] ?? 0,
          bounds: {
            x: topLeft[0],
            y: topLeft[1],
            width: bottomRight[0] - topLeft[0],
            height: bottomRight[1] - topLeft[1],
          },
          landmarks: extractLandmarks(prediction.landmarks as number[][] | undefined),
        };
      });
  } catch (error) {
    console.error('[FaceDetector] Multi-face detection error:', error);
    return [];
  }
}

/**
 * Check if face detector is ready
 */
export function isFaceDetectorReady(): boolean {
  return blazefaceModel !== null && !isLoading;
}

/**
 * Check if face detector is loading
 */
export function isFaceDetectorLoading(): boolean {
  return isLoading;
}

/**
 * Get face detector error if any
 */
export function getFaceDetectorError(): Error | null {
  return loadError;
}

/**
 * Extract landmarks from BlazeFace prediction
 */
function extractLandmarks(landmarks: number[][] | undefined): FaceLandmark[] | null {
  if (!landmarks || landmarks.length < 6) return null;

  // BlazeFace returns 6 landmarks:
  // [rightEye, leftEye, nose, mouth, rightEar, leftEar]
  const landmarkTypes: FaceLandmark['type'][] = [
    'rightEye', 'leftEye', 'nose', 'mouth', 'rightEar', 'leftEar'
  ];

  return landmarks.map((point, index) => ({
    type: landmarkTypes[index] || 'nose',
    position: { x: point[0], y: point[1] } as Point,
  }));
}

/**
 * Create empty result for error/unavailable cases
 */
function createEmptyResult(): FaceDetectionResult {
  return {
    detected: false,
    confidence: 0,
    bounds: null,
    landmarks: null,
  };
}

/**
 * Dispose face detector resources
 */
export async function disposeFaceDetector(): Promise<void> {
  // BlazeFace model doesn't have explicit dispose
  blazefaceModel = null;
  isLoading = false;
  loadError = null;
}
