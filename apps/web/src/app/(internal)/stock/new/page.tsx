'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
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
import { useToast } from '@/components/ui/use-toast'

interface CreatePartResponse {
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

export default function NewPartPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [reference, setReference] = useState('')
  const [category, setCategory] = useState('')
  const [compatibleModels, setCompatibleModels] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [minThreshold, setMinThreshold] = useState('0')
  const [supplier, setSupplier] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast({ title: 'Champ requis', description: 'Le nom de la pièce est obligatoire.', variant: 'error' })
      return
    }
    if (!category) {
      toast({ title: 'Champ requis', description: 'Veuillez sélectionner une catégorie.', variant: 'error' })
      return
    }
    const costNum = parseFloat(unitCost)
    if (!unitCost || isNaN(costNum) || costNum < 0) {
      toast({ title: 'Valeur invalide', description: 'Le coût unitaire doit être un nombre positif.', variant: 'error' })
      return
    }

    setBusy(true)
    try {
      const res = await api.post<CreatePartResponse>('/parts', {
        name: name.trim(),
        reference: reference.trim() || undefined,
        category,
        compatibleModels: compatibleModels.trim() || undefined,
        unitCost: costNum,
        quantity: parseInt(quantity, 10) || 0,
        minThreshold: parseInt(minThreshold, 10) || 0,
        supplier: supplier.trim() || undefined,
      })
      toast({ title: 'Pièce créée', description: `"${name}" a été ajoutée au catalogue.`, variant: 'default' })
      router.push(`/stock/${res.data.id}`)
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof ApiError ? err.message : 'Impossible de créer la pièce.',
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stock">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle pièce</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ajouter une pièce au catalogue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informations de la pièce</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Nom */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom de la pièce *</Label>
              <Input
                id="name"
                placeholder="Ex: Filtre à huile"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Référence */}
            <div className="space-y-1.5">
              <Label htmlFor="reference">Référence</Label>
              <Input
                id="reference"
                placeholder="Ex: OIL-F-001"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {/* Catégorie */}
            <div className="space-y-1.5">
              <Label htmlFor="category">Catégorie *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modèles compatibles */}
            <div className="space-y-1.5">
              <Label htmlFor="compatibleModels">Modèles compatibles</Label>
              <Input
                id="compatibleModels"
                placeholder="Ex: Toyota Corolla, Dacia Logan"
                value={compatibleModels}
                onChange={(e) => setCompatibleModels(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Séparez les modèles par une virgule
              </p>
            </div>

            {/* Coût unitaire */}
            <div className="space-y-1.5">
              <Label htmlFor="unitCost">Coût unitaire en DH *</Label>
              <Input
                id="unitCost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantité initiale */}
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantité initiale en stock</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              {/* Seuil minimum */}
              <div className="space-y-1.5">
                <Label htmlFor="minThreshold">Seuil minimum</Label>
                <Input
                  id="minThreshold"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                />
              </div>
            </div>

            {/* Fournisseur */}
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Fournisseur</Label>
              <Input
                id="supplier"
                placeholder="Ex: AutoParts Maroc"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" type="button" asChild disabled={busy}>
            <Link href="/stock">Annuler</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer la pièce
          </Button>
        </div>
      </form>
    </div>
  )
}
