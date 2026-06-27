'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  PackagePlus,
  SlidersHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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

interface PartDetail {
  id: string
  name: string
  reference?: string
  category: string
  compatibleModels?: string
  unitCost: number
  quantity: number
  minThreshold: number
  supplier?: string
  isLowStock: boolean
  createdAt: string
  updatedAt: string
}

interface StockTransaction {
  id: string
  type: 'received' | 'used' | 'adjustment'
  quantityChange: number
  quantityAfter: number
  note?: string
  createdAt: string
  doneBy: { name: string }
  repair?: { id: string; status: string }
}

interface PartResponse {
  data: PartDetail
}

interface TransactionsResponse {
  data: StockTransaction[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasMore: boolean
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  Engine: 'Moteur',
  Brakes: 'Freins',
  Electrical: 'Électrique',
  Bodywork: 'Carrosserie',
  Suspension: 'Suspension',
  Other: 'Autre',
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  received: 'Réception',
  used: 'Utilisé',
  adjustment: 'Ajustement',
}

const TRANSACTION_TYPE_VARIANTS: Record<string, 'success' | 'info' | 'warning'> = {
  received: 'success',
  used: 'info',
  adjustment: 'warning',
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PartDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [part, setPart] = useState<PartDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Transactions
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [txPage, setTxPage] = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)
  const [txTotal, setTxTotal] = useState(0)

  // Add stock dialog
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [addQty, setAddQty] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addBusy, setAddBusy] = useState(false)

  // Adjust stock dialog
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustBusy, setAdjustBusy] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editReference, setEditReference] = useState('')
  const [editUnitCost, setEditUnitCost] = useState('')
  const [editMinThreshold, setEditMinThreshold] = useState('')
  const [editSupplier, setEditSupplier] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const loadPart = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<PartResponse>(`/parts/${id}`)
      setPart(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors du chargement.')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const res = await api.get<TransactionsResponse>(
        `/parts/${id}/transactions?page=${txPage}&limit=20`,
      )
      setTransactions(res.data)
      setTxTotalPages(res.meta.totalPages)
      setTxTotal(res.meta.total)
    } catch {
      // silently ignore
    } finally {
      setTxLoading(false)
    }
  }, [id, txPage])

  useEffect(() => { loadPart() }, [loadPart])
  useEffect(() => { loadTransactions() }, [loadTransactions])

  function openEdit() {
    if (!part) return
    setEditName(part.name)
    setEditReference(part.reference ?? '')
    setEditUnitCost(String(part.unitCost))
    setEditMinThreshold(String(part.minThreshold))
    setEditSupplier(part.supplier ?? '')
    setEditOpen(true)
  }

  async function handleAddStock() {
    const qty = parseInt(addQty, 10)
    if (!addQty || isNaN(qty) || qty <= 0) {
      toast({ title: 'Quantité invalide', description: 'Entrez un entier positif.', variant: 'error' })
      return
    }
    setAddBusy(true)
    try {
      await api.post(`/parts/${id}/stock`, { quantity: qty, note: addNote || undefined })
      toast({ title: 'Stock ajouté', description: `${qty} unité(s) ajoutée(s).`, variant: 'default' })
      setAddStockOpen(false)
      setAddQty('')
      setAddNote('')
      loadPart()
      loadTransactions()
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
    const qty = parseInt(adjustQty, 10)
    if (!adjustQty || isNaN(qty)) {
      toast({ title: 'Valeur invalide', description: 'Entrez un nombre entier (positif ou négatif).', variant: 'error' })
      return
    }
    if (!adjustNote.trim()) {
      toast({ title: 'Note requise', description: 'Une note est obligatoire pour un ajustement.', variant: 'error' })
      return
    }
    setAdjustBusy(true)
    try {
      await api.post(`/parts/${id}/adjust`, { quantityChange: qty, note: adjustNote.trim() })
      toast({ title: 'Stock ajusté', description: `Ajustement de ${qty > 0 ? '+' : ''}${qty} appliqué.`, variant: 'default' })
      setAdjustOpen(false)
      setAdjustQty('')
      setAdjustNote('')
      loadPart()
      loadTransactions()
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

  async function handleEdit() {
    if (!editName.trim()) {
      toast({ title: 'Champ requis', description: 'Le nom est obligatoire.', variant: 'error' })
      return
    }
    const cost = parseFloat(editUnitCost)
    if (isNaN(cost) || cost < 0) {
      toast({ title: 'Valeur invalide', description: 'Le coût unitaire est invalide.', variant: 'error' })
      return
    }
    setEditBusy(true)
    try {
      const res = await api.patch<PartResponse>(`/parts/${id}`, {
        name: editName.trim(),
        reference: editReference.trim() || undefined,
        unitCost: cost,
        minThreshold: parseInt(editMinThreshold, 10) || 0,
        supplier: editSupplier.trim() || undefined,
      })
      setPart(res.data)
      toast({ title: 'Pièce modifiée', description: 'Les informations ont été mises à jour.', variant: 'default' })
      setEditOpen(false)
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Impossible de modifier la pièce.',
        variant: 'error',
      })
    } finally {
      setEditBusy(false)
    }
  }

  async function handleDelete() {
    setDeleteBusy(true)
    try {
      await api.delete(`/parts/${id}`)
      toast({ title: 'Pièce supprimée', description: 'La pièce a été retirée du catalogue.', variant: 'default' })
      router.push('/stock')
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Impossible de supprimer la pièce.',
        variant: 'error',
      })
      setDeleteBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !part) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error ?? 'Pièce introuvable.'}</p>
        <Button variant="outline" size="sm" onClick={loadPart} className="ml-auto">
          Réessayer
        </Button>
      </div>
    )
  }

  const stockColor =
    part.quantity === 0
      ? 'text-red-600'
      : part.isLowStock
      ? 'text-amber-600'
      : 'text-green-600'

  const stockBg =
    part.quantity === 0
      ? 'bg-red-50 border-red-200'
      : part.isLowStock
      ? 'bg-amber-50 border-amber-200'
      : 'bg-green-50 border-green-200'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stock">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{part.name}</h1>
          {part.reference && (
            <p className="mt-0.5 text-sm text-muted-foreground">Réf. {part.reference}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Modifier
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: info + stock widget */}
        <div className="space-y-4 lg:col-span-1">
          {/* Stock level widget */}
          <Card className={`border-2 ${stockBg}`}>
            <CardContent className="pt-6 pb-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Stock actuel</p>
              <p className={`text-5xl font-bold ${stockColor}`}>{part.quantity}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Seuil minimum : {part.minThreshold}
              </p>
              {part.quantity === 0 && (
                <p className="mt-1 text-xs font-medium text-red-600">⚠ Rupture de stock</p>
              )}
              {part.isLowStock && part.quantity > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-600">⚠ Stock faible</p>
              )}
              <div className="mt-4 flex flex-col gap-2">
                <Button className="w-full" size="sm" onClick={() => { setAddQty(''); setAddNote(''); setAddStockOpen(true) }}>
                  <PackagePlus className="h-4 w-4 mr-1" />
                  Ajouter du stock
                </Button>
                <Button variant="outline" className="w-full" size="sm" onClick={() => { setAdjustQty(''); setAdjustNote(''); setAdjustOpen(true) }}>
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  Ajuster le stock
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Part info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Catégorie</span>
                <Badge variant="secondary">
                  {CATEGORY_LABELS[part.category] ?? part.category}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coût unitaire</span>
                <span className="font-medium">{Number(part.unitCost).toFixed(2)} DH</span>
              </div>
              {part.supplier && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fournisseur</span>
                    <span className="font-medium text-right max-w-[60%] break-words">{part.supplier}</span>
                  </div>
                </>
              )}
              {part.compatibleModels && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1">Modèles compatibles</p>
                    <p className="font-medium">{part.compatibleModels}</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Créé le</span>
                <span>{formatDate(part.createdAt)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mis à jour</span>
                <span>{formatDate(part.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: transaction history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des mouvements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Aucun mouvement de stock enregistré.
                </div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Changement</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground hidden sm:table-cell">Stock après</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Note</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Par</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Réparation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(tx.createdAt)}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={TRANSACTION_TYPE_VARIANTS[tx.type] ?? 'secondary'}>
                              {TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                            <span className={tx.quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {tx.quantityChange >= 0 ? '+' : ''}{tx.quantityChange}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                            {tx.quantityAfter}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell max-w-[160px] truncate">
                            {tx.note || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">
                            {tx.doneBy.name}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            {tx.repair ? (
                              <Link
                                href={`/repairs/${tx.repair.id}`}
                                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                              >
                                Voir <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Tx pagination */}
                  {txTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                      <span>{txTotal} mouvement{txTotal > 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                          disabled={txPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>
                          {txPage} / {txTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                          disabled={txPage === txTotalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add stock dialog */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter du stock</DialogTitle>
            <DialogDescription>
              Stock actuel : <strong>{part.quantity}</strong> unité(s)
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
            <Button variant="outline" onClick={() => setAddStockOpen(false)} disabled={addBusy}>
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
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuster le stock</DialogTitle>
            <DialogDescription>
              Stock actuel : <strong>{part.quantity}</strong> unité(s). Entrez une valeur positive ou négative.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adj-qty">Changement de quantité *</Label>
              <Input
                id="adj-qty"
                type="number"
                placeholder="Ex: -3 ou +5"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-note">Note * (obligatoire)</Label>
              <Input
                id="adj-note"
                placeholder="Ex: Correction après inventaire"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustBusy}>
              Annuler
            </Button>
            <Button onClick={handleAdjustStock} disabled={adjustBusy}>
              {adjustBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la pièce</DialogTitle>
            <DialogDescription>
              Modifiez les informations de cette pièce.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nom *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-ref">Référence</Label>
              <Input
                id="edit-ref"
                value={editReference}
                onChange={(e) => setEditReference(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cost">Coût unitaire (DH)</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editUnitCost}
                  onChange={(e) => setEditUnitCost(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-threshold">Seuil min.</Label>
                <Input
                  id="edit-threshold"
                  type="number"
                  min="0"
                  value={editMinThreshold}
                  onChange={(e) => setEditMinThreshold(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-supplier">Fournisseur</Label>
              <Input
                id="edit-supplier"
                value={editSupplier}
                onChange={(e) => setEditSupplier(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editBusy}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={editBusy}>
              {editBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la pièce</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{part.name}</strong> du catalogue ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteBusy}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
