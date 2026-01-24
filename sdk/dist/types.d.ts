/**
 * IDV SDK Configuration
 */
export interface IDVConfig {
    /** Partner API key (required) */
    apiKey: string;
    /** Environment: 'sandbox' or 'production' (default: 'production') */
    environment?: 'sandbox' | 'production';
    /** Override the verification app base URL */
    baseUrl?: string;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * User context passed to verification
 */
export interface UserContext {
    /** Partner's internal user ID */
    id?: string;
    /** User's email address */
    email?: string;
    /** User's full name */
    name?: string;
}
/**
 * Theme customization options
 */
export interface ThemeOptions {
    /** Primary button/accent color (hex) */
    primaryColor?: string;
    /** Modal background color */
    backgroundColor?: string;
    /** Primary text color */
    textColor?: string;
    /** Font family */
    fontFamily?: string;
    /** Border radius for buttons/cards */
    borderRadius?: string;
    /** Partner logo URL */
    logoUrl?: string;
}
/**
 * Modal behavior options
 */
export interface ModalOptions {
    /** Close modal when clicking overlay (default: false) */
    closeOnOverlayClick?: boolean;
    /** Close modal when pressing ESC (default: true) */
    closeOnEscape?: boolean;
    /** Show close button (default: true) */
    showCloseButton?: boolean;
    /** Prevent body scroll when modal open (default: true) */
    preventScroll?: boolean;
}
/**
 * Options for starting verification
 */
export interface IDVStartOptions {
    /** User context */
    user?: UserContext;
    /** Allowed document types */
    allowedDocumentTypes?: ('passport' | 'drivers_license' | 'id_card')[];
    /** Pre-selected country */
    country?: string;
    /** UI locale (e.g., 'en', 'es', 'fr') */
    locale?: string;
    /** Theme customization */
    theme?: ThemeOptions;
    /** Modal behavior */
    modal?: ModalOptions;
    /** Called when iframe is ready */
    onReady?: () => void;
    /** Called when user starts verification */
    onStart?: () => void;
    /** Called on step progression */
    onStep?: (step: StepInfo) => void;
    /** Called when verification completes */
    onComplete?: (result: VerificationComplete) => void;
    /** Called on error */
    onError?: (error: SDKError) => void;
    /** Called when modal closes */
    onClose?: (reason: CloseReason) => void;
}
/**
 * Step progression info
 */
export interface StepInfo {
    /** Current step name */
    step: 'intro' | 'document_select' | 'document_capture' | 'document_review' | 'selfie_intro' | 'selfie_capture' | 'selfie_review' | 'processing' | 'complete';
    /** Step number (1-8) */
    stepNumber: number;
    /** Total steps */
    totalSteps: number;
    /** Timestamp */
    timestamp: string;
}
/**
 * Verification result passed to onComplete
 */
export interface VerificationComplete {
    /** Unique verification ID */
    verificationId: string;
    /** Verification status */
    status: 'passed' | 'failed' | 'review';
    /** Result summary */
    result: {
        passed: boolean;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        message?: string;
    };
    /** Extracted data (if passed and permitted) */
    extractedData?: {
        fullName?: string;
        dateOfBirth?: string;
        documentNumber?: string;
        expiryDate?: string;
        issuingCountry?: string;
    };
    /** Completion timestamp */
    completedAt: string;
    /** Duration in milliseconds */
    duration: number;
}
/**
 * SDK error
 */
export interface SDKError {
    /** Error code */
    code: string;
    /** Human-readable message */
    message: string;
    /** Additional details */
    details?: Record<string, unknown>;
    /** Whether the error is recoverable */
    recoverable: boolean;
}
/**
 * Reason for modal close
 */
export type CloseReason = 'user_closed' | 'completed' | 'error' | 'expired';
/**
 * Message types for postMessage communication
 */
export type MessageType = 'IDV_READY' | 'IDV_START' | 'IDV_STEP' | 'IDV_COMPLETE' | 'IDV_ERROR' | 'IDV_CLOSE';
/**
 * Message structure for postMessage
 */
export interface SDKMessage<T = unknown> {
    type: MessageType;
    payload: T;
    timestamp: string;
    nonce: string;
}
/**
 * Error codes
 */
export declare const ErrorCodes: {
    readonly INVALID_API_KEY: "INVALID_API_KEY";
    readonly NOT_INITIALIZED: "NOT_INITIALIZED";
    readonly ALREADY_OPEN: "ALREADY_OPEN";
    readonly BROWSER_NOT_SUPPORTED: "BROWSER_NOT_SUPPORTED";
    readonly CAMERA_PERMISSION_DENIED: "CAMERA_PERMISSION_DENIED";
    readonly CAMERA_NOT_FOUND: "CAMERA_NOT_FOUND";
    readonly VERIFICATION_FAILED: "VERIFICATION_FAILED";
    readonly DOCUMENT_UNREADABLE: "DOCUMENT_UNREADABLE";
    readonly FACE_NOT_DETECTED: "FACE_NOT_DETECTED";
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly TIMEOUT: "TIMEOUT";
    readonly SESSION_EXPIRED: "SESSION_EXPIRED";
};
