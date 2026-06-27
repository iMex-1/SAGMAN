'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNav } from '@/components/layout/TopNav'
import { Toaster } from '@/components/ui/toast'
import { authStorage } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<{
    name: string
    email: string
    role: string
  } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = authStorage.getAccessToken()
    if (!token) {
      router.push('/login')
      return
    }
    const stored = authStorage.getUser()
    if (stored && 'email' in stored) {
      setUser({ name: stored.name, email: stored.email, role: stored.role })
    }
  }, [router])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          userRole={user?.role ?? 'manager'}
          userName={user?.name ?? '...'}
          userEmail={user?.email}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex">
            <Sidebar
              userRole={user?.role ?? 'manager'}
              userName={user?.name ?? '...'}
              userEmail={user?.email}
            />
          </div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">{children}</main>
      </div>

      <Toaster />
    </div>
  )
}
