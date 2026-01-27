'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import {
  sendToParent,
  isSDKEmbed,
  getParentOrigin,
  getStepName,
  maskDocumentNumber,
} from '@/lib/sdk-messaging'
import Image from 'next/image'
import DocumentSelectStep, { DOCUMENTS_REQUIRING_BACK } from '@/components/verify/DocumentSelectStep'
import DocumentCaptureStep from '@/components/verify/DocumentCaptureStep'
import DocumentBackCaptureStep from '@/components/verify/DocumentBackCaptureStep'
import DocumentReviewStep from '@/components/verify/DocumentReviewStep'
import SelfieIntroStep from '@/components/verify/SelfieIntroStep'
import SelfieStep from '@/components/verify/SelfieStep'
import SelfieReviewStep from '@/components/verify/SelfieReviewStep'
import ProcessingStep from '@/components/verify/ProcessingStep'
import CompleteStep from '@/components/verify/CompleteStep'
import ProgressBar from '@/components/verify/ProgressBar'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { QRCodeSVG } from 'qrcode.react'
import {
  getPartnerInfo,
  validateApiKey,
  createVerification,
  uploadDocument,
  uploadSelfie,
  submitVerification,
  sendWebhook,
  getApiDocumentType,
  type VerificationResult,
  type PartnerInfo,
} from '@/lib/api'

export type VerificationStep = 1 | 2 | 3 | 3.5 | 4 | 5 | 6 | 7 | 7.5 | 8

export interface VerificationData {
  country: string
  documentType: string
  documentFrontImage: string | null
  documentBackImage: string | null
  selfieImage: string | null
  retakeDocument?: boolean
  retakeDocumentBack?: boolean
  retakeSelfie?: boolean
}

function VerifyPageContent() {
  const searchParams = useSearchParams()

  // SDK embed detection
  const sdkMode = isSDKEmbed(searchParams)
  const parentOrigin = getParentOrigin(searchParams)
  const [startTime] = useState(() => Date.now())

  // Core state
  const [currentStep, setCurrentStep] = useState<VerificationStep>(1)
  const [verificationData, setVerificationData] = useState<VerificationData>({
    country: 'Canada',
    documentType: '',
    documentFrontImage: null,
    documentBackImage: null,
    selfieImage: null,
  })

  // API state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>('Initializing...')
  const [isDesktop, setIsDesktop] = useState(false)
  const [mobileVerifyUrl, setMobileVerifyUrl] = useState<string>('')

  // Detect desktop and build mobile QR URL
  useEffect(() => {
    const checkDesktop = () => {
      // Check actual screen width (not container) to determine if on desktop
      const isDesktopScreen = window.screen.width >= 1024
      setIsDesktop(isDesktopScreen)
    }
    checkDesktop()

    // Build the URL for QR code (current page URL with all params)
    if (typeof window !== 'undefined') {
      setMobileVerifyUrl(window.location.href)
    }
  }, [])


  // SDK messaging helper
  const sendSDKMessage = useCallback(<T,>(type: Parameters<typeof sendToParent>[0], payload: T) => {
    if (sdkMode) {
      sendToParent(type, payload, parentOrigin)
    }
  }, [sdkMode, parentOrigin])

  // Send ready message when component mounts in SDK mode
  useEffect(() => {
    if (sdkMode) {
      sendSDKMessage('IDV_READY', {})
    }
  }, [sdkMode, sendSDKMessage])

  // Send step changes to parent SDK
  useEffect(() => {
    if (sdkMode && currentStep > 1) {
      sendSDKMessage('IDV_STEP', {
        step: getStepName(currentStep),
        stepNumber: currentStep,
        totalSteps: 8,
        timestamp: new Date().toISOString(),
      })
    }
  }, [sdkMode, currentStep, sendSDKMessage])

  const initializeVerification = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Check for partner-id (direct link) or api-key (SDK embed)
      const directPartnerId = searchParams.get('partner-id')
      const apiKey = searchParams.get('api-key')
      const userIdParam = searchParams.get('user-id')

      // Capture user ID from SDK caller
      if (userIdParam) {
        console.log('[User] Captured user-id from URL:', userIdParam)
        setUserId(userIdParam)
      }

      if (!directPartnerId && !apiKey) {
        const errorMsg = 'No partner ID provided. Please use a valid verification link.'
        setError(errorMsg)
        sendSDKMessage('IDV_ERROR', {
          code: 'INVALID_API_KEY',
          message: errorMsg,
          recoverable: false,
        })
        setIsLoading(false)
        return
      }

      let resolvedPartnerId: string

      // If using API key (SDK mode), validate it and get the partner ID
      if (apiKey && !directPartnerId) {
        try {
          const partnerData = await validateApiKey(apiKey)
          console.log('[Partner] Validated API key, partner data:', partnerData)
          console.log('[Partner] webhookUrl:', partnerData.webhookUrl)
          resolvedPartnerId = partnerData.id || partnerData.partnerId || apiKey
          setPartnerInfo(partnerData)
        } catch (e) {
          const errorMsg = 'Invalid API key. Please check your configuration.'
          setError(errorMsg)
          sendSDKMessage('IDV_ERROR', {
            code: 'INVALID_API_KEY',
            message: errorMsg,
            recoverable: false,
          })
          setIsLoading(false)
          return
        }
      } else {
        resolvedPartnerId = directPartnerId!
        // Get partner info for direct link mode
        try {
          const partner = await getPartnerInfo(resolvedPartnerId)
          console.log('[Partner] Got partner info:', partner)
          console.log('[Partner] webhookUrl:', partner.webhookUrl)
          setPartnerInfo(partner)
        } catch (e) {
          console.log('[Partner] Failed to get partner info:', e)
          // Partner info is optional, continue without it
        }
      }

      setPartnerId(resolvedPartnerId)

      // Notify SDK that verification has started
      sendSDKMessage('IDV_START', {})

      // Create new verification for this partner
      const newVerification = await createVerification(resolvedPartnerId, {
        userId: userIdParam || undefined,
        source: sdkMode ? 'sdk' : 'web-flow',
      })
      setVerificationId(newVerification.id)
      setCurrentStep(2)
    } catch (err) {
      console.error('Initialization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize verification')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNext = () => {
    if (currentStep < 8) {
      // Clear error when moving forward
      setError(null)
      setCurrentStep((prev) => {
        // After front document capture (step 3), check if back capture is needed
        if (prev === 3) {
          const needsBackCapture = DOCUMENTS_REQUIRING_BACK.includes(verificationData.documentType)
          if (needsBackCapture) {
            return 3.5 as VerificationStep // Go to back capture
          }
          return 4 as VerificationStep // Skip to document review
        }
        // After back capture (step 3.5), go to document review
        if (prev === 3.5) {
          return 4 as VerificationStep
        }
        const next = prev + 1
        return next as VerificationStep
      })
    }
  }

  const handleBack = () => {
    if (currentStep > 2) {
      // Clear error when navigating back
      setError(null)
      setCurrentStep((prev) => {
        // From document review (step 4), go back to back capture if needed, else front capture
        if (prev === 4) {
          const needsBackCapture = DOCUMENTS_REQUIRING_BACK.includes(verificationData.documentType)
          if (needsBackCapture && verificationData.documentBackImage) {
            return 3.5 as VerificationStep
          }
          return 3 as VerificationStep
        }
        // From back capture (step 3.5), go to front capture
        if (prev === 3.5) {
          return 3 as VerificationStep
        }
        const next = prev - 1
        return next as VerificationStep
      })
    }
  }

  const updateVerificationData = (data: Partial<VerificationData>) => {
    setVerificationData(prev => ({ ...prev, ...data }))
  }

  // Handle verification submission after selfie review
  const handleSubmitVerification = async () => {
    if (!verificationId || !verificationData.documentFrontImage || !verificationData.selfieImage) {
      setError('Missing required data for verification')
      return
    }

    setCurrentStep(7.5) // Processing step
    setError(null)

    try {
      // Step 1: Upload front document
      setProcessingStatus('Analyzing your document...')
      const documentType = getApiDocumentType(verificationData.documentType, verificationData.country)
      await uploadDocument(
        verificationId,
        verificationData.documentFrontImage,
        documentType,
        'FRONT',
        partnerId || undefined
      )

      // Step 1.5: Upload back document if exists
      if (verificationData.documentBackImage) {
        setProcessingStatus('Analyzing back of document...')
        await uploadDocument(
          verificationId,
          verificationData.documentBackImage,
          documentType,
          'BACK',
          partnerId || undefined
        )
      }

      // Step 2: Upload selfie
      setProcessingStatus('Processing your selfie...')
      await uploadSelfie(
        verificationId,
        verificationData.selfieImage,
        partnerId || undefined
      )

      // Step 3: Submit and get result
      setProcessingStatus('Completing verification...')
      const submitStartTime = Date.now()
      console.log('[submitVerification] Start:', new Date(submitStartTime).toISOString())
      const result = await submitVerification(verificationId, partnerId || undefined, userId || undefined)
      const submitEndTime = Date.now()
      console.log('[submitVerification] End:', new Date(submitEndTime).toISOString())
      console.log('[submitVerification] Duration:', (submitEndTime - submitStartTime) / 1000, 'seconds')
      setVerificationResult(result)

      // Check if verification failed and retry is allowed
      if (!result.passed && (result.canRetry || (result.remainingRetries !== undefined && result.remainingRetries > 0))) {
        console.log('[Verification] Failed but retry allowed:', {
          canRetry: result.canRetry,
          remainingRetries: result.remainingRetries,
        })

        // Send webhook for failed verification - DISABLED (webhook sent from backend)
        // if (partnerInfo?.webhookUrl && partnerId) {
        //   console.log('[Webhook] Sending failure webhook to:', partnerInfo.webhookUrl)
        //   sendWebhook({
        //     webhookUrl: partnerInfo.webhookUrl,
        //     verificationId,
        //     partnerId,
        //     referenceId: userId || undefined,
        //     result,
        //     extractedData: result.extractedData,
        //     source: sdkMode ? 'sdk' : 'web-flow',
        //     duration: Date.now() - startTime,
        //   })
        //     .then((response) => {
        //       console.log('[Webhook] Failure webhook response:', response)
        //     })
        //     .catch((err) => {
        //       console.error('[Webhook] Failure webhook failed:', err)
        //     })
        // }

        // Determine specific error message
        const isDocumentExpired = result.checks?.documentExpired === true
        const errorMessage = isDocumentExpired
          ? 'Your document has expired. Please use a valid, non-expired document.'
          : (result.message || 'Verification failed. Please try again.')

        // Send retry event to SDK
        sendSDKMessage('IDV_ERROR', {
          code: isDocumentExpired ? 'DOCUMENT_EXPIRED' : 'VERIFICATION_FAILED',
          message: errorMessage,
          recoverable: true,
          remainingRetries: result.remainingRetries,
        })

        // Set error message and allow retry
        setError(errorMessage)
        setCurrentStep(2) // Go back to document selection to retry
        setVerificationData({
          country: verificationData.country,
          documentType: '',
          documentFrontImage: null,
          documentBackImage: null,
          selfieImage: null,
        })
        return
      }

      // Send complete message to SDK (for both final pass and final fail)
      sendSDKMessage('IDV_COMPLETE', {
        verificationId,
        status: result.passed ? 'passed' : 'failed',
        result: {
          passed: result.passed,
          riskLevel: result.riskLevel,
          message: result.message,
        },
        extractedData: result.passed ? {
          fullName: result.extractedData?.fullName,
          dateOfBirth: result.extractedData?.dateOfBirth,
          documentNumber: maskDocumentNumber(result.extractedData?.documentNumber),
          expiryDate: result.extractedData?.expiryDate,
          issuingCountry: result.extractedData?.issuingCountry,
        } : undefined,
        completedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
      })

      // Close the window after verification complete
      // Small delay to ensure SDK message is sent
      setTimeout(() => {
        if (sdkMode) {
          // Send close message to parent
          sendSDKMessage('IDV_CLOSE', {
            verificationId,
            status: result.passed ? 'passed' : 'failed',
          })
        }
        // Try to close the window
        window.close()
      }, 500)
    } catch (err) {
      console.error('Verification submission error:', err)
      const errorMsg = err instanceof Error ? err.message : 'Verification failed'
      setError(errorMsg)

      // Send error to SDK
      sendSDKMessage('IDV_ERROR', {
        code: 'VERIFICATION_FAILED',
        message: errorMsg,
        recoverable: true,
      })

      // Check if error is related to invalid/missing document
      const isDocumentError = errorMsg.toLowerCase().includes('no valid id document') ||
        errorMsg.toLowerCase().includes('document not found') ||
        errorMsg.toLowerCase().includes('invalid document') ||
        errorMsg.toLowerCase().includes('upload a government-issued id') ||
        errorMsg.toLowerCase().includes('unable to extract') ||
        errorMsg.toLowerCase().includes('upload a clearer image')

      if (isDocumentError) {
        // Go back to document select page and clear document images
        setVerificationData(prev => ({
          ...prev,
          documentType: '',
          documentFrontImage: null,
          documentBackImage: null,
        }))
        setCurrentStep(2) // Select ID type page
        return
      }

      // Go back to selfie review to allow retry for other errors
      setCurrentStep(7)
    }
  }

  const handleRetry = () => {
    setError(null)
    setVerificationResult(null)
    setCurrentStep(2)
    setVerificationData({
      country: verificationData.country,
      documentType: '',
      documentFrontImage: null,
      documentBackImage: null,
      selfieImage: null,
    })
  }

  const renderStep = () => {
    // Error state (fatal - no verification ID and on step 1)
    if (error && !verificationId && currentStep === 1) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4 px-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl text-red-600">!</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Unable to Load Verification</h2>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setError(null)
              setIsLoading(false)
            }}
            className="mt-4"
          >
            Try again
          </Button>
        </div>
      )
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="flex flex-col w-full h-full">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Let's get started
              </h1>
              <p className="text-gray-500 text-sm">
                Verify your identity to keep your account secure.
              </p>
            </div>

            <div className="space-y-4 mt-16">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  <Image
                    src="/id-card.svg"
                    alt="Photo ID"
                    width={48}
                    height={48}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">Photo ID</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ID card, passport, driver's license supported
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  <Image
                    src="/facial.svg"
                    alt="Facial recognition"
                    width={48}
                    height={48}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">Facial recognition</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Quick selfie to confirm it's you
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code for desktop users to switch to mobile */}
            {isDesktop && mobileVerifyUrl && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 text-center mb-3">
                  Scan to continue on mobile
                </p>
                <div className="flex justify-center">
                  <div className="bg-white p-2 rounded-lg">
                    <QRCodeSVG
                      value={mobileVerifyUrl}
                      size={120}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  For best results, use your phone's camera
                </p>
              </div>
            )}

            <div className="mt-auto pb-6">
              <div className="space-y-4">
                <p className="text-xs text-gray-500 text-center">
                  By continuing, you agree to our{' '}
                  <a href="https://partner.trustcredo.com/Privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.
                </p>

                <Button
                  variant="idv"
                  className="w-full"
                  style={{ borderRadius: '8px', fontSize: '14px' }}
                  onClick={initializeVerification}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    'Agree and continue'
                  )}
                </Button>
                <p className="text-center text-gray-300 text-xs mt-2">v1.25.5</p>
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="flex flex-col h-full">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-red-600 text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Verification Failed</p>
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <DocumentSelectStep
                data={verificationData}
                onNext={handleNext}
                onBack={handleBack}
                updateData={updateVerificationData}
              />
            </div>
          </div>
        )
      case 3:
        return (
          <DocumentCaptureStep
            data={verificationData}
            onNext={handleNext}
            onBack={handleBack}
            updateData={updateVerificationData}
          />
        )
      case 3.5:
        return (
          <DocumentBackCaptureStep
            data={verificationData}
            onNext={handleNext}
            onBack={handleBack}
            updateData={updateVerificationData}
          />
        )
      case 4:
        return (
          <DocumentReviewStep
            data={verificationData}
            onNext={handleNext}
            onBack={handleBack}
            updateData={updateVerificationData}
            error={error}
          />
        )
      case 5:
        return (
          <SelfieIntroStep
            data={verificationData}
            onNext={handleNext}
            onBack={handleBack}
            updateData={updateVerificationData}
          />
        )
      case 6:
        return (
          <SelfieStep
            data={verificationData}
            onNext={handleNext}
            onBack={handleBack}
            updateData={updateVerificationData}
          />
        )
      case 7:
        return (
          <SelfieReviewStep
            data={verificationData}
            onNext={handleSubmitVerification}
            onBack={handleBack}
            updateData={updateVerificationData}
            error={error}
          />
        )
      case 7.5:
        return (
          <ProcessingStep
            status={processingStatus}
          />
        )
      case 8:
        return (
          <CompleteStep
            result={verificationResult}
            onRetry={verificationResult?.canRetry ? handleRetry : undefined}
            onClose={() => {
              sendSDKMessage('IDV_CLOSE', {
                verificationId,
                status: verificationResult?.passed ? 'passed' : 'failed',
              })
            }}
            partnerInfo={partnerInfo}
          />
        )
      default:
        return null
    }
  }

  // Calculate progress (handle 7.5 step)
  const getProgressStep = () => {
    if (currentStep === 7.5) return 7.5
    return currentStep
  }

  return (
    <AppLayout>
      {/* Header with back button and progress */}
      {currentStep > 1 && currentStep !== 7.5 && (
        <div className="absolute top-12 left-0 right-0 px-6 sm:px-8 flex items-center gap-4">
          {currentStep > 2 && currentStep < 8 && (
            <button
              onClick={handleBack}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {currentStep === 2 && (
            <button
              onClick={() => setCurrentStep(1)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <ProgressBar currentStep={getProgressStep()} totalSteps={8} />
        </div>
      )}

      {/* Partner branding */}
      {/*partnerInfo && currentStep === 2 && (
        <div className="absolute top-16 left-0 right-0 px-6 pt-4 text-center">
          <p className="text-xs text-gray-500">
            Verification for <span className="font-medium text-gray-700">{partnerInfo.companyName}</span>
          </p>
        </div>
      )*/}

      {/* Main content */}
      <div className={`flex flex-col w-full flex-1 min-h-0 ${currentStep > 1 ? 'pt-12' : ''}`}>
        <div className="animate-fade-in flex-1 min-h-0" key={currentStep}>
          {renderStep()}
        </div>
      </div>
    </AppLayout>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </AppLayout>
    }>
      <VerifyPageContent />
    </Suspense>
  )
}
