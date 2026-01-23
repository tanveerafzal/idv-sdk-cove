/**
 * ML Detection Types for ID Card Capture
 */

export interface DetectionResult {
  documentDetected: boolean;
  documentConfidence: number;
  documentBounds: BoundingBox | null;
  isBlurry: boolean;
  blurScore: number;
  hasGlare: boolean;
  glareScore: number;
  faceDetected: boolean;
  faceConfidence: number;
  faceBounds: BoundingBox | null;
  readyForCapture: boolean;
  overallQuality: QualityLevel;
  timestamp: number;
}

export type QualityLevel = 'poor' | 'fair' | 'good' | 'excellent';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionConfig {
  minDocumentConfidence: number;
  maxBlurScore: number;
  maxGlareScore: number;
  minFaceConfidence: number;
  autoCaptureDelayMs: number;
  frameRateTarget: number;
  enableFaceDetection: boolean;
  enableBlurDetection: boolean;
  enableGlareDetection: boolean;
  enableDocumentDetection: boolean;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  minDocumentConfidence: 0.5,   // Lowered - more tolerant
  maxBlurScore: 0.5,            // Increased - allow more blur
  maxGlareScore: 0.4,           // Increased - allow more glare
  minFaceConfidence: 0.4,       // Lowered - more tolerant
  autoCaptureDelayMs: 2000,     // Faster capture
  frameRateTarget: 8,           // Slightly lower FPS for stability
  enableFaceDetection: true,
  enableBlurDetection: true,
  enableGlareDetection: true,
  enableDocumentDetection: true,
};

export interface DetectorStatus {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
}

export interface BlurDetectionResult {
  isBlurry: boolean;
  score: number;
  variance: number;
}

export interface GlareDetectionResult {
  hasGlare: boolean;
  score: number;
  hotspotCount: number;
  brightnessHistogram: number[];
}

export interface DocumentDetectionResult {
  detected: boolean;
  confidence: number;
  bounds: BoundingBox | null;
  corners: Point[] | null;
  aspectRatio: number | null;
}

export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  bounds: BoundingBox | null;
  landmarks: FaceLandmark[] | null;
}

export interface Point {
  x: number;
  y: number;
}

export interface FaceLandmark {
  type: 'leftEye' | 'rightEye' | 'nose' | 'mouth' | 'leftEar' | 'rightEar';
  position: Point;
}

export interface FrameData {
  imageData: ImageData;
  width: number;
  height: number;
  timestamp: number;
}

export type DetectionStatusMessage =
  | 'Position ID card in frame'
  | 'Hold camera still - image is blurry'
  | 'Tilt document to reduce glare'
  | 'Ensure face on ID is visible'
  | 'Perfect! Hold still...'
  | 'Capturing...';

export interface AutoCaptureState {
  isCountingDown: boolean;
  countdownProgress: number;
  remainingMs: number;
  shouldCapture: boolean;
}
