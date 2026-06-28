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

// Keys match the API schema (snake_case)
interface GarageSettings {
  garage_name: string
  garage_address: string
  garage_phone: string
  max_concurrent_cars: number
  working_hours: string
  currency_label: string
  overseer_whatsapp_number: string
  require_diagnosis_approval: 'true' | 'false'
  require_client_approval: 'true' | 'false'
  session_timeout_hours: number
}

interface SettingsResponse {
  data: Record<string, string>
}

const DEFAULTS: GarageSettings = {
  garage_name: '',
  garage_address: '',
  garage_phone: '',
  max_concurrent_cars: 5,
  working_hours: 'Mon-Sat 08:00-18:00',
  currency_label: 'DH',
  overseer_whatsapp_number: '',
  require_diagnosis_approval: 'true',
  require_client_approval: 'true',
  session_timeout_hours: 8,
}

function parseSettings(raw: Record<string, string>): GarageSettings {
  return {
    garage_name: raw.garage_name ?? DEFAULTS.garage_name,
    garage_address: raw.garage_address ?? DEFAULTS.garage_address,
    garage_phone: raw.garage_phone ?? DEFAULTS.garage_phone,
    max_concurrent_cars: parseInt(raw.max_concurrent_cars ?? String(DEFAULTS.max_concurrent_cars), 10),
    working_hours: raw.working_hours ?? DEFAULTS.working_hours,
    currency_label: raw.currency_label ?? DEFAULTS.currency_label,
    overseer_whatsapp_number: raw.overseer_whatsapp_number ?? DEFAULTS.overseer_whatsapp_number,
    require_diagnosis_approval: (raw.require_diagnosis_approval === 'false' ? 'false' : 'true') as 'true' | 'false',
    require_client_approval: (raw.require_client_approval === 'false' ? 'false' : 'true') as 'true' | 'false',
    session_timeout_hours: parseInt(raw.session_timeout_hours ?? String(DEFAULTS.session_timeout_hours), 10),
  }
}

export default function SettingsPage() {
  const { success, error: toastError } = useToast()

  const [settings, setSettings] = useState<GarageSettings>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await api.get<SettingsResponse>('/settings')
      setSettings(parseSettings(res.data))
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load settings.')
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
      // Send only fields the API schema recognises (snake_case)
      await api.patch('/settings', {
        garage_name: settings.garage_name || undefined,
        garage_address: settings.garage_address || undefined,
        garage_phone: settings.garage_phone || undefined,
        max_concurrent_cars: settings.max_concurrent_cars,
        working_hours: settings.working_hours || undefined,
        currency_label: settings.currency_label || undefined,
        overseer_whatsapp_number: settings.overseer_whatsapp_number || undefined,
        require_diagnosis_approval: settings.require_diagnosis_approval,
        require_client_approval: settings.require_client_approval,
        session_timeout_hours: settings.session_timeout_hours,
      })
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
              <Label htmlFor="garage_name">Garage Name</Label>
              <Input
                id="garage_name"
                placeholder="Sagman Auto Repair"
                value={settings.garage_name}
                onChange={(e) => setField('garage_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage_address">Address</Label>
              <Input
                id="garage_address"
                placeholder="123 Rue des Ateliers, Alger"
                value={settings.garage_address}
                onChange={(e) => setField('garage_address', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="garage_phone">Phone Number</Label>
              <Input
                id="garage_phone"
                type="tel"
                placeholder="+213 21 123 456"
                value={settings.garage_phone}
                onChange={(e) => setField('garage_phone', e.target.value)}
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
              <Label htmlFor="max_concurrent_cars">Maximum Concurrent Cars</Label>
              <Input
                id="max_concurrent_cars"
                type="number"
                min={1}
                max={50}
                value={settings.max_concurrent_cars}
                onChange={(e) =>
                  setField('max_concurrent_cars', parseInt(e.target.value, 10) || 1)
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of cars that can be in repair simultaneously.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="working_hours">Working Hours</Label>
              <Input
                id="working_hours"
                placeholder="Mon-Sat 08:00-18:00"
                value={settings.working_hours}
                onChange={(e) => setField('working_hours', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Displayed on the client portal (e.g. Mon-Sat 08:00-18:00).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency_label">Currency Label</Label>
              <Input
                id="currency_label"
                placeholder="DH"
                maxLength={10}
                value={settings.currency_label}
                onChange={(e) => setField('currency_label', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Currency label displayed on invoices and quotes (e.g. DH, DZD, EUR).
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
              <Label htmlFor="overseer_whatsapp_number">Overseer WhatsApp Number</Label>
              <Input
                id="overseer_whatsapp_number"
                type="tel"
                placeholder="+213 555 000 000"
                value={settings.overseer_whatsapp_number}
                onChange={(e) => setField('overseer_whatsapp_number', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for critical notifications to the garage owner.
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <ToggleRow
                id="require_diagnosis_approval"
                label="Require Diagnosis Approval"
                description="Clients must approve the diagnosis report before repair work begins."
                checked={settings.require_diagnosis_approval === 'true'}
                onChange={(v) => setField('require_diagnosis_approval', v ? 'true' : 'false')}
              />
              <ToggleRow
                id="require_client_approval"
                label="Require Client Approval for Quotes"
                description="Clients must approve cost estimates before work proceeds."
                checked={settings.require_client_approval === 'true'}
                onChange={(v) => setField('require_client_approval', v ? 'true' : 'false')}
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
              <Label htmlFor="session_timeout_hours">Session Timeout (hours)</Label>
              <Input
                id="session_timeout_hours"
                type="number"
                min={1}
                max={168}
                value={settings.session_timeout_hours}
                onChange={(e) =>
                  setField('session_timeout_hours', parseInt(e.target.value, 10) || 8)
                }
              />
              <p className="text-xs text-muted-foreground">
                Users will be logged out after this period of inactivity. Min: 1h, Max: 168h (7 days).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} size="lg">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
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
