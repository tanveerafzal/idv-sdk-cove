import React, { useState, useEffect } from 'react';

const IDCaptureOverlay = () => {
  const [scannerOffset, setScannerOffset] = useState(0);
  
  // Animated scanner line effect
  useEffect(() => {
    const interval = setInterval(() => {
      setScannerOffset(prev => (prev + 1) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-sm mx-auto h-[700px] bg-gray-900 overflow-hidden rounded-3xl">
      {/* Simulated camera feed background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=800')`,
        }}
      />
      
      {/* Dark overlay with cutout */}
      <div className="absolute inset-0">
        {/* Top dark section */}
        <div className="absolute top-0 left-0 right-0 h-[200px] bg-black/60" />
        
        {/* Middle section with cutout */}
        <div className="absolute top-[200px] left-0 right-0 h-[200px] flex">
          {/* Left dark */}
          <div className="w-6 bg-black/60" />
          {/* Transparent cutout - this is where the ID goes */}
          <div className="flex-1 relative">
            {/* Corner brackets */}
            <CornerBrackets />
            {/* Scanning animation */}
            <div 
              className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60"
              style={{ top: `${scannerOffset}%` }}
            />
          </div>
          {/* Right dark */}
          <div className="w-6 bg-black/60" />
        </div>
        
        {/* Bottom dark section */}
        <div className="absolute top-[400px] left-0 right-0 bottom-0 bg-black/60" />
      </div>
      
      {/* Back arrow */}
      <button className="absolute top-12 left-4 z-10 text-white">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      {/* Header text */}
      <div className="absolute top-20 left-6 right-6 z-10">
        <h1 className="text-xl font-semibold text-white">
          Place the <span className="text-emerald-400">Information Page of Passport</span> in the frame
        </h1>
      </div>
      
      {/* Help link at bottom */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10">
        <button className="flex items-center gap-2 text-white/80 text-sm">
          problem with scanning?
          <span className="w-5 h-5 rounded-full border border-white/60 flex items-center justify-center text-xs">?</span>
        </button>
      </div>
      
      {/* Home indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white rounded-full" />
    </div>
  );
};

const CornerBrackets = () => {
  const bracketStyle = "absolute w-8 h-8 border-emerald-400";
  
  return (
    <>
      {/* Top-left */}
      <div className={`${bracketStyle} top-0 left-0 border-t-2 border-l-2 rounded-tl-lg`} />
      <ChevronRow position="top-2 left-10" direction="left" />
      
      {/* Top-right */}
      <div className={`${bracketStyle} top-0 right-0 border-t-2 border-r-2 rounded-tr-lg`} />
      <ChevronRow position="top-2 right-10" direction="right" />
      
      {/* Bottom-left */}
      <div className={`${bracketStyle} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg`} />
      <ChevronRow position="bottom-2 left-10" direction="left" />
      
      {/* Bottom-right */}
      <div className={`${bracketStyle} bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg`} />
      <ChevronRow position="bottom-2 right-10" direction="right" />
    </>
  );
};

const ChevronRow = ({ position, direction }) => {
  const chevrons = Array(8).fill(null);
  
  return (
    <div className={`absolute ${position} flex gap-0.5 opacity-40`}>
      {chevrons.map((_, i) => (
        <span 
          key={i} 
          className="text-white text-xs"
          style={{ 
            animationDelay: `${i * 0.1}s`,
          }}
        >
          {direction === 'left' ? '‹' : '›'}
        </span>
      ))}
    </div>
  );
};

export default IDCaptureOverlay;
