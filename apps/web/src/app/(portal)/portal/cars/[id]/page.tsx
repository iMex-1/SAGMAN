'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Icon } from '@/components/ui/icon'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface RepairItem {
  id: string
  status: string
  priority: string
  description: string
  targetCompletionDate?: string
  actualCompletionDate?: string
  createdAt: string
  isOverdue: boolean
  mechanicName?: string
}

interface CarDetail {
  id: string
  matricule: string
  make: string
  model: string
  year?: number
  color?: string
  createdAt: string
  activeRepairs: RepairItem[]
  pastRepairs: RepairItem[]
}

const STATUS_CONFIG: Record<string, { color: string; step: number; icon: string }> = {
  received:          { color: 'bg-surface-variant', step: 1, icon: 'check_circle' },
  diagnosing:        { color: 'bg-blue-500',       step: 2, icon: 'warning'       },
  awaiting_approval: { color: 'bg-amber-500',      step: 2, icon: 'warning'       },
  in_progress:       { color: 'bg-purple-500',     step: 3, icon: 'schedule'      },
  waiting_for_parts: { color: 'bg-orange-500',     step: 3, icon: 'schedule'      },
  complete:          { color: 'bg-emerald-500',    step: 4, icon: 'check_circle'  },
  delivered:         { color: 'bg-surface-variant', step: 5, icon: 'check_circle'  },
  cancelled:         { color: 'bg-red-400',        step: 0, icon: 'warning'       },
}

const PROGRESS_STEP_KEYS = ['received', 'diagnosing', 'in_progress', 'complete', 'delivered']

function RepairProgressBar({ status }: { status: string }) {
  const t = useTranslations()
  const config = STATUS_CONFIG[status]
  if (!config || config.step === 0) return null

  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[10px] font-medium text-on-surface-variant">
        {PROGRESS_STEP_KEYS.map((key, i) => (
          <span key={key} className={cn(i + 1 <= config.step ? 'text-primary font-semibold' : '')}>
            {t('repair.status.' + key)}
          </span>
        ))}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
        <div
          className={cn('h-full rounded-full transition-all duration-700', config.color)}
          style={{ width: `${(config.step / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations()
  const c = STATUS_CONFIG[status]
  if (!c) return null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white', c.color)}>
      <Icon name={c.icon} size={10} />
      {t('repair.status.' + status)}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function PortalCarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations()
  const { id } = use(params)
  const router = useRouter()

  const [car, setCar] = useState<CarDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = authStorage.getAccessToken()
    if (!token) {
      router.push('/portal/login')
      return
    }

    api
      .get<{ data: CarDetail }>(`/portal/cars/${id}`)
      .then(res => setCar(res.data))
      .catch(err => {
        if (err instanceof ApiError && err.statusCode === 401) {
          authStorage.clear()
          router.push('/portal/login')
        } else {
          setError(t('car.loadCarError'))
        }
      })
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="sync" size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  if (error || !car) {
    return (
      <div className="space-y-4">
        <Link href="/portal/cars" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Icon name="arrow_back" size={14} />
          {t('car.backToCars')}
        </Link>
        <div className="rounded-xl border border-error/30 bg-error-container p-4 text-sm text-on-error-container">
          {error ?? t('car.carNotFound')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Back */}
      <Link href="/portal/cars" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <Icon name="arrow_back" size={14} />
        {t('car.backToCars')}
      </Link>

      {/* Car header */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary">
          <Icon name="directions_car" size={22} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg text-primary">
            {car.make} {car.model}
          </h1>
          <p className="font-mono text-sm text-on-surface-variant">{car.matricule}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-on-surface-variant">
            {car.year && <span>{car.year}</span>}
            {car.color && <span>{car.color}</span>}
            <span>{t('car.registeredOn', { date: formatDate(car.createdAt) })}</span>
          </div>
        </div>
      </div>

      {/* Active repair(s) */}
      {car.activeRepairs.length > 0 && (
        <section>
          <h2 className="mb-3 font-title-md text-title-md text-primary">{t('car.activeRepair')}</h2>
          <div className="space-y-3">
            {car.activeRepairs.map((r) => (
              <Link
                key={r.id}
                href={`/portal/repairs/${r.id}`}
                className="block bg-white border border-outline-variant rounded-xl shadow-sm p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-title-md text-title-md text-primary truncate">{r.description}</p>
                  <StatusBadge status={r.status} />
                </div>
                <RepairProgressBar status={r.status} />
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                  {r.priority && <span>{t('car.priority')} {r.priority}</span>}
                  {r.targetCompletionDate && (
                    <span>{t('car.scheduledFor', { date: formatDate(r.targetCompletionDate) })}</span>
                  )}
                  {r.mechanicName && <span>{t('car.mechanic')} {r.mechanicName}</span>}
                </div>
                {r.isOverdue && (
                  <div className="overdue-pulse mt-2 flex items-center gap-1 text-xs font-medium text-error">
                    <Icon name="warning" size={14} />
                    {t('repair.overdue')}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Past repairs */}
      {car.pastRepairs.length > 0 && (
        <section>
          <h2 className="mb-3 font-title-md text-title-md text-primary">
            {t('car.repairHistory')} ({car.pastRepairs.length})
          </h2>
          <div className="space-y-2">
            {car.pastRepairs.map((r) => (
              <Link
                key={r.id}
                href={`/portal/repairs/${r.id}`}
                className="flex items-center justify-between gap-3 bg-white border border-outline-variant rounded-xl px-4 py-3 hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <p className="font-title-md text-title-md text-primary truncate">{r.description}</p>
                  <p className="text-xs text-on-surface-variant">
                    {formatDateTime(r.createdAt)}
                    {r.actualCompletionDate && t('car.completedOn', { date: formatDate(r.actualCompletionDate) })}
                    {r.mechanicName && ` — ${r.mechanicName}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={r.status} />
                  <Icon name="chevron_right" size={16} className="text-on-surface-variant" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* No repairs at all */}
      {car.activeRepairs.length === 0 && car.pastRepairs.length === 0 && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm py-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
            <Icon name="build" size={28} className="text-on-surface-variant/40" />
          </div>
          <p className="font-title-md text-title-md text-primary">{t('car.noRepairs')}</p>
          <p className="mt-1 text-body-md font-body-md text-on-surface-variant">
            {t('car.noRepairsForCar')}
          </p>
          <Link
            href="/portal/book"
            className="mt-4 inline-flex items-center gap-2 bg-primary text-white rounded-lg px-xl py-md font-title-md text-title-md"
          >
            <Icon name="add_circle" size={16} />
            {t('portal.landing.bookAppointment')}
          </Link>
        </div>
      )}
    </div>
  )
}
