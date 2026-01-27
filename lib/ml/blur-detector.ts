/**
 * Blur Detection using Laplacian Variance Method
 *
 * Uses pure JavaScript for zero GPU memory usage.
 * Laplacian variance is a reliable indicator of image sharpness.
 * Lower variance = blurrier image
 */

import type { BlurDetectionResult } from './types';

// Threshold for blur detection (lower variance = blurrier)
const BLUR_THRESHOLD_LOW = 100;   // Below this = very blurry
const BLUR_THRESHOLD_HIGH = 500;  // Above this = sharp
const EDGE_THRESHOLD_LOW = 5;     // Low edge response = blurry

/**
 * Fast blur detection using pure JavaScript (no TensorFlow, no GPU memory leaks)
 * Uses Laplacian variance on sampled pixels
 */
export async function detectBlurFast(imageData: ImageData): Promise<BlurDetectionResult> {
  const { width, height, data } = imageData;

  // Get grayscale brightness at pixel
  const getBrightness = (x: number, y: number): number => {
    const idx = (y * width + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  };

  // Apply Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
  // and calculate variance of the result
  const step = 2; // Sample every 2nd pixel for speed
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      // Laplacian = -4*center + top + bottom + left + right
      const laplacian =
        -4 * getBrightness(x, y) +
        getBrightness(x, y - 1) +
        getBrightness(x, y + 1) +
        getBrightness(x - 1, y) +
        getBrightness(x + 1, y);

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  // Calculate variance: E[X^2] - E[X]^2
  const mean = sum / count;
  const variance = (sumSq / count) - (mean * mean);

  // Also calculate Sobel edge response for blur estimation
  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y += step * 2) {
    for (let x = 1; x < width - 1; x += step * 2) {
      // Simplified Sobel X: -left + right
      const gx = getBrightness(x + 1, y) - getBrightness(x - 1, y);
      // Simplified Sobel Y: -top + bottom
      const gy = getBrightness(x, y + 1) - getBrightness(x, y - 1);
      edgeSum += Math.sqrt(gx * gx + gy * gy);
      edgeCount++;
    }
  }

  const edgeMean = edgeSum / edgeCount;
  const score = normalizeBlurScore(edgeMean * 100);
  const isBlurry = edgeMean < EDGE_THRESHOLD_LOW;

  return {
    isBlurry,
    score,
    variance,
  };
}

/**
 * Normalize variance to a 0-1 score
 */
function normalizeBlurScore(variance: number): number {
  if (variance <= BLUR_THRESHOLD_LOW) {
    return variance / BLUR_THRESHOLD_LOW * 0.3; // 0-0.3 for very blurry
  } else if (variance >= BLUR_THRESHOLD_HIGH) {
    return 1; // Sharp
  } else {
    // Linear interpolation between thresholds
    return 0.3 + (variance - BLUR_THRESHOLD_LOW) / (BLUR_THRESHOLD_HIGH - BLUR_THRESHOLD_LOW) * 0.7;
  }
}

/**
 * Get human-readable blur status
 */
export function getBlurStatus(result: BlurDetectionResult): string {
  if (result.score < 0.3) return 'Very blurry';
  if (result.score < 0.5) return 'Slightly blurry';
  if (result.score < 0.7) return 'Acceptable';
  return 'Sharp';
}
