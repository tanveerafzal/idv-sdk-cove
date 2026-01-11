/**
 * TrustCredo Verification API Service
 *
 * This file contains all API calls needed for the ID verification flow.
 */

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.trustcredo.com';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

// Types
export interface VerificationData {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  partnerId?: string;
  user?: {
    fullName?: string;
    email?: string;
  };
  allowedDocumentTypes?: string[];
  retryCount: number;
  maxRetries: number;
}

export interface PartnerInfo {
  companyName: string;
  logoUrl?: string;
}

export interface DocumentUploadResponse {
  documentId: string;
  documentType: string;
  detection?: {
    detectedType: string;
    confidence: number;
  };
}

export interface SelfieUploadResponse {
  selfieId: string;
  faceDetected: boolean;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  checks: {
    documentAuthentic: boolean;
    documentExpired: boolean;
    documentTampered: boolean;
    faceMatch?: boolean;
    faceMatchScore?: number;
    nameMatch?: boolean;
    nameMatchScore?: number;
  };
  extractedData: {
    fullName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    expiryDate?: string;
    issuingCountry?: string;
    address?: string;
  };
  flags: string[];
  warnings: string[];
  canRetry?: boolean;
  remainingRetries?: number;
  message?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  message?: string;
}

// Helper function to get API URL
export function getApiUrl(path: string): string {
  // Insert API version after /api/ (e.g., /api/verifications -> /api/v1/verifications)
  const versionedPath = path.replace(/^\/api\//, `/api/${API_VERSION}/`);
  return `${API_BASE_URL}${versionedPath}`;
}

// Helper to convert base64 to File
export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * 1. Get verification details
 */
export async function getVerification(verificationId: string): Promise<VerificationData> {
  const response = await fetch(getApiUrl(`/api/verifications/${verificationId}`));

  if (!response.ok) {
    throw new Error('Failed to load verification');
  }

  const data = await response.json();
  return data.data;
}

/**
 * 3. Get partner public info
 */
export async function getPartnerInfo(partnerId: string): Promise<PartnerInfo> {
  const response = await fetch(getApiUrl(`/api/partners/${partnerId}/public`));

  if (!response.ok) {
    throw new Error('Failed to load partner info');
  }

  const data = await response.json();
  return data.data;
}

/**
 * 4. Validate API key and get partner info
 */
export async function validateApiKey(apiKey: string): Promise<PartnerInfo> {
  const response = await fetch(getApiUrl(`/api/partners/validate-key?apiKey=${apiKey}`));

  if (!response.ok) {
    throw new Error('Invalid API key');
  }

  const data = await response.json();
  return data.data;
}

/**
 * 5. Create new verification
 */
export async function createVerification(
  partnerId: string,
  options?: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    source?: string;
  }
): Promise<{ id: string; status: string }> {
  const response = await fetch(getApiUrl(`/api/verifications?partnerId=${partnerId}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'IDENTITY',
      metadata: {
        source: options?.source || 'web',
        userId: options?.userId,
      },
      user: options?.userEmail ? {
        email: options.userEmail,
        fullName: options.userName,
      } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create verification');
  }

  const data = await response.json();
  return data.data;
}

/**
 * 6. Upload document
 */
export async function uploadDocument(
  verificationId: string,
  documentImage: string | File,
  documentType: string,
  side: 'FRONT' | 'BACK' = 'FRONT',
  partnerId?: string
): Promise<DocumentUploadResponse> {
  const formData = new FormData();

  // Convert base64 to File if needed
  const file = typeof documentImage === 'string'
    ? base64ToFile(documentImage, 'document.jpg')
    : documentImage;

  formData.append('document', file);
  formData.append('documentType', documentType);
  formData.append('side', side);

  const url = partnerId
    ? getApiUrl(`/api/verifications/${verificationId}/documents?partnerId=${partnerId}`)
    : getApiUrl(`/api/verifications/${verificationId}/documents`);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload document');
  }

  return data.data;
}

/**
 * 7. Upload selfie
 */
export async function uploadSelfie(
  verificationId: string,
  selfieImage: string | File,
  partnerId?: string
): Promise<SelfieUploadResponse> {
  const formData = new FormData();

  // Convert base64 to File if needed
  const file = typeof selfieImage === 'string'
    ? base64ToFile(selfieImage, 'selfie.jpg')
    : selfieImage;

  formData.append('selfie', file);

  const url = partnerId
    ? getApiUrl(`/api/verifications/${verificationId}/selfie?partnerId=${partnerId}`)
    : getApiUrl(`/api/verifications/${verificationId}/selfie`);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload selfie');
  }

  return data.data;
}

/**
 * 8. Submit verification and get result
 */
export async function submitVerification(
  verificationId: string,
  partnerId?: string
): Promise<VerificationResult> {
  const url = partnerId
    ? getApiUrl(`/api/verifications/${verificationId}/submit?partnerId=${partnerId}`)
    : getApiUrl(`/api/verifications/${verificationId}/submit`);

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();

  if (!response.ok && response.status === 429) {
    throw new Error(data.message || 'Maximum retry limit reached');
  }

  if (!response.ok && !data.data) {
    throw new Error(data.error || 'Verification failed');
  }

  return data.data;
}

/**
 * Complete verification flow helper
 * Combines upload document, upload selfie, and submit in sequence
 */
export async function completeVerification(
  verificationId: string,
  documentImage: string,
  documentType: string,
  selfieImage: string,
  partnerId?: string,
  onProgress?: (step: 'document' | 'selfie' | 'processing' | 'complete', message: string) => void
): Promise<VerificationResult> {
  try {
    // Step 1: Upload document
    onProgress?.('document', 'Uploading document...');
    await uploadDocument(verificationId, documentImage, documentType, 'FRONT', partnerId);

    // Step 2: Upload selfie
    onProgress?.('selfie', 'Uploading selfie...');
    await uploadSelfie(verificationId, selfieImage, partnerId);

    // Step 3: Submit and get result
    onProgress?.('processing', 'Processing verification...');
    const result = await submitVerification(verificationId, partnerId);

    onProgress?.('complete', result.passed ? 'Verification complete!' : 'Verification failed');
    return result;
  } catch (error) {
    throw error;
  }
}

// Document type mapping
export const DOCUMENT_TYPES: Record<string, string> = {
  'drivers_license': 'DRIVERS_LICENSE',
  'id_card': 'NATIONAL_ID',
  'passport': 'PASSPORT',
};

// Get document type for API
export function getApiDocumentType(uiDocumentType: string): string {
  return DOCUMENT_TYPES[uiDocumentType] || 'OTHER';
}
