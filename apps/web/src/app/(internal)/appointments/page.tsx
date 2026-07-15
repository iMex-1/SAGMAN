'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AppointmentsPage() {
  const t = useTranslations()
  const FILTER_TABS: { label: string; value: StatusFilter }[] = [
    { label: t('common.all'), value: 'all' },
    { label: t('appointment.status.pending'), value: 'pending' },
    { label: t('appointment.status.confirmed'), value: 'confirmed' },
    { label: t('appointment.status.rescheduled'), value: 'rescheduled' },
    { label: t('appointment.status.cancelled'), value: 'cancelled' },
    { label: t('appointment.status.converted'), value: 'converted' },
  ]
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [dateFilter, setDateFilter] = useState('')

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateFilter) params.set('date', dateFilter)
      const res = await api.get<AppointmentsResponse>(`/appointments?${params}`)
      setAppointments(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('appointment.errors.loadFailed'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, dateFilter])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">{t('appointment.title')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {t('appointment.title')}
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-lg py-sm text-title-md font-title-md transition-colors ${
              statusFilter === tab.value
                ? 'bg-primary text-on-primary'
                : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <Icon name="calendar_today" size={16} className="text-on-surface-variant" />
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="max-w-[180px]"
        />
        {dateFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDateFilter('')}
          >
            <Icon name="close" size={16} />
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
          <Icon name="error" size={20} className="shrink-0 text-primary" />
          <p className="font-body-md text-body-md text-primary">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAppointments} className="ml-auto">
            {t('common.retry')}
          </Button>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {statusFilter !== 'all'
              ? `${t('common.noResults')} ${t('appointment.status.' + (statusFilter as AppointmentStatus)).toLowerCase()}`
              : t('common.noResults')}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                  {t('appointment.fields.clientName')}
                </th>
                <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant sm:table-cell">
                  {t('common.phone')}
                </th>
                <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant md:table-cell">
                  {t('appointment.fields.vehicleMatricule')}
                </th>
                <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant lg:table-cell">
                  {t('appointment.fields.purpose')}
                </th>
                <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                  {t('appointment.fields.requestedDate')}
                </th>
                <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                  {t('common.status')}
                </th>
                <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-title-md text-title-md">{appt.clientName}</td>
                  <td className="hidden px-4 py-3 text-on-surface-variant font-body-md text-body-md sm:table-cell">
                    {appt.clientPhone}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-on-surface-variant md:table-cell">
                    {appt.car?.matricule || appt.carMatricule || '—'}
                  </td>
                  <td className="hidden max-w-[200px] px-4 py-3 text-on-surface-variant font-body-md text-body-md lg:table-cell">
                    <span className="block truncate">{appt.purpose}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant font-body-md text-body-md">
                    {formatDate(appt.requestedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[appt.status]}>
                      {t('appointment.status.' + appt.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/appointments/${appt.id}`}>
                          <Icon name="visibility" size={16} />
                          <span className="sr-only">{t('common.view')}</span>
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
