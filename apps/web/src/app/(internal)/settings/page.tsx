'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, Save } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { api, ApiError } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'

interface GarageSettings {
  garageName: string
  garageAddress: string
  garagePhone: string
  maxConcurrentCars: number
  workingHoursStart: string
  workingHoursEnd: string
  currency: string
  overseerWhatsapp: string
  requireDiagnosisApproval: boolean
  requireClientApproval: boolean
  sessionTimeoutMinutes: number
}

interface SettingsResponse {
  data: GarageSettings
}

const DEFAULT_SETTINGS: GarageSettings = {
  garageName: '',
  garageAddress: '',
  garagePhone: '',
  maxConcurrentCars: 10,
  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  currency: 'DZD',
  overseerWhatsapp: '',
  requireDiagnosisApproval: false,
  requireClientApproval: false,
  sessionTimeoutMinutes: 60,
}

export default function SettingsPage() {
  const { success, error: toastError } = useToast()

  const [settings, setSettings] = useState<GarageSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await api.get<SettingsResponse>('/settings')
      setSettings({ ...DEFAULT_SETTINGS, ...res.data })
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(err.message)
      } else {
        setLoadError('Failed to load settings.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  function setField<K extends keyof GarageSettings>(key: K, value: GarageSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaveError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setIsSaving(true)

    try {
      await api.patch('/settings', settings)
      success('Settings saved successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message)
        toastError('Save failed', err.message)
      } else {
        setSaveError('An unexpected error occurred.')
        toastError('Save failed', 'An unexpected error occurred.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{loadError}</p>
          <Button variant="outline" size="sm" onClick={fetchSettings} className="ml-auto">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your garage management system preferences.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {saveError && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Garage Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Garage Information</CardTitle>
            <CardDescription>Basic details about your garage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="garageName">Garage Name</Label>
              <Input
                id="garageName"
                placeholder="Sagman Auto Repair"
                value={settings.garageName}
                onChange={(e) => setField('garageName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garageAddress">Address</Label>
              <Input
                id="garageAddress"
                placeholder="123 Rue des Ateliers, Alger"
                value={settings.garageAddress}
                onChange={(e) => setField('garageAddress', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garagePhone">Phone Number</Label>
              <Input
                id="garagePhone"
                type="tel"
                placeholder="+213 21 123 456"
                value={settings.garagePhone}
                onChange={(e) => setField('garagePhone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Operational Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operational Settings</CardTitle>
            <CardDescription>
              Configure capacity and scheduling parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxConcurrentCars">Maximum Concurrent Cars</Label>
              <Input
                id="maxConcurrentCars"
                type="number"
                min={1}
                max={100}
                value={settings.maxConcurrentCars}
                onChange={(e) =>
                  setField('maxConcurrentCars', parseInt(e.target.value, 10) || 1)
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of cars that can be in repair simultaneously.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workingHoursStart">Working Hours — Start</Label>
                <Input
                  id="workingHoursStart"
                  type="time"
                  value={settings.workingHoursStart}
                  onChange={(e) => setField('workingHoursStart', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workingHoursEnd">Working Hours — End</Label>
                <Input
                  id="workingHoursEnd"
                  type="time"
                  value={settings.workingHoursEnd}
                  onChange={(e) => setField('workingHoursEnd', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                placeholder="DZD"
                maxLength={10}
                value={settings.currency}
                onChange={(e) => setField('currency', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Currency code displayed on invoices and quotes (e.g. DZD, EUR).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Client Portal Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Portal</CardTitle>
            <CardDescription>
              Settings for the client-facing portal and approval workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="overseerWhatsapp">Overseer WhatsApp Number</Label>
              <Input
                id="overseerWhatsapp"
                type="tel"
                placeholder="+213 555 000 000"
                value={settings.overseerWhatsapp}
                onChange={(e) => setField('overseerWhatsapp', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for critical notifications to the garage owner.
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <ToggleRow
                id="requireDiagnosisApproval"
                label="Require Diagnosis Approval"
                description="Clients must approve the diagnosis report before repair work begins."
                checked={settings.requireDiagnosisApproval}
                onChange={(v) => setField('requireDiagnosisApproval', v)}
              />
              <ToggleRow
                id="requireClientApproval"
                label="Require Client Approval for Quotes"
                description="Clients must approve cost estimates before work proceeds."
                checked={settings.requireClientApproval}
                onChange={(v) => setField('requireClientApproval', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Session Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Settings</CardTitle>
            <CardDescription>
              Control how long user sessions remain active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min={5}
                max={1440}
                value={settings.sessionTimeoutMinutes}
                onChange={(e) =>
                  setField('sessionTimeoutMinutes', parseInt(e.target.value, 10) || 60)
                }
              />
              <p className="text-xs text-muted-foreground">
                Users will be logged out after this period of inactivity. Min: 5, Max: 1440 (24h).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} size="lg">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

// Small inline toggle component
interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
