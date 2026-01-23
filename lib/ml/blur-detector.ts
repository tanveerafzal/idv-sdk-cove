/**
 * Blur Detection using Laplacian Variance Method
 *
 * Uses TensorFlow.js for GPU-accelerated computation of the Laplacian
 * variance, which is a reliable indicator of image sharpness.
 * Lower variance = blurrier image
 */

import type { BlurDetectionResult } from './types';
import { getTensorFlow, isTensorFlowReady, imageDataToGrayscale, disposeTensor } from './model-loader';

// Laplacian kernel for edge detection (approximates second derivative)
const LAPLACIAN_KERNEL = [
  [0, 1, 0],
  [1, -4, 1],
  [0, 1, 0],
];

// Threshold for blur detection (lower variance = blurrier)
// These values are calibrated for typical webcam/phone cameras
const BLUR_THRESHOLD_LOW = 100;   // Below this = very blurry
const BLUR_THRESHOLD_HIGH = 500;  // Above this = sharp

/**
 * Detect blur in an image using Laplacian variance
 * @param imageData - ImageData from canvas
 * @returns BlurDetectionResult with blur status and score
 */
export async function detectBlur(imageData: ImageData): Promise<BlurDetectionResult> {
  if (!isTensorFlowReady()) {
    // Return non-blocking result if TF not ready
    return {
      isBlurry: false,
      score: 0,
      variance: 0,
    };
  }

  const tf = getTensorFlow();
  let grayscale = null;
  let kernel = null;
  let convResult = null;
  let variance = null;

  try {
    // Convert to grayscale tensor
    grayscale = imageDataToGrayscale(imageData);

    // Reshape for conv2d: [batch, height, width, channels]
    const input = grayscale.expandDims(0).expandDims(-1) as import('@tensorflow/tfjs').Tensor4D;

    // Create Laplacian kernel tensor [height, width, inChannels, outChannels]
    kernel = tf.tensor4d(
      LAPLACIAN_KERNEL.flat(),
      [3, 3, 1, 1]
    );

    // Apply Laplacian convolution
    convResult = tf.conv2d(input, kernel, 1, 'same');

    // Calculate variance of the Laplacian
    const mean = tf.mean(convResult);
    const squaredDiff = tf.squaredDifference(convResult, mean);
    variance = tf.mean(squaredDiff);

    // Get variance value
    const varianceValue = (await variance.data())[0];

    // Calculate blur score (0 = very blurry, 1 = very sharp)
    const score = normalizeBlurScore(varianceValue);
    const isBlurry = varianceValue < BLUR_THRESHOLD_LOW;

    // Cleanup intermediate tensors
    input.dispose();
    mean.dispose();
    squaredDiff.dispose();

    return {
      isBlurry,
      score,
      variance: varianceValue,
    };
  } catch (error) {
    console.error('[BlurDetector] Error detecting blur:', error);
    return {
      isBlurry: false,
      score: 0.5,
      variance: 0,
    };
  } finally {
    // Cleanup tensors
    disposeTensor(grayscale);
    disposeTensor(kernel);
    disposeTensor(convResult);
    disposeTensor(variance);
  }
}

/**
 * Fast blur detection using downsampled image
 * More efficient for real-time processing
 */
export async function detectBlurFast(imageData: ImageData): Promise<BlurDetectionResult> {
  if (!isTensorFlowReady()) {
    return { isBlurry: false, score: 0.5, variance: 0 };
  }

  const tf = getTensorFlow();
  let grayscale = null;
  let downsampled = null;

  try {
    grayscale = imageDataToGrayscale(imageData);

    // Downsample to 200x200 max for faster processing
    const targetSize = 200;
    const scale = Math.min(targetSize / imageData.width, targetSize / imageData.height, 1);
    const newWidth = Math.round(imageData.width * scale);
    const newHeight = Math.round(imageData.height * scale);

    if (scale < 1) {
      downsampled = tf.image.resizeBilinear(
        grayscale.expandDims(0).expandDims(-1) as import('@tensorflow/tfjs').Tensor4D,
        [newHeight, newWidth]
      ).squeeze([0, 3]) as import('@tensorflow/tfjs').Tensor2D;
      grayscale.dispose();
      grayscale = downsampled;
    }

    // Calculate variance using simple approach
    const mean = tf.mean(grayscale);
    const squaredDiff = tf.squaredDifference(grayscale, mean);
    const variance = await tf.mean(squaredDiff).data();

    // Apply Sobel-like edge detection for faster blur estimation
    // Note: tensor4d requires flat array when shape is specified
    const sobelXKernel = tf.tensor4d(
      [-1, 0, 1, -2, 0, 2, -1, 0, 1],  // Flattened 3x3 kernel
      [3, 3, 1, 1]
    );
    const sobelYKernel = tf.tensor4d(
      [-1, -2, -1, 0, 0, 0, 1, 2, 1],  // Flattened 3x3 kernel
      [3, 3, 1, 1]
    );

    const sobelX = tf.conv2d(
      grayscale.expandDims(0).expandDims(-1) as import('@tensorflow/tfjs').Tensor4D,
      sobelXKernel,
      1,
      'same'
    );
    const sobelY = tf.conv2d(
      grayscale.expandDims(0).expandDims(-1) as import('@tensorflow/tfjs').Tensor4D,
      sobelYKernel,
      1,
      'same'
    );
    const gradient = tf.sqrt(tf.add(tf.square(sobelX), tf.square(sobelY)));
    const edgeVariance = await tf.mean(gradient).data();

    mean.dispose();
    squaredDiff.dispose();
    sobelXKernel.dispose();
    sobelYKernel.dispose();
    sobelX.dispose();
    sobelY.dispose();
    gradient.dispose();

    const score = normalizeBlurScore(edgeVariance[0] * 100);
    const isBlurry = edgeVariance[0] < 5; // Low edge response = blurry

    return {
      isBlurry,
      score,
      variance: variance[0],
    };
  } catch (error) {
    console.error('[BlurDetector] Fast blur detection error:', error);
    return { isBlurry: false, score: 0.5, variance: 0 };
  } finally {
    disposeTensor(grayscale);
  }
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
