/**
 * Glare Detection using Brightness Histogram Analysis
 *
 * Detects glare/reflections on documents by analyzing:
 * 1. Brightness histogram distribution
 * 2. Saturation in bright areas (overexposed = low saturation)
 * 3. Local brightness hotspots
 */

import type { GlareDetectionResult } from './types';
import { getTensorFlow, isTensorFlowReady, disposeTensor } from './model-loader';

// Glare detection thresholds
const BRIGHTNESS_THRESHOLD = 240;     // Pixel brightness above this = potential glare
const GLARE_AREA_THRESHOLD = 0.05;    // 5% of image as hotspots = glare detected
const HOTSPOT_MIN_SIZE = 100;         // Minimum pixels in a hotspot
const SATURATION_THRESHOLD = 0.1;     // Low saturation in bright area = glare

/**
 * Detect glare in an image using histogram and hotspot analysis
 */
export async function detectGlare(imageData: ImageData): Promise<GlareDetectionResult> {
  if (!isTensorFlowReady()) {
    return {
      hasGlare: false,
      score: 0,
      hotspotCount: 0,
      brightnessHistogram: [],
    };
  }

  const tf = getTensorFlow();
  let tensor = null;

  try {
    tensor = tf.browser.fromPixels(imageData);

    // Calculate brightness (luminance) for each pixel
    // Y = 0.299*R + 0.587*G + 0.114*B
    const [r, g, b] = tf.split(tensor, 3, 2);
    const brightness = tf.add(
      tf.add(
        tf.mul(r.squeeze([2]), 0.299),
        tf.mul(g.squeeze([2]), 0.587)
      ),
      tf.mul(b.squeeze([2]), 0.114)
    );

    r.dispose();
    g.dispose();
    b.dispose();

    // Calculate histogram
    const histogram = await calculateHistogram(brightness, 256);

    // Count bright pixels (potential glare)
    const brightPixelMask = tf.greater(brightness, BRIGHTNESS_THRESHOLD);
    const brightPixelCount = await tf.sum(tf.cast(brightPixelMask, 'float32')).data();
    const totalPixels = imageData.width * imageData.height;
    const brightRatio = brightPixelCount[0] / totalPixels;

    // Detect hotspots (clusters of very bright pixels)
    const hotspotCount = await countHotspots(imageData, brightness);

    // Calculate saturation in bright areas to distinguish glare from white content
    const glareConfidence = await analyzeGlareConfidence(imageData);

    brightness.dispose();
    brightPixelMask.dispose();

    // Calculate overall glare score
    const score = calculateGlareScore(brightRatio, hotspotCount, glareConfidence);
    const hasGlare = score > GLARE_AREA_THRESHOLD;

    return {
      hasGlare,
      score,
      hotspotCount,
      brightnessHistogram: histogram,
    };
  } catch (error) {
    console.error('[GlareDetector] Error detecting glare:', error);
    return {
      hasGlare: false,
      score: 0,
      hotspotCount: 0,
      brightnessHistogram: [],
    };
  } finally {
    disposeTensor(tensor);
  }
}

/**
 * Fast glare detection for real-time processing
 */
export async function detectGlareFast(imageData: ImageData): Promise<GlareDetectionResult> {
  // Use native JavaScript for faster processing on small images
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;

  let brightPixelCount = 0;
  let veryBrightCount = 0;
  const histogram = new Array(256).fill(0);

  // Sample every 4th pixel for speed
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate brightness
    const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    histogram[brightness]++;

    if (brightness > BRIGHTNESS_THRESHOLD) {
      brightPixelCount++;

      // Check for very saturated bright pixels (actual glare vs white content)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      if (saturation < SATURATION_THRESHOLD && brightness > 250) {
        veryBrightCount++;
      }
    }
  }

  const sampledPixels = Math.floor(totalPixels / 4);
  const brightRatio = brightPixelCount / sampledPixels;
  const veryBrightRatio = veryBrightCount / sampledPixels;

  // Score based on very bright, low-saturation pixels (true glare)
  const score = veryBrightRatio * 10; // Scale up for sensitivity
  const hasGlare = score > GLARE_AREA_THRESHOLD || veryBrightRatio > 0.02;

  return {
    hasGlare,
    score: Math.min(score, 1),
    hotspotCount: Math.floor(veryBrightCount / HOTSPOT_MIN_SIZE),
    brightnessHistogram: histogram,
  };
}

/**
 * Calculate brightness histogram
 */
async function calculateHistogram(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brightness: any,
  bins: number
): Promise<number[]> {
  try {
    const data = await brightness.data();
    const histogram = new Array(bins).fill(0);

    for (let i = 0; i < data.length; i++) {
      const bin = Math.min(Math.floor(data[i]), bins - 1);
      histogram[bin]++;
    }

    // Normalize
    const total = data.length;
    return histogram.map((count: number) => count / total);
  } catch {
    return new Array(bins).fill(0);
  }
}

/**
 * Count hotspot regions (clusters of bright pixels)
 */
async function countHotspots(
  imageData: ImageData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brightness: any
): Promise<number> {
  const tf = getTensorFlow();

  try {
    // Threshold to binary mask
    const mask = tf.greater(brightness, BRIGHTNESS_THRESHOLD);

    // Downsample for faster processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expanded = mask.expandDims(0).expandDims(-1) as any;
    const downsampled = tf.image.resizeNearestNeighbor(
      expanded,
      [Math.floor(imageData.height / 4), Math.floor(imageData.width / 4)]
    );

    const data = await downsampled.data();
    mask.dispose();
    downsampled.dispose();

    // Simple connected component counting (approximate)
    let hotspots = 0;
    let consecutiveBright = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0) {
        consecutiveBright++;
      } else {
        if (consecutiveBright > 5) { // Threshold for hotspot
          hotspots++;
        }
        consecutiveBright = 0;
      }
    }

    return hotspots;
  } catch {
    return 0;
  }
}

/**
 * Analyze glare confidence by checking saturation in bright areas
 */
async function analyzeGlareConfidence(
  imageData: ImageData
): Promise<number> {
  const data = imageData.data;
  let glarePixels = 0;
  let brightPixels = 0;

  // Sample pixels
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > BRIGHTNESS_THRESHOLD) {
      brightPixels++;

      // Calculate saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      // Low saturation in bright area = likely glare
      if (saturation < SATURATION_THRESHOLD) {
        glarePixels++;
      }
    }
  }

  return brightPixels > 0 ? glarePixels / brightPixels : 0;
}

/**
 * Calculate overall glare score
 */
function calculateGlareScore(
  brightRatio: number,
  hotspotCount: number,
  glareConfidence: number
): number {
  // Weighted combination
  const brightScore = Math.min(brightRatio * 5, 1);
  const hotspotScore = Math.min(hotspotCount / 10, 1);
  const confidenceScore = glareConfidence;

  return (brightScore * 0.3 + hotspotScore * 0.3 + confidenceScore * 0.4);
}

/**
 * Get human-readable glare status
 */
export function getGlareStatus(result: GlareDetectionResult): string {
  if (result.score > 0.5) return 'Severe glare detected';
  if (result.score > 0.2) return 'Moderate glare detected';
  if (result.hasGlare) return 'Minor glare detected';
  return 'No glare';
}
