/**
 * Error codes
 */
const ErrorCodes = {
    // Initialization
    INVALID_API_KEY: 'INVALID_API_KEY',
    NOT_INITIALIZED: 'NOT_INITIALIZED',
    ALREADY_OPEN: 'ALREADY_OPEN',
    // Browser
    BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
    CAMERA_PERMISSION_DENIED: 'CAMERA_PERMISSION_DENIED',
    CAMERA_NOT_FOUND: 'CAMERA_NOT_FOUND',
    // Verification
    VERIFICATION_FAILED: 'VERIFICATION_FAILED',
    DOCUMENT_UNREADABLE: 'DOCUMENT_UNREADABLE',
    FACE_NOT_DETECTED: 'FACE_NOT_DETECTED',
    // Network
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    // Session
    SESSION_EXPIRED: 'SESSION_EXPIRED',
};

/**
 * Handles postMessage communication between parent page and iframe
 */
class MessageBus {
    constructor(allowedOrigins, debug = false) {
        this.callbacks = new Map();
        this.processedNonces = new Set();
        this.allowedOrigins = allowedOrigins;
        this.debug = debug;
        this.boundHandler = this.handleMessage.bind(this);
        window.addEventListener('message', this.boundHandler);
    }
    /**
     * Handle incoming postMessage events
     */
    handleMessage(event) {
        // Validate origin
        if (!this.allowedOrigins.some(origin => event.origin === origin || origin === '*')) {
            if (this.debug) {
                console.warn('[IDV SDK] Message from unauthorized origin:', event.origin);
            }
            return;
        }
        // Validate message structure
        const message = event.data;
        if (!message?.type || typeof message.type !== 'string' || !message.type.startsWith('IDV_')) {
            return;
        }
        // Prevent replay attacks (skip if no nonce - older messages)
        if (message.nonce) {
            if (this.processedNonces.has(message.nonce)) {
                if (this.debug) {
                    console.warn('[IDV SDK] Duplicate nonce detected, ignoring message');
                }
                return;
            }
            this.processedNonces.add(message.nonce);
            // Clean up old nonces periodically (keep last 100)
            if (this.processedNonces.size > 100) {
                const noncesArray = Array.from(this.processedNonces);
                this.processedNonces = new Set(noncesArray.slice(-50));
            }
        }
        if (this.debug) {
            console.log('[IDV SDK] Received message:', message.type, message.payload);
        }
        // Dispatch to registered callbacks
        const handlers = this.callbacks.get(message.type) || [];
        handlers.forEach(callback => {
            try {
                callback(message.payload);
            }
            catch (error) {
                console.error('[IDV SDK] Error in message handler:', error);
            }
        });
    }
    /**
     * Register a callback for a message type
     */
    on(type, callback) {
        const handlers = this.callbacks.get(type) || [];
        handlers.push(callback);
        this.callbacks.set(type, handlers);
    }
    /**
     * Unregister a callback
     */
    off(type, callback) {
        const handlers = this.callbacks.get(type) || [];
        const index = handlers.indexOf(callback);
        if (index > -1) {
            handlers.splice(index, 1);
            this.callbacks.set(type, handlers);
        }
    }
    /**
     * Remove all callbacks for a message type
     */
    removeAllListeners(type) {
        if (type) {
            this.callbacks.delete(type);
        }
        else {
            this.callbacks.clear();
        }
    }
    /**
     * Clean up and remove event listener
     */
    destroy() {
        window.removeEventListener('message', this.boundHandler);
        this.callbacks.clear();
        this.processedNonces.clear();
    }
}

/**
 * Manages the modal overlay and iframe
 */
class ModalManager {
    constructor(config) {
        this.overlay = null;
        this.container = null;
        this.iframe = null;
        this.originalOverflow = '';
        this.escHandler = null;
        this.config = config;
    }
    /**
     * Open the modal with iframe
     */
    open() {
        if (this.overlay) {
            return; // Already open
        }
        this.createOverlay();
        this.createContainer();
        this.createIframe();
        this.attachEventListeners();
        this.preventScroll();
        this.animateIn();
    }
    /**
     * Close the modal
     */
    close(reason = 'user_closed') {
        if (!this.overlay) {
            return;
        }
        this.animateOut(() => {
            this.cleanup();
            this.config.onClose?.(reason);
        });
    }
    /**
     * Get the iframe element
     */
    getIframe() {
        return this.iframe;
    }
    /**
     * Check if modal is open
     */
    isOpen() {
        return this.overlay !== null;
    }
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'idv-sdk-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-label', 'Identity Verification');
        Object.assign(this.overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: '2147483647',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: '0',
            transition: 'opacity 0.2s ease-out',
        });
        document.body.appendChild(this.overlay);
    }
    isMobile() {
        return window.innerWidth <= 480 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    }
    createContainer() {
        const theme = this.config.theme || {};
        const mobile = this.isMobile();
        this.container = document.createElement('div');
        this.container.id = 'idv-sdk-modal';
        // Use full screen on mobile, modal on desktop
        if (mobile) {
            Object.assign(this.container.style, {
                width: '100%',
                height: '100%',
                backgroundColor: theme.backgroundColor || '#ffffff',
                borderRadius: '0',
                overflow: 'hidden',
                position: 'relative',
                transform: 'translateY(20px)',
                transition: 'transform 0.2s ease-out',
            });
        }
        else {
            Object.assign(this.container.style, {
                width: '100%',
                maxWidth: '420px',
                height: '90vh',
                maxHeight: '720px',
                backgroundColor: theme.backgroundColor || '#ffffff',
                borderRadius: theme.borderRadius || '16px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                transform: 'scale(0.95) translateY(10px)',
                transition: 'transform 0.2s ease-out',
            });
        }
        // Add close button if enabled
        if (this.config.modal?.showCloseButton !== false) {
            const closeButton = this.createCloseButton();
            this.container.appendChild(closeButton);
        }
        this.overlay.appendChild(this.container);
    }
    createCloseButton() {
        const button = document.createElement('button');
        button.id = 'idv-sdk-close';
        button.setAttribute('aria-label', 'Close verification');
        button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
        Object.assign(button.style, {
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
            color: '#666666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10',
            transition: 'background-color 0.15s ease',
        });
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.12)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
        });
        button.addEventListener('click', () => {
            this.close('user_closed');
        });
        return button;
    }
    createIframe() {
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'idv-sdk-iframe';
        this.iframe.src = this.config.iframeSrc;
        // Mobile-friendly iframe attributes
        this.iframe.setAttribute('allow', 'camera; microphone; fullscreen');
        this.iframe.setAttribute('scrolling', 'yes');
        this.iframe.setAttribute('frameborder', '0');
        Object.assign(this.iframe.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            backgroundColor: '#ffffff',
            // Fix iOS iframe scroll issues
            WebkitOverflowScrolling: 'touch',
            overflowY: 'auto',
        });
        this.container.appendChild(this.iframe);
    }
    attachEventListeners() {
        // ESC key handler
        if (this.config.modal?.closeOnEscape !== false) {
            this.escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.close('user_closed');
                }
            };
            document.addEventListener('keydown', this.escHandler);
        }
        // Overlay click handler
        if (this.config.modal?.closeOnOverlayClick) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close('user_closed');
                }
            });
        }
    }
    preventScroll() {
        if (this.config.modal?.preventScroll !== false) {
            this.originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            // Fix iOS body scroll issue
            if (this.isMobile()) {
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
                document.body.style.height = '100%';
            }
        }
    }
    restoreScroll() {
        if (this.config.modal?.preventScroll !== false) {
            document.body.style.overflow = this.originalOverflow;
            // Restore iOS body
            if (this.isMobile()) {
                document.body.style.position = '';
                document.body.style.width = '';
                document.body.style.height = '';
            }
        }
    }
    animateIn() {
        const mobile = this.isMobile();
        // Force reflow
        this.overlay.offsetHeight;
        requestAnimationFrame(() => {
            if (this.overlay) {
                this.overlay.style.opacity = '1';
            }
            if (this.container) {
                this.container.style.transform = mobile
                    ? 'translateY(0)'
                    : 'scale(1) translateY(0)';
            }
        });
    }
    animateOut(callback) {
        const mobile = this.isMobile();
        if (this.overlay) {
            this.overlay.style.opacity = '0';
        }
        if (this.container) {
            this.container.style.transform = mobile
                ? 'translateY(20px)'
                : 'scale(0.95) translateY(10px)';
        }
        setTimeout(callback, 200);
    }
    cleanup() {
        // Remove ESC handler
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
        // Remove overlay from DOM
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.container = null;
        this.iframe = null;
        this.restoreScroll();
    }
}

const SDK_VERSION = '1.0.0';
/**
 * Main IDV SDK class
 */
class IDVCore {
    constructor() {
        this.config = null;
        this.modalManager = null;
        this.messageBus = null;
        this.currentOptions = null;
        this.startTime = 0;
    }
    /**
     * Initialize the SDK with configuration
     */
    init(config) {
        if (!config.apiKey) {
            throw new Error('API key is required');
        }
        this.config = {
            environment: 'production',
            debug: false,
            ...config,
        };
        if (this.config.debug) {
            console.log('[IDV SDK] Initialized with config:', {
                environment: this.config.environment,
                apiKey: this.config.apiKey.substring(0, 10) + '...',
            });
        }
    }
    /**
     * Start the verification flow
     */
    start(options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.config) {
                const error = {
                    code: ErrorCodes.NOT_INITIALIZED,
                    message: 'SDK not initialized. Call IDV.init() first.',
                    recoverable: false,
                };
                options.onError?.(error);
                reject(error);
                return;
            }
            if (this.modalManager?.isOpen()) {
                const error = {
                    code: ErrorCodes.ALREADY_OPEN,
                    message: 'Verification already in progress',
                    recoverable: false,
                };
                options.onError?.(error);
                reject(error);
                return;
            }
            this.currentOptions = options;
            this.startTime = Date.now();
            // Build iframe URL
            const iframeSrc = this.buildIframeUrl(options);
            // Set up message bus
            const verifyOrigin = this.getVerifyOrigin();
            this.messageBus = new MessageBus([verifyOrigin], this.config.debug);
            this.setupMessageHandlers(resolve, reject);
            // Create and open modal
            this.modalManager = new ModalManager({
                iframeSrc,
                theme: options.theme,
                modal: options.modal,
                onClose: (reason) => {
                    this.handleClose(reason, reject);
                },
            });
            this.modalManager.open();
            if (this.config.debug) {
                console.log('[IDV SDK] Modal opened with URL:', iframeSrc);
            }
        });
    }
    /**
     * Close the verification modal
     */
    close() {
        if (this.modalManager?.isOpen()) {
            this.modalManager.close('user_closed');
        }
    }
    /**
     * Get SDK version
     */
    getVersion() {
        return SDK_VERSION;
    }
    /**
     * Check if SDK is initialized
     */
    isInitialized() {
        return this.config !== null;
    }
    /**
     * Check if verification is in progress
     */
    isOpen() {
        return this.modalManager?.isOpen() ?? false;
    }
    buildIframeUrl(options) {
        const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
        const params = new URLSearchParams({
            'api-key': this.config.apiKey,
            'sdk-version': SDK_VERSION,
            'origin': window.location.origin,
        });
        // Add user context
        if (options.user?.id)
            params.set('user-id', options.user.id);
        if (options.user?.email)
            params.set('user-email', options.user.email);
        if (options.user?.name)
            params.set('user-name', options.user.name);
        // Add verification options
        if (options.country)
            params.set('country', options.country);
        if (options.locale)
            params.set('locale', options.locale);
        if (options.allowedDocumentTypes?.length) {
            params.set('doc-types', options.allowedDocumentTypes.join(','));
        }
        // Add theme as base64 encoded JSON
        if (options.theme && Object.keys(options.theme).length > 0) {
            params.set('theme', btoa(JSON.stringify(options.theme)));
        }
        return `${baseUrl}/verify?${params.toString()}`;
    }
    getDefaultBaseUrl() {
        if (this.config.environment === 'sandbox') {
            return 'https://cove.sandbox.trustcredo.com';
        }
        return 'https://cove.trustcredo.com';
    }
    getVerifyOrigin() {
        if (this.config.baseUrl) {
            return new URL(this.config.baseUrl).origin;
        }
        return this.getDefaultBaseUrl();
    }
    setupMessageHandlers(resolve, reject) {
        if (!this.messageBus)
            return;
        // Ready event
        this.messageBus.on('IDV_READY', () => {
            this.currentOptions?.onReady?.();
        });
        // Start event
        this.messageBus.on('IDV_START', () => {
            this.currentOptions?.onStart?.();
        });
        // Step event
        this.messageBus.on('IDV_STEP', (payload) => {
            this.currentOptions?.onStep?.(payload);
        });
        // Complete event
        this.messageBus.on('IDV_COMPLETE', (payload) => {
            const result = payload;
            result.duration = Date.now() - this.startTime;
            this.currentOptions?.onComplete?.(result);
            this.modalManager?.close('completed');
            this.cleanup();
            resolve(result);
        });
        // Error event
        this.messageBus.on('IDV_ERROR', (payload) => {
            const error = payload;
            this.currentOptions?.onError?.(error);
            if (!error.recoverable) {
                this.modalManager?.close('error');
                this.cleanup();
                reject(error);
            }
        });
        // Close event (from iframe)
        this.messageBus.on('IDV_CLOSE', (payload) => {
            const reason = payload.reason || 'user_closed';
            this.modalManager?.close(reason);
        });
    }
    handleClose(reason, reject) {
        this.currentOptions?.onClose?.(reason);
        if (reason === 'user_closed') {
            // User cancelled - reject with cancellation error
            const error = {
                code: 'USER_CANCELLED',
                message: 'Verification was cancelled by the user',
                recoverable: true,
            };
            reject(error);
        }
        this.cleanup();
    }
    cleanup() {
        this.messageBus?.destroy();
        this.messageBus = null;
        this.modalManager = null;
        this.currentOptions = null;
    }
}
// Create singleton instance
const IDV = new IDVCore();

/**
 * IDV SDK - Identity Verification SDK
 *
 * Usage:
 * ```html
 * <script src="https://cdn.trustcredo.com/sdk/v1/idv.min.js"></script>
 * <script>
 *   IDV.init({ apiKey: 'pk_live_...' });
 *   IDV.start({ onComplete: (result) => console.log(result) });
 * </script>
 * ```
 *
 * Or with ES modules:
 * ```javascript
 * import { IDV } from '@anthropic/idv-sdk';
 * IDV.init({ apiKey: 'pk_live_...' });
 * ```
 */

export { ErrorCodes, IDV, IDVCore, IDV as default };
//# sourceMappingURL=idv.esm.js.map
