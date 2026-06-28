'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api, ApiError } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'

interface FieldErrors {
  clientName?: string
  clientPhone?: string
  carMatricule?: string
  purpose?: string
  requestedDate?: string
  requestedTime?: string
  notes?: string
}

interface CreateAppointmentResponse {
  data: { id: string }
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    carMatricule: '',
    purpose: '',
    requestedDate: '',
    requestedTime: '09:00',
    notes: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!form.clientName.trim()) errors.clientName = 'Client name is required.'
    if (!form.clientPhone.trim()) errors.clientPhone = 'Client phone is required.'
    if (!form.purpose.trim()) errors.purpose = 'Purpose is required.'
    if (!form.requestedDate) errors.requestedDate = 'Date is required.'
    if (!form.requestedTime) errors.requestedTime = 'Time is required.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setIsLoading(true)
    try {
      const requestedAt = new Date(
        `${form.requestedDate}T${form.requestedTime}:00`,
      ).toISOString()

      const res = await api.post<CreateAppointmentResponse>('/appointments', {
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone.trim(),
        carMatricule: form.carMatricule.trim().toUpperCase() || undefined,
        purpose: form.purpose.trim(),
        requestedAt,
        notes: form.notes.trim() || undefined,
      })

      success('Appointment created')
      router.push(`/appointments/${res.data.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.details) {
          setFieldErrors(err.details as FieldErrors)
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/appointments">
            <ArrowLeft className="h-4 w-4" />
            Back to Appointments
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Appointment</CardTitle>
          <CardDescription>Schedule a client visit to the garage.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Form-level error */}
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Appointments created by managers are confirmed immediately.</p>
            </div>

            {/* Client */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Client
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">
                    Client Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="clientName"
                    placeholder="Ahmed Benali"
                    value={form.clientName}
                    onChange={(e) => setField('clientName', e.target.value)}
                    error={fieldErrors.clientName}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">
                    Client Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    placeholder="+212600000000"
                    value={form.clientPhone}
                    onChange={(e) => setField('clientPhone', e.target.value)}
                    error={fieldErrors.clientPhone}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Vehicle */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Vehicle
              </h3>
              <div className="space-y-2">
                <Label htmlFor="carMatricule">Car Plate / Matricule (optional)</Label>
                <Input
                  id="carMatricule"
                  placeholder="e.g. 123456-A-50"
                  value={form.carMatricule}
                  onChange={(e) => setField('carMatricule', e.target.value.toUpperCase())}
                  error={fieldErrors.carMatricule}
                />
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Details
              </h3>

              <div className="space-y-2">
                <Label htmlFor="purpose">
                  Purpose / Issue Description <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="purpose"
                  placeholder="Describe the issue or service needed..."
                  value={form.purpose}
                  onChange={(e) => setField('purpose', e.target.value)}
                  rows={3}
                  className={`w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    fieldErrors.purpose ? 'border-destructive' : 'border-input'
                  }`}
                  required
                />
                {fieldErrors.purpose && (
                  <p className="text-xs text-destructive">{fieldErrors.purpose}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="requestedDate">
                    Requested Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requestedDate"
                    type="date"
                    value={form.requestedDate}
                    onChange={(e) => setField('requestedDate', e.target.value)}
                    error={fieldErrors.requestedDate}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requestedTime">
                    Requested Time <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="requestedTime"
                    type="time"
                    value={form.requestedTime}
                    onChange={(e) => setField('requestedTime', e.target.value)}
                    error={fieldErrors.requestedTime}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isLoading} className="min-w-[160px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Appointment'
                )}
              </Button>
              <Button variant="outline" type="button" asChild>
                <Link href="/appointments">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
