/**
 * Lazy Model Loader with Caching
 * Handles TensorFlow.js initialization and model loading
 */

import type { DetectorStatus } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tf: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let blazeface: any = null;

interface LoadedModels {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blazeface: any;
}

const loadedModels: LoadedModels = {
  blazeface: null,
};

let tfInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize TensorFlow.js with WebGL backend
 */
export async function initializeTensorFlow(): Promise<void> {
  if (tfInitialized) return;

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Dynamic import to prevent SSR issues
      tf = await import('@tensorflow/tfjs');
      await import('@tensorflow/tfjs-backend-webgl');

      // Set WebGL backend for GPU acceleration
      await tf.setBackend('webgl');
      await tf.ready();

      // Configure for performance
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      tf.env().set('WEBGL_PACK', true);

      tfInitialized = true;
      console.log('[ML] TensorFlow.js initialized with WebGL backend');
    } catch (error) {
      console.error('[ML] Failed to initialize TensorFlow.js:', error);
      // Try CPU fallback
      try {
        if (tf) {
          await tf.setBackend('cpu');
          await tf.ready();
          tfInitialized = true;
          console.log('[ML] TensorFlow.js initialized with CPU backend (fallback)');
        }
      } catch (cpuError) {
        console.error('[ML] CPU fallback also failed:', cpuError);
        throw new Error('Failed to initialize TensorFlow.js');
      }
    }
  })();

  return initializationPromise;
}

/**
 * Load BlazeFace model for face detection
 */
export async function loadBlazeFaceModel(): Promise<typeof loadedModels.blazeface> {
  if (loadedModels.blazeface) {
    return loadedModels.blazeface;
  }

  await initializeTensorFlow();

  try {
    blazeface = await import('@tensorflow-models/blazeface');
    loadedModels.blazeface = await blazeface.load({
      maxFaces: 5, // Detect up to 5 faces (for documents with multiple photos)
    });
    console.log('[ML] BlazeFace model loaded');
    return loadedModels.blazeface;
  } catch (error) {
    console.error('[ML] Failed to load BlazeFace model:', error);
    throw error;
  }
}

/**
 * Get TensorFlow.js instance (must be initialized first)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTensorFlow(): any {
  if (!tf) {
    throw new Error('TensorFlow.js not initialized. Call initializeTensorFlow() first.');
  }
  return tf;
}

/**
 * Check if TensorFlow is initialized and ready
 */
export function isTensorFlowReady(): boolean {
  return tfInitialized && tf !== null;
}

/**
 * Get current model loading status
 */
export function getModelStatus(): DetectorStatus {
  return {
    isLoading: initializationPromise !== null && !tfInitialized,
    isReady: tfInitialized,
    error: null,
  };
}

/**
 * Dispose all loaded models and cleanup
 */
export async function disposeModels(): Promise<void> {
  if (loadedModels.blazeface) {
    // BlazeFace doesn't have a dispose method, but we clear the reference
    loadedModels.blazeface = null;
  }

  if (tf) {
    // Dispose all tensors
    tf.disposeVariables();
  }

  console.log('[ML] Models disposed');
}

/**
 * Create an image tensor from ImageData for processing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function imageDataToTensor(imageData: ImageData): any {
  if (!tf) {
    throw new Error('TensorFlow.js not initialized');
  }

  return tf.browser.fromPixels(imageData);
}

/**
 * Create a grayscale tensor from ImageData
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function imageDataToGrayscale(imageData: ImageData): any {
  if (!tf) {
    throw new Error('TensorFlow.js not initialized');
  }

  const tensor = tf.browser.fromPixels(imageData);
  // Convert to grayscale using luminosity method
  const grayscale = tf.mean(tensor, 2);
  tensor.dispose();
  return grayscale;
}

/**
 * Cleanup a tensor after use
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function disposeTensor(tensor: any): void {
  if (tensor && !tensor.isDisposed) {
    tensor.dispose();
  }
}
