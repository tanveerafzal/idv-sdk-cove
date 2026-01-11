import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Image from 'next/image'
import { VerificationResult, PartnerInfo } from '@/lib/api'

interface CompleteStepProps {
  result: VerificationResult | null
  onRetry?: () => void
  partnerInfo?: PartnerInfo | null
}

export default function CompleteStep({ result, onRetry, partnerInfo }: CompleteStepProps) {
  const isPassed = result?.passed ?? false
  const canRetry = result?.canRetry && onRetry

  // Determine icon and colors based on result
  const getStatusDisplay = () => {
    if (!result) {
      return {
        icon: <AlertTriangle className="w-16 h-16 text-yellow-500" />,
        title: 'Verification Status Unknown',
        description: 'We could not determine your verification status. Please try again.',
        bgColor: 'bg-yellow-100',
      }
    }

    if (isPassed) {
      return {
        icon: null, // Use image instead
        title: "You're verified",
        description: 'Your identity has been confirmed. You can now continue your application.',
        bgColor: 'bg-green-100',
      }
    }

    // Failed verification
    const message = result.message || 'We were unable to verify your identity. Please try again with clearer photos.'
    return {
      icon: <XCircle className="w-16 h-16 text-red-500" />,
      title: 'Verification Failed',
      description: message,
      bgColor: 'bg-red-100',
    }
  }

  const statusDisplay = getStatusDisplay()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        {isPassed ? (
          <div className="w-full flex justify-center mb-4">
            <Image src="/verified.svg" alt="Verification Complete" width={200} height={200} />
          </div>
        ) : (
          <div className={`w-24 h-24 ${statusDisplay.bgColor} rounded-full flex items-center justify-center`}>
            {statusDisplay.icon}
          </div>
        )}

        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold text-gray-900">{statusDisplay.title}</h2>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            {statusDisplay.description}
          </p>
        </div>

        {/* Show verification details if passed */}
        {isPassed && result?.extractedData && (
          <div className="w-full max-w-sm bg-gray-50 rounded-lg p-4 space-y-2">
            {result.extractedData.fullName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-900">{result.extractedData.fullName}</span>
              </div>
            )}
            {result.extractedData.dateOfBirth && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date of Birth</span>
                <span className="font-medium text-gray-900">{result.extractedData.dateOfBirth}</span>
              </div>
            )}
            {result.extractedData.documentNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Document Number</span>
                <span className="font-medium text-gray-900">
                  {result.extractedData.documentNumber.slice(0, 4)}****
                </span>
              </div>
            )}
          </div>
        )}

        {/* Show warnings if any */}
        {result?.warnings && result.warnings.length > 0 && (
          <div className="w-full max-w-sm bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">Please note:</p>
            <ul className="text-sm text-yellow-700 space-y-1">
              {result.warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Show remaining retries */}
        {!isPassed && result?.remainingRetries !== undefined && result.remainingRetries > 0 && (
          <p className="text-xs text-gray-500">
            {result.remainingRetries} {result.remainingRetries === 1 ? 'attempt' : 'attempts'} remaining
          </p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-6 mb-[40px] sm:mb-[40px]">
        {canRetry ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              style={{ borderRadius: '8px', fontSize: '14px' }}
              onClick={() => window.location.href = '/'}
            >
              Cancel
            </Button>
            <Button
              variant="idv"
              className="flex-1"
              style={{ borderRadius: '8px', fontSize: '14px' }}
              onClick={onRetry}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <Button
            variant="idv"
            className="w-full"
            style={{ borderRadius: '8px', fontSize: '14px' }}
            onClick={() => window.location.href = '/'}
          >
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
