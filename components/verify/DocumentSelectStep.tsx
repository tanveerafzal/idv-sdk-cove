import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { CountryDropdown, type Country } from '@/components/ui/country-dropdown'
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

const allDocumentTypes = [
  { id: 'drivers_license', label: 'Driver License', icon: '/driverslic-icon.svg' },
  { id: 'state_id', label: 'State ID', icon: '/id-card-icon.svg' },
  { id: 'photo_card', label: 'Photo Card', icon: '/id-card-icon.svg' },
  { id: 'health_card', label: 'Health Card', icon: '/id-card-icon.svg' },
  { id: 'passport', label: 'Passport', icon: '/passport-icon.svg' },
  { id: 'passport_card', label: 'Passport Card', icon: '/passport-icon.svg' },
  { id: 'permanent_resident', label: 'Permanent Resident Card', icon: '/id-card-icon.svg' },
  { id: 'us_green_card', label: 'U.S. Permanent Resident Card (Green Card)', icon: '/id-card-icon.svg' },
  { id: 'work_permit', label: 'Work Permit', icon: '/id-card-icon.svg' },
  { id: 'indian_status', label: 'Certificate of Indian Status (SCIS)', icon: '/id-card-icon.svg' },
]

// Document types that require back side capture
export const DOCUMENTS_REQUIRING_BACK = ['health_card', 'permanent_resident', 'us_green_card']

function getDocumentTypesForCountry(country: string) {
  const countryLower = country?.toLowerCase() || ''

  if (countryLower === 'canada') {
    // Canada: Driver License, Photo Card, Health Card, Passport, Permanent Resident Card, Certificate of Indian Status
    const canadaDocTypes = ['drivers_license', 'photo_card', 'health_card', 'passport', 'permanent_resident', 'indian_status']
    return allDocumentTypes.filter(doc => canadaDocTypes.includes(doc.id))
  } else if (countryLower === 'united states' || countryLower === 'united states of america' || countryLower === 'usa' || countryLower === 'us') {
    // US: Passport, Driver License, State ID, Passport Card, Green Card, Work Permit
    const usDocTypes = ['passport', 'drivers_license', 'state_id', 'passport_card', 'us_green_card', 'work_permit']
    return allDocumentTypes.filter(doc => usDocTypes.includes(doc.id))
  } else {
    // Other countries: Passport only
    return allDocumentTypes.filter(doc => doc.id === 'passport')
  }
}

export default function DocumentSelectStep({
  data,
  onNext,
  onBack,
  updateData,
}: DocumentSelectStepProps) {
  const documentTypes = useMemo(() => getDocumentTypesForCountry(data.country), [data.country])

  const handleCountryChange = (country: Country) => {
    const newDocumentTypes = getDocumentTypesForCountry(country.name)
    const isCurrentDocumentTypeValid = newDocumentTypes.some(doc => doc.id === data.documentType)

    // Reset document type if current selection is not available for the new country
    if (!isCurrentDocumentTypeValid) {
      updateData({ country: country.name, documentType: '' })
    } else {
      updateData({ country: country.name })
    }
  }

  const handleDocumentTypeChange = (value: string) => {
    updateData({ documentType: value })
  }

  const canContinue = data.country && data.documentType

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Select ID type</h1>

        <div className="space-y-4">
          <div>
            <Label htmlFor="country">Issuing country</Label>
            <div className="mt-2">
              <CountryDropdown
                placeholder="Select your country"
                defaultValue={data.country}
                onChange={handleCountryChange}
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label>Document Type</Label>
            <RadioGroup value={data.documentType} onValueChange={handleDocumentTypeChange} className="mt-2">
              <div className="space-y-2">
                {documentTypes.map((doc) => (
                  <label
                    key={doc.id}
                    htmlFor={doc.id}
                    className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                      data.documentType === doc.id ? 'border-gray-900 bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <RadioGroupItem value={doc.id} id={doc.id} className="sr-only" />
                    <Image src={doc.icon} alt={doc.label} width={28} height={28} />
                    <span className="text-gray-900 ml-2 flex-1 text-sm">{doc.label}</span>
                    {data.documentType === doc.id && (
                      <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 pt-4">
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
