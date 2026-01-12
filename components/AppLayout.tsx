import { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 sm:flex sm:items-center sm:justify-center sm:p-4 sm:bg-[url('/Background.svg')] sm:bg-cover sm:bg-center sm:bg-no-repeat">
      <div className="h-screen sm:h-auto bg-white sm:bg-transparent sm:max-w-[390px] w-full">
        <Card
          className="h-full sm:h-[700px] border-0 sm:border shadow-none sm:shadow-lg rounded-none sm:rounded-xl px-6 sm:px-8 flex flex-col relative overflow-hidden"
          style={{ paddingTop: '48px', paddingBottom: '16px' }}
        >
          {children}
        </Card>
      </div>
    </div>
  )
}
