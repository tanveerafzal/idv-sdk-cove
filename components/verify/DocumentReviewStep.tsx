import { Button } from '@/components/ui/button'
import { VerificationData } from '@/app/verify/page'

interface DocumentReviewStepProps {
  data: VerificationData
  onNext: () => void
  onBack: () => void
  updateData: (data: Partial<VerificationData>) => void
  error?: string | null
}

export default function DocumentReviewStep({
  data,
  onNext,
  onBack,
  updateData,
  error,
}: DocumentReviewStepProps) {
  const hasBackImage = !!data.documentBackImage

  const handleRetake = () => {
    updateData({
      documentFrontImage: null,
      documentBackImage: null,
      retakeDocument: true
    })
    onBack()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 overflow-y-auto pb-24">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">Review your documents</h2>
          <p className="text-sm text-gray-600">Make sure all text is clear and readable</p>
        </div>

        {/* Front of document - zoomed to show document area */}
        <div className="space-y-2">
          {hasBackImage && (
            <p className="text-sm font-medium text-gray-700">Front</p>
          )}
          <div
            className="rounded-lg overflow-hidden border border-gray-200 relative"
            style={{ aspectRatio: '1.586 / 1' }}
          >
            <img
              src={data.documentFrontImage || ''}
              alt="Document front"
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{ transform: 'scale(1.6)', transformOrigin: 'top center' }}
            />
          </div>
        </div>

        {/* Back of document (if captured) - zoomed to show document area */}
        {hasBackImage && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Back</p>
            <div
              className="rounded-lg overflow-hidden border border-gray-200 relative"
              style={{ aspectRatio: '1.586 / 1' }}
            >
              <img
                src={data.documentBackImage || ''}
                alt="Document back"
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ transform: 'scale(1.6)', transformOrigin: 'top center' }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-6 mb-[40px] sm:mb-[40px] bg-white pt-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleRetake}
            className="flex-1"
            style={{ borderRadius: '8px', fontSize: '14px' }}
          >
            Retake
          </Button>
          <Button
            onClick={onNext}
            variant="idv"
            className="flex-1"
            style={{ borderRadius: '8px', fontSize: '14px' }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
