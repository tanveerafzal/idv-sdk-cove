import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronLeft, Camera, Upload, Smartphone, Info } from 'lucide-react'
import { VerificationData } from '@/app/verify/page'
import Image from 'next/image'
import IDCaptureOverlay from './IDCaptureOverlay'

interface DocumentCaptureStepProps {
  data: VerificationData
  onNext: () => void
  onBack: () => void
  updateData: (data: Partial<VerificationData>) => void
}

export default function DocumentCaptureStep({
  data,
  onNext,
  onBack,
  updateData,
}: DocumentCaptureStepProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(data.documentFrontImage)
  const [showContinueModal, setShowContinueModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Auto-start camera if coming from retake
  useEffect(() => {
    if (data.retakeDocument) {
      updateData({ retakeDocument: false })
      startCamera()
    }
  }, [])

  
  const getDocumentTypeLabel = () => {
    const labels: Record<string, string> = {
      drivers_license: "driver's license",
      state_id: 'state ID',
      passport: 'passport',
      passport_card: 'passport card',
      permanent_resident: 'permanent resident card',
      travel_document: 'travel document',
      visa: 'visa',
      work_permit: 'work permit',
    }
    return labels[data.documentType] || 'document'
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setCapturedImage(base64String)
        updateData({ documentFrontImage: base64String })
      }
      reader.readAsDataURL(file)
    }
  }

  const startCamera = async () => {
    try {
      // Start transition first - show component but with opacity 0
      setIsCapturing(true)
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Ensure video plays
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setIsCapturing(false)
      // Fallback to file upload
      fileInputRef.current?.click()
    }
  }

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0)
        const base64String = canvas.toDataURL('image/jpeg')
        setCapturedImage(base64String)
        updateData({ documentFrontImage: base64String })
        stopCamera()
      }
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCapturing(false)
  }

  const handleRetake = () => {
    setCapturedImage(null)
    updateData({ documentFrontImage: null })
  }

  const handleContinue = () => {
    if (capturedImage) {
      onNext()
    }
  }

  // Show camera overlay
  if (isCapturing) {
    return (
      <IDCaptureOverlay
        documentType={data.documentType}
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        onCapture={(imageData) => {
          setCapturedImage(imageData)
          updateData({ documentFrontImage: imageData })
          stopCamera()
          onNext()
        }}
        onBack={stopCamera}
      />
    )
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 space-y-6">
        <div className="w-full mb-4">
          <Image src="/mock-id.svg" alt="ID Document" width={400} height={240} className="w-full h-auto" />
        </div>

        <div className="space-y-2">
          <h2 className="text-l font-bold text-gray-900">
            Before you take a photo of your {getDocumentTypeLabel()}, please make sure:
          </h2>
        </div>

        <div className="space-y-4">
          {!capturedImage ? (
            <>

              <div className="space-y-3">
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Your ID isn't expired</li>
                  <li>• Lighting is good with no glare or shadows</li>
                  <li>• All corners are visible and text is readable</li>
                </ul>
              </div>

              <div className="fixed bottom-0 left-0 right-0 px-6 pb-[40px] sm:pb-[40px] sm:absolute sm:px-6 z-10 bg-white sm:bg-transparent">
                <Button onClick={startCamera} variant="idv" className="w-full" style={{ borderRadius: '8px', fontSize: '14px' }}>
                  Take Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden">
                <img
                  src={capturedImage || ''}
                  alt="Captured document"
                  className="w-full"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  className="flex-1"
                >
                  Retake
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={!capturedImage}
                  variant="idv"
                  className="flex-1"
                  style={{ borderRadius: '8px', fontSize: '14px' }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showContinueModal} onOpenChange={setShowContinueModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Continue on another device</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              You can continue this verification process on your mobile device.
            </p>
            <div className="bg-gray-100 p-4 rounded-lg text-center">
              <Smartphone className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                QR code or SMS option would go here
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowContinueModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
