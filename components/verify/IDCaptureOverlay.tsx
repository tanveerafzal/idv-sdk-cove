'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface IDCaptureOverlayProps {
  documentType: string
  onCapture: (imageData: string) => void
  onBack: () => void
  videoRef: React.RefObject<HTMLVideoElement>
  isBackSide?: boolean
}

const IDCaptureOverlay = ({ documentType, onCapture, onBack, videoRef, isBackSide = false }: IDCaptureOverlayProps) => {
  const [scannerOffset, setScannerOffset] = useState(0)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isStable, setIsStable] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Position document in frame')

  // Refs for auto-capture
  const previousFrameRef = useRef<ImageData | null>(null)
  const stableCountRef = useRef(0)
  const capturedRef = useRef(false)
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const getDocumentLabel = () => {
    const labels: Record<string, string> = {
      drivers_license: "Driver's License",
      state_id: 'ID Card',
      health_card: 'Health Card',
      passport: 'Information Page of Passport',
      passport_card: 'Passport Card',
      permanent_resident: 'Permanent Resident Card',
      us_green_card: 'Green Card',
      work_permit: 'Work Permit',
      indian_status: 'Certificate of Indian Status',
    }
    const label = labels[documentType] || 'Document'
    return isBackSide ? `Back of ${label}` : label
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setScannerOffset(prev => (prev + 1) % 100)
    }, 30)
    return () => clearInterval(interval)
  }, [])

  // Auto-capture: Analyze frames for stability
  const analyzeFrame = useCallback(() => {
    if (!videoRef.current || capturedRef.current) return

    const video = videoRef.current
    if (video.readyState !== 4) return // Video not ready

    // Create or reuse analysis canvas
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas')
      analysisCanvasRef.current.width = 160 // Small size for faster analysis
      analysisCanvasRef.current.height = 90
    }

    const canvas = analysisCanvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Draw scaled down frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height)

    if (previousFrameRef.current) {
      // Compare frames to detect motion
      let diff = 0
      const data1 = previousFrameRef.current.data
      const data2 = currentFrame.data
      const pixelCount = data1.length / 4

      for (let i = 0; i < data1.length; i += 4) {
        // Compare RGB values (skip alpha)
        diff += Math.abs(data1[i] - data2[i])     // R
        diff += Math.abs(data1[i + 1] - data2[i + 1]) // G
        diff += Math.abs(data1[i + 2] - data2[i + 2]) // B
      }

      const avgDiff = diff / (pixelCount * 3)
      const isFrameStable = avgDiff < 8 // Threshold for stability

      if (isFrameStable) {
        stableCountRef.current++

        if (stableCountRef.current >= 10 && !isStable) { // ~500ms of stability
          setIsStable(true)
          setStatusMessage('Hold steady...')
          setCountdown(3)
        }
      } else {
        stableCountRef.current = 0
        if (isStable) {
          setIsStable(false)
          setCountdown(null)
          setStatusMessage('Position document in frame')
        }
      }
    }

    previousFrameRef.current = currentFrame
  }, [isStable, videoRef])

  // Run frame analysis
  useEffect(() => {
    const interval = setInterval(analyzeFrame, 50) // 20 fps analysis
    return () => clearInterval(interval)
  }, [analyzeFrame])

  // Countdown timer for auto-capture
  useEffect(() => {
    if (countdown === null || capturedRef.current) return

    if (countdown === 0) {
      capturedRef.current = true
      handleCapture()
      return
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown])

  const handleCapture = () => {
    if (videoRef.current) {
      const video = videoRef.current
      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight

      // Get the displayed video dimensions
      const displayWidth = video.clientWidth
      const displayHeight = video.clientHeight

      // Calculate scale factors between actual video and displayed size
      const scaleX = videoWidth / displayWidth
      const scaleY = videoHeight / displayHeight

      // Determine if mobile or desktop based on window width
      const isMobile = window.innerWidth < 640 // sm breakpoint

      // Frame dimensions matching IDScannerFrame (with proper ID card aspect ratio)
      const frameLeft = 24 // w-6 = 1.5rem = 24px
      const frameWidth = displayWidth - (frameLeft * 2)
      // ID card aspect ratio is ~1.586:1 (85.6mm x 54mm)
      const idCardAspectRatio = 1.586
      const frameHeight = frameWidth / idCardAspectRatio
      const frameTop = isMobile ? 140 : 200

      // Convert to video coordinates
      const cropX = frameLeft * scaleX
      const cropY = frameTop * scaleY
      const cropWidth = frameWidth * scaleX
      const cropHeight = frameHeight * scaleY

      // Create canvas with high resolution output (minimum 1200px wide for quality)
      const outputWidth = Math.max(cropWidth, 1200)
      const outputHeight = outputWidth / idCardAspectRatio

      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // Draw the cropped region scaled up to output size
        ctx.drawImage(
          video,
          cropX, cropY, cropWidth, cropHeight,  // Source rectangle
          0, 0, outputWidth, outputHeight        // Destination rectangle
        )
        const base64String = canvas.toDataURL('image/jpeg', 0.95)
        onCapture(base64String)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black sm:absolute sm:top-0 sm:left-0 sm:right-0 sm:bottom-0 sm:w-full sm:h-full sm:rounded-xl sm:overflow-hidden animate-fade-in">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

     <IDScannerFrame
  mobileTop={140}
  desktopTop={200}
  scannerOffset={scannerOffset}
/>


      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 sm:top-2 left-4 z-10 text-white p-2"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Header text */}
      <div className="absolute top-20 sm:top-20 left-6 right-6 z-10">
        <h1 className="text-xl sm:text-lg font-semibold text-white">
          Place the <span className="text-emerald-400">{getDocumentLabel()}</span> in the frame
        </h1>
        <p className={`text-sm mt-2 ${isStable ? 'text-emerald-400' : 'text-white/70'}`}>
          {statusMessage}
        </p>
      </div>

      {/* Countdown indicator */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-24 h-24 rounded-full bg-black/50 flex items-center justify-center">
            <span className="text-5xl font-bold text-white">{countdown}</span>
          </div>
        </div>
      )}

      {/* Capture button */}
      <div className="absolute bottom-32 sm:bottom-16 left-0 right-0 flex justify-center z-10">
        <button
          onClick={() => {
            capturedRef.current = true
            handleCapture()
          }}
          className={`w-20 h-20 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center transition-colors ${
            isStable ? 'border-emerald-400' : 'border-white'
          }`}
        >
          <div className={`w-16 h-16 sm:w-12 sm:h-12 rounded-full transition-colors ${
            isStable ? 'bg-emerald-400' : 'bg-white'
          }`} />
        </button>
      </div>

      {/* Help link */}
      <div className="absolute bottom-16 sm:bottom-4 left-0 right-0 flex justify-center z-10">
        <button
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-2 text-white/80 text-sm"
        >
          Problem with scanning?
          <span className="w-5 h-5 rounded-full border border-white/60 flex items-center justify-center text-xs">?</span>
        </button>
      </div>

      {/* Help Modal */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="sm:max-w-md z-[200]">
          <DialogHeader>
            <DialogTitle>Having trouble scanning?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Try these tips:</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Make sure your document is flat and not bent</li>
              <li>• Find a well-lit area without glare</li>
              <li>• Hold your phone steady and parallel to the document</li>
              <li>• Ensure all corners of the document are visible</li>
              <li>• Clean your camera lens if the image is blurry</li>
            </ul>
            <Button
              variant="outline"
              onClick={() => setShowHelpModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface IDScannerFrameProps {
  mobileTop: number      // pixels from top on mobile
  desktopTop: number     // pixels from top on desktop
  scannerOffset: number
}

const IDScannerFrame = ({ mobileTop, desktopTop, scannerOffset }: IDScannerFrameProps) => {
  const [frameHeight, setFrameHeight] = useState(200)

  useEffect(() => {
    const calculateFrameHeight = () => {
      // ID card aspect ratio is ~1.586:1 (85.6mm x 54mm)
      const idCardAspectRatio = 1.586
      const frameWidth = window.innerWidth - 48 // 24px padding on each side
      const calculatedHeight = frameWidth / idCardAspectRatio
      setFrameHeight(calculatedHeight)
    }

    calculateFrameHeight()
    window.addEventListener('resize', calculateFrameHeight)
    return () => window.removeEventListener('resize', calculateFrameHeight)
  }, [])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const topPosition = isMobile ? mobileTop : desktopTop

  return (
    <div className="absolute inset-0">
      {/* Top dark section */}
      <div
        className="absolute top-0 left-0 right-0 bg-black/70"
        style={{ height: `${topPosition}px` }}
      />

      {/* Middle section with cutout */}
      <div
        className="absolute left-0 right-0 flex"
        style={{ top: `${topPosition}px`, height: `${frameHeight}px` }}
      >
        <div className="w-6 bg-black/70" />
        <div className="flex-1 relative rounded-2xl overflow-hidden">
          <CornerBrackets />
          <div
            className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60"
            style={{ top: `${scannerOffset}%` }}
          />
        </div>
        <div className="w-6 bg-black/70" />
      </div>

      {/* Bottom dark section */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-black/70"
        style={{ top: `${topPosition + frameHeight}px` }}
      />
    </div>
  )
}

const CornerBrackets = () => {
  const bracketStyle = "absolute w-10 h-10 border-emerald-400"

  return (
    <>
      {/* Top-left */}
      <div className={`${bracketStyle} top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl`} />
      <ChevronRow position="top-2 left-12" direction="left" />

      {/* Top-right */}
      <div className={`${bracketStyle} top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl`} />
      <ChevronRow position="top-2 right-12" direction="right" />

      {/* Bottom-left */}
      <div className={`${bracketStyle} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl`} />
      <ChevronRow position="bottom-2 left-12" direction="left" />

      {/* Bottom-right */}
      <div className={`${bracketStyle} bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl`} />
      <ChevronRow position="bottom-2 right-12" direction="right" />
    </>
  )
}

const ChevronRow = ({ position, direction }: { position: string; direction: 'left' | 'right' }) => {
  const chevrons = Array(8).fill(null)

  return (
    <div className={`absolute ${position} flex gap-0.5 opacity-40`}>
      {chevrons.map((_, i) => (
        <span
          key={i}
          className="text-white text-xs"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          {direction === 'left' ? '‹' : '›'}
        </span>
      ))}
    </div>
  )
}

export default IDCaptureOverlay
