'use client'
import { cn } from '@/lib/utils'

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700 font-bold',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  emergency: '🚨 Emergency',
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs',
        PRIORITY_STYLES[priority] ?? '',
      )}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  )
}
