"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
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
  received: "bg-surface-container-low text-on-surface-variant",
  diagnosing: "bg-surface-container text-primary",
  awaiting_approval: "bg-surface-container-low text-on-surface-variant",
  in_progress: "bg-surface-container text-primary",
  waiting_for_parts: "bg-surface-container-low text-on-surface-variant",
  complete: "bg-surface-container text-primary",
  delivered: "bg-surface-container-low text-on-surface-variant",
  cancelled: "bg-surface-container-low text-on-surface-variant",
};

const PRIORITY_VARIANTS: Record<string, string> = {
  low: "bg-surface-container-low text-on-surface-variant",
  normal: "bg-surface-container text-primary",
  high: "bg-surface-container-low text-on-surface-variant",
  emergency: "bg-surface-container text-primary",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function formatCurrency(amount: number) {
  return `${amount.toFixed(2)} DH`;
}

export default function SearchPage() {
  const t = useTranslations();
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
        err instanceof ApiError ? err.message : t('search.error'),
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
          <div>
            <h2 className="font-headline-xl text-headline-xl">{t('search.title')}</h2>
          </div>
        </div>
        
        <form onSubmit={handleSearch} className="max-w-xl">
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder={t('search.placeholder')}
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
                <Icon name="progress_activity" size={16} className="animate-spin" />
              ) : (
                t('search.button')
              )}
            </Button>
          </div>
        </form>

        {query && !loading && results && (
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('search.results', { count: resultCount })} &quot;{query}&quot;
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
          <Icon name="error" size={20} className="shrink-0 text-primary" />
          <p className="font-body-md text-body-md text-primary">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
        </div>
      )}

      {/* No results */}
      {query && !loading && results && !hasResults && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
          <Icon name="search" size={48} className="text-on-surface-variant/40" />
          <p className="mt-4 font-body-lg text-body-lg text-on-surface-variant">
            {t('search.noResults')} &quot;{query}&quot;
          </p>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            {t('search.noResultsHint')}
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
                <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
                  <Icon name="directions_car" size={16} />
                  {t('search.vehicles', { count: results.cars.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.cars.map((car) => (
                  <Link
                    key={car.id}
                    href={`/cars/${car.id}`}
                    className="flex items-center justify-between rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-low"
                  >
                    <div>
                      <p className="font-title-md text-title-md">{car.matricule}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {car.make} {car.model} ({car.year})
                      </p>
                    </div>
                    <Icon name="arrow_forward" size={16} className="text-on-surface-variant" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Clients */}
          {results.clients.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
                  <Icon name="person" size={16} />
                  {t('search.clients', { count: results.clients.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.clients.map((client) => (
                  <div className="rounded-lg border border-outline-variant p-3">
                    <div>
                      <p className="font-title-md text-title-md">{client.name}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {client.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Repairs */}
          {results.repairs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
                  <Icon name="build" size={16} />
                  {t('search.repairs', { count: results.repairs.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.repairs.map((repair) => (
                  <Link
                    key={repair.id}
                    href={`/repairs/${repair.id}`}
                    className="rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-low block"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-title-md text-title-md">#{repair.id.slice(0, 8)}</p>
                          <span
                            className={cn(
                              "inline-flex items-center px-sm py-xs rounded-full font-label-sm text-label-sm font-bold",
                              STATUS_VARIANTS[repair.status] ||
                                "bg-surface-container-low text-on-surface-variant",
                            )}
                          >
                            {t('repair.status.' + repair.status) ?? repair.status}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center px-sm py-xs rounded-full font-label-sm text-label-sm font-bold",
                              PRIORITY_VARIANTS[repair.priority] ||
                                "bg-surface-container-low text-on-surface-variant",
                            )}
                          >
                            {repair.priority}
                          </span>
                        </div>
                        <p className="font-body-md text-body-md text-on-surface-variant">
                          {repair.car.matricule} — {repair.car.make}{" "}
                          {repair.car.model}
                        </p>
                        <p className="font-body-md text-body-md">{repair.description}</p>
                      </div>
                      <Icon name="arrow_forward" size={16} className="text-on-surface-variant mt-1" />
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
                <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
                  <Icon name="description" size={16} />
                  {t('search.invoices', { count: results.invoices.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/repairs/${invoice.repair.id}#payment`}
                    className="flex items-center justify-between rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-low"
                  >
                    <div>
                      <p className="font-title-md text-title-md">{invoice.invoiceNumber}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {invoice.repair.car.matricule} —{" "}
                        {formatDate(invoice.createdAt)}
                      </p>
                      <p className="font-title-md text-title-md text-primary">
                        {formatCurrency(invoice.finalTotal)}
                      </p>
                    </div>
                    <Icon name="arrow_forward" size={16} className="text-on-surface-variant" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty state */}
      {!query && !loading && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
          <Icon name="search" size={48} className="text-on-surface-variant/40" />
          <p className="mt-4 font-headline-lg text-headline-lg">{t('search.title')}</p>
          <p className="mt-2 font-body-lg text-body-lg text-on-surface-variant">
            {t('search.welcome')}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-left max-w-md mx-auto font-body-md text-body-md text-on-surface-variant">
            <div>
              <p className="font-title-md text-title-md">{t('search.examples')}</p>
              <ul className="mt-2 space-y-1">
                <li>• {t('search.plateHint')}</li>
                <li>• {t('search.clientNameHint')}</li>
                <li>• {t('search.phoneHint')}</li>
              </ul>
            </div>
            <div>
              <p className="font-title-md text-title-md">&nbsp;</p>
              <ul className="mt-2 space-y-1">
                <li>• {t('search.repairIdHint')}</li>
                <li>• {t('search.invoiceHint')}</li>
                <li>• {t('search.brandHint')}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
