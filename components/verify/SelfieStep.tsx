import { useState, useEffect } from 'react'
import { VerificationData } from '@/app/verify/page'
import SelfieCaptureOverlay from './SelfieCaptureOverlay'

interface SelfieStepProps {
  data: VerificationData
  onNext: () => void
  onBack: () => void
  updateData: (data: Partial<VerificationData>) => void
}

export default function SelfieStep({
  data,
  onNext,
  onBack,
  updateData,
}: SelfieStepProps) {
  const [isCapturing, setIsCapturing] = useState(false)

  // Auto-start camera if coming from retake or on mount
  useEffect(() => {
    if (data.retakeSelfie) {
      updateData({ retakeSelfie: false })
    }
    setIsCapturing(true)
  }, [])

  const handleCapture = (imageData: string) => {
    updateData({ selfieImage: imageData })
    setIsCapturing(false)
    onNext()
  }

  const handleClose = () => {
    setIsCapturing(false)
    onBack()
  }

  if (isCapturing) {
    return (
      <SelfieCaptureOverlay
        onCapture={handleCapture}
        onClose={handleClose}
      />
    )
  }

  return null
}
