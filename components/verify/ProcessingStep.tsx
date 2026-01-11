interface ProcessingStepProps {
  status: string
}

export default function ProcessingStep({ status }: ProcessingStepProps) {
  return (
    <div className="flex flex-col h-full items-center justify-center space-y-8">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-gray-200 rounded-full" />
        <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-t-gray-900 rounded-full animate-spin" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-gray-900">Processing</h2>
        <p className="text-sm text-gray-600">{status}</p>
      </div>

      <p className="text-xs text-gray-400 max-w-xs text-center">
        Please wait while we verify your identity. This may take a few moments.
      </p>
    </div>
  )
}
