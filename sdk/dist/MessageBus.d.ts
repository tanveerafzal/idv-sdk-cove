import type { MessageType } from './types';
type MessageCallback = (payload: unknown) => void;
/**
 * Handles postMessage communication between parent page and iframe
 */
export declare class MessageBus {
    private allowedOrigins;
    private callbacks;
    private processedNonces;
    private debug;
    private boundHandler;
    constructor(allowedOrigins: string[], debug?: boolean);
    /**
     * Handle incoming postMessage events
     */
    private handleMessage;
    /**
     * Register a callback for a message type
     */
    on(type: MessageType, callback: MessageCallback): void;
    /**
     * Unregister a callback
     */
    off(type: MessageType, callback: MessageCallback): void;
    /**
     * Remove all callbacks for a message type
     */
    removeAllListeners(type?: MessageType): void;
    /**
     * Clean up and remove event listener
     */
    destroy(): void;
}
export {};
