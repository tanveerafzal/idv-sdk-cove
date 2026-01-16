import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import AppLayout from '@/components/AppLayout'

export default function Home() {
  return (
    <AppLayout>
      <div className="flex flex-col w-full h-full">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Let's get started
              </h1>
              <p className="text-gray-500 text-sm">
                Verify your identity to keep your account secure.
              </p>
            </div>

            <div className="space-y-4 mt-16">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  <Image 
                    src="/id-card.svg" 
                    alt="Photo ID" 
                    width={48} 
                    height={48}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">Photo ID</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ID card, passport, driver's license supported
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  <Image 
                    src="/facial.svg" 
                    alt="Facial recognition" 
                    width={48} 
                    height={48}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">Facial recognition</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Quick selfie to confirm it's you
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-70">
              <div className="space-y-4">
                <p className="text-xs text-gray-500 text-center">
                  By continuing, you agree to our{' '}
                  <a href="#" className="underline">Privacy Policy</a>.
                </p>
                
                <Link href="/verify" className="block">
                  <Button
                    variant="idv"
                    className="w-full"
                    style={{ borderRadius: '8px', fontSize: '14px' }}
                  >
                    Agree and continue
                  </Button>
                </Link>
                <p className="text-xs text-white text-center mt-2">{process.env.NEXT_PUBLIC_APP_VERSION}</p>
              </div>
            </div>
      </div>
    </AppLayout>
  );
}
