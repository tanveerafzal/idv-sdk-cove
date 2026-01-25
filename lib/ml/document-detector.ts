/**
 * Document Detection using Edge Detection + Contour Analysis
 *
 * Detects ID cards and documents in the camera frame by:
 * 1. Edge detection (Canny-like using Sobel)
 * 2. Rectangle detection
 * 3. Aspect ratio validation
 * 4. Position and size checks
 */

import type { DocumentDetectionResult, BoundingBox, Point } from './types';
import { getTensorFlow, isTensorFlowReady, disposeTensor } from './model-loader';

// ID card aspect ratio (ISO/IEC 7810 ID-1): 85.6mm × 53.98mm ≈ 1.586
const ID_CARD_ASPECT_RATIO = 1.586;
const ASPECT_RATIO_TOLERANCE = 0.3; // Allow ±30% variation

// Minimum document coverage in frame
const MIN_COVERAGE = 0.20;  // Document should cover at least 20% of frame
const MAX_COVERAGE = 0.90;  // Document shouldn't cover more than 90%

// Edge detection thresholds
const EDGE_LOW_THRESHOLD = 50;

/**
 * Detect document in image using edge detection
 */
export async function detectDocument(imageData: ImageData): Promise<DocumentDetectionResult> {
  if (!isTensorFlowReady()) {
    return createEmptyResult();
  }

  const tf = getTensorFlow();
  let grayscale = null;
  let edges = null;

  try {
    // Convert to grayscale
    const tensor = tf.browser.fromPixels(imageData);
    grayscale = tf.mean(tensor, 2);
    tensor.dispose();

    // Apply Gaussian blur to reduce noise
    const blurred = await applyGaussianBlur(grayscale);

    // Detect edges using Sobel operators
    edges = await detectEdges(blurred);
    blurred.dispose();

    // Find document bounds from edges
    const bounds = await findDocumentBounds(edges, imageData.width, imageData.height);

    if (!bounds) {
      return createEmptyResult();
    }

    // Validate aspect ratio
    const aspectRatio = bounds.width / bounds.height;
    const isValidAspectRatio = isAspectRatioValid(aspectRatio);

    // Validate coverage
    const coverage = (bounds.width * bounds.height) / (imageData.width * imageData.height);

    // Calculate confidence based on edge strength and geometry
    const confidence = calculateConfidence(bounds, aspectRatio, coverage, isValidAspectRatio);

    // Extract corners (approximate)
    const corners = extractCorners(bounds);

    return {
      detected: confidence > 0.5,
      confidence,
      bounds,
      corners,
      aspectRatio,
    };
  } catch (error) {
    console.error('[DocumentDetector] Detection error:', error);
    return createEmptyResult();
  } finally {
    disposeTensor(grayscale);
    disposeTensor(edges);
  }
}

/**
 * Fast document detection - SCAN LINE APPROACH
 * Finds document edges by scanning rows and columns for brightness transitions
 */
export async function detectDocumentFast(imageData: ImageData): Promise<DocumentDetectionResult> {
  const { width, height, data } = imageData;

  // Get brightness at a pixel
  const getBrightness = (x: number, y: number): number => {
    const idx = (y * width + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  // Scan parameters
  const scanStep = 2;
  const edgeThreshold = 35;
  const minEdgeRun = 20; // Minimum continuous edge length

  // Find TOP edge - scan from top down, looking for bright-to-dark or dark-to-bright transition
  let topEdge = -1;
  for (let y = 10; y < height / 2; y += scanStep) {
    let edgeCount = 0;
    for (let x = width * 0.1; x < width * 0.9; x += scanStep) {
      const above = getBrightness(x, y - scanStep);
      const current = getBrightness(x, y);
      if (Math.abs(above - current) > edgeThreshold) {
        edgeCount++;
      }
    }
    if (edgeCount > minEdgeRun) {
      topEdge = y;
      break;
    }
  }

  // Find BOTTOM edge - scan from bottom up
  let bottomEdge = -1;
  for (let y = height - 10; y > height / 2; y -= scanStep) {
    let edgeCount = 0;
    for (let x = width * 0.1; x < width * 0.9; x += scanStep) {
      const below = getBrightness(x, y + scanStep);
      const current = getBrightness(x, y);
      if (Math.abs(below - current) > edgeThreshold) {
        edgeCount++;
      }
    }
    if (edgeCount > minEdgeRun) {
      bottomEdge = y;
      break;
    }
  }

  // Find LEFT edge - scan from left to right
  let leftEdge = -1;
  for (let x = 10; x < width / 2; x += scanStep) {
    let edgeCount = 0;
    for (let y = height * 0.1; y < height * 0.9; y += scanStep) {
      const left = getBrightness(x - scanStep, y);
      const current = getBrightness(x, y);
      if (Math.abs(left - current) > edgeThreshold) {
        edgeCount++;
      }
    }
    if (edgeCount > minEdgeRun) {
      leftEdge = x;
      break;
    }
  }

  // Find RIGHT edge - scan from right to left
  let rightEdge = -1;
  for (let x = width - 10; x > width / 2; x -= scanStep) {
    let edgeCount = 0;
    for (let y = height * 0.1; y < height * 0.9; y += scanStep) {
      const right = getBrightness(x + scanStep, y);
      const current = getBrightness(x, y);
      if (Math.abs(right - current) > edgeThreshold) {
        edgeCount++;
      }
    }
    if (edgeCount > minEdgeRun) {
      rightEdge = x;
      break;
    }
  }

  // Check if we found all 4 edges
  const foundAllEdges = topEdge > 0 && bottomEdge > 0 && leftEdge > 0 && rightEdge > 0;

  if (!foundAllEdges) {
    return createEmptyResult();
  }

  // Validate the detected rectangle
  const detectedWidth = rightEdge - leftEdge;
  const detectedHeight = bottomEdge - topEdge;
  const aspectRatio = detectedWidth / detectedHeight;
  const coverage = (detectedWidth * detectedHeight) / (width * height);

  const isValidSize = coverage >= 0.15 && coverage <= 0.85;
  const isValidAspect = isAspectRatioValid(aspectRatio);

  // Calculate confidence
  let confidence = 0.4; // Base for finding 4 edges
  if (isValidSize) confidence += 0.3;
  if (isValidAspect) confidence += 0.3;

  const detected = foundAllEdges && isValidSize;

  const bounds: BoundingBox = {
    x: leftEdge,
    y: topEdge,
    width: detectedWidth,
    height: detectedHeight,
  };

  return {
    detected,
    confidence,
    bounds: detected ? bounds : null,
    corners: detected ? extractCorners(bounds) : null,
    aspectRatio: detected ? aspectRatio : null,
  };
}

/**
 * Apply Gaussian blur to reduce noise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyGaussianBlur(tensor: any): Promise<any> {
  const tf = getTensorFlow();

  // 3x3 Gaussian kernel
  const gaussianKernel = tf.tensor4d(
    [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v: number) => v / 16),
    [3, 3, 1, 1]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = tensor.expandDims(0).expandDims(-1) as any;
  const blurred = tf.conv2d(input, gaussianKernel, 1, 'same');

  gaussianKernel.dispose();

  return blurred.squeeze([0, 3]);
}

/**
 * Detect edges using Sobel operators
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detectEdges(tensor: any): Promise<any> {
  const tf = getTensorFlow();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = tensor.expandDims(0).expandDims(-1) as any;

  // Sobel X
  const sobelX = tf.tensor4d(
    [-1, 0, 1, -2, 0, 2, -1, 0, 1],
    [3, 3, 1, 1]
  );

  // Sobel Y
  const sobelY = tf.tensor4d(
    [-1, -2, -1, 0, 0, 0, 1, 2, 1],
    [3, 3, 1, 1]
  );

  const gx = tf.conv2d(input, sobelX, 1, 'same');
  const gy = tf.conv2d(input, sobelY, 1, 'same');

  // Gradient magnitude
  const magnitude = tf.sqrt(tf.add(tf.square(gx), tf.square(gy)));

  sobelX.dispose();
  sobelY.dispose();
  gx.dispose();
  gy.dispose();

  return magnitude.squeeze([0, 3]);
}

/**
 * Find document bounds from edge image
 */
async function findDocumentBounds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any,
  width: number,
  height: number
): Promise<BoundingBox | null> {
  const tf = getTensorFlow();

  try {
    // Threshold edges
    const threshold = tf.greater(edges, EDGE_LOW_THRESHOLD);
    const data = await threshold.data();
    threshold.dispose();

    // Find bounding box of strong edges
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let edgeCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x]) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          edgeCount++;
        }
      }
    }

    // Need minimum edges to detect document
    if (edgeCount < width * height * 0.01) {
      return null;
    }

    // Add padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width, maxX + padding);
    maxY = Math.min(height, maxY + padding);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  } catch {
    return null;
  }
}


/**
 * Validate aspect ratio for ID card
 */
function isAspectRatioValid(aspectRatio: number): boolean {
  const minRatio = ID_CARD_ASPECT_RATIO * (1 - ASPECT_RATIO_TOLERANCE);
  const maxRatio = ID_CARD_ASPECT_RATIO * (1 + ASPECT_RATIO_TOLERANCE);

  // Check both orientations (landscape and portrait)
  return (
    (aspectRatio >= minRatio && aspectRatio <= maxRatio) ||
    (aspectRatio >= 1 / maxRatio && aspectRatio <= 1 / minRatio)
  );
}

/**
 * Calculate detection confidence
 */
function calculateConfidence(
  bounds: BoundingBox,
  aspectRatio: number,
  coverage: number,
  isValidAspectRatio: boolean
): number {
  let confidence = 0.3; // Base confidence

  // Boost for valid aspect ratio
  if (isValidAspectRatio) {
    confidence += 0.3;
  }

  // Boost for good coverage
  if (coverage >= 0.2 && coverage <= 0.8) {
    confidence += 0.2;
  }

  // Boost for centered document
  confidence += 0.2; // Default centering bonus

  return Math.min(confidence, 1);
}

/**
 * Extract corners from bounding box
 */
function extractCorners(bounds: BoundingBox): Point[] {
  return [
    { x: bounds.x, y: bounds.y },                              // Top-left
    { x: bounds.x + bounds.width, y: bounds.y },               // Top-right
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // Bottom-right
    { x: bounds.x, y: bounds.y + bounds.height },              // Bottom-left
  ];
}

/**
 * Create empty result
 */
function createEmptyResult(): DocumentDetectionResult {
  return {
    detected: false,
    confidence: 0,
    bounds: null,
    corners: null,
    aspectRatio: null,
  };
}
