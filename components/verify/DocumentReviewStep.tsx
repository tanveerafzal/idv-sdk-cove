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
  const handleRetake = () => {
    updateData({ documentFrontImage: null, retakeDocument: true })
    onBack()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">Review your photo</h2>
          <p className="text-sm text-gray-600">Make sure all text is clear and readable</p>
        </div>

        <div className="rounded-lg overflow-hidden">
          <img
            src={data.documentFrontImage || ''}
            alt="Captured document"
            className="w-full"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-6 mb-[40px] sm:mb-[40px]">
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
    </div>
  )
}
