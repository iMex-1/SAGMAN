'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/lib/api-client'

type AppointmentStatus = 'pending' | 'confirmed' | 'rescheduled' | 'cancelled' | 'converted'

interface Appointment {
  id: string
  clientName: string
  clientPhone: string
  carMatricule?: string
  purpose: string
  requestedAt: string
  status: AppointmentStatus
  notes?: string
  createdAt: string
  car?: { id: string; matricule: string; make: string; model: string }
  client?: { id: string; name: string }
}

interface AppointmentsResponse {
  data: Appointment[]
  meta: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean }
}

type StatusFilter = 'all' | AppointmentStatus

const STATUS_VARIANTS: Record<
  AppointmentStatus,
  'warning' | 'success' | 'info' | 'destructive' | 'secondary'
> = {
  pending: 'warning',
  confirmed: 'success',
  rescheduled: 'info',
  cancelled: 'destructive',
  converted: 'secondary',
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  converted: 'Converted',
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

const FILTER_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Rescheduled', value: 'rescheduled' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Converted', value: 'converted' },
]

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await api.get<AppointmentsResponse>(`/appointments?${params}`)
      setAppointments(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load appointments.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage client appointment requests
          </p>
        </div>
        <Button asChild>
          <Link href="/appointments/new">
            <Plus className="h-4 w-4" />
            New Appointment
          </Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAppointments} className="ml-auto">
            Retry
          </Button>
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {statusFilter !== 'all'
              ? `No ${STATUS_LABELS[statusFilter as AppointmentStatus]?.toLowerCase()} appointments found.`
              : 'No appointments yet.'}
          </p>
          <Button asChild className="mt-4">
            <Link href="/appointments/new">Create an appointment</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Client Name
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  Phone
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Vehicle
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                  Purpose
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Requested Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map((appt) => (
                <tr key={appt.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{appt.clientName}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {appt.clientPhone}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {appt.car?.matricule || appt.carMatricule || '—'}
                  </td>
                  <td className="hidden max-w-[200px] px-4 py-3 text-muted-foreground lg:table-cell">
                    <span className="block truncate">{appt.purpose}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(appt.requestedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[appt.status]}>
                      {STATUS_LABELS[appt.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/appointments/${appt.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
