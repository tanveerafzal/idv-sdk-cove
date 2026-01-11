import { ReactNode } from 'react'
import AppLayout from '@/components/AppLayout'

interface VerifyCardProps {
  children: ReactNode
}

export default function VerifyCard({ children }: VerifyCardProps) {
  return (
    <AppLayout>
      <div className="flex flex-col w-full h-full">
        {children}
      </div>
    </AppLayout>
  )
}
