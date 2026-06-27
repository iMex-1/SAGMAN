'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye, Loader2, AlertCircle, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/lib/api-client'

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
        setError('Failed to load cars.')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cars</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage registered vehicles</p>
        </div>
        <Button asChild>
          <Link href="/cars/new">
            <Plus className="h-4 w-4" />
            Register Car
          </Link>
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by plate, make, or model..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {activeSearch && (
          <Button type="button" variant="ghost" onClick={clearSearch}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </form>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCars} className="ml-auto">
            Retry
          </Button>
        </div>
      ) : cars.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {activeSearch ? `No cars found matching "${activeSearch}".` : 'No cars registered yet.'}
          </p>
          {!activeSearch && (
            <Button asChild className="mt-4">
              <Link href="/cars/new">Register your first car</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Matricule</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Make / Model / Year
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Color
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                  Client
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                  Repairs
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cars.map((car) => (
                <tr key={car.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-medium">{car.matricule}</td>
                  <td className="px-4 py-3">
                    {car.make} {car.model}
                    {car.year && (
                      <span className="ml-1 text-muted-foreground">({car.year})</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {car.color || '—'}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {car.client ? (
                      <span className="font-medium">{car.client.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Walk-in</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Badge variant="secondary">{car._count?.repairs ?? 0}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/cars/${car.id}`}>
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
