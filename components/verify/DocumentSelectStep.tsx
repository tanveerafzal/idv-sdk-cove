import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { VerificationData } from '@/app/verify/page'
import Image from 'next/image'
import { Check } from 'lucide-react'

interface DocumentSelectStepProps {
  data: VerificationData
  onNext: () => void
  onBack: () => void
  updateData: (data: Partial<VerificationData>) => void
}

const countries = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Sweden',
]

const documentTypes = [
  { id: 'drivers_license', label: 'Driver License', icon: '/driverslic-icon.svg' },
  { id: 'state_id', label: 'ID Card', icon: '/id-card-icon.svg' },
  { id: 'passport', label: 'Passport', icon: '/passport-icon.svg' },
]

export default function DocumentSelectStep({
  data,
  onNext,
  onBack,
  updateData,
}: DocumentSelectStepProps) {
  const handleCountryChange = (value: string) => {
    updateData({ country: value })
  }

  const handleDocumentTypeChange = (value: string) => {
    updateData({ documentType: value })
  }

  const canContinue = data.country && data.documentType

  return (
    <div className="relative h-full">
      <div className="space-y-6">
        <div className="space-y-3 -mt-12">
          <h1 className="text-2xl font-bold text-gray-900">Select ID type</h1>
        </div>

      <div className="space-y-4 mt-8">
        <div>
          <Label htmlFor="country">Issuing country</Label>
          <Select value={data.country} onValueChange={handleCountryChange}>
            <SelectTrigger id="country" className="w-full mt-2">
              <SelectValue placeholder="Select your country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="mt-10">
          <Label>Document Type</Label>
          <RadioGroup value={data.documentType} onValueChange={handleDocumentTypeChange} className="mt-2">
            <div className="space-y-3">
              {documentTypes.map((doc) => (
                  <label
                    key={doc.id}
                    htmlFor={doc.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      data.documentType === doc.id ? 'border-gray-900 bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <RadioGroupItem value={doc.id} id={doc.id} className="sr-only" />
                    <Image src={doc.icon} alt={doc.label} width={40} height={40} />
                    <span className="text-gray-900 ml-3 flex-1">{doc.label}</span>
                    {data.documentType === doc.id && (
                      <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </label>
                ))}
            </div>
          </RadioGroup>
        </div>
      </div>

      </div>

      <div className="absolute bottom-0 left-0 right-0 px-2 sm:px-2 mb-[-190px] sm:mb-[-210px]">
        <Button
          onClick={onNext}
          disabled={!canContinue}
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
