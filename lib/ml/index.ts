/**
 * ML Detection Module
 *
 * Provides client-side ML-based detection for ID card capture:
 * - Document detection
 * - Blur detection
 * - Glare detection
 * - Face detection
 */

// Types
export type {
  DetectionResult,
  DetectionConfig,
  QualityLevel,
  BoundingBox,
  DetectorStatus,
  BlurDetectionResult,
  GlareDetectionResult,
  DocumentDetectionResult,
  FaceDetectionResult,
  Point,
  FaceLandmark,
  FrameData,
  DetectionStatusMessage,
  AutoCaptureState,
} from './types';

export { DEFAULT_DETECTION_CONFIG } from './types';

// Model loader
export {
  initializeTensorFlow,
  loadBlazeFaceModel,
  getTensorFlow,
  isTensorFlowReady,
  getModelStatus,
  disposeModels,
} from './model-loader';

// Individual detectors
export { detectBlur, detectBlurFast, getBlurStatus } from './blur-detector';
export { detectGlare, detectGlareFast, getGlareStatus } from './glare-detector';
export {
  detectFace,
  detectMultipleFaces,
  initFaceDetector,
  isFaceDetectorReady,
  isFaceDetectorLoading,
  getFaceDetectorError,
  disposeFaceDetector,
} from './face-detector';
export { detectDocument, detectDocumentFast } from './document-detector';

// Frame analyzer (main entry point)
export {
  initializeAnalyzer,
  analyzeFrame,
  analyzeVideoFrame,
  getStatusMessage,
  isAnalyzerReady,
  disposeAnalyzer,
  resetMotionHistory,
} from './frame-analyzer';
