'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, ApiError } from '@/lib/api-client'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/use-toast'

interface CarDetail {
  id: string
  matricule: string
  make: string
  model: string
  year?: number
  color?: string
  vin?: string
  mileage?: number
  notes?: string
  clientId?: string
  client?: { id: string; name: string; phone: string }
  createdAt: string
}

interface RepairSummary {
  id: string
  status: string
  priority: string
  primaryMechanic?: { name: string }
  targetCompletionDate?: string
  createdAt: string
}

interface CarRepairsResponse {
  data: RepairSummary[]
}

const REPAIR_STATUS_VARIANTS: Record<
  string,
  'secondary' | 'info' | 'warning' | 'default' | 'success' | 'destructive' | 'outline'
> = {
  received: 'secondary',
  diagnosing: 'info',
  awaiting_approval: 'warning',
  in_progress: 'default',
  waiting_for_parts: 'warning',
  complete: 'success',
  delivered: 'outline',
  cancelled: 'destructive',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations()
  const { id } = use(params)
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [car, setCar] = useState<CarDetail | null>(null)
  const [repairs, setRepairs] = useState<RepairSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Notes inline edit
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchCar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [carRes, repairsRes] = await Promise.all([
        api.get<{ data: CarDetail }>(`/cars/${id}`),
        api.get<CarRepairsResponse>(`/cars/${id}/repairs?page=1&limit=10`),
      ])
      setCar(carRes.data)
      setNotesValue(carRes.data.notes ?? '')
      setRepairs(repairsRes.data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('car.loadCarError'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCar()
  }, [fetchCar])

  async function handleSaveNotes() {
    if (!car) return
    setSavingNotes(true)
    try {
      await api.patch(`/cars/${id}`, { notes: notesValue })
      setCar((prev) => (prev ? { ...prev, notes: notesValue } : prev))
      setEditingNotes(false)
      success(t('car.detail.toasts.notesSaved'))
    } catch (err) {
      if (err instanceof ApiError) {
        toastError(t('car.detail.toasts.saveFailed'), err.message)
      } else {
        toastError(t('car.detail.toasts.saveFailed'), t('car.detail.toasts.genericError'))
      }
    } finally {
      setSavingNotes(false)
    }
  }

  function handleCancelNotes() {
    setEditingNotes(false)
    setNotesValue(car?.notes ?? '')
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.delete(`/cars/${id}`)
      success(t('car.detail.toasts.deleted'), t('car.detail.deleteSuccess', { matricule: car?.matricule ?? '' }))
      router.push('/cars')
    } catch (err) {
      if (err instanceof ApiError) {
        toastError(t('car.detail.toasts.deleteFailed'), err.message)
      } else {
        toastError(t('car.detail.toasts.deleteFailed'), t('car.detail.toasts.genericError'))
      }
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !car) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cars">
            <Icon name="arrow_back" size={16} />
            {t('car.detail.backLink')}
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{error ?? t('car.detail.notFound')}</p>
          <Button variant="outline" size="sm" onClick={fetchCar} className="ml-auto">
            {t('car.detail.retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cars">
            <Icon name="arrow_back" size={16} />
            {t('car.detail.backLink')}
          </Link>
        </Button>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-mono">{car.matricule}</h1>
          <p className="mt-1 text-muted-foreground">
            {car.make} {car.model}
            {car.year ? ` · ${car.year}` : ''}
            {car.color ? ` · ${car.color}` : ''}
          </p>
        </div>
        <Button asChild className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
          <Link href={`/repairs/new?carId=${car.id}`}>
            <Icon name="add" size={16} />
            {t('car.detail.newRepair')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Vehicle Info */}
          <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="font-title-md text-title-md">{t('car.detail.info')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('car.detail.plate')}</dt>
                <dd className="font-mono font-medium">{car.matricule}</dd>

                <dt className="text-muted-foreground">{t('car.detail.make')}</dt>
                <dd>{car.make}</dd>

                <dt className="text-muted-foreground">{t('car.detail.model')}</dt>
                <dd>{car.model}</dd>

                {car.year !== undefined && (
                  <>
                    <dt className="text-muted-foreground">{t('car.detail.year')}</dt>
                    <dd>{car.year}</dd>
                  </>
                )}
                {car.color && (
                  <>
                    <dt className="text-muted-foreground">{t('car.detail.color')}</dt>
                    <dd>{car.color}</dd>
                  </>
                )}
                {car.vin && (
                  <>
                    <dt className="text-muted-foreground">{t('car.detail.vin')}</dt>
                    <dd className="break-all font-mono text-xs">{car.vin}</dd>
                  </>
                )}
                {car.mileage != null && (
                  <>
                    <dt className="text-muted-foreground">{t('car.detail.mileage')}</dt>
                    <dd>{car.mileage.toLocaleString()} km</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t('car.detail.registeredOn')}</dt>
                <dd>{formatDate(car.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-title-md text-title-md">{t('car.detail.notes')}</CardTitle>
                {!editingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNotes(true)}
                    title={t('car.detail.editNotes')}
                    className="text-on-surface-variant"
                  >
                    <Icon name="edit" size={16} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={4}
                    autoFocus
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
                      {savingNotes ? (
                        <Icon name="sync" size={16} className="animate-spin" />
                      ) : (
                        <Icon name="check" size={16} />
                      )}
                      {t('car.detail.save')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelNotes} className="text-on-surface-variant">
                      <Icon name="close" size={16} />
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {car.notes || t('car.detail.noNotes')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Repair History */}
          <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-title-md text-title-md">{t('car.detail.repairHistory')}</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {t('car.detail.repairCount', { count: repairs.length })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {repairs.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  {t('car.detail.noRepairs')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-surface-container/50">
                        <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                          {t('car.table.id')}
                        </th>
                        <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                          {t('car.table.status')}
                        </th>
                        <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant md:table-cell">
                          {t('car.table.priority')}
                        </th>
                        <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant lg:table-cell">
                          {t('car.table.mechanic')}
                        </th>
                        <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant lg:table-cell">
                          {t('car.table.createdAt')}
                        </th>
                        <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant xl:table-cell">
                          {t('car.table.targetDate')}
                        </th>
                        <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant">
                          {t('car.table.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {repairs.map((repair) => (
                        <tr key={repair.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {repair.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={REPAIR_STATUS_VARIANTS[repair.status] ?? 'secondary'}
                            >
                              {t('repair.status.' + repair.status) ?? repair.status}
                            </Badge>
                          </td>
                          <td className="hidden px-4 py-3 capitalize text-muted-foreground md:table-cell">
                            {repair.priority}
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                            {repair.primaryMechanic?.name ?? '—'}
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                            {formatDate(repair.createdAt)}
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                            {repair.targetCompletionDate
                              ? formatDate(repair.targetCompletionDate)
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" asChild className="text-on-surface-variant">
                              <Link href={`/repairs/${repair.id}`}>{t('car.table.view')}</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* Client */}
          <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="font-title-md text-title-md">{t('car.detail.client')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {car.client ? (
                <div className="space-y-2">
                  <p className="font-medium">{car.client.name}</p>
                  <p className="text-muted-foreground">{car.client.phone}</p>
                  <Button variant="outline" size="sm" className="mt-2 w-full border border-outline-variant text-on-surface-variant" asChild>
                    <Link href={`/clients/${car.client.id}`}>{t('car.detail.viewClient')}</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">{t('car.detail.noClient')}</p>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="bg-white border border-outline-variant rounded-xl shadow-sm border-destructive/30">
            <CardHeader>
              <CardTitle className="font-title-md text-title-md text-destructive">{t('car.detail.deleteSection')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('car.detail.deleteDescription')}
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Icon name="delete" size={16} />
                {t('car.detail.deleteButton')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('car.detail.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('car.detail.deleteConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
              className="border border-outline-variant text-on-surface-variant"
            >
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md">
              {deleting ? (
                <Icon name="sync" size={16} className="animate-spin" />
              ) : (
                <Icon name="delete" size={16} />
              )}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
