'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Icon } from '@/components/ui/icon'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveRepair {
  id: string
  status: string
  priority: string
  targetCompletionDate?: string
  isOverdue: boolean
  description: string
}

interface PastRepair {
  id: string
  status: string
  priority: string
  targetCompletionDate?: string
  description: string
  createdAt: string
}

interface ClientCar {
  id: string
  matricule: string
  make: string
  model: string
  year?: number
  activeRepair?: ActiveRepair
  pastRepairs?: PastRepair[]
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { color: string; step: number; icon: string }
> = {
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

// ─── Progress bar ─────────────────────────────────────────────────────────────

function RepairProgressBar({ status }: { status: string }) {
  const t = useTranslations()
  const config = STATUS_CONFIG[status]
  if (!config || config.step === 0) return null

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex justify-between text-[10px] font-medium text-on-surface-variant">
        {PROGRESS_STEP_KEYS.map((key, i) => (
          <span key={key} className={cn(i + 1 <= config.step ? 'text-primary font-semibold' : '')}>
            {t('repair.status.' + key)}
          </span>
        ))}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-low">
        <div
          className={cn('h-full rounded-full transition-all duration-700', config.color)}
          style={{ width: `${(config.step / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── Car repair card ─────────────────────────────────────────────────────────

function CarRepairCard({ car }: { car: ClientCar }) {
  const t = useTranslations()
  const repair = car.activeRepair
  const statusConfig = repair ? (STATUS_CONFIG[repair.status] ?? null) : null
  const [showHistory, setShowHistory] = useState(false)
  const hasPast = (car.pastRepairs?.length ?? 0) > 0

  return (
    <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
      <Link
        href={`/portal/cars/${car.id}`}
        className={cn(
          'block p-5 transition-all hover:shadow-md hover:-translate-y-0.5',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Car info */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary">
              <Icon name="directions_car" size={20} className="text-white" />
            </div>
            <div>
              <p className="font-title-md text-title-md text-primary">
                {car.make} {car.model}
              </p>
              <p className="font-mono text-sm text-on-surface-variant">{car.matricule}</p>
              {car.year && <p className="text-label-sm font-label-sm text-on-surface-variant">{car.year}</p>}
            </div>
          </div>

          {/* Status badge */}
          {statusConfig && (
            <div
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white',
                statusConfig.color,
              )}
            >
              <Icon name={statusConfig.icon} size={12} />
              {t('repair.status.' + repair!.status)}
            </div>
          )}
        </div>

        {repair ? (
          <>
            <RepairProgressBar status={repair.status} />

            <div className="mt-3 flex items-center justify-between">
              <p className="max-w-[70%] truncate text-xs text-on-surface-variant">
                {repair.description}
              </p>
              <Icon name="chevron_right" size={16} className="shrink-0 text-on-surface-variant" />
            </div>

            {repair.isOverdue && (
              <div className="overdue-pulse mt-2 flex items-center gap-1.5 text-xs font-medium text-error">
                <Icon name="warning" size={14} />
                {t('portal.myCars.repairOverdue')}
              </div>
            )}

            {repair.targetCompletionDate && (
              <p className="mt-1 text-xs text-on-surface-variant">
                {t('portal.myCars.estimatedDate')}{' '}
                {new Date(repair.targetCompletionDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-on-surface-variant">{t('portal.myCars.noActiveRepair')}</p>
        )}
      </Link>

      {/* Past repairs */}
      {hasPast && (
        <div className="border-t border-outline-variant">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
          >
            <span>{t('portal.myCars.repairHistory', { count: car.pastRepairs!.length })}</span>
            <Icon name={showHistory ? 'expand_less' : 'expand_more'} size={18} />
          </button>

          {showHistory && (
            <div className="space-y-1 px-5 pb-4">
              {car.pastRepairs!.map((pr) => (
                <Link
                  key={pr.id}
                  href={`/portal/repairs/${pr.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-on-surface">{pr.description}</span>
                    <span className="text-xs text-on-surface-variant">
                      {new Date(pr.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-on-surface-variant">
                    {t('repair.status.' + pr.status) ?? pr.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalCarsPage() {
  const t = useTranslations()
  const router = useRouter()
  const [cars, setCars] = useState<ClientCar[]>([])
  const [clientName, setClientName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = authStorage.getAccessToken()
    if (!token) {
      router.push('/portal/login')
      return
    }

    // Grab cached name for greeting
    const user = authStorage.getUser()
    if (user && 'name' in user) setClientName(user.name)

    api
      .get<{ data: ClientCar[] }>('/portal/cars')
      .then(res => setCars(res.data))
      .catch(err => {
        if (err instanceof ApiError && err.statusCode === 401) {
          authStorage.clear()
          router.push('/portal/login')
        } else {
          setError(t('portal.myCars.loadError'))
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="sync" size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {clientName && (
            <p className="text-sm text-on-surface-variant">{t('portal.myCars.greeting', { name: clientName })}</p>
          )}
          <h1 className="font-headline-lg text-headline-lg text-primary">{t('portal.myCars.title')}</h1>
          <p className="text-body-md font-body-md text-on-surface-variant">
            {cars.length === 1
              ? t('portal.myCars.carsRegistered', { count: cars.length })
              : t('portal.myCars.carsRegisteredPlural', { count: cars.length })
            }
          </p>
        </div>
        <Link
          href="/portal/book"
          className="flex items-center gap-1.5 bg-primary text-white rounded-lg px-xl py-md font-title-md text-title-md shadow-sm"
        >
          <Icon name="add_circle" size={16} />
          <span className="hidden sm:inline">{t('portal.myCars.bookAppointment')}</span>
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-error/30 bg-error-container p-4 text-sm text-on-error-container">
          {error}
        </div>
      )}

      {/* Empty state */}
      {cars.length === 0 && !error && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low">
            <Icon name="directions_car" size={32} className="text-on-surface-variant/40" />
          </div>
          <p className="font-title-md text-title-md text-primary">{t('portal.myCars.emptyTitle')}</p>
          <p className="mt-1 text-body-md font-body-md text-on-surface-variant">
            {t('portal.myCars.emptyDesc')}
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

      {/* Car list */}
      {cars.length > 0 && (
        <div className="space-y-3">
          {cars.map(car => (
            <CarRepairCard key={car.id} car={car} />
          ))}
        </div>
      )}
    </div>
  )
}
