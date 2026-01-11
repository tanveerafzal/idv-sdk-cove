'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Image from 'next/image'
import DocumentSelectStep from '@/components/verify/DocumentSelectStep'
import DocumentCaptureStep from '@/components/verify/DocumentCaptureStep'
import DocumentReviewStep from '@/components/verify/DocumentReviewStep'
import SelfieIntroStep from '@/components/verify/SelfieIntroStep'
import SelfieStep from '@/components/verify/SelfieStep'
import SelfieReviewStep from '@/components/verify/SelfieReviewStep'
import ProcessingStep from '@/components/verify/ProcessingStep'
import CompleteStep from '@/components/verify/CompleteStep'
import ProgressBar from '@/components/verify/ProgressBar'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import {
  getPartnerInfo,
  createVerification,
  uploadDocument,
  uploadSelfie,
  submitVerification,
  getApiDocumentType,
  type VerificationResult,
  type PartnerInfo,
} from '@/lib/api'

export type VerificationStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 7.5 | 8

export interface VerificationData {
  country: string
  documentType: string
  documentFrontImage: string | null
  selfieImage: string | null
  retakeDocument?: boolean
  retakeSelfie?: boolean
}

function VerifyPageContent() {
  const searchParams = useSearchParams()

  // Core state
  const [currentStep, setCurrentStep] = useState<VerificationStep>(1)
  const [verificationData, setVerificationData] = useState<VerificationData>({
    country: 'Canada',
    documentType: '',
    documentFrontImage: null,
    selfieImage: null,
  })

  // API state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>('Initializing...')

  const initializeVerification = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const partnerIdParam = searchParams.get('partner-id')

      if (!partnerIdParam) {
        setError('No partner ID provided. Please use a valid verification link.')
        setIsLoading(false)
        return
      }

      setPartnerId(partnerIdParam)

      // Get partner info
      try {
        const partner = await getPartnerInfo(partnerIdParam)
        setPartnerInfo(partner)
      } catch (e) {
        // Partner info is optional, continue without it
      }

      // Create new verification for this partner
      const newVerification = await createVerification(partnerIdParam, {
        source: 'web-flow',
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
      setCurrentStep((prev) => {
        const next = prev + 1
        return next as VerificationStep
      })
    }
  }

  const handleBack = () => {
    if (currentStep > 2) {
      setCurrentStep((prev) => {
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
      // Step 1: Upload document
      setProcessingStatus('Analyzing your document...')
      const documentType = getApiDocumentType(verificationData.documentType)
      await uploadDocument(
        verificationId,
        verificationData.documentFrontImage,
        documentType,
        'FRONT',
        partnerId || undefined
      )

      // Step 2: Upload selfie
      setProcessingStatus('Processing your selfie...')
      await uploadSelfie(
        verificationId,
        verificationData.selfieImage,
        partnerId || undefined
      )

      // Step 3: Submit and get result
      setProcessingStatus('Completing verification...')
      const result = await submitVerification(verificationId, partnerId || undefined)
      setVerificationResult(result)

      // Move to complete step
      setCurrentStep(8)
    } catch (err) {
      console.error('Verification submission error:', err)
      setError(err instanceof Error ? err.message : 'Verification failed')
      // Go back to selfie review to allow retry
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
              <h1 className="text-2xl font-bold text-gray-900">Let's get started</h1>
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

            <div className="mt-auto pb-6">
              <div className="space-y-4">
                <p className="text-xs text-gray-500 text-center">
                  By continuing, you agree to our{' '}
                  <a href="#" className="underline">Privacy Policy</a>.
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
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <DocumentSelectStep
            data={verificationData}
            onNext={handleNext}
            onBack={handleBack}
            updateData={updateVerificationData}
          />
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
        <div className="absolute top-6 left-0 right-0 px-6 sm:px-8 flex items-center gap-4">
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
      {partnerInfo && currentStep === 2 && (
        <div className="absolute top-16 left-0 right-0 px-6 pt-4 text-center">
          <p className="text-xs text-gray-500">
            Verification for <span className="font-medium text-gray-700">{partnerInfo.companyName}</span>
          </p>
        </div>
      )}

      {/* Main content */}
      <div className={`flex flex-col w-full h-full ${currentStep > 1 ? 'pt-16' : ''}`}>
        <div className="animate-fade-in h-full" key={currentStep}>
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
