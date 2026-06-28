'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import {
  Car, ArrowLeft, CheckCircle, Clock, AlertTriangle,
  Phone, MessageCircle, Loader2, FileText,
  Wrench, Package, User,
} from 'lucide-react'
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
  payment?: { invoiceNumber: string; finalTotal: number; createdAt: string }
}

// ─── Status labels & step mapping ─────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  received:          'Véhicule reçu',
  diagnosing:        'Diagnostic en cours',
  awaiting_approval: 'En attente de votre accord',
  in_progress:       'Réparation en cours',
  waiting_for_parts: 'En attente de pièces',
  complete:          '✓ Votre véhicule est prêt !',
  delivered:         'Véhicule livré',
  cancelled:         'Réparation annulée',
}

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
  Minor:    'bg-green-50 text-green-700 border-green-200',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  Critical: 'bg-red-50 text-red-700 border-red-200',
}

const SEVERITY_LABELS: Record<string, string> = {
  Minor:    'Mineur',
  Moderate: 'Modéré',
  Critical: 'Critique',
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const REPAIR_STEPS = [
  { id: 'received',   label: 'Reçu',       icon: Car       },
  { id: 'diagnosing', label: 'Diagnostic', icon: FileText  },
  { id: 'in_progress',label: 'Réparation', icon: Wrench    },
  { id: 'complete',   label: 'Terminé',    icon: CheckCircle },
  { id: 'delivered',  label: 'Livré',      icon: Package   },
]

function RepairStepper({ status }: { status: string }) {
  const currentStep = STATUS_TO_STEP[status] ?? 0
  const isCancelled = status === 'cancelled'

  if (isCancelled) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm font-medium text-destructive">
        ✕ Cette réparation a été annulée
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical connector — mobile only */}
      <div className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-0.5 bg-border md:hidden" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {REPAIR_STEPS.map((step, i) => {
          const isDone    = i < currentStep
          const isCurrent = i === currentStep
          const Icon      = step.icon

          return (
            <div
              key={step.id}
              className="relative z-10 flex items-center gap-3 md:flex-col md:items-center md:flex-1 md:gap-2"
            >
              <div
                className={cn(
                  'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                  isDone    ? 'border-primary bg-primary text-white'        :
                  isCurrent ? 'border-primary bg-primary/10 text-primary'  :
                              'border-muted bg-muted text-muted-foreground',
                )}
              >
                {isDone ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                {isCurrent && (
                  <span className="absolute -inset-1 animate-ping rounded-full bg-primary opacity-20" />
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium md:text-center',
                  isDone || isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalRepairPage() {
  const { id } = useParams() as { id: string }
  const router  = useRouter()
  const [repair,  setRepair]  = useState<PortalRepair | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const loadRepair = useCallback(async () => {
    const token = authStorage.getAccessToken()
    if (!token) { router.push('/portal/login'); return }
    try {
      const res = await api.get<{ data: PortalRepair }>(`/portal/repairs/${id}`)
      setRepair(res.data)
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        authStorage.clear()
        router.push('/portal/login')
      } else {
        setError('Réparation introuvable')
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !repair) {
    return (
      <div className="py-20 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="font-semibold text-foreground">{error ?? 'Réparation introuvable'}</p>
        <Link
          href="/portal/cars"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à mes véhicules
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mes véhicules
      </Link>

      {/* ── Car header card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-black leading-tight">
              {repair.car.make} {repair.car.model}
            </p>
            <p className="font-mono text-sm text-blue-200">{repair.car.matricule}</p>
            {repair.car.year && (
              <p className="text-xs text-blue-300">
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
              repair.status === 'complete'  ? 'bg-emerald-400 text-white' :
              repair.status === 'cancelled' ? 'bg-red-400 text-white'     :
                                             'bg-white/20 text-white',
            )}
          >
            {STATUS_LABELS[repair.status] ?? repair.status}
          </div>
          {repair.isOverdue && (
            <div className="overdue-pulse rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
              ⚠ En retard
            </div>
          )}
        </div>
      </div>

      {/* ── Ready-for-pickup banner ──────────────────────────────────────── */}
      {isComplete && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
          <div className="mb-2 text-3xl">🎉</div>
          <h2 className="text-lg font-black text-emerald-800">Votre véhicule est prêt !</h2>
          <p className="mt-1 text-sm text-emerald-700">
            Vous pouvez venir le récupérer pendant nos heures d&apos;ouverture.
          </p>
          {repair.finalTotal > 0 && (
            <p className="mt-2 text-base font-bold text-emerald-800">
              Montant à régler : {Number(repair.finalTotal).toFixed(2)} DH
            </p>
          )}
        </div>
      )}

      {/* ── Progress stepper ────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white p-5 shadow-card">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Progression
        </h2>
        <RepairStepper status={repair.status} />
      </div>

      {/* ── Repair details ──────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border bg-white p-5 shadow-card">
        <h2 className="font-bold text-foreground">Détails de la réparation</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">Problème signalé</span>
            <span className="text-right font-medium">{repair.description}</span>
          </div>
          {repair.targetCompletionDate && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-muted-foreground">Date prévue</span>
              <span className={cn('font-medium', repair.isOverdue ? 'text-destructive' : '')}>
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
              <span className="shrink-0 text-muted-foreground">Terminé le</span>
              <span className="font-medium text-emerald-600">
                {new Date(repair.actualCompletionDate).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              Mécanicien
            </span>
            <span className="font-medium">{repair.primaryMechanic.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">Date d&apos;entrée</span>
            <span className="font-medium">
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
        <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-card">
          <h2 className="font-bold text-foreground">Résultat du diagnostic</h2>

          {repair.diagnosisReport.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Problèmes identifiés
              </p>
              {repair.diagnosisReport.issues.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
                    SEVERITY_STYLES[issue.severity] ?? 'bg-muted',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span>{issue.description}</span>
                    <span className="ml-2 text-xs font-semibold">
                      ({SEVERITY_LABELS[issue.severity] ?? issue.severity})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {repair.diagnosisReport.recommendedRepairs && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Travaux recommandés
              </p>
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                {repair.diagnosisReport.recommendedRepairs}
              </p>
            </div>
          )}

          {repair.diagnosisReport.additionalNotes && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes du technicien
              </p>
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                {repair.diagnosisReport.additionalNotes}
              </p>
            </div>
          )}

          {(repair.estimatedCost ?? 0) > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-xs text-muted-foreground">Estimation du coût</p>
              <p className="text-xl font-black text-primary">
                {Number(repair.estimatedCost).toFixed(2)} DH
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Invoice ─────────────────────────────────────────────────────── */}
      {repair.payment && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Facture
              </p>
              <p className="font-mono font-bold text-foreground">{repair.payment.invoiceNumber}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {new Date(repair.payment.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Montant</p>
              <p className="text-xl font-black text-foreground">
                {Number(repair.payment.finalTotal).toFixed(2)} DH
              </p>
              <span className="mt-1 inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                ✓ PAYÉ
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Status timeline ──────────────────────────────────────────────── */}
      {repair.statusLogs.length > 0 && (
        <div className="rounded-2xl border bg-white p-5 shadow-card">
          <h2 className="mb-4 font-bold text-foreground">Historique</h2>
          <div className="space-y-3">
            {[...repair.statusLogs].reverse().map((log, i) => (
              <div key={log.id} className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {repair.statusLogs.length - i}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {STATUS_LABELS[log.toStatus] ?? log.toStatus}
                  </p>
                  {log.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{log.note}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
      <div className="rounded-2xl border bg-white p-5 shadow-card">
        <h2 className="mb-3 font-bold text-foreground">Une question ?</h2>
        <div className="flex gap-3">
          <a
            href="tel:+212000000000"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <Phone className="h-4 w-4 text-primary" />
            Appeler
          </a>
          <a
            href="https://wa.me/212000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-400"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
