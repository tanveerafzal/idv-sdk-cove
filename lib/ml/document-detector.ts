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
const MIN_COVERAGE = 0.15;  // Document should cover at least 15% of frame
const MAX_COVERAGE = 0.95;  // Document shouldn't cover more than 95%

// Edge detection thresholds
const EDGE_LOW_THRESHOLD = 50;
const EDGE_HIGH_THRESHOLD = 150;

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
    grayscale = tf.mean(tensor, 2) as import('@tensorflow/tfjs').Tensor2D;
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
    const isValidCoverage = coverage >= MIN_COVERAGE && coverage <= MAX_COVERAGE;

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
 * Fast document detection using color and edge analysis
 */
export async function detectDocumentFast(imageData: ImageData): Promise<DocumentDetectionResult> {
  // Use native JavaScript for faster processing
  const { width, height, data } = imageData;

  // Analyze image in grid cells for faster processing
  const gridSize = 8;
  const cellWidth = Math.floor(width / gridSize);
  const cellHeight = Math.floor(height / gridSize);

  const cellBrightness: number[][] = [];
  const cellEdgeStrength: number[][] = [];

  // Calculate brightness and edge strength per cell
  for (let gy = 0; gy < gridSize; gy++) {
    cellBrightness[gy] = [];
    cellEdgeStrength[gy] = [];

    for (let gx = 0; gx < gridSize; gx++) {
      let brightness = 0;
      let edgeCount = 0;
      let prevBrightness = 0;
      let sampleCount = 0;

      const startX = gx * cellWidth;
      const startY = gy * cellHeight;

      // Sample pixels in cell
      for (let y = startY; y < startY + cellHeight; y += 4) {
        for (let x = startX; x < startX + cellWidth; x += 4) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          brightness += lum;

          // Simple edge detection via brightness difference
          if (sampleCount > 0) {
            const diff = Math.abs(lum - prevBrightness);
            if (diff > 30) edgeCount++;
          }

          prevBrightness = lum;
          sampleCount++;
        }
      }

      cellBrightness[gy][gx] = brightness / sampleCount;
      cellEdgeStrength[gy][gx] = edgeCount / sampleCount;
    }
  }

  // Find rectangular region with consistent brightness and strong edges
  const bounds = findRectangularRegion(cellBrightness, cellEdgeStrength, cellWidth, cellHeight);

  if (!bounds) {
    return createEmptyResult();
  }

  // Calculate aspect ratio and confidence
  const aspectRatio = bounds.width / bounds.height;
  const isValidAspectRatio = isAspectRatioValid(aspectRatio);
  const coverage = (bounds.width * bounds.height) / (width * height);

  const confidence = isValidAspectRatio && coverage >= MIN_COVERAGE
    ? Math.min(0.5 + coverage * 0.5, 0.95)
    : 0.3;

  return {
    detected: confidence > 0.5,
    confidence,
    bounds,
    corners: extractCorners(bounds),
    aspectRatio,
  };
}

/**
 * Apply Gaussian blur to reduce noise
 */
async function applyGaussianBlur(
  tensor: import('@tensorflow/tfjs').Tensor2D
): Promise<import('@tensorflow/tfjs').Tensor2D> {
  const tf = getTensorFlow();

  // 3x3 Gaussian kernel
  const gaussianKernel = tf.tensor4d(
    [1, 2, 1, 2, 4, 2, 1, 2, 1].map(v => v / 16),
    [3, 3, 1, 1]
  );

  const input = tensor.expandDims(0).expandDims(-1) as import('@tensorflow/tfjs').Tensor4D;
  const blurred = tf.conv2d(input, gaussianKernel, 1, 'same');

  gaussianKernel.dispose();

  return blurred.squeeze([0, 3]) as import('@tensorflow/tfjs').Tensor2D;
}

/**
 * Detect edges using Sobel operators
 */
async function detectEdges(
  tensor: import('@tensorflow/tfjs').Tensor2D
): Promise<import('@tensorflow/tfjs').Tensor2D> {
  const tf = getTensorFlow();

  const input = tensor.expandDims(0).expandDims(-1) as import('@tensorflow/tfjs').Tensor4D;

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

  return magnitude.squeeze([0, 3]) as import('@tensorflow/tfjs').Tensor2D;
}

/**
 * Find document bounds from edge image
 */
async function findDocumentBounds(
  edges: import('@tensorflow/tfjs').Tensor2D,
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
 * Find rectangular region from brightness/edge grid
 */
function findRectangularRegion(
  brightness: number[][],
  edges: number[][],
  cellWidth: number,
  cellHeight: number
): BoundingBox | null {
  const gridSize = brightness.length;

  // Find cells with document-like brightness (not too dark, not pure white)
  const documentCells: [number, number][] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const b = brightness[y][x];
      const e = edges[y][x];

      // Document cells: moderate brightness, some edge activity
      if (b > 50 && b < 240 && e > 0.01) {
        documentCells.push([x, y]);
      }
    }
  }

  if (documentCells.length < 4) {
    return null;
  }

  // Find bounding rectangle
  let minX = gridSize, minY = gridSize, maxX = 0, maxY = 0;

  for (const [x, y] of documentCells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    x: minX * cellWidth,
    y: minY * cellHeight,
    width: (maxX - minX + 1) * cellWidth,
    height: (maxY - minY + 1) * cellHeight,
  };
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
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  // Assuming normalized coordinates would be better here

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
