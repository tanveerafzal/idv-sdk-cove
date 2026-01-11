import React, { useRef, useCallback, useState } from 'react';

const SelfieCaptureOverlay = ({ onCapture, onClose, idType = 'ID' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  // Initialize camera
  React.useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 1280, height: 720 }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
        }
      } catch (err) {
        console.error('Camera access error:', err);
      }
    };
    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture photo
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    
    if (onCapture) {
      onCapture(imageData);
    }
  }, [onCapture]);

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }} // Mirror for selfie
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Tinted overlay with oval cutout */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 240px 320px at 50% 40%, transparent 0%, transparent 100%, rgba(0, 50, 70, 0.85) 100%)`,
        }}
      />
      
      {/* Oval cutout using box-shadow */}
      <div
        className="absolute top-1/2 left-1/2 w-60 h-80 rounded-full pointer-events-none"
        style={{
          transform: 'translate(-50%, -60%)',
          boxShadow: '0 0 0 9999px rgba(0, 50, 70, 0.85)',
        }}
      />

      {/* Oval border */}
      <div
        className="absolute top-1/2 left-1/2 w-[244px] h-[324px] rounded-full border-[3px] border-white/50 pointer-events-none animate-pulse"
        style={{ transform: 'translate(-50%, -60%)' }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-12 left-5 z-20 text-white w-8 h-8 flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Header text */}
      <div className="absolute top-16 left-0 right-0 z-20 text-center">
        <h1 className="text-xl font-semibold text-white">Take a selfie</h1>
      </div>

      {/* Instruction text */}
      <div className="absolute bottom-32 left-0 right-0 z-20 text-center px-8">
        <p className="text-white text-base">Center your face and hold still.</p>
      </div>

      {/* Capture button */}
      <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center">
        <button
          onClick={handleCapture}
          disabled={!isReady}
          className="w-[72px] h-[72px] rounded-full bg-transparent border-4 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <div className="w-14 h-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
};

export default SelfieCaptureOverlay;
