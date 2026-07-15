"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ReportData {
  date: string;
  carsReceived: Array<{
    id: string;
    car: { matricule: string; make: string; model: string };
  }>;
  carsDelivered: Array<{
    id: string;
    car: { matricule: string; make: string; model: string };
    revenue: number;
  }>;
  totalRevenue: number;
  activeRepairs: Array<{
    id: string;
    car: { matricule: string; make: string; model: string };
    status: string;
    mechanic: string;
  }>;
  overdueRepairs: Array<{
    id: string;
    car: { matricule: string; make: string; model: string };
    reason: string;
    daysSinceTarget: number;
  }>;
  lowStockParts: Array<{
    name: string;
    quantity: number;
    minThreshold: number;
  }>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function SummaryCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-4 text-center">
      <p className="font-body-md text-body-md text-on-surface-variant">{label}</p>
      <p className={cn("mt-1 font-headline-lg text-headline-lg", colorClass)}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.get<{ data: ReportData }>("/reports/end-of-day");
      setReportData(res.data);
      setNotes("");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : t('reports.errors.generateFailed');
      setError(msg);
      toast({ title: t('common.error'), description: msg, variant: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!reportData) return;
    setSending(true);
    try {
      const res = await api.post<{ data: { waUrl: string | null } }>(
        "/reports/end-of-day/send",
        { notes, reportData },
      );
      if (res.data.waUrl) {
        window.open(res.data.waUrl, "_blank");
      }
      toast({
        title: t('reports.subtitle'),
        description: t('reports.sendViaWhatsApp'),
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : t('reports.errors.sendFailed');
      toast({ title: t('common.error'), description: msg, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">{t('reports.title')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant capitalize">
            {today}
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Icon name="progress_activity" size={16} className="animate-spin" />
          ) : reportData ? (
            <Icon name="refresh" size={16} />
          ) : (
            <Icon name="description" size={16} />
          )}
          {generating
            ? t('reports.generating')
            : reportData
              ? t('reports.regenerate')
              : t('reports.generate')}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
          <Icon name="error" size={20} className="shrink-0 text-primary" />
          <p className="font-body-md text-body-md text-primary">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!reportData && !generating && !error && (
        <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-16 text-center">
          <Icon name="description" size={48} className="text-on-surface-variant/40" />
          <p className="mt-4 font-body-lg text-body-lg text-on-surface-variant">
            {t('reports.emptyPrompt')}
          </p>
        </div>
      )}

      {/* Loading state */}
      {generating && (
        <div className="flex items-center justify-center py-24">
          <Icon name="progress_activity" size={40} className="animate-spin text-on-surface-variant" />
        </div>
      )}

      {/* Report preview */}
      {reportData && !generating && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label={t('reports.carsReceived')}
              value={reportData.carsReceived.length}
            />
            <SummaryCard
              label={t('reports.carsDelivered')}
              value={reportData.carsDelivered.length}
            />
            <SummaryCard
              label={t('reports.totalRevenue')}
              value={`${Number(reportData.totalRevenue).toFixed(2)} DH`}
              colorClass="text-primary"
            />
          </div>

          {/* Vehicles received */}
          {reportData.carsReceived.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-title-md text-title-md">
                  {t('reports.carsReceived')} ({reportData.carsReceived.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('car.fields.matricule')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('repair.fields.car')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.carsReceived.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-2 font-title-md text-title-md">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant font-body-md text-body-md">
                          {r.car.make} {r.car.model}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Vehicles delivered */}
          {reportData.carsDelivered.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-title-md text-title-md">
                  {t('reports.carsDelivered')} ({reportData.carsDelivered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('car.fields.matricule')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('repair.fields.car')}
                      </th>
                      <th className="px-4 py-2 text-right font-label-sm text-label-sm text-on-surface-variant">
                        {t('reports.totalRevenue')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.carsDelivered.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-2 font-title-md text-title-md">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant font-body-md text-body-md">
                          {r.car.make} {r.car.model}
                        </td>
                        <td className="px-4 py-2 text-right font-title-md text-title-md text-primary">
                          {Number(r.revenue).toFixed(2)} DH
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Active repairs */}
          {reportData.activeRepairs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-title-md text-title-md">
                  {t('dashboard.activeRepairs')} ({reportData.activeRepairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('car.fields.matricule')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('repair.fields.car')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('common.status')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">
                        {t('repair.fields.mechanic')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.activeRepairs.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-2 font-title-md text-title-md">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant font-body-md text-body-md">
                          {r.car.make} {r.car.model}
                        </td>
                        <td className="px-4 py-2 font-body-md text-body-md">
                          {t('repair.status.' + r.status) ?? r.status}
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant font-body-md text-body-md hidden md:table-cell">
                          {r.mechanic}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Overdue repairs */}
          {reportData.overdueRepairs.length > 0 && (
            <Card className="border-outline-variant">
              <CardHeader className="bg-surface-container-low">
                <CardTitle className="font-title-md text-title-md text-primary">
                  <Icon name="warning" size={16} className="inline mr-1" />
                  {t('repair.overdue')} ({reportData.overdueRepairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('car.fields.matricule')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('repair.fields.car')}
                      </th>
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">
                        {t('common.notes')}
                      </th>
                      <th className="px-4 py-2 text-right font-label-sm text-label-sm text-on-surface-variant">
                        {t('common.days')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.overdueRepairs.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low">
                        <td className="px-4 py-2 font-title-md text-title-md">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant font-body-md text-body-md">
                          {r.car.make} {r.car.model}
                        </td>
                        <td className="px-4 py-2 text-on-surface-variant font-body-md text-body-md hidden md:table-cell">
                          {r.reason || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-title-md text-title-md text-primary">
                          +{r.daysSinceTarget}j
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Low stock alerts */}
          {reportData.lowStockParts.length > 0 && (
            <Card className="border-outline-variant">
              <CardHeader className="bg-surface-container-low">
                <CardTitle className="font-title-md text-title-md text-primary">
                  <Icon name="warning" size={16} className="inline mr-1" />
                  {t('stock.outOfStock')} ({reportData.lowStockParts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="px-4 py-2 text-left font-label-sm text-label-sm text-on-surface-variant">
                        {t('stock.fields.name')}
                      </th>
                      <th className="px-4 py-2 text-center font-label-sm text-label-sm text-on-surface-variant">
                        {t('stock.fields.quantity')}
                      </th>
                      <th className="px-4 py-2 text-center font-label-sm text-label-sm text-on-surface-variant">
                        {t('stock.fields.minThreshold')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.lowStockParts.map((p, i) => (
                      <tr key={i} className="hover:bg-surface-container-low">
                        <td className="px-4 py-2 font-title-md text-title-md">{p.name}</td>
                        <td className="px-4 py-2 text-center font-title-md text-title-md text-primary">
                          {p.quantity}
                        </td>
                        <td className="px-4 py-2 text-center text-on-surface-variant font-body-md text-body-md">
                          {p.minThreshold}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Manager notes */}
          <div className="space-y-2">
            <label className="font-title-md text-title-md">{t('reports.managerNotes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('reports.notesPlaceholder')}
              rows={5}
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 font-body-md text-body-md shadow-sm placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {/* Send button */}
          <div className="flex justify-end">
            <Button onClick={handleSend} disabled={sending} size="lg">
              {sending ? (
                <Icon name="progress_activity" size={16} className="animate-spin" />
              ) : (
                <Icon name="send" size={16} />
              )}
              {sending
                ? t('common.sending')
                : t('reports.sendViaWhatsApp')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
