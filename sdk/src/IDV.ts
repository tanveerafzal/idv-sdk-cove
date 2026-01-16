import type {
  IDVConfig,
  IDVStartOptions,
  VerificationComplete,
  SDKError,
  StepInfo,
  CloseReason,
} from './types';
import { ErrorCodes } from './types';
import { MessageBus } from './MessageBus';
import { ModalManager } from './ModalManager';

const SDK_VERSION = '1.0.0';

/**
 * Main IDV SDK class
 */
export class IDVCore {
  private config: IDVConfig | null = null;
  private modalManager: ModalManager | null = null;
  private messageBus: MessageBus | null = null;
  private currentOptions: IDVStartOptions | null = null;
  private startTime: number = 0;

  /**
   * Initialize the SDK with configuration
   */
  init(config: IDVConfig): void {
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
  start(options: IDVStartOptions = {}): Promise<VerificationComplete> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        const error: SDKError = {
          code: ErrorCodes.NOT_INITIALIZED,
          message: 'SDK not initialized. Call IDV.init() first ',
          recoverable: false,
        };
        options.onError?.(error);
        reject(error);
        return;
      }

      if (this.modalManager?.isOpen()) {
        const error: SDKError = {
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
        onClose: (reason: CloseReason) => {
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
  close(): void {
    if (this.modalManager?.isOpen()) {
      this.modalManager.close('user_closed');
    }
  }

  /**
   * Get SDK version
   */
  getVersion(): string {
    return SDK_VERSION;
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Check if verification is in progress
   */
  isOpen(): boolean {
    return this.modalManager?.isOpen() ?? false;
  }

  private buildIframeUrl(options: IDVStartOptions): string {
    const baseUrl = this.config!.baseUrl || this.getDefaultBaseUrl();

    const params = new URLSearchParams({
      'api-key': this.config!.apiKey,
      'sdk-version': SDK_VERSION,
      'origin': window.location.origin,
    });

    // Add user context
    if (options.user?.id) params.set('user-id', options.user.id);
    if (options.user?.email) params.set('user-email', options.user.email);
    if (options.user?.name) params.set('user-name', options.user.name);

    // Add verification options
    if (options.country) params.set('country', options.country);
    if (options.locale) params.set('locale', options.locale);
    if (options.allowedDocumentTypes?.length) {
      params.set('doc-types', options.allowedDocumentTypes.join(','));
    }

    // Add theme as base64 encoded JSON
    if (options.theme && Object.keys(options.theme).length > 0) {
      params.set('theme', btoa(JSON.stringify(options.theme)));
    }

    return `${baseUrl}/verify?${params.toString()}`;
  }

  private getDefaultBaseUrl(): string {
    if (this.config!.environment === 'sandbox') {
      return 'https://sandbox.trustcredo.com';
    }
    return 'https://sdk.trustcredo.com';
  }

  private getVerifyOrigin(): string {
    if (this.config!.baseUrl) {
      return new URL(this.config!.baseUrl).origin;
    }
    return this.getDefaultBaseUrl();
  }

  private setupMessageHandlers(
    resolve: (result: VerificationComplete) => void,
    reject: (error: SDKError) => void
  ): void {
    if (!this.messageBus) return;

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
      this.currentOptions?.onStep?.(payload as StepInfo);
    });

    // Complete event
    this.messageBus.on('IDV_COMPLETE', (payload) => {
      const result = payload as VerificationComplete;
      result.duration = Date.now() - this.startTime;

      this.currentOptions?.onComplete?.(result);
      this.modalManager?.close('completed');
      this.cleanup();
      resolve(result);
    });

    // Error event
    this.messageBus.on('IDV_ERROR', (payload) => {
      const error = payload as SDKError;
      this.currentOptions?.onError?.(error);

      if (!error.recoverable) {
        this.modalManager?.close('error');
        this.cleanup();
        reject(error);
      }
    });

    // Close event (from iframe)
    this.messageBus.on('IDV_CLOSE', (payload) => {
      const reason = (payload as { reason: CloseReason }).reason || 'user_closed';
      this.modalManager?.close(reason);
    });
  }

  private handleClose(reason: CloseReason, reject: (error: SDKError) => void): void {
    this.currentOptions?.onClose?.(reason);

    if (reason === 'user_closed') {
      // User cancelled - reject with cancellation error
      const error: SDKError = {
        code: 'USER_CANCELLED',
        message: 'Verification was cancelled by the user',
        recoverable: true,
      };
      reject(error);
    }

    this.cleanup();
  }

  private cleanup(): void {
    this.messageBus?.destroy();
    this.messageBus = null;
    this.modalManager = null;
    this.currentOptions = null;
  }
}

// Create singleton instance
export const IDV = new IDVCore();
