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
  matricule?: string
  make?: string
  model?: string
  year?: string
  color?: string
  vin?: string
  mileage?: string
  notes?: string
}

interface CreateCarResponse {
  data: { id: string; matricule: string }
}

export default function NewCarPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [form, setForm] = useState({
    matricule: '',
    make: '',
    model: '',
    year: '',
    color: '',
    vin: '',
    mileage: '',
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
    if (!form.matricule.trim()) errors.matricule = 'Plate number is required.'
    if (!form.make.trim()) errors.make = 'Make is required.'
    if (!form.model.trim()) errors.model = 'Model is required.'
    if (form.year) {
      const y = Number(form.year)
      if (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) {
        errors.year = 'Enter a valid year.'
      }
    }
    if (form.mileage && isNaN(Number(form.mileage))) {
      errors.mileage = 'Mileage must be a number.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return

    setIsLoading(true)
    try {
      const res = await api.post<CreateCarResponse>('/cars', {
        matricule: form.matricule.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year ? Number(form.year) : undefined,
        color: form.color.trim() || undefined,
        vin: form.vin.trim() || undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        notes: form.notes.trim() || undefined,
      })
      success('Car registered', `${res.data.matricule} has been added to the system.`)
      router.push(`/cars/${res.data.id}`)
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
          <Link href="/cars">
            <ArrowLeft className="h-4 w-4" />
            Back to Cars
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register Car</CardTitle>
          <CardDescription>Add a vehicle to the garage system.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Form-level error */}
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {/* Vehicle Identity */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Vehicle Identity
              </h3>

              <div className="space-y-2">
                <Label htmlFor="matricule">
                  Plate Number / Matricule <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="matricule"
                  placeholder="e.g. 123456-A-50"
                  value={form.matricule}
                  onChange={(e) => setField('matricule', e.target.value.toUpperCase())}
                  error={fieldErrors.matricule}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="make">
                    Make <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="make"
                    placeholder="Toyota"
                    value={form.make}
                    onChange={(e) => setField('make', e.target.value)}
                    error={fieldErrors.make}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">
                    Model <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model"
                    placeholder="Corolla"
                    value={form.model}
                    onChange={(e) => setField('model', e.target.value)}
                    error={fieldErrors.model}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="2020"
                    value={form.year}
                    onChange={(e) => setField('year', e.target.value)}
                    error={fieldErrors.year}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    placeholder="White"
                    value={form.color}
                    onChange={(e) => setField('color', e.target.value)}
                    error={fieldErrors.color}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN</Label>
                  <Input
                    id="vin"
                    placeholder="Vehicle identification number"
                    value={form.vin}
                    onChange={(e) => setField('vin', e.target.value)}
                    error={fieldErrors.vin}
                  />
                </div>
              </div>
            </div>

            {/* Intake */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Intake
              </h3>

              <div className="space-y-2">
                <Label htmlFor="mileage">Mileage (km)</Label>
                <Input
                  id="mileage"
                  type="number"
                  placeholder="e.g. 45000"
                  value={form.mileage}
                  onChange={(e) => setField('mileage', e.target.value)}
                  error={fieldErrors.mileage}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  placeholder="Any initial observations about the vehicle..."
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>

            {/* Client note */}
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Client linking is done from the car detail page after registration. Leave the
                vehicle unlinked for walk-in customers.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={isLoading} className="min-w-[140px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Car'
                )}
              </Button>
              <Button variant="outline" type="button" asChild>
                <Link href="/cars">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
