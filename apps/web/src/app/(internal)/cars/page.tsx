'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/lib/api-client'
import { useTranslations } from 'next-intl'

interface Car {
  id: string
  matricule: string
  make: string
  model: string
  year?: number
  color?: string
  clientId?: string
  client?: { id: string; name: string; phone: string }
  _count?: { repairs: number }
  createdAt: string
}

interface CarsResponse {
  data: Car[]
  meta: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean }
}

export default function CarsPage() {
  const t = useTranslations()
  const [cars, setCars] = useState<Car[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

  const fetchCars = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' })
      if (activeSearch) params.set('q', activeSearch)
      const res = await api.get<CarsResponse>(`/cars?${params}`)
      setCars(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError(t('car.errors.loadFailed'))
      }
    } finally {
      setIsLoading(false)
    }
  }, [activeSearch])

  useEffect(() => {
    fetchCars()
  }, [fetchCars])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setActiveSearch(searchInput.trim())
  }

  function clearSearch() {
    setSearchInput('')
    setActiveSearch('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">{t('car.title')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('car.subtitle')}</p>
        </div>

      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            placeholder={t('car.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t('common.search')}
        </Button>
        {activeSearch && (
          <Button type="button" variant="ghost" onClick={clearSearch}>
            <Icon name="close" size={16} />
            {t('common.clear')}
          </Button>
        )}
      </form>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
          <Icon name="error" size={20} className="shrink-0 text-primary" />
          <p className="font-body-md text-body-md text-primary">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCars} className="ml-auto">
            {t('common.retry')}
          </Button>
        </div>
      ) : cars.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {activeSearch ? t('car.empty.noResults').replace('{search}', activeSearch) : t('car.empty.none')}
          </p>

        </div>
      ) : (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('car.fields.matricule')}</th>
                <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">
                  {t('car.fields.make')} / {t('car.fields.model')} / {t('car.fields.year')}
                </th>
                <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant md:table-cell">
                  {t('car.fields.color')}
                </th>
                <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant lg:table-cell">
                  {t('car.fields.client')}
                </th>
                <th className="hidden px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant lg:table-cell">
                  {t('car.repairCount')}
                </th>
                <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-mono font-title-md text-title-md">{car.matricule}</td>
                  <td className="px-4 py-3 font-body-md text-body-md">
                    {car.make} {car.model}
                    {car.year && (
                      <span className="ml-1 text-on-surface-variant">({car.year})</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-on-surface-variant font-body-md text-body-md md:table-cell">
                    {car.color || '—'}
                  </td>
                  <td className="hidden px-4 py-3 font-body-md text-body-md lg:table-cell">
                    {car.client ? (
                      <span className="font-title-md text-title-md">{car.client.name}</span>
                    ) : (
                      <span className="text-on-surface-variant">{t('car.walkin')}</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Badge variant="secondary">{car._count?.repairs ?? 0}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/cars/${car.id}`}>
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
