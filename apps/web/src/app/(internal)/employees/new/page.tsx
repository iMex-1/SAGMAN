'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { normalizePhone } from '@/lib/phone'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, ApiError } from '@/lib/api-client'

const SPECIALTIES = [
  'Moteur', 'Transmission', 'Freins', 'Suspension',
  'Électrique', 'Carrosserie', 'Diagnostic', 'Climatisation', 'Autre',
]

interface FieldErrors {
  name?: string
  role?: string
  phone?: string
  specialty?: string
  cin?: string
  address?: string
}

interface CreateEmployeeResponse {
  data: {
    id: string
    name: string
    email: string
    role: string
  }
}

export default function NewEmployeePage() {
  const t = useTranslations()
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    role: '',
    phone: '',
    specialty: '',
    cin: '',
    address: '',
  })
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isCustomSpecialty = form.specialty === 'Autre'

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errors: FieldErrors = {}

    if (!form.name.trim()) errors.name = t('employee.validation.nameRequired')
    if (!form.role) errors.role = t('employee.validation.roleRequired')

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!validate()) return

    setIsLoading(true)
    try {
      const specialty = isCustomSpecialty ? customSpecialty.trim() : form.specialty

      let imageUrl: string | undefined
      if (imageFile) {
        setUploadingImage(true)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
        const uploadRes = await api.post<{ url: string }>(
          '/uploads/employee-image',
          { image: base64, mimeType: imageFile.type },
        )
        imageUrl = uploadRes.url
        setUploadingImage(false)
      }

      await api.post<CreateEmployeeResponse>('/employees', {
        name: form.name.trim(),
        role: form.role,
        phone: normalizePhone(form.phone) || undefined,
        specialty: specialty || undefined,
        cin: form.cin.trim() || undefined,
        address: form.address.trim() || undefined,
        imageUrl,
      })

      router.push('/employees?created=1')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.details) {
          const details = err.details as Record<string, string>
          setFieldErrors(details)
        } else if (err.code === 'EMAIL_TAKEN') {
          setFieldErrors((prev) => ({ ...prev, email: 'Cet email est déjà utilisé.' }))
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError(err instanceof Error ? err.message : t('employee.errors.generic'))
      }
    } finally {
      setIsLoading(false)
      setUploadingImage(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employees">
            <Icon name="arrow_back" size={16} />
            {t('employee.create.backLink')}
          </Link>
        </Button>
      </div>

      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline-lg text-headline-lg">{t('employee.create.title')}</CardTitle>
          <CardDescription className="font-body-md text-body-md text-on-surface-variant">
            {t('employee.create.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {t('employee.sections.personalInfo')}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t('employee.fields.fullName')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={t('employee.placeholders.fullName')}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    error={fieldErrors.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t('employee.fields.phone')}</Label>
                  <PhoneInput
                    id="phone"
                    placeholder={t('employee.placeholders.phone')}
                    value={form.phone}
                    onChange={(v) => setField('phone', v)}
                    error={fieldErrors.phone}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cin">{t('employee.fields.cin')}</Label>
                  <Input
                    id="cin"
                    placeholder={t('employee.placeholders.cin')}
                    value={form.cin}
                    onChange={(e) => setField('cin', e.target.value)}
                    error={fieldErrors.cin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t('employee.fields.address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('employee.placeholders.address')}
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                    error={fieldErrors.address}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">{t('employee.fields.photo')}</Label>
                  <div className="flex items-center gap-3">
                    {imagePreview && (
                      <img src={imagePreview} alt={t('common.preview')} className="w-14 h-14 rounded-full object-cover border" />
                    )}
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setImageFile(file)
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = () => setImagePreview(reader.result as string)
                          reader.readAsDataURL(file)
                        } else {
                          setImagePreview(null)
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">
                    {t('employee.fields.role')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.role} onValueChange={(v) => setField('role', v)}>
                    <SelectTrigger id="role" error={fieldErrors.role}>
                      <SelectValue placeholder={t('employee.placeholders.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">{t('employee.roles.manager')}</SelectItem>
                      <SelectItem value="mechanic">{t('employee.roles.mechanic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialty">{t('employee.fields.specialty')}</Label>
                  <Select value={form.specialty} onValueChange={(v) => setField('specialty', v)}>
                    <SelectTrigger id="specialty" error={fieldErrors.specialty}>
                      <SelectValue placeholder={t('employee.placeholders.specialty')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map((s) => (
                        <SelectItem key={s} value={s}>{t('employee.specialties.' + s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCustomSpecialty && (
                    <div className="mt-2">
                      <Input
                        id="customSpecialty"
                        placeholder={t('employee.placeholders.customSpecialty')}
                        value={customSpecialty}
                        onChange={(e) => setCustomSpecialty(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isLoading || uploadingImage} isLoading={isLoading || uploadingImage} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md min-w-[120px]">
                {uploadingImage ? t('employee.create.uploading') : isLoading ? t('employee.create.submitting') : t('employee.create.submit')}
              </Button>
              <Button variant="outline" type="button" asChild className="border border-outline-variant text-on-surface-variant">
                <Link href="/employees">{t('common.cancel')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
