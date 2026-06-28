'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Plus,
  Eye,
  Loader2,
  AlertCircle,
  AlertTriangle,
  PackagePlus,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { api, ApiError } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'

interface Part {
  id: string
  name: string
  reference?: string
  category: string
  unitCost: number
  quantity: number
  minThreshold: number
  supplier?: string
  isLowStock?: boolean
  createdAt: string
}

interface PartsResponse {
  data: Part[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
  }
}

interface AddStockResponse {
  data: { id: string }
}

const CATEGORY_LABELS: Record<string, string> = {
  Engine: 'Moteur',
  Brakes: 'Freins',
  Electrical: 'Électrique',
  Bodywork: 'Carrosserie',
  Suspension: 'Suspension',
  Other: 'Autre',
}

const CATEGORIES = Object.keys(CATEGORY_LABELS)

type FilterTab = 'all' | 'low_stock'

export default function StockPage() {
  const { toast } = useToast()

  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Low stock banner
  const [lowStockCount, setLowStockCount] = useState(0)

  // Add stock dialog
  const [addStockPart, setAddStockPart] = useState<Part | null>(null)
  const [addQty, setAddQty] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  // Adjust stock dialog
  const [adjustStockPart, setAdjustStockPart] = useState<Part | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadParts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (filterTab === 'low_stock') params.set('lowStock', 'true')
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      params.set('page', String(page))
      params.set('limit', '20')

      const res = await api.get<PartsResponse>(`/parts?${params.toString()}`)
      setParts(res.data)
      setTotalPages(res.meta.totalPages)
      setTotal(res.meta.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors du chargement des pièces.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, filterTab, categoryFilter, page])

  // Load low stock count separately (always, regardless of tab filter)
  const loadLowStockCount = useCallback(async () => {
    try {
      const res = await api.get<PartsResponse>('/parts?lowStock=true&limit=1')
      setLowStockCount(res.meta.total)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    loadParts()
  }, [loadParts])

  useEffect(() => {
    loadLowStockCount()
  }, [loadLowStockCount])

  async function handleAddStock() {
    if (!addStockPart) return
    const qty = parseInt(addQty, 10)
    if (!addQty || isNaN(qty) || qty <= 0) {
      toast({ title: 'Quantité invalide', description: 'Entrez un nombre entier positif.', variant: 'error' })
      return
    }
    setAddBusy(true)
    try {
      await api.post<AddStockResponse>(`/parts/${addStockPart.id}/stock`, {
        quantity: qty,
        note: addNote || undefined,
      })
      toast({ title: 'Stock ajouté', description: `${qty} unité(s) ajoutée(s) à "${addStockPart.name}".`, variant: 'default' })
      setAddStockPart(null)
      setAddQty('')
      setAddNote('')
      loadParts()
      loadLowStockCount()
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Impossible d\'ajouter le stock.',
        variant: 'error',
      })
    } finally {
      setAddBusy(false)
    }
  }

  async function handleAdjustStock() {
    if (!adjustStockPart) return
    const qtyChange = parseInt(adjustQty, 10)
    if (!adjustQty || isNaN(qtyChange) || qtyChange === 0) {
      toast({ title: 'Quantité invalide', description: 'Entrez un nombre entier différent de zéro.', variant: 'error' })
      return
    }
    if (!adjustNote.trim()) {
      toast({ title: 'Note requise', description: 'Veuillez expliquer la raison de cet ajustement.', variant: 'error' })
      return
    }
    setAdjustBusy(true)
    try {
      await api.post(`/parts/${adjustStockPart.id}/adjust`, {
        quantityChange: qtyChange,
        note: adjustNote.trim(),
      })
      const action = qtyChange > 0 ? 'augmenté' : 'diminué'
      toast({ 
        title: 'Stock ajusté', 
        description: `Stock ${action} de ${Math.abs(qtyChange)} unité(s) pour "${adjustStockPart.name}".`, 
        variant: 'default' 
      })
      setAdjustStockPart(null)
      setAdjustQty('')
      setAdjustNote('')
      loadParts()
      loadLowStockCount()
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Impossible d\'ajuster le stock.',
        variant: 'error',
      })
    } finally {
      setAdjustBusy(false)
    }
  }

  function openAddStock(part: Part) {
    setAddStockPart(part)
    setAddQty('')
    setAddNote('')
  }

  function openAdjustStock(part: Part) {
    setAdjustStockPart(part)
    setAdjustQty('')
    setAdjustNote('')
  }

  function handleLowStockBannerClick() {
    setFilterTab('low_stock')
    setCategoryFilter('all')
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock & Pièces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogue des pièces détachées et gestion des stocks
          </p>
        </div>
        <Button asChild>
          <Link href="/stock/new">
            <Plus className="h-4 w-4" />
            Nouvelle pièce
          </Link>
        </Button>
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <button
          onClick={handleLowStockBannerClick}
          className="w-full flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="text-sm font-medium">
            ⚠ {lowStockCount} pièce{lowStockCount > 1 ? 's' : ''} en dessous du seuil minimum — Cliquez pour filtrer
          </span>
        </button>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tab buttons */}
        <div className="flex gap-1">
          {([
            { label: 'Tous', value: 'all' as FilterTab },
            { label: 'Stock faible', value: 'low_stock' as FilterTab },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setFilterTab(tab.value); setPage(1) }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filterTab === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="w-44">
          <Select
            value={categoryFilter}
            onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Rechercher une pièce..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={loadParts} className="ml-auto">
            Réessayer
          </Button>
        </div>
      ) : parts.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">Aucune pièce trouvée.</p>
          <Button asChild className="mt-4">
            <Link href="/stock/new">Ajouter une pièce</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Référence</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Catégorie</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Stock actuel</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Seuil min</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">Coût unitaire</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parts.map((part) => {
                  const isEmpty = part.quantity === 0
                  const isLow = part.isLowStock && !isEmpty
                  const rowClass = isEmpty
                    ? 'bg-red-50 hover:bg-red-100'
                    : isLow
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'hover:bg-muted/30'
                  return (
                    <tr key={part.id} className={`transition-colors ${rowClass}`}>
                      <td className="px-4 py-3 font-medium">{part.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {part.reference || '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[part.category] ?? part.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            isEmpty ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-foreground'
                          }`}
                        >
                          {part.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                        {part.minThreshold}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                        {Number(part.unitCost).toFixed(2)} DH
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/stock/${part.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Voir</span>
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAddStock(part)}
                            title="Ajouter stock"
                          >
                            <PackagePlus className="h-4 w-4" />
                            <span className="sr-only">Ajouter stock</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAdjustStock(part)}
                            title="Ajuster stock"
                          >
                            <Package className="h-4 w-4" />
                            <span className="sr-only">Ajuster stock</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{total} pièce{total > 1 ? 's' : ''} au total</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add stock dialog */}
      <Dialog open={!!addStockPart} onOpenChange={(open) => { if (!open) setAddStockPart(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter du stock</DialogTitle>
            <DialogDescription>
              {addStockPart
                ? `Ajouter des unités à "${addStockPart.name}" (stock actuel : ${addStockPart.quantity})`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-qty">Quantité à ajouter *</Label>
              <Input
                id="add-qty"
                type="number"
                min="1"
                placeholder="Ex: 10"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-note">Note (optionnel)</Label>
              <Input
                id="add-note"
                placeholder="Ex: Livraison fournisseur"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStockPart(null)} disabled={addBusy}>
              Annuler
            </Button>
            <Button onClick={handleAddStock} disabled={addBusy}>
              {addBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustStockPart} onOpenChange={(open) => { if (!open) setAdjustStockPart(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuster le stock</DialogTitle>
            <DialogDescription>
              {adjustStockPart
                ? `Ajustement manuel pour "${adjustStockPart.name}" (stock actuel : ${adjustStockPart.quantity})`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-qty">Changement de quantité *</Label>
              <Input
                id="adjust-qty"
                type="number"
                placeholder="Ex: +5 ou -3"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
              {adjustStockPart && adjustQty && !isNaN(parseInt(adjustQty)) && (
                <p className="text-xs text-muted-foreground">
                  Nouveau stock: {adjustStockPart.quantity + parseInt(adjustQty)} unités
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">Raison de l'ajustement *</Label>
              <textarea
                id="adjust-note"
                rows={3}
                placeholder="Ex: Pièces endommagées retirées, Correction d'inventaire"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustStockPart(null)} disabled={adjustBusy}>
              Annuler
            </Button>
            <Button onClick={handleAdjustStock} disabled={adjustBusy}>
              {adjustBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ajuster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
