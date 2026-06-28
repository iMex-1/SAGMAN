'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
} from 'lucide-react'
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

const REPAIR_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  diagnosing: 'Diagnosing',
  awaiting_approval: 'Awaiting Approval',
  in_progress: 'In Progress',
  waiting_for_parts: 'Waiting for Parts',
  complete: 'Complete',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CarDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        setError('Failed to load car details.')
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
      success('Notes saved')
    } catch (err) {
      if (err instanceof ApiError) {
        toastError('Save failed', err.message)
      } else {
        toastError('Save failed', 'An unexpected error occurred.')
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
      success('Car deleted', `${car?.matricule} has been removed.`)
      router.push('/cars')
    } catch (err) {
      if (err instanceof ApiError) {
        toastError('Delete failed', err.message)
      } else {
        toastError('Delete failed', 'An unexpected error occurred.')
      }
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !car) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cars">
            <ArrowLeft className="h-4 w-4" />
            Back to Cars
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error ?? 'Car not found.'}</p>
          <Button variant="outline" size="sm" onClick={fetchCar} className="ml-auto">
            Retry
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
            <ArrowLeft className="h-4 w-4" />
            Back to Cars
          </Link>
        </Button>
      </div>

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-3xl font-bold">{car.matricule}</h1>
          <p className="mt-1 text-muted-foreground">
            {car.make} {car.model}
            {car.year ? ` · ${car.year}` : ''}
            {car.color ? ` · ${car.color}` : ''}
          </p>
        </div>
        <Button asChild>
          <Link href={`/repairs/new?carId=${car.id}`}>
            <Plus className="h-4 w-4" />
            New Repair
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vehicle Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Plate</dt>
                <dd className="font-mono font-medium">{car.matricule}</dd>

                <dt className="text-muted-foreground">Make</dt>
                <dd>{car.make}</dd>

                <dt className="text-muted-foreground">Model</dt>
                <dd>{car.model}</dd>

                {car.year !== undefined && (
                  <>
                    <dt className="text-muted-foreground">Year</dt>
                    <dd>{car.year}</dd>
                  </>
                )}
                {car.color && (
                  <>
                    <dt className="text-muted-foreground">Color</dt>
                    <dd>{car.color}</dd>
                  </>
                )}
                {car.vin && (
                  <>
                    <dt className="text-muted-foreground">VIN</dt>
                    <dd className="break-all font-mono text-xs">{car.vin}</dd>
                  </>
                )}
                {car.mileage !== undefined && (
                  <>
                    <dt className="text-muted-foreground">Mileage</dt>
                    <dd>{car.mileage.toLocaleString()} km</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Registered</dt>
                <dd>{formatDate(car.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Notes</CardTitle>
                {!editingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNotes(true)}
                    title="Edit notes"
                  >
                    <Pencil className="h-4 w-4" />
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
                    <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                      {savingNotes ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelNotes}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {car.notes || 'No notes. Click the edit button to add some.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Repair History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Repair History</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {repairs.length} record{repairs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {repairs.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No repairs on record for this vehicle.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          ID
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                          Priority
                        </th>
                        <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                          Mechanic
                        </th>
                        <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                          Created
                        </th>
                        <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground xl:table-cell">
                          Target
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          Actions
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
                              {REPAIR_STATUS_LABELS[repair.status] ?? repair.status}
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
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/repairs/${repair.id}`}>View</Link>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {car.client ? (
                <div className="space-y-2">
                  <p className="font-medium">{car.client.name}</p>
                  <p className="text-muted-foreground">{car.client.phone}</p>
                  <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                    <Link href={`/clients/${car.client.id}`}>View Client</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Walk-in (no client account)</p>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Permanently deletes this vehicle and all associated records.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Car
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Car</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="font-mono">{car.matricule}</strong>? This action cannot be
              undone and will remove all associated repair records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
