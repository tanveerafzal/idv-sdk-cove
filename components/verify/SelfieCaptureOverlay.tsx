'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'

interface SelfieCaptureOverlayProps {
  onCapture: (imageData: string) => void
  onClose: () => void
}

const SelfieCaptureOverlay = ({ onCapture, onClose }: SelfieCaptureOverlayProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isReady, setIsReady] = useState(false)

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsReady(true)
        }
      } catch (err) {
        console.error('Camera access error:', err)
      }
    }
    startCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Capture photo - cropped to face oval area
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight
    const displayWidth = video.clientWidth
    const displayHeight = video.clientHeight

    // Determine if mobile or desktop
    const isMobile = window.innerWidth < 640

    // Oval dimensions (matching the CSS) with padding for context
    const ovalWidth = isMobile ? 256 : 320  // w-64 or w-80
    const ovalHeight = isMobile ? 320 : 384 // h-80 or h-96

    // Add padding around the oval (50% extra on each side)
    const paddingMultiplier = 1.5
    const captureWidth = ovalWidth * paddingMultiplier
    const captureHeight = ovalHeight * paddingMultiplier

    // Capture area position: centered horizontally, 60% up from center vertically
    const captureCenterX = displayWidth / 2
    const captureCenterY = displayHeight * 0.4 // 60% from top = 40% position

    const ovalLeft = captureCenterX - (captureWidth / 2)
    const ovalTop = captureCenterY - (captureHeight / 2)

    // Handle object-cover scaling
    const videoAspect = videoWidth / videoHeight
    const displayAspect = displayWidth / displayHeight

    let visibleWidth, visibleHeight, offsetX, offsetY

    if (videoAspect > displayAspect) {
      // Video is wider - cropped on sides
      visibleHeight = videoHeight
      visibleWidth = videoHeight * displayAspect
      offsetX = (videoWidth - visibleWidth) / 2
      offsetY = 0
    } else {
      // Video is taller - cropped on top/bottom
      visibleWidth = videoWidth
      visibleHeight = videoWidth / displayAspect
      offsetX = 0
      offsetY = (videoHeight - visibleHeight) / 2
    }

    // Scale from display to video coordinates
    const scaleX = visibleWidth / displayWidth
    const scaleY = visibleHeight / displayHeight

    // Convert capture area position to video coordinates
    const cropX = offsetX + (ovalLeft * scaleX)
    const cropY = offsetY + (ovalTop * scaleY)
    const cropWidth = captureWidth * scaleX
    const cropHeight = captureHeight * scaleY

    // Account for mirroring - flip the X coordinate
    const mirroredCropX = videoWidth - cropX - cropWidth

    // Set canvas to crop dimensions
    canvas.width = cropWidth
    canvas.height = cropHeight

    // Draw cropped and mirrored image
    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(
      video,
      mirroredCropX, cropY, cropWidth, cropHeight,  // Source (use mirrored X)
      0, 0, cropWidth, cropHeight                    // Destination
    )
    ctx.restore()

    const imageData = canvas.toDataURL('image/jpeg', 0.95)
    onCapture(imageData)
  }, [onCapture])

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 sm:absolute sm:top-0 sm:left-0 sm:right-0 sm:bottom-0 sm:w-full sm:h-full sm:rounded-xl sm:overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Oval cutout using box-shadow */}
      <div
        className="absolute top-1/2 left-1/2 w-64 h-80 sm:w-80 sm:h-96 rounded-full pointer-events-none"
        style={{
          transform: 'translate(-50%, -60%)',
          boxShadow: '0 0 0 9999px rgba(0, 50, 70, 0.85)',
        }}
      />

      {/* Oval border */}
      <div
        className="absolute top-1/2 left-1/2 w-[260px] h-[324px] sm:w-[324px] sm:h-[388px] rounded-full border-[3px] border-white/50 pointer-events-none"
        style={{ transform: 'translate(-50%, -60%)' }}
      />

      {/* Back button */}
      <button
        onClick={onClose}
        className="absolute top-4 sm:top-2 left-4 z-20 text-white p-2"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Header text */}
      <div className="absolute top-14 sm:top-8 left-0 right-0 z-20 text-center">
        <h1 className="text-xl sm:text-xl font-bold text-white">Take a selfie</h1>
      </div>

      {/* Instruction text */}
      <div className="absolute bottom-138 sm:bottom-150 left-0 right-0 z-20 text-center px-8">
        <p className="text-white text-base sm:text-sm">Center your face and hold still.</p>
      </div>

      {/* Capture button */}
      <div className="absolute bottom-12 sm:bottom-8 left-0 right-0 z-20 flex justify-center">
        <button
          onClick={handleCapture}
          disabled={!isReady}
          className="w-[72px] h-[72px] sm:w-16 sm:h-16 rounded-full bg-transparent border-4 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-white" />
        </button>
      </div>
    </div>
  )
}

export default SelfieCaptureOverlay
