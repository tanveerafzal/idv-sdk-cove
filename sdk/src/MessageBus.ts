import type { MessageType, SDKMessage } from './types';

type MessageCallback = (payload: unknown) => void;

/**
 * Handles postMessage communication between parent page and iframe
 */
export class MessageBus {
  private allowedOrigins: string[];
  private callbacks: Map<MessageType, MessageCallback[]> = new Map();
  private processedNonces: Set<string> = new Set();
  private debug: boolean;
  private boundHandler: (event: MessageEvent) => void;

  constructor(allowedOrigins: string[], debug = false) {
    this.allowedOrigins = allowedOrigins;
    this.debug = debug;
    this.boundHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.boundHandler);
  }

  /**
   * Handle incoming postMessage events
   */
  private handleMessage(event: MessageEvent): void {
    // Validate origin
    if (!this.allowedOrigins.some(origin => event.origin === origin || origin === '*')) {
      if (this.debug) {
        console.warn('[IDV SDK] Message from unauthorized origin:', event.origin);
      }
      return;
    }

    // Validate message structure
    const message = event.data as SDKMessage;
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
    const handlers = this.callbacks.get(message.type as MessageType) || [];
    handlers.forEach(callback => {
      try {
        callback(message.payload);
      } catch (error) {
        console.error('[IDV SDK] Error in message handler:', error);
      }
    });
  }

  /**
   * Register a callback for a message type
   */
  on(type: MessageType, callback: MessageCallback): void {
    const handlers = this.callbacks.get(type) || [];
    handlers.push(callback);
    this.callbacks.set(type, handlers);
  }

  /**
   * Unregister a callback
   */
  off(type: MessageType, callback: MessageCallback): void {
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
  removeAllListeners(type?: MessageType): void {
    if (type) {
      this.callbacks.delete(type);
    } else {
      this.callbacks.clear();
    }
  }

  /**
   * Clean up and remove event listener
   */
  destroy(): void {
    window.removeEventListener('message', this.boundHandler);
    this.callbacks.clear();
    this.processedNonces.clear();
  }
}
