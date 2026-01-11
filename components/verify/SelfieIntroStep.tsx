import { Button } from '@/components/ui/button'
import { VerificationData } from '@/app/verify/page'
import Image from 'next/image'

interface SelfieIntroStepProps {
  data: VerificationData
  onNext: () => void
  onBack: () => void
  updateData: (data: Partial<VerificationData>) => void
}

export default function SelfieIntroStep({
  data,
  onNext,
  onBack,
  updateData,
}: SelfieIntroStepProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-6">
        <div className="w-full mb-4 flex justify-center">
          <Image src="/selfie-image.svg" alt="Selfie" width={200} height={200} />
        </div>

        <div className="space-y-2">
          <h2 className="text-l font-bold text-gray-900">
            Selfie time to confirm it's you
          </h2>
          <p className="text-sm text-gray-600">For best results:</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Image src="/holdup.svg" alt="Hold upright" width={40} height={40} />
              <span className="text-sm text-gray-600">Hold upright</span>
            </div>
            <div className="flex items-center gap-3">
              <Image src="/welllit.svg" alt="Well-lit" width={40} height={40} />
              <span className="text-sm text-gray-600">Well-lit</span>
            </div>
            <div className="flex items-center gap-3">
              <Image src="/face.svg" alt="Face uncovered" width={40} height={40} />
              <span className="text-sm text-gray-600">Face uncovered</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-6 mb-[40px] sm:mb-[40px]">
            <Button onClick={onNext} variant="idv" className="w-full" style={{ borderRadius: '8px', fontSize: '14px' }}>
              Take Selfie
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
