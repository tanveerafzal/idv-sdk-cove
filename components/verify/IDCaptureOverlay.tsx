'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMLDetection } from '@/lib/hooks/useMLDetection'
import { useAutoCapture } from '@/lib/hooks/useAutoCapture'
import { DetectionFeedback, DetectionMessage } from './DetectionFeedback'
import { AutoCaptureProgress, CapturingOverlay } from './AutoCaptureProgress'
import type { DetectionConfig, DetectionResult } from '@/lib/ml/types'
import { logInfo, logException } from '@/lib/error-logger'

interface IDCaptureOverlayProps {
  documentType: string
  onCapture: (imageData: string) => void
  onBack: () => void
  videoRef: React.RefObject<HTMLVideoElement>
  isBackSide?: boolean
  enableMLDetection?: boolean
  detectionConfig?: Partial<DetectionConfig>
}

const IDCaptureOverlay = ({
  documentType,
  onCapture,
  onBack,
  videoRef,
  isBackSide = false,
  enableMLDetection = true,
  detectionConfig = {},
}: IDCaptureOverlayProps) => {
  const [scannerOffset, setScannerOffset] = useState(0)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  // ML Detection hook
  const {
    result: detectionResult,
    isReady: mlReady,
    startDetection,
    stopDetection,
  } = useMLDetection({
    config: {
      ...detectionConfig,
      // Disable face detection for back side
      enableFaceDetection: !isBackSide && (detectionConfig.enableFaceDetection !== false),
    },
    enabled: enableMLDetection,
  })

  // Auto-capture hook
  const {
    state: autoCaptureState,
    updateDetectionResult,
    reset: resetAutoCapture,
  } = useAutoCapture({
    delayMs: detectionConfig.autoCaptureDelayMs ?? 2500,
    enabled: enableMLDetection,
    onCapture: () => handleAutoCapture(),
  })

  // Track last detection result for motion tolerance
  const lastResultRef = useRef<DetectionResult | null>(null)

  // Update auto-capture when detection result changes (with motion tolerance)
  useEffect(() => {
    if (!detectionResult) return

    const last = lastResultRef.current

    // Filter out tiny jitter in detection bounds
    if (last && detectionResult.documentBounds && last.documentBounds) {
      const dx = Math.abs(detectionResult.documentBounds.x - last.documentBounds.x)
      const dy = Math.abs(detectionResult.documentBounds.y - last.documentBounds.y)
      const dw = Math.abs(detectionResult.documentBounds.width - last.documentBounds.width)
      const dh = Math.abs(detectionResult.documentBounds.height - last.documentBounds.height)

      // Ignore tiny jitter - only update if movement is significant
      if (dx < 4 && dy < 4 && dw < 6 && dh < 6) {
        // Still update auto-capture state even if bounds didn't change much
        updateDetectionResult(detectionResult)
        return
      }
    }

    lastResultRef.current = detectionResult
    updateDetectionResult(detectionResult)
  }, [detectionResult, updateDetectionResult])

  // Start ML detection when video is ready
  useEffect(() => {
    if (!enableMLDetection) return

    const video = videoRef.current
    if (!video) return

    const handleCanPlay = () => {
      startDetection(video)
    }

    if (video.readyState >= 2) {
      startDetection(video)
    } else {
      video.addEventListener('canplay', handleCanPlay)
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      stopDetection()
    }
  }, [enableMLDetection, videoRef, startDetection, stopDetection])

  // Detect desktop vs mobile context using innerWidth
  // This handles both actual mobile devices AND desktop SDK embeds with narrow iframes
  useEffect(() => {
    const updateDesktopState = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    updateDesktopState()
    window.addEventListener('resize', updateDesktopState)
    return () => window.removeEventListener('resize', updateDesktopState)
  }, [])

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

  const captureImage = useCallback((): string | null => {
    if (videoRef.current) {
      const video = videoRef.current
      const canvas = document.createElement('canvas')

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.92)
      }
    }
    return null
  }, [videoRef])

  const handleCapture = useCallback(() => {
    const imageData = captureImage()
    if (imageData) {
      stopDetection()
      onCapture(imageData)
    }
  }, [captureImage, stopDetection, onCapture])

  const handleAutoCapture = useCallback(() => {
    try {
      logInfo('Auto-capture triggered', { component: 'IDCaptureOverlay', documentType, isBackSide })
      setIsCapturing(true)
      // Small delay for visual feedback
      setTimeout(() => {
        try {
          handleCapture()
        } catch (error) {
          logException(error instanceof Error ? error : new Error(String(error)), {
            component: 'IDCaptureOverlay',
            action: 'handleCapture',
            documentType,
            isBackSide,
          })
        }
      }, 200)
    } catch (error) {
      logException(error instanceof Error ? error : new Error(String(error)), {
        component: 'IDCaptureOverlay',
        action: 'handleAutoCapture',
        documentType,
        isBackSide,
      })
    }
  }, [handleCapture, documentType, isBackSide])

  const handleManualCapture = () => {
    resetAutoCapture()
    handleCapture()
  }

  const handleBack = () => {
    resetAutoCapture()
    stopDetection()
    onBack()
  }

  // Quality indicator based on detection result
  const getQualityColor = (result: DetectionResult | null) => {
    if (!result) return 'border-white/50'
    switch (result.overallQuality) {
      case 'excellent': return 'border-emerald-400'
      case 'good': return 'border-emerald-400/70'
      case 'fair': return 'border-amber-400'
      case 'poor': return 'border-red-400/50'
      default: return 'border-white/50'
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black animate-fade-in">
      {/* Camera feed - fullscreen on all devices for better ID visibility */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Capturing overlay */}
      <CapturingOverlay visible={isCapturing} />

      <IDScannerFrame
        mobileTop={70}
        desktopTop={80}
        scannerOffset={scannerOffset}
        qualityBorderColor={getQualityColor(detectionResult)}
      />

      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 sm:top-2 left-4 z-10 text-white p-2"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Detection feedback indicators */}
      {enableMLDetection && mlReady && (
        <div className="absolute top-4 sm:top-2 right-4 z-10">
          <DetectionFeedback result={detectionResult} compact />
        </div>
      )}

      {/* Header text */}
      <div className="absolute top-10 sm:top-12 left-3 right-3 z-10">
        <h1 className="text-xl sm:text-lg font-semibold text-white">
          Place the <span className="text-emerald-400">{getDocumentLabel()}</span> in the frame
        </h1>
              </div>

      {/* Hint text / Detection status */}
      <div className="absolute left-6 right-6 z-10 flex justify-center" style={{ top: isDesktop ? 'calc(80px + 15px)' : 'calc(70px + 15px)' }}>
        {enableMLDetection && detectionResult ? (
          <DetectionMessage result={detectionResult} className="text-sm text-center" />
        ) : (
          <p className="text-sm text-white/70 text-center">
            {isDesktop
              ? 'Bring document closer to camera for better quality'
              : 'Hold document close to fill the frame'}
          </p>
        )}
      </div>

      {/* Auto-capture progress (above capture button) */}
      {enableMLDetection && autoCaptureState.isCountingDown && (
        <div className="absolute bottom-52 sm:bottom-36 left-0 right-0 flex flex-col items-center z-10">
          <AutoCaptureProgress state={autoCaptureState} />
          <p className="text-emerald-400 text-sm mt-2">Hold still...</p>
        </div>
      )}

      {/* Capture button */}
      <div className="absolute bottom-32 sm:bottom-16 left-0 right-0 flex justify-center z-10">
        <button
          onClick={handleManualCapture}
          className={`
            w-20 h-20 sm:w-16 sm:h-16 rounded-full border-4 flex items-center justify-center
            transition-all duration-300 hover:scale-105 active:scale-95
            ${detectionResult?.readyForCapture
              ? 'border-emerald-400'
              : 'border-white'
            }
          `}
        >
          <div
            className={`
              w-16 h-16 sm:w-12 sm:h-12 rounded-full transition-colors duration-300
              ${detectionResult?.readyForCapture
                ? 'bg-emerald-400'
                : 'bg-white'
              }
            `}
          />
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
              <li>Make sure your document is flat and not bent</li>
              <li>Find a well-lit area without glare</li>
              <li>Hold your phone steady and parallel to the document</li>
              <li>Ensure all corners of the document are visible</li>
              <li>Clean your camera lens if the image is blurry</li>
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
  mobileTop: number
  desktopTop: number
  scannerOffset: number
  qualityBorderColor?: string
}

const IDScannerFrame = ({
  mobileTop,
  desktopTop,
  scannerOffset,
  qualityBorderColor = 'border-emerald-400',
}: IDScannerFrameProps) => {
  const [frameHeight, setFrameHeight] = useState(200)
  const [frameWidth, setFrameWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const calculateFrameDimensions = () => {
      const idCardAspectRatio = 1.586
      const containerWidth = window.innerWidth
      const containerHeight = window.innerHeight
      // Use innerWidth to detect mobile context - this handles both actual mobile devices
      // AND desktop SDK embeds where the iframe is narrow (e.g., 420px modal)
      const mobile = containerWidth < 768
      setIsMobile(mobile)

      let width: number
      let height: number

      if (mobile) {
        // Mobile: use nearly full width for maximum ID visibility
        width = containerWidth - 24  // Only 12px padding on each side
        height = width / idCardAspectRatio
      } else {
        // Desktop: use most of the screen for clear ID visibility
        const availableHeight = containerHeight - 200
        const maxHeightBasedWidth = availableHeight * idCardAspectRatio
        width = Math.min(containerWidth * 0.9, maxHeightBasedWidth, 1200)
        height = width / idCardAspectRatio
      }

      setFrameWidth(width)
      setFrameHeight(height)
    }

    calculateFrameDimensions()
    window.addEventListener('resize', calculateFrameDimensions)
    return () => window.removeEventListener('resize', calculateFrameDimensions)
  }, [])

  const topPosition = isMobile ? mobileTop : desktopTop
  const horizontalPadding = typeof window !== 'undefined'
    ? Math.max(0, (window.innerWidth - frameWidth) / 2)
    : 24

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
          <CornerBrackets qualityColor={qualityBorderColor} />
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

const CornerBrackets = ({ qualityColor = 'border-emerald-400' }: { qualityColor?: string }) => {
  return (
    <>
      {/* Top-left */}
      <div className={`absolute w-10 h-10 top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl ${qualityColor} transition-colors duration-300`} />
      <ChevronRow position="top-2 left-12" direction="left" />

      {/* Top-right */}
      <div className={`absolute w-10 h-10 top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl ${qualityColor} transition-colors duration-300`} />
      <ChevronRow position="top-2 right-12" direction="right" />

      {/* Bottom-left */}
      <div className={`absolute w-10 h-10 bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl ${qualityColor} transition-colors duration-300`} />
      <ChevronRow position="bottom-2 left-12" direction="left" />

      {/* Bottom-right */}
      <div className={`absolute w-10 h-10 bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl ${qualityColor} transition-colors duration-300`} />
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
          {direction === 'left' ? '\u2039' : '\u203a'}
        </span>
      ))}
    </div>
  )
}

export default IDCaptureOverlay
