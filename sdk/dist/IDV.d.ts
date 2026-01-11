import type { IDVConfig, IDVStartOptions, VerificationComplete } from './types';
/**
 * Main IDV SDK class
 */
export declare class IDVCore {
    private config;
    private modalManager;
    private messageBus;
    private currentOptions;
    private startTime;
    /**
     * Initialize the SDK with configuration
     */
    init(config: IDVConfig): void;
    /**
     * Start the verification flow
     */
    start(options?: IDVStartOptions): Promise<VerificationComplete>;
    /**
     * Close the verification modal
     */
    close(): void;
    /**
     * Get SDK version
     */
    getVersion(): string;
    /**
     * Check if SDK is initialized
     */
    isInitialized(): boolean;
    /**
     * Check if verification is in progress
     */
    isOpen(): boolean;
    private buildIframeUrl;
    private getDefaultBaseUrl;
    private getVerifyOrigin;
    private setupMessageHandlers;
    private handleClose;
    private cleanup;
}
export declare const IDV: IDVCore;
