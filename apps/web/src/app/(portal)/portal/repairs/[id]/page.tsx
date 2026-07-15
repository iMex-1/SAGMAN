'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import { Icon } from '@/components/ui/icon'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosisIssue {
  description: string
  severity: string
}

interface DiagnosisReport {
  issues: DiagnosisIssue[]
  recommendedRepairs?: string
  estimatedDurationHours?: number
  additionalNotes?: string
}

interface StatusLog {
  id: string
  fromStatus?: string
  toStatus: string
  note?: string
  createdAt: string
  changedBy: { name: string }
}

interface PortalRepair {
  id: string
  status: string
  priority: string
  description: string
  isOverdue: boolean
  diagnosisShared: boolean
  diagnosisReport?: DiagnosisReport
  estimatedCost?: number
  finalTotal: number
  targetCompletionDate?: string
  actualCompletionDate?: string
  createdAt: string
  car: {
    id: string
    matricule: string
    make: string
    model: string
    year?: number
    color?: string
  }
  primaryMechanic: { name: string }
  statusLogs: StatusLog[]
  carImageUrl?: string
  payment?: { invoiceNumber: string; finalTotal: number; createdAt: string }
}

// ─── Status labels & step mapping ─────────────────────────────────────────────

const STATUS_TO_STEP: Record<string, number> = {
  received:          0,
  diagnosing:        1,
  awaiting_approval: 1,
  in_progress:       2,
  waiting_for_parts: 2,
  complete:          3,
  delivered:         4,
  cancelled:         -1,
}

const SEVERITY_STYLES: Record<string, string> = {
  Minor:    'bg-success-container text-on-success-container border-success/30',
  Moderate: 'bg-warning-container text-on-warning-container border-warning/30',
  Critical: 'bg-error-container text-on-error-container border-error/30',
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const REPAIR_STEPS = [
  { id: 'received',   labelKey: 'received',   icon: 'directions_car' },
  { id: 'diagnosing', labelKey: 'diagnosing', icon: 'description'    },
  { id: 'in_progress',labelKey: 'in_progress',icon: 'build'          },
  { id: 'complete',   labelKey: 'complete',   icon: 'check_circle'   },
  { id: 'delivered',  labelKey: 'delivered',  icon: 'inventory_2'    },
]

function RepairStepper({ status }: { status: string }) {
  const t = useTranslations()
  const currentStep = STATUS_TO_STEP[status] ?? 0
  const isCancelled = status === 'cancelled'

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-error/30 bg-error-container p-4 text-center text-sm font-medium text-on-error-container">
        <Icon name="close" size={16} className="inline mr-1" />
        {t('portal.repairStatus.cancelled')}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical connector — mobile only */}
      <div className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-0.5 bg-outline-variant md:hidden" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {REPAIR_STEPS.map((step, i) => {
          const isDone    = i < currentStep
          const isCurrent = i === currentStep

          return (
            <div
              key={step.id}
              className="relative z-10 flex items-center gap-3 md:flex-col md:items-center md:flex-1 md:gap-2"
            >
              <div
                className={cn(
                  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  isDone    ? 'border-primary bg-primary text-white'             :
                  isCurrent ? 'border-primary bg-primary-container text-on-primary-container'  :
                              'border-outline-variant bg-surface-container-low text-on-surface-variant',
                )}
              >
                {isDone ? <Icon name="check_circle" size={20} /> : <Icon name={step.icon} size={16} />}
                {isCurrent && (
                  <span className="absolute -inset-1 animate-ping rounded-full bg-primary opacity-20" />
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium md:text-center',
                  isDone || isCurrent ? 'text-primary' : 'text-on-surface-variant',
                )}
              >
                {t('repair.status.' + step.labelKey)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface GarageSettings {
  garage_phone?: string
}

interface GarageSettings {
  garage_phone?: string
}

export default function PortalRepairPage() {
  const t = useTranslations()
  const { id } = useParams() as { id: string }
  const router  = useRouter()
  const [repair,  setRepair]  = useState<PortalRepair | null>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<GarageSettings>({})
  const [error,   setError]   = useState<string | null>(null)
  const [carImageError, setCarImageError] = useState(false)

  const loadRepair = useCallback(async () => {
    const token = authStorage.getAccessToken()
    if (!token) { router.push('/portal/login'); return }
    try {
      const [repairRes, settingsRes] = await Promise.all([
        api.get<{ data: PortalRepair }>(`/portal/repairs/${id}`),
        api.get<{ data: GarageSettings }>('/settings/public').catch(() => ({ data: {} })),
      ])
      setRepair(repairRes.data)
      setSettings(settingsRes.data ?? {})
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        authStorage.clear()
        router.push('/portal/login')
      } else {
        setError(t('portal.repairStatus.notFound'))
      }
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { loadRepair() }, [loadRepair])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="sync" size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !repair) {
    return (
      <div className="py-20 text-center">
        <Icon name="warning" size={40} className="mx-auto mb-3 text-on-surface-variant/30" />
        <p className="font-title-md text-title-md text-primary">{error ?? t('portal.repairStatus.notFound')}</p>
        <Link
          href="/portal/cars"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Icon name="arrow_back" size={16} />
          {t('portal.repairStatus.backToCars')}
        </Link>
      </div>
    )
  }

  const isComplete  = repair.status === 'complete'

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      {/* Back */}
      <Link
        href="/portal/cars"
        className="flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
      >
        <Icon name="arrow_back" size={16} />
        {t('portal.repairStatus.backToCars')}
      </Link>

      {/* ── Car header card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          {repair.carImageUrl && !carImageError ? (
            <img
              src={repair.carImageUrl}
              alt={`${repair.car.make} ${repair.car.model}`}
              className="h-16 w-16 rounded-xl object-cover"
              onError={() => setCarImageError(true)}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-on-primary/15">
              <Icon name="directions_car" size={24} />
            </div>
          )}
          <div>
            <p className="text-lg font-black leading-tight">
              {repair.car.make} {repair.car.model}
            </p>
            <p className="font-mono text-sm text-on-primary-container">{repair.car.matricule}</p>
            {repair.car.year && (
              <p className="text-xs text-on-primary-container/70">
                {repair.car.year}
                {repair.car.color ? ` · ${repair.car.color}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold',
              repair.status === 'complete'  ? 'bg-success text-on-success' :
              repair.status === 'cancelled' ? 'bg-error text-on-error'     :
                                              'bg-on-primary/20 text-on-primary',
            )}
          >
            {t('repair.status.' + repair.status) ?? repair.status}
          </div>
          {repair.isOverdue && (
            <div className="overdue-pulse rounded-full bg-error px-3 py-1 text-xs font-bold text-on-error">
              <Icon name="warning" size={12} className="inline mr-1" />
              {t('portal.repairStatus.overdue')}
            </div>
          )}
        </div>
      </div>

      {/* ── Ready-for-pickup banner ──────────────────────────────────────── */}
      {isComplete && (
        <div className="rounded-2xl border-2 border-success/50 bg-success-container p-5 text-center">
          <Icon name="celebration" size={32} className="mx-auto mb-2 text-on-success-container" />
          <h2 className="font-headline-lg text-headline-lg text-on-success-container">{t('portal.repairStatus.readyTitle')}</h2>
          <p className="mt-1 text-body-md font-body-md text-on-success-container/80">
            {t('portal.repairStatus.readyDesc')}
          </p>
          {repair.status === "delivered" && repair.finalTotal > 0 && (
            <p className="mt-2 font-title-md text-title-md text-on-success-container">
              {t('portal.repairStatus.amountPaid', { amount: Number(repair.finalTotal).toFixed(2) })}
            </p>
          )}
        </div>
      )}

      {/* ── Progress stepper ────────────────────────────────────────────── */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-5">
        <h2 className="mb-5 text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant">
          {t('portal.repairStatus.progression')}
        </h2>
        <RepairStepper status={repair.status} />
      </div>

      {/* ── Repair details ──────────────────────────────────────────────── */}
      <div className="space-y-3 bg-white border border-outline-variant rounded-xl shadow-sm p-5">
        <h2 className="font-title-md text-title-md text-primary">{t('portal.repairStatus.details')}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-on-surface-variant">{t('portal.repairStatus.reportedProblem')}</span>
            <span className="text-right font-medium text-primary">{repair.description}</span>
          </div>
          {repair.targetCompletionDate && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-on-surface-variant">{t('portal.repairStatus.expectedDate')}</span>
              <span className={cn('font-medium', repair.isOverdue ? 'text-error' : '')}>
                {new Date(repair.targetCompletionDate).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          {repair.actualCompletionDate && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-on-surface-variant">{t('portal.repairStatus.completedDate')}</span>
              <span className="font-medium text-success">
                {new Date(repair.actualCompletionDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="flex shrink-0 items-center gap-1 text-on-surface-variant">
              <Icon name="person" size={14} />
              {t('portal.repairStatus.mechanic')}
            </span>
            <span className="font-medium text-primary">{repair.primaryMechanic.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-on-surface-variant">{t('portal.repairStatus.entryDate')}</span>
            <span className="font-medium text-primary">
              {new Date(repair.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Diagnosis report (if shared) ────────────────────────────────── */}
      {repair.diagnosisShared && repair.diagnosisReport && (
        <div className="space-y-4 bg-white border border-outline-variant rounded-xl shadow-sm p-5">
          <h2 className="font-title-md text-title-md text-primary">{t('portal.repairStatus.diagnosisTitle')}</h2>

          {repair.diagnosisReport.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant">
                {t('portal.repairStatus.issuesIdentified')}
              </p>
              {repair.diagnosisReport.issues.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
                    SEVERITY_STYLES[issue.severity] ?? 'bg-surface-container-low',
                  )}
                >
                  <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <span>{issue.description}</span>
                    <span className="ml-2 text-xs font-semibold">
                      ({t('repair.diagnosisSections.severity.' + issue.severity) ?? issue.severity})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {repair.diagnosisReport.recommendedRepairs && (
            <div>
              <p className="mb-2 text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant">
                {t('portal.repairStatus.recommendedWork')}
              </p>
              <p className="rounded-lg bg-surface-container-low p-3 text-sm text-primary">
                {repair.diagnosisReport.recommendedRepairs}
              </p>
            </div>
          )}

          {repair.diagnosisReport.additionalNotes && (
            <div>
              <p className="mb-2 text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant">
                {t('portal.repairStatus.technicianNotes')}
              </p>
              <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">
                {repair.diagnosisReport.additionalNotes}
              </p>
            </div>
          )}

          {/* Price estimation hidden from client until final receipt */}
        </div>
      )}

      {/* ── Invoice ─────────────────────────────────────────────────────── */}
      {repair.payment && (
        <div className="rounded-2xl border border-success/30 bg-success-container p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-label-sm font-label-sm uppercase tracking-wider text-on-success-container/70">
                {t('portal.repairStatus.invoice')}
              </p>
              <p className="font-mono font-bold text-primary">{repair.payment.invoiceNumber}</p>
              <p className="mt-0.5 text-sm text-on-surface-variant">
                {new Date(repair.payment.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-on-surface-variant">{t('portal.repairStatus.amount')}</p>
              <p className="text-xl font-black text-primary">
                {Number(repair.payment.finalTotal).toFixed(2)} DH
              </p>
              <span className="mt-1 inline-block rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-on-success">
                <Icon name="check_circle" size={10} className="inline mr-0.5" />
                {t('portal.repairStatus.paymentStatus')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Status timeline ──────────────────────────────────────────────── */}
      {repair.statusLogs.length > 0 && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-5">
          <h2 className="mb-4 font-title-md text-title-md text-primary">{t('portal.repairStatus.history')}</h2>
          <div className="space-y-3">
            {[...repair.statusLogs].reverse().map((log, i) => (
              <div key={log.id} className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant',
                  )}
                >
                  {repair.statusLogs.length - i}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary">
                    {t('repair.status.' + log.toStatus) ?? log.toStatus}
                  </p>
                  {log.note && (
                    <p className="mt-0.5 text-xs text-on-surface-variant">{log.note}</p>
                  )}
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {new Date(log.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {log.changedBy.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contact garage ───────────────────────────────────────────────── */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-5">
        <h2 className="mb-3 font-title-md text-title-md text-primary">{t('portal.repairStatus.question')}</h2>
        <div className="flex gap-3">
          <a
            href={`tel:${settings.garage_phone ?? '+2126947222954'}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <Icon name="call" size={16} />
            {t('portal.repairStatus.call')}
          </a>
          <a
            href={`https://wa.me/${(settings.garage_phone ?? '+2126947222954').replace(/\D/g, '')}?text=${encodeURIComponent(t('portal.repairStatus.whatsappMessage', { matricule: repair?.car?.matricule ?? '' }))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-on-success transition-colors hover:bg-success/90"
          >
            <Icon name="chat" size={16} />
            {t('portal.repairStatus.whatsapp')}
          </a>
        </div>
      </div>
    </div>
  )
}
