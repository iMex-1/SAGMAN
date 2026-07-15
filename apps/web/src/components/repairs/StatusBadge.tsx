'use client'
import { useTranslations } from 'next-intl'

export const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-100 text-gray-700 border-gray-200',
  diagnosing: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_approval: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  waiting_for_parts: 'bg-orange-100 text-orange-700 border-orange-200',
  complete: 'bg-green-100 text-green-700 border-green-200',
  delivered: 'bg-gray-50 text-gray-400 border-gray-100',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations()
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {t(`repair.status.${status}`)}
    </span>
  )
}
