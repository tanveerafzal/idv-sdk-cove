import { Progress } from '@/components/ui/progress'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="flex-1">
      <Progress value={progress} className="h-2" />
    </div>
  )
}
