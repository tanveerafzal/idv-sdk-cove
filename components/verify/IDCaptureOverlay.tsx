'use client'

import { useState, useEffect } from 'react'
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

  const handleCapture = () => {
    if (videoRef.current) {
      const video = videoRef.current
      const canvas = document.createElement('canvas')

      // Capture full frame at native resolution
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const base64String = canvas.toDataURL('image/jpeg', 0.92)
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
  mobileTop={90}
  desktopTop={120}
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
      <div className="absolute top-14 sm:top-16 left-3 right-3 z-10">
        <h1 className="text-xl sm:text-lg font-semibold text-white">
          Place the <span className="text-emerald-400">{getDocumentLabel()}</span> in the frame
        </h1>
      </div>

      {/* Hint text inside frame */}
      <div className="absolute left-6 right-6 z-10 flex justify-center" style={{ top: 'calc(90px + 20px)' }}>
        <p className="text-sm text-white/70 text-center sm:hidden">
          Hold document close to fill the frame
        </p>
      </div>
      <div className="absolute left-6 right-6 z-10 justify-center hidden sm:flex" style={{ top: 'calc(120px + 20px)' }}>
        <p className="text-sm text-white/70 text-center">
          Hold document close to fill the frame
        </p>
      </div>

      {/* Capture button */}
      <div className="absolute bottom-32 sm:bottom-16 left-0 right-0 flex justify-center z-10">
        <button
          onClick={handleCapture}
          className="w-20 h-20 sm:w-16 sm:h-16 rounded-full border-4 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <div className="w-16 h-16 sm:w-12 sm:h-12 rounded-full bg-white" />
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
  const [frameWidth, setFrameWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const calculateFrameDimensions = () => {
      // ID card aspect ratio is ~1.586:1 (85.6mm x 54mm)
      const idCardAspectRatio = 1.586
      const screenWidth = window.innerWidth
      const mobile = screenWidth < 640
      setIsMobile(mobile)

      let width: number
      if (mobile) {
        // Mobile: use full width minus padding
        width = screenWidth - 48
      } else {
        // Desktop: limit max width to 420px so document can fill the frame easier
        // This makes it easier to capture readable documents on webcams
        width = Math.min(screenWidth - 48, 420)
      }

      console.log('[IDScannerFrame] Device detection:', {
        screenWidth,
        isMobile: mobile,
        device: mobile ? 'MOBILE' : 'DESKTOP',
        frameWidth: width,
        frameHeight: width / idCardAspectRatio
      })

      setFrameWidth(width)
      setFrameHeight(width / idCardAspectRatio)
    }

    calculateFrameDimensions()
    window.addEventListener('resize', calculateFrameDimensions)
    return () => window.removeEventListener('resize', calculateFrameDimensions)
  }, [])

  const topPosition = isMobile ? mobileTop : desktopTop
  const horizontalPadding = isMobile ? 24 : (typeof window !== 'undefined' ? (window.innerWidth - frameWidth) / 2 : 24)

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
        <div className="bg-black/70" style={{ width: `${horizontalPadding}px` }} />
        <div className="relative rounded-2xl overflow-hidden" style={{ width: `${frameWidth}px` }}>
          <CornerBrackets />
          <div
            className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60"
            style={{ top: `${scannerOffset}%` }}
          />
        </div>
        <div className="bg-black/70" style={{ width: `${horizontalPadding}px` }} />
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
