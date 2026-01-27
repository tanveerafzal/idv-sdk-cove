import { NextRequest, NextResponse } from 'next/server';

/**
 * Client-side error logging endpoint
 * Logs errors to Vercel server logs for debugging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level = 'error', message, context, userAgent, url } = body;

    // Log with structured format for Vercel
    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userAgent: userAgent?.substring(0, 100),
      url,
    };

    if (level === 'error') {
      console.error('[CLIENT_ERROR]', JSON.stringify(logData));
    } else if (level === 'warn') {
      console.warn('[CLIENT_WARN]', JSON.stringify(logData));
    } else {
      console.log('[CLIENT_LOG]', JSON.stringify(logData));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LOG_API_ERROR]', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
