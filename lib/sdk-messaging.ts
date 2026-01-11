/**
 * SDK Messaging - Handles communication with parent SDK when embedded in iframe
 */

export type SDKMessageType =
  | 'IDV_READY'
  | 'IDV_START'
  | 'IDV_STEP'
  | 'IDV_COMPLETE'
  | 'IDV_ERROR'
  | 'IDV_CLOSE';

export interface SDKMessage<T = unknown> {
  type: SDKMessageType;
  payload: T;
  timestamp: string;
  nonce: string;
}

/**
 * Generate a random nonce for message deduplication
 */
function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Send a message to the parent SDK
 */
export function sendToParent<T>(
  type: SDKMessageType,
  payload: T,
  parentOrigin: string | null
): void {
  if (!parentOrigin || typeof window === 'undefined' || window.parent === window) {
    return; // Not in iframe or no parent origin
  }

  const message: SDKMessage<T> = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    nonce: generateNonce(),
  };

  try {
    window.parent.postMessage(message, parentOrigin);
  } catch (error) {
    console.error('[IDV] Failed to send message to parent:', error);
  }
}

/**
 * Check if we're running in SDK embed mode
 */
export function isSDKEmbed(searchParams: URLSearchParams): boolean {
  return searchParams.has('api-key') && searchParams.has('origin');
}

/**
 * Get parent origin from URL params
 */
export function getParentOrigin(searchParams: URLSearchParams): string | null {
  return searchParams.get('origin');
}

/**
 * Parse theme from URL params
 */
export function parseThemeFromParams(searchParams: URLSearchParams): Record<string, string> | null {
  const themeParam = searchParams.get('theme');
  if (!themeParam) return null;

  try {
    return JSON.parse(atob(themeParam));
  } catch {
    console.warn('[IDV] Failed to parse theme parameter');
    return null;
  }
}

/**
 * Get step name for SDK messaging
 */
export function getStepName(step: number): string {
  const stepMap: Record<number, string> = {
    1: 'intro',
    2: 'document_select',
    3: 'document_capture',
    4: 'document_review',
    5: 'selfie_intro',
    6: 'selfie_capture',
    7: 'selfie_review',
    7.5: 'processing',
    8: 'complete',
  };
  return stepMap[step] || 'unknown';
}

/**
 * Mask document number for frontend display
 */
export function maskDocumentNumber(documentNumber: string | undefined): string | undefined {
  if (!documentNumber || documentNumber.length < 4) return documentNumber;
  const lastFour = documentNumber.slice(-4);
  const masked = 'X'.repeat(documentNumber.length - 4);
  return masked + lastFour;
}
