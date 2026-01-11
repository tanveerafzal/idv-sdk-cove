'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>('')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    // Get available devices
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput')
      setDevices(videoDevices)
      console.log('Available video devices:', videoDevices)
    })
  }, [])

  const startCamera = async () => {
    try {
      setError('')
      console.log('Requesting camera access...')
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      
      console.log('Got media stream:', mediaStream)
      console.log('Video tracks:', mediaStream.getVideoTracks())
      
      setStream(mediaStream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        console.log('Set srcObject on video element')
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded')
          videoRef.current?.play().then(() => {
            console.log('Video playing')
          }).catch(err => {
            console.error('Error playing video:', err)
            setError('Error playing video: ' + err.message)
          })
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('Camera error: ' + (err as Error).message)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Camera Test Page</h1>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Available Cameras:</h2>
          {devices.length === 0 ? (
            <p className="text-gray-500">No cameras detected</p>
          ) : (
            <ul className="space-y-1">
              {devices.map((device, index) => (
                <li key={index} className="text-sm">
                  {device.label || `Camera ${index + 1}`} (ID: {device.deviceId})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-4">Camera Preview:</h2>
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full"
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <p className="font-semibold">Error:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-4">
          <Button onClick={startCamera} disabled={!!stream}>
            Start Camera
          </Button>
          <Button onClick={stopCamera} disabled={!stream} variant="outline">
            Stop Camera
          </Button>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg text-sm">
          <p className="font-semibold mb-2">Debug Info:</p>
          <p>Stream active: {stream ? 'Yes' : 'No'}</p>
          <p>Video element exists: {videoRef.current ? 'Yes' : 'No'}</p>
          {stream && <p>Video tracks: {stream.getVideoTracks().length}</p>}
        </div>
      </div>
    </div>
  )
}
