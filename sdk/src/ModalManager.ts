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
export class ModalManager {
  private overlay: HTMLDivElement | null = null;
  private container: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private config: ModalConfig;
  private originalOverflow: string = '';
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: ModalConfig) {
    this.config = config;
  }

  /**
   * Open the modal with iframe
   */
  open(): void {
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
  close(reason: CloseReason = 'user_closed'): void {
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
  getIframe(): HTMLIFrameElement | null {
    return this.iframe;
  }

  /**
   * Check if modal is open
   */
  isOpen(): boolean {
    return this.overlay !== null;
  }

  private createOverlay(): void {
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

  private isMobile(): boolean {
    return window.innerWidth <= 480 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  private createContainer(): void {
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
    } else {
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

    this.overlay!.appendChild(this.container);
  }

  private createCloseButton(): HTMLButtonElement {
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

  private createIframe(): void {
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'idv-sdk-iframe';
    this.iframe.src = this.config.iframeSrc;

    // Mobile-friendly iframe attributes
    this.iframe.setAttribute('allow', 'camera; microphone; fullscreen');
    this.iframe.setAttribute('allowfullscreen', 'true');
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

    this.container!.appendChild(this.iframe);
  }

  private attachEventListeners(): void {
    // ESC key handler
    if (this.config.modal?.closeOnEscape !== false) {
      this.escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.close('user_closed');
        }
      };
      document.addEventListener('keydown', this.escHandler);
    }

    // Overlay click handler
    if (this.config.modal?.closeOnOverlayClick) {
      this.overlay!.addEventListener('click', (e: MouseEvent) => {
        if (e.target === this.overlay) {
          this.close('user_closed');
        }
      });
    }
  }

  private preventScroll(): void {
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

  private restoreScroll(): void {
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

  private animateIn(): void {
    const mobile = this.isMobile();

    // Force reflow
    this.overlay!.offsetHeight;

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

  private animateOut(callback: () => void): void {
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

  private cleanup(): void {
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
