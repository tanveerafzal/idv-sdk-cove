import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

interface IntroStepProps {
  onNext: () => void
}

export default function IntroStep({ onNext }: IntroStepProps) {
  // Since the home page already shows the intro, this is now a simple verification start screen
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
          <Shield className="w-10 h-10 text-blue-600" />
        </div>
        
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">Identity Verification</h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            We'll guide you through a quick process to verify your identity 
          </p>
        </div>
      </div>

      <div className="mt-auto">
        <Button 
          onClick={onNext}
          variant="idv"
          className="w-full"
          style={{ borderRadius: '8px', fontSize: '14px' }}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
