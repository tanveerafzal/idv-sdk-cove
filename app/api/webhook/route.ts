import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Webhook secret for signing (should be in env vars in production)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_default_secret'

interface WebhookPayload {
  data: {
    id: string
    type: 'event'
    attributes: {
      name: 'inquiry.completed' | 'inquiry.failed'
      createdAt: string
      payload: {
        data: {
          id: string
          type: 'inquiry'
          attributes: {
            status: 'completed' | 'failed' | 'pending'
            referenceId: string
            nameFirst?: string
            nameLast?: string
            birthdate?: string
            addressStreet1?: string
            addressCity?: string
            addressSubdivision?: string
            addressPostalCode?: string
            fields: {
              emailAddress?: { type: 'string'; value: string }
              phoneNumber?: { type: 'string'; value: string }
              addressCountryCode?: { type: 'string'; value: string }
            }
          }
        }
        included: Array<{
          type: 'verification/government-id' | 'verification/selfie'
          attributes: {
            status: 'passed' | 'failed'
            countryCode?: string
            identificationNumber?: string
            photoUrls?: Array<{
              url: string
              page: string
              byteSize: number
            }>
            checks: Array<{
              name: string
              status: 'passed' | 'failed'
            }>
          }
        }>
      }
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
  console.log('[Webhook API] Received webhook request')

  try {
    const body = await request.json()
    console.log('[Webhook API] Request body:', JSON.stringify(body, null, 2))

    const {
      webhookUrl,
      verificationId,
      partnerId,
      referenceId,
      result,
      extractedData,
      source,
      duration,
    } = body

    if (!webhookUrl) {
      console.log('[Webhook API] Error: No webhook URL provided')
      return NextResponse.json(
        { error: 'No webhook URL provided' },
        { status: 400 }
      )
    }

    if (!verificationId || !partnerId) {
      console.log('[Webhook API] Error: Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Webhook API] Preparing to send webhook to:', webhookUrl)

    // Build webhook payload
    const timestamp = Math.floor(Date.now() / 1000)
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '')}`
    const inquiryId = `inq_${verificationId.replace(/-/g, '')}`
    const createdAt = new Date().toISOString()

    // Use firstName/lastName from API, or parse from fullName as fallback
    const nameFirst = extractedData?.firstName || extractedData?.fullName?.split(' ')[0] || undefined
    const nameLast = extractedData?.lastName || extractedData?.fullName?.split(' ').slice(1).join(' ') || undefined

    // Extract address fields from nested address object
    const address = extractedData?.address
    const addressStreet = address?.street || undefined
    const addressCity = address?.city || undefined
    const addressState = address?.state || undefined
    const addressPostalCode = address?.postalCode || undefined
    const addressCountry = address?.country || extractedData?.issuingCountry || undefined

    const payload: WebhookPayload = {
      data: {
        id: eventId,
        type: 'event',
        attributes: {
          name: result?.passed ? 'inquiry.completed' : 'inquiry.failed',
          createdAt,
          payload: {
            data: {
              id: inquiryId,
              type: 'inquiry',
              attributes: {
                status: result?.passed ? 'completed' : 'failed',
                referenceId: referenceId || partnerId,
                nameFirst,
                nameLast,
                birthdate: extractedData?.dateOfBirth,
                addressStreet1: addressStreet,
                addressCity: addressCity,
                addressSubdivision: addressState,
                addressPostalCode: addressPostalCode,
                fields: {
                  ...(extractedData?.email && {
                    emailAddress: { type: 'string' as const, value: extractedData.email }
                  }),
                  ...(extractedData?.phone && {
                    phoneNumber: { type: 'string' as const, value: extractedData.phone }
                  }),
                  ...(addressCountry && {
                    addressCountryCode: { type: 'string' as const, value: addressCountry }
                  }),
                },
              },
            },
            included: [
              {
                type: 'verification/government-id',
                attributes: {
                  status: result?.passed ? 'passed' : 'failed',
                  countryCode: extractedData?.issuingCountry,
                  identificationNumber: extractedData?.documentNumber,
                  checks: [],
                },
              },
              {
                type: 'verification/selfie',
                attributes: {
                  status: result?.passed ? 'passed' : 'failed',
                  checks: [
                    {
                      name: 'selfie_id_comparison',
                      status: result?.passed ? 'passed' : 'failed',
                    },
                    {
                      name: 'selfie_liveness_detection',
                      status: result?.passed ? 'passed' : 'failed',
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    const payloadString = JSON.stringify(payload)
    const signature = generateSignature(payloadString, timestamp)

    console.log('[Webhook API] Sending payload:', payloadString)

    // Send webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IDV-Signature': `t=${timestamp},v1=${signature}`,
        'X-IDV-Event-Id': eventId,
        'X-IDV-Timestamp': timestamp.toString(),
      },
      body: payloadString,
    })

    console.log('[Webhook API] Response status:', response.status, response.statusText)

    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Unable to read response')
      console.error(`[Webhook API] Delivery failed: ${response.status} ${response.statusText}`, responseText)
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook delivery failed',
          status: response.status,
          details: responseText,
        },
        { status: 200 } // Return 200 to client even if webhook fails
      )
    }

    console.log('[Webhook API] Webhook delivered successfully, eventId:', eventId)

    return NextResponse.json({
      success: true,
      eventId,
      deliveredAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[Webhook API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 } // Return 200 to not block the client
    )
  }
}
