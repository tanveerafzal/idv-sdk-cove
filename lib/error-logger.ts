/**
 * Client-side error logger that sends errors to Vercel logs
 * Uses throttling to prevent performance impact
 */

type LogLevel = 'error' | 'warn' | 'info';

interface LogContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

// Throttle: max 1 log per key per 5 seconds
const lastLogTime: Record<string, number> = {};
const THROTTLE_MS = 5000;

/**
 * Send log to server for Vercel logging (throttled)
 */
function sendLog(level: LogLevel, message: string, context?: LogContext): void {
  // Create throttle key from level + message + component
  const key = `${level}:${message}:${context?.component || ''}`;
  const now = Date.now();

  // Skip if we logged this recently
  if (lastLogTime[key] && now - lastLogTime[key] < THROTTLE_MS) {
    return;
  }
  lastLogTime[key] = now;

  // Use setTimeout to ensure completely non-blocking
  setTimeout(() => {
    try {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          context,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {});
    } catch {
      // Silently fail
    }
  }, 0);
}

/**
 * Log an error to Vercel
 */
export function logError(message: string, context?: LogContext): void {
  console.error(`[Error] ${message}`, context);
  sendLog('error', message, context);
}

/**
 * Log a warning to Vercel
 */
export function logWarn(message: string, context?: LogContext): void {
  console.warn(`[Warn] ${message}`, context);
  sendLog('warn', message, context);
}

/**
 * Log info to Vercel
 */
export function logInfo(message: string, context?: LogContext): void {
  console.log(`[Info] ${message}`, context);
  sendLog('info', message, context);
}

/**
 * Log an exception with stack trace
 */
export function logException(error: Error, context?: LogContext): void {
  const errorContext = {
    ...context,
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack?.substring(0, 500),
  };
  console.error(`[Exception] ${error.message}`, errorContext);
  sendLog('error', error.message, errorContext);
}
