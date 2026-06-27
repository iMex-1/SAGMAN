'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api, ApiError } from '@/lib/api-client'

interface InvoiceData {
  invoice: {
    invoiceNumber: string
    amountBilled: number
    partsTotal: number
    laborTotal: number
    discountAmount: number
    finalTotal: number
    amountReceived: number
    changeDue: number
    method: string
    createdAt: string
  }
  repair: { id: string; description: string; status: string }
  car: { matricule: string; make: string; model: string; year?: number }
  client?: { name: string; phone: string }
  laborItems: Array<{ id: string; description: string; cost: number }>
  parts: Array<{
    id: string
    quantityUsed: number
    unitCostAtTime: number
    part: { name: string; reference?: string }
  }>
  mechanics: Array<{ name: string }>
  createdBy: { name: string }
  settings: {
    garageName: string
    garageAddress: string
    garagePhone: string
    currencyLabel: string
  }
}

interface InvoiceResponse {
  data: InvoiceData
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function money(amount: number, currency = 'DH') {
  return `${Number(amount).toFixed(2)} ${currency}`
}

export default function InvoicePage() {
  const params = useParams()
  const repairId = params.id as string

  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadInvoice = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<InvoiceResponse>(`/payments/invoice/${repairId}`)
      setData(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors du chargement de la facture.')
    } finally {
      setLoading(false)
    }
  }, [repairId])

  useEffect(() => { loadInvoice() }, [loadInvoice])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive m-6">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm">{error ?? 'Facture introuvable.'}</p>
        <Button variant="outline" size="sm" onClick={loadInvoice} className="ml-auto">
          Réessayer
        </Button>
      </div>
    )
  }

  const { invoice, repair, car, client, laborItems, parts, mechanics, createdBy, settings } = data
  const currency = settings.currencyLabel || 'DH'

  return (
    <>
      {/* Print styles: hide sidebar, topnav, and action bar */}
      <style>{`
        @media print {
          nav, aside, header, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .invoice-content {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 16mm;
            size: A4;
          }
        }
      `}</style>

      {/* Action bar — hidden on print */}
      <div className="no-print flex items-center justify-between mb-6 px-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/repairs/${repairId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimer
        </Button>
      </div>

      {/* Invoice document */}
      <div className="invoice-content mx-auto max-w-3xl rounded-lg border bg-white text-gray-900 shadow-sm">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-8 pt-8 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{settings.garageName}</h1>
            {settings.garageAddress && (
              <p className="mt-1 text-sm text-gray-500">{settings.garageAddress}</p>
            )}
            {settings.garagePhone && (
              <p className="text-sm text-gray-500">Tél : {settings.garagePhone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-800">{invoice.invoiceNumber}</p>
            <p className="mt-1 text-sm text-gray-500">Date : {formatDate(invoice.createdAt)}</p>
          </div>
        </div>

        <Separator />

        {/* ── Client & Véhicule ── */}
        <div className="grid grid-cols-2 gap-6 px-8 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Client
            </p>
            {client ? (
              <>
                <p className="font-semibold">{client.name}</p>
                <p className="text-sm text-gray-500">{client.phone}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Client non renseigné</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Véhicule
            </p>
            <p className="font-semibold">
              {car.make} {car.model}
            </p>
            <p className="text-sm text-gray-500">Immat : {car.matricule}</p>
            {car.year && <p className="text-sm text-gray-500">Année : {car.year}</p>}
          </div>
        </div>

        {/* ── Description réparation ── */}
        {repair.description && (
          <>
            <Separator />
            <div className="px-8 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Désignation
              </p>
              <p className="text-sm text-gray-700">{repair.description}</p>
            </div>
          </>
        )}

        {/* ── Main d'œuvre ── */}
        {laborItems.length > 0 && (
          <>
            <Separator />
            <div className="px-8 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Main d&apos;œuvre
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {laborItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 text-gray-700">{item.description}</td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {money(item.cost, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Pièces détachées ── */}
        {parts.length > 0 && (
          <>
            <Separator />
            <div className="px-8 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Pièces détachées
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">Désignation</th>
                    <th className="text-right pb-2 font-medium">Qté</th>
                    <th className="text-right pb-2 font-medium">Prix unit.</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 text-gray-700">
                        {p.part.name}
                        {p.part.reference && (
                          <span className="ml-1 text-xs text-gray-400">({p.part.reference})</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-600 tabular-nums">
                        {p.quantityUsed}
                      </td>
                      <td className="py-2 text-right text-gray-600 tabular-nums">
                        {money(p.unitCostAtTime, currency)}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {money(p.quantityUsed * p.unitCostAtTime, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Totaux ── */}
        <Separator />
        <div className="px-8 py-6">
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total pièces</span>
              <span className="tabular-nums">{money(invoice.partsTotal, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total main d&apos;œuvre</span>
              <span className="tabular-nums">{money(invoice.laborTotal, currency)}</span>
            </div>
            {Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Remise</span>
                <span className="tabular-nums">−{money(invoice.discountAmount, currency)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total net</span>
              <span className="tabular-nums">{money(invoice.finalTotal, currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-gray-600">
              <span>Reçu</span>
              <span className="tabular-nums">{money(invoice.amountReceived, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Rendu</span>
              <span className="tabular-nums">{money(invoice.changeDue, currency)}</span>
            </div>
            {invoice.method && (
              <div className="flex justify-between text-xs text-gray-400 pt-1">
                <span>Mode de paiement</span>
                <span className="capitalize">{invoice.method}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <Separator />
        <div className="flex items-center justify-between px-8 py-5 text-sm text-gray-500">
          <div>
            {mechanics.length > 0 && (
              <p>
                <span className="font-medium">Mécanicien(s) : </span>
                {mechanics.map((m) => m.name).join(', ')}
              </p>
            )}
            <p>
              <span className="font-medium">Responsable : </span>
              {createdBy.name}
            </p>
          </div>
          <p className="text-center text-xs text-gray-400 italic">
            Merci de votre confiance — {settings.garageName}
          </p>
        </div>
      </div>
    </>
  )
}
