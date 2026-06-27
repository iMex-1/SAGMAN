'use client'

import { Suspense, useState, useEffect, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Loader2, Car, Users, Wrench, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface SearchResults {
  cars: Array<{ id: string; matricule: string; make: string; model: string; year?: number }>
  clients: Array<{ id: string; name: string; phone: string }>
  repairs: Array<{
    id: string
    status: string
    priority: string
    car: { matricule: string; make: string; model: string }
  }>
  invoices: Array<{
    id: string
    invoiceNumber: string
    finalTotal: number
    createdAt: string
    repair: { id: string; car: { matricule: string } }
  }>
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Reçu',
  diagnosing: 'Diagnostic',
  awaiting_approval: 'En attente',
  in_progress: 'En cours',
  waiting_for_parts: 'Att. pièces',
  complete: 'Terminé',
  delivered: 'Livré',
  cancelled: 'Annulé',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  received: 'secondary',
  diagnosing: 'default',
  awaiting_approval: 'outline',
  in_progress: 'default',
  waiting_for_parts: 'outline',
  complete: 'secondary',
  delivered: 'secondary',
  cancelled: 'destructive',
}

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [inputValue, setInputValue] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }

    let cancelled = false

    async function doSearch() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<{ data: SearchResults }>(
          `/search?q=${encodeURIComponent(query)}&limit=8`,
        )
        if (!cancelled) setResults(res.data)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Erreur lors de la recherche.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    doSearch()
    return () => {
      cancelled = true
    }
  }, [query])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = inputValue.trim()
    if (!q) return
    setQuery(q)
    router.replace(`/search?q=${encodeURIComponent(q)}`)
  }

  const total =
    (results?.cars.length ?? 0) +
    (results?.clients.length ?? 0) +
    (results?.repairs.length ?? 0) +
    (results?.invoices.length ?? 0)

  const hasResults = results !== null && total > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Recherche globale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rechercher des véhicules, clients, réparations et factures
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Matricule, nom client, numéro facture…"
            className="pl-9"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
        </Button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* No results */}
      {!loading && results !== null && !hasResults && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            Aucun résultat pour &quot;{query}&quot;
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && hasResults && (
        <div className="space-y-6">
          {/* Vehicles */}
          {results.cars.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Véhicules
                </h2>
                <Badge variant="secondary">{results.cars.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.cars.map((car) => (
                  <Link
                    key={car.id}
                    href={`/cars/${car.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                      <Car className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{car.matricule}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {car.make} {car.model}
                        {car.year ? ` · ${car.year}` : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Clients */}
          {results.clients.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Clients
                </h2>
                <Badge variant="secondary">{results.clients.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.clients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950">
                      <Users className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.phone}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Repairs */}
          {results.repairs.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Réparations
                </h2>
                <Badge variant="secondary">{results.repairs.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.repairs.map((repair) => (
                  <Link
                    key={repair.id}
                    href={`/repairs/${repair.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                        <Wrench className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{repair.car.matricule}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {repair.car.make} {repair.car.model}
                        </p>
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANTS[repair.status] ?? 'secondary'}>
                      {STATUS_LABELS[repair.status] ?? repair.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Invoices */}
          {results.invoices.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Factures
                </h2>
                <Badge variant="secondary">{results.invoices.length}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {results.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/repairs/${invoice.repair.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                        <FileText className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{invoice.invoiceNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invoice.repair.car.matricule}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-600">
                      {Number(invoice.finalTotal).toFixed(2)} DH
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Empty initial state */}
      {!loading && results === null && !error && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            Saisissez un terme pour lancer la recherche
          </p>
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6">Chargement...</div>}>
      <SearchContent />
    </Suspense>
  )
}
