"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api-client";

interface ClientCar {
  id: string;
  matricule: string;
  make: string;
  model: string;
  year: number | null;
  notes: string | null;
  createdAt: string;
}

interface ClientRepair {
  id: string;
  carId: string;
  description: string;
  status: string;
  totalCost: number | null;
  createdAt: string;
  matricule: string;
  make: string;
  model: string;
  mechanicName: string | null;
}

interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  cars: ClientCar[];
  repairs: ClientRepair[];
}

const REPAIR_STATUS_VARIANTS: Record<string, "secondary" | "info" | "warning" | "default" | "success" | "outline" | "destructive"> = {
  received: "secondary",
  diagnosing: "info",
  awaiting_approval: "warning",
  in_progress: "default",
  waiting_for_parts: "warning",
  complete: "success",
  delivered: "outline",
  cancelled: "destructive",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "MAD",
  }).format(amount);
}

export default function ClientDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ data: ClientDetail }>(`/clients/${clientId}`);
      setClient(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(err.statusCode === 404 ? t('client.detail.notFound') : err.message);
      } else {
        setLoadError(t('client.detail.loadError'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employees">
            <Icon name="arrow_back" size={16} />
            {t('common.back')}
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{loadError ?? t('client.detail.notFound')}</p>
          <Button variant="outline" size="sm" onClick={fetchClient} className="ml-auto">
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/employees">
          <Icon name="arrow_back" size={16} />
          {t('common.back')}
        </Link>
      </Button>

      {/* Client info header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary">
          {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="font-headline-xl text-headline-xl">{client.name}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('client.detail.clientSince', { date: formatDate(client.createdAt) })}
          </p>
        </div>
      </div>

      {/* Contact info */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-title-md text-title-md">{t('client.detail.contactInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">{t('client.detail.phone')}</p>
              <p className="font-body-lg text-body-lg">{client.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">{t('client.detail.email')}</p>
              <p className="font-body-lg text-body-lg">{client.email || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cars */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-title-md text-title-md">
            {t('client.detail.vehicles', { count: client.cars.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {client.cars.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t('client.detail.noVehicles')}</p>
          ) : (
            <div className="space-y-3">
              {client.cars.map((car) => (
                <Link
                  key={car.id}
                  href={`/cars/${car.id}`}
                  className="flex items-center justify-between rounded-lg border border-outline-variant p-4 hover:bg-surface-container-low transition-colors"
                >
                  <div>
                    <p className="font-title-md text-title-md">
                      {car.make} {car.model}
                    </p>
                    <p className="text-sm text-on-surface-variant">{car.matricule}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                    {car.year && <span>{car.year}</span>}
                    <Icon name="chevron_right" size={16} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repairs */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-title-md text-title-md">
            {t('client.detail.repairs', { count: client.repairs.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {client.repairs.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t('client.detail.noRepairs')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('client.detail.vehicle')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('client.detail.description')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">{t('client.detail.mechanic')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('client.detail.status')}</th>
                    <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">{t('client.detail.cost')}</th>
                    <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">{t('client.detail.date')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {client.repairs.map((repair) => (
                    <tr key={repair.id} className="hover:bg-surface-container-low border-t border-outline-variant/50">
                      <td className="px-4 py-3">
                        <span className="font-title-md text-title-md text-primary">
                          {repair.make} {repair.model}
                        </span>
                        <p className="text-xs text-on-surface-variant">{repair.matricule}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate font-body-md text-body-md">
                        {repair.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant font-body-md text-body-md hidden md:table-cell">
                        {repair.mechanicName || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={REPAIR_STATUS_VARIANTS[repair.status] ?? "secondary"}>
                          {t('repair.status.' + repair.status) ?? repair.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-title-md text-title-md hidden lg:table-cell">
                        {repair.totalCost != null ? formatCurrency(repair.totalCost) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant text-sm hidden lg:table-cell">
                        {formatDate(repair.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/repairs/${repair.id}`}>
                            <Icon name="visibility" size={16} />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
