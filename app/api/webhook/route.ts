import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Webhook secret for signing (should be in env vars in production)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_default_secret'

interface WebhookPayload {
  id: string
  type: 'verification.completed' | 'verification.failed'
  apiVersion: string
  createdAt: string
  data: {
    verificationId: string
    partnerId: string
    status: 'passed' | 'failed' | 'review'
    result: {
      passed: boolean
      score?: number
      riskLevel: string
      message?: string
    }
    extractedData?: {
      fullName?: string
      dateOfBirth?: string
      documentNumber?: string
      expiryDate?: string
      issuingCountry?: string
    }
    metadata: {
      source: string
      completedAt: string
      duration: number
    }
  }
}

function generateSignature(payload: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      webhookUrl,
      verificationId,
      partnerId,
      result,
      extractedData,
      source,
      duration,
    } = body

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'No webhook URL provided' },
        { status: 400 }
      )
    }

    if (!verificationId || !partnerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Build webhook payload
    const timestamp = Math.floor(Date.now() / 1000)
    const webhookId = `wh_${crypto.randomUUID().replace(/-/g, '')}`

    const payload: WebhookPayload = {
      id: webhookId,
      type: result?.passed ? 'verification.completed' : 'verification.failed',
      apiVersion: '2024-01',
      createdAt: new Date().toISOString(),
      data: {
        verificationId,
        partnerId,
        status: result?.passed ? 'passed' : 'failed',
        result: {
          passed: result?.passed ?? false,
          riskLevel: result?.riskLevel ?? 'UNKNOWN',
          message: result?.message,
        },
        extractedData: extractedData,
        metadata: {
          source: source || 'sdk',
          completedAt: new Date().toISOString(),
          duration: duration || 0,
        },
      },
    }

    const payloadString = JSON.stringify(payload)
    const signature = generateSignature(payloadString, timestamp)

    // Send webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IDV-Signature': `t=${timestamp},v1=${signature}`,
        'X-IDV-Webhook-Id': webhookId,
        'X-IDV-Timestamp': timestamp.toString(),
      },
      body: payloadString,
    })

    if (!response.ok) {
      console.error(`Webhook delivery failed: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook delivery failed',
          status: response.status
        },
        { status: 200 } // Return 200 to client even if webhook fails
      )
    }

    return NextResponse.json({
      success: true,
      webhookId,
      deliveredAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 } // Return 200 to not block the client
    )
  }
}
