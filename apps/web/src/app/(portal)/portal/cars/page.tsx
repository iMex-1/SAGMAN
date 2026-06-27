'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api-client'
import { authStorage } from '@/lib/auth'
import {
  Car, PlusCircle, ChevronRight, Clock, AlertCircle,
  CheckCircle2, Loader2,
} from 'lucide-react'
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

interface ClientCar {
  id: string
  matricule: string
  make: string
  model: string
  year?: number
  activeRepair?: ActiveRepair
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; step: number; icon: typeof CheckCircle2 }
> = {
  received:          { label: 'Reçu',              color: 'bg-slate-400',   step: 1, icon: CheckCircle2 },
  diagnosing:        { label: 'Diagnostic',         color: 'bg-blue-500',    step: 2, icon: AlertCircle  },
  awaiting_approval: { label: 'En attente',         color: 'bg-amber-500',   step: 2, icon: AlertCircle  },
  in_progress:       { label: 'En cours',           color: 'bg-purple-500',  step: 3, icon: Clock        },
  waiting_for_parts: { label: 'Pièces manquantes',  color: 'bg-orange-500',  step: 3, icon: Clock        },
  complete:          { label: 'Prêt !',             color: 'bg-emerald-500', step: 4, icon: CheckCircle2 },
  delivered:         { label: 'Livré',              color: 'bg-slate-400',   step: 5, icon: CheckCircle2 },
  cancelled:         { label: 'Annulé',             color: 'bg-red-400',     step: 0, icon: AlertCircle  },
}

const PROGRESS_STEPS = ['Reçu', 'Diagnostic', 'Réparation', 'Terminé', 'Livré']

// ─── Progress bar ─────────────────────────────────────────────────────────────

function RepairProgressBar({ status }: { status: string }) {
  const config = STATUS_CONFIG[status]
  if (!config || config.step === 0) return null

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex justify-between text-[10px] font-medium text-muted-foreground">
        {PROGRESS_STEPS.map((s, i) => (
          <span key={s} className={cn(i + 1 <= config.step ? 'text-primary font-semibold' : '')}>
            {s}
          </span>
        ))}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
  const repair = car.activeRepair
  const statusConfig = repair ? (STATUS_CONFIG[repair.status] ?? null) : null

  return (
    <Link
      href={repair ? `/portal/repairs/${repair.id}` : '#'}
      className={cn(
        'block rounded-2xl border bg-white p-5 shadow-card transition-all hover:shadow-card-hover',
        repair ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Car info */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">
              {car.make} {car.model}
            </p>
            <p className="font-mono text-sm text-muted-foreground">{car.matricule}</p>
            {car.year && <p className="text-xs text-muted-foreground">{car.year}</p>}
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
            <statusConfig.icon className="h-3 w-3" />
            {statusConfig.label}
          </div>
        )}
      </div>

      {repair ? (
        <>
          <RepairProgressBar status={repair.status} />

          <div className="mt-3 flex items-center justify-between">
            <p className="max-w-[70%] truncate text-xs text-muted-foreground">
              {repair.description}
            </p>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>

          {repair.isOverdue && (
            <div className="overdue-pulse mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Réparation en retard
            </div>
          )}

          {repair.targetCompletionDate && (
            <p className="mt-1 text-xs text-muted-foreground">
              Date prévue :{' '}
              {new Date(repair.targetCompletionDate).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Aucune réparation active</p>
      )}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalCarsPage() {
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
          setError('Impossible de charger vos véhicules')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {clientName && (
            <p className="text-sm text-muted-foreground">Bonjour, {clientName} 👋</p>
          )}
          <h1 className="text-xl font-bold text-foreground">Mes véhicules</h1>
          <p className="text-sm text-muted-foreground">
            {cars.length} véhicule{cars.length !== 1 ? 's' : ''} enregistré
            {cars.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/portal/book"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Rendez-vous</span>
        </Link>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {cars.length === 0 && !error && (
        <div className="rounded-2xl border bg-white py-16 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Car className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">Aucun véhicule enregistré</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prenez rendez-vous pour enregistrer votre véhicule
          </p>
          <Link
            href="/portal/book"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            Prendre rendez-vous
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
