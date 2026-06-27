import { addToast, type ToastVariant } from './toast'

export function useToast() {
  function toast({
    title,
    description,
    variant = 'default',
  }: {
    title: string
    description?: string
    variant?: ToastVariant
  }) {
    return addToast({ title, description, variant })
  }

  return {
    toast,
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'error' }),
    info: (title: string, description?: string) =>
      addToast({ title, description, variant: 'info' }),
  }
}
