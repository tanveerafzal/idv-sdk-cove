'use client';

import { memo } from 'react';
import { FileText, Eye, Sun, User, Check, AlertTriangle, X } from 'lucide-react';
import type { DetectionResult } from '@/lib/ml/types';

interface DetectionFeedbackProps {
  result: DetectionResult | null;
  showLabels?: boolean;
  compact?: boolean;
}

type StatusType = 'success' | 'warning' | 'error' | 'inactive';

interface StatusIndicator {
  icon: React.ReactNode;
  status: StatusType;
  label: string;
}

/**
 * Detection status indicators showing document, blur, glare, and face status
 */
export const DetectionFeedback = memo(function DetectionFeedback({
  result,
  showLabels = false,
  compact = false,
}: DetectionFeedbackProps) {
  const indicators = getIndicators(result);

  return (
    <div className={`flex gap-2 ${compact ? 'gap-1' : 'gap-3'}`}>
      {indicators.map((indicator, index) => (
        <StatusIcon
          key={index}
          indicator={indicator}
          showLabel={showLabels}
          compact={compact}
        />
      ))}
    </div>
  );
});

interface StatusIconProps {
  indicator: StatusIndicator;
  showLabel?: boolean;
  compact?: boolean;
}

const StatusIcon = memo(function StatusIcon({
  indicator,
  showLabel = false,
  compact = false,
}: StatusIconProps) {
  const { icon, status, label } = indicator;

  const statusColors: Record<StatusType, string> = {
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-400/50',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-400/50',
    error: 'bg-red-500/20 text-red-400 border-red-400/50',
    inactive: 'bg-white/10 text-white/40 border-white/20',
  };

  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const containerSize = compact ? 'w-8 h-8' : 'w-10 h-10';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          ${containerSize} rounded-full border flex items-center justify-center
          transition-all duration-300 ease-out
          ${statusColors[status]}
        `}
        title={label}
      >
        <div className={iconSize}>{icon}</div>
        {status === 'success' && (
          <Check className="absolute w-3 h-3 text-emerald-400 -bottom-1 -right-1" />
        )}
      </div>
      {showLabel && (
        <span className="text-xs text-white/60 whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  );
});

/**
 * Get status indicators from detection result
 */
function getIndicators(result: DetectionResult | null): StatusIndicator[] {
  if (!result) {
    return [
      { icon: <FileText className="w-full h-full" />, status: 'inactive', label: 'Document' },
      { icon: <Eye className="w-full h-full" />, status: 'inactive', label: 'Focus' },
      { icon: <Sun className="w-full h-full" />, status: 'inactive', label: 'Glare' },
      { icon: <User className="w-full h-full" />, status: 'inactive', label: 'Face' },
    ];
  }

  return [
    // Document detection
    {
      icon: <FileText className="w-full h-full" />,
      status: result.documentDetected
        ? result.documentConfidence > 0.8 ? 'success' : 'warning'
        : 'error',
      label: result.documentDetected ? 'Document OK' : 'No document',
    },
    // Blur/focus
    {
      icon: <Eye className="w-full h-full" />,
      status: !result.isBlurry
        ? result.blurScore > 0.7 ? 'success' : 'warning'
        : 'error',
      label: result.isBlurry ? 'Blurry' : 'Sharp',
    },
    // Glare
    {
      icon: <Sun className="w-full h-full" />,
      status: !result.hasGlare
        ? result.glareScore < 0.1 ? 'success' : 'warning'
        : 'error',
      label: result.hasGlare ? 'Glare' : 'No glare',
    },
    // Face detection
    {
      icon: <User className="w-full h-full" />,
      status: result.faceDetected
        ? result.faceConfidence > 0.7 ? 'success' : 'warning'
        : 'warning', // Warning not error since face detection may be optional
      label: result.faceDetected ? 'Face OK' : 'No face',
    },
  ];
}

/**
 * Simple text feedback based on detection result
 */
export const DetectionMessage = memo(function DetectionMessage({
  result,
  className = '',
  isInitializing = false,
}: {
  result: DetectionResult | null;
  className?: string;
  isInitializing?: boolean;
}) {
  if (!result) {
    // Don't show initializing message - just show positioning hint
    return (
      <p className={`text-white/70 ${className}`}>
        {isInitializing ? 'Setting up camera...' : 'Position ID card in frame'}
      </p>
    );
  }

  if (!result.documentDetected) {
    return (
      <p className={`text-amber-400 ${className}`}>
        Position ID card in frame
      </p>
    );
  }

  if (result.isBlurry) {
    return (
      <p className={`text-amber-400 ${className}`}>
        Hold camera still - image is blurry
      </p>
    );
  }

  if (result.hasGlare) {
    return (
      <p className={`text-amber-400 ${className}`}>
        Tilt document to reduce glare
      </p>
    );
  }

  if (!result.faceDetected && result.documentDetected) {
    return (
      <p className={`text-amber-400 ${className}`}>
        Ensure face on ID is visible
      </p>
    );
  }

  if (result.readyForCapture) {
    return (
      <p className={`text-emerald-400 ${className}`}>
        Perfect! Hold still...
      </p>
    );
  }

  return (
    <p className={`text-white/70 ${className}`}>
      Adjusting...
    </p>
  );
});

export default DetectionFeedback;
