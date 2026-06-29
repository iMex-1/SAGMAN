"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Loader2,
  AlertCircle,
  Car,
  User,
  Wrench,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";

interface SearchResult {
  cars: Array<{
    id: string;
    matricule: string;
    make: string;
    model: string;
    year: number;
  }>;
  clients: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  repairs: Array<{
    id: string;
    status: string;
    priority: string;
    description: string;
    car: { matricule: string; make: string; model: string };
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    finalTotal: number;
    createdAt: string;
    repair: { id: string; car: { matricule: string } };
  }>;
}

const STATUS_VARIANTS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  diagnosing: "bg-purple-100 text-purple-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  in_progress: "bg-orange-100 text-orange-700",
  waiting_for_parts: "bg-red-100 text-red-700",
  complete: "bg-emerald-100 text-emerald-700",
  delivered: "bg-slate-100 text-slate-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const PRIORITY_VARIANTS: Record<string, string> = {
  low: "bg-green-100 text-green-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function formatCurrency(amount: number) {
  return `${amount.toFixed(2)} DH`;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasResults =
    results &&
    (results.cars.length > 0 ||
      results.clients.length > 0 ||
      results.repairs.length > 0 ||
      results.invoices.length > 0);

  const resultCount =
    (results?.cars.length || 0) +
    (results?.clients.length || 0) +
    (results?.repairs.length || 0) +
    (results?.invoices.length || 0);

  async function performSearch(searchTerm: string) {
    if (!searchTerm.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SearchResult }>(
        `/search?q=${encodeURIComponent(searchTerm.trim())}&limit=5`,
      );
      setResults(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la recherche.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q !== query) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Recherche globale</h1>
        
        <form onSubmit={handleSearch} className="max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher véhicules, clients, réparations, factures..."
              className="pl-9 pr-20"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1 top-1/2 h-7 -translate-y-1/2"
              disabled={!query.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Chercher"
              )}
            </Button>
          </div>
        </form>

        {query && !loading && results && (
          <p className="text-sm text-muted-foreground">
            {resultCount} résultat{resultCount !== 1 ? "s" : ""} pour &quot;{query}&quot;
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No results */}
      {query && !loading && results && !hasResults && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            Aucun résultat trouvé pour &quot;{query}&quot;
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Essayez avec d&apos;autres mots-clés ou vérifiez l&apos;orthographe
          </p>
        </div>
      )}

      {/* Results */}
      {results && hasResults && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Vehicles */}
          {results.cars.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Car className="h-4 w-4" />
                  Véhicules ({results.cars.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.cars.map((car) => (
                  <Link
                    key={car.id}
                    href={`/cars/${car.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-semibold">{car.matricule}</p>
                      <p className="text-sm text-muted-foreground">
                        {car.make} {car.model} ({car.year})
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Clients */}
          {results.clients.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Clients ({results.clients.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.clients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-semibold">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {client.phone}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Repairs */}
          {results.repairs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4" />
                  Réparations ({results.repairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.repairs.map((repair) => (
                  <Link
                    key={repair.id}
                    href={`/repairs/${repair.id}`}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/50 block"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">#{repair.id.slice(0, 8)}</p>
                          <Badge
                            className={
                              STATUS_VARIANTS[repair.status] ||
                              "bg-slate-100 text-slate-700"
                            }
                          >
                            {repair.status}
                          </Badge>
                          <Badge
                            className={
                              PRIORITY_VARIANTS[repair.priority] ||
                              "bg-slate-100 text-slate-700"
                            }
                          >
                            {repair.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {repair.car.matricule} — {repair.car.make}{" "}
                          {repair.car.model}
                        </p>
                        <p className="text-sm">{repair.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Invoices */}
          {results.invoices.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Factures ({results.invoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/repairs/${invoice.repair.id}#payment`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-semibold">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.repair.car.matricule} —{" "}
                        {formatDate(invoice.createdAt)}
                      </p>
                      <p className="text-sm font-medium text-emerald-600">
                        {formatCurrency(invoice.finalTotal)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!query && !loading && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-medium">Recherche globale</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Recherchez dans tous les véhicules, clients, réparations et factures
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-left max-w-md mx-auto text-sm text-muted-foreground">
            <div>
              <p className="font-medium">Exemples de recherche :</p>
              <ul className="mt-2 space-y-1">
                <li>• Plaque d&apos;immatriculation</li>
                <li>• Nom du client</li>
                <li>• Numéro de téléphone</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">&nbsp;</p>
              <ul className="mt-2 space-y-1">
                <li>• ID de réparation</li>
                <li>• Numéro de facture</li>
                <li>• Marque de véhicule</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}