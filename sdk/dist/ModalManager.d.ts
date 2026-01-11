import type { ModalOptions, ThemeOptions, CloseReason } from './types';
export interface ModalConfig {
    iframeSrc: string;
    theme?: ThemeOptions;
    modal?: ModalOptions;
    onClose?: (reason: CloseReason) => void;
}
/**
 * Manages the modal overlay and iframe
 */
export declare class ModalManager {
    private overlay;
    private container;
    private iframe;
    private config;
    private originalOverflow;
    private escHandler;
    constructor(config: ModalConfig);
    /**
     * Open the modal with iframe
     */
    open(): void;
    /**
     * Close the modal
     */
    close(reason?: CloseReason): void;
    /**
     * Get the iframe element
     */
    getIframe(): HTMLIFrameElement | null;
    /**
     * Check if modal is open
     */
    isOpen(): boolean;
    private createOverlay;
    private createContainer;
    private createCloseButton;
    private createIframe;
    private attachEventListeners;
    private preventScroll;
    private restoreScroll;
    private animateIn;
    private animateOut;
    private cleanup;
}
