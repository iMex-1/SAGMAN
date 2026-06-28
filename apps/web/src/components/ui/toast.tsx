'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'error' | 'info'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

// Simple global toast state
let toastListeners: Array<(toasts: ToastData[]) => void> = []
let toastList: ToastData[] = []

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toastList]))
}

export function addToast(toast: Omit<ToastData, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  toastList = [...toastList, { ...toast, id }]
  notifyListeners()

  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeToast(id)
  }, 5000)

  return id
}

export function removeToast(id: string) {
  toastList = toastList.filter((t) => t.id !== id)
  notifyListeners()
}

function useToastState() {
  const [toasts, setToasts] = React.useState<ToastData[]>(toastList)

  React.useEffect(() => {
    toastListeners.push(setToasts)
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setToasts)
    }
  }, [])

  return toasts
}

const variantStyles: Record<ToastVariant, string> = {
  default: 'border bg-background text-foreground',
  success: 'border-green-200 bg-green-50 text-green-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
}

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />,
  error: <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />,
  info: <Info className="h-4 w-4 text-blue-600 shrink-0" />,
}

export function Toaster() {
  const toasts = useToastState()

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => {
        const variant = toast.variant ?? 'default'
        return (
          <ToastPrimitive.Root
            key={toast.id}
            className={cn(
              'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all',
              'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full',
              variantStyles[variant],
            )}
            open
            onOpenChange={(open) => {
              if (!open) removeToast(toast.id)
            }}
          >
            {variantIcons[variant]}
            <div className="flex flex-col gap-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-semibold leading-none">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description && (
                <ToastPrimitive.Description className="text-sm opacity-80">
                  {toast.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]" />
    </ToastPrimitive.Provider>
  )
}
