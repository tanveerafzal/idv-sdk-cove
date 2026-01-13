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
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '')}`
    const inquiryId = `inq_${verificationId.replace(/-/g, '')}`
    const createdAt = new Date().toISOString()

    // Parse full name into first and last
    const nameParts = extractedData?.fullName?.split(' ') || []
    const nameFirst = nameParts[0] || undefined
    const nameLast = nameParts.slice(1).join(' ') || undefined

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
                referenceId: partnerId,
                nameFirst,
                nameLast,
                birthdate: extractedData?.dateOfBirth,
                addressStreet1: extractedData?.addressStreet1,
                addressCity: extractedData?.addressCity,
                addressSubdivision: extractedData?.addressSubdivision,
                addressPostalCode: extractedData?.addressPostalCode,
                fields: {
                  ...(extractedData?.email && {
                    emailAddress: { type: 'string' as const, value: extractedData.email }
                  }),
                  ...(extractedData?.phone && {
                    phoneNumber: { type: 'string' as const, value: extractedData.phone }
                  }),
                  ...(extractedData?.issuingCountry && {
                    addressCountryCode: { type: 'string' as const, value: extractedData.issuingCountry }
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
      eventId,
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
