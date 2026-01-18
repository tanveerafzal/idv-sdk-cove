'use client'

import { useState, useEffect, useRef } from 'react'
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
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0)
        const base64String = canvas.toDataURL('image/jpeg')
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
  mobileTop={180}
  desktopTop={270}
  mobileHeight={200}
  desktopHeight={180}
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
      </div>

      {/* Capture button */}
      <div className="absolute bottom-32 sm:bottom-16 left-0 right-0 flex justify-center z-10">
        <button
          onClick={handleCapture}
          className="w-20 h-20 sm:w-16 sm:h-16 rounded-full border-4 border-white flex items-center justify-center"
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
  mobileHeight: number   // frame height on mobile
  desktopHeight: number  // frame height on desktop
  scannerOffset: number
}

const IDScannerFrame = ({ mobileTop, desktopTop, mobileHeight, desktopHeight, scannerOffset }: IDScannerFrameProps) => {
  return (
    <div className="absolute inset-0">
      {/* Top dark section */}
      <div 
        className="absolute top-0 left-0 right-0 bg-black/70" 
        style={{ height: `${mobileTop}px` }}
      />
      <div 
        className="absolute top-0 left-0 right-0 bg-black/70 hidden sm:block" 
        style={{ height: `${desktopTop}px` }}
      />

      {/* Middle section with cutout */}
      <div 
        className="absolute left-0 right-0 flex sm:hidden" 
        style={{ top: `${mobileTop}px`, height: `${mobileHeight}px` }}
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

      {/* Desktop middle section */}
      <div 
        className="absolute left-0 right-0 hidden sm:flex" 
        style={{ top: `${desktopTop}px`, height: `${desktopHeight}px` }}
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
        className="absolute left-0 right-0 bottom-0 bg-black/70 sm:hidden" 
        style={{ top: `${mobileTop + mobileHeight}px` }}
      />
      <div 
        className="absolute left-0 right-0 bottom-0 bg-black/70 hidden sm:block" 
        style={{ top: `${desktopTop + desktopHeight}px` }}
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
