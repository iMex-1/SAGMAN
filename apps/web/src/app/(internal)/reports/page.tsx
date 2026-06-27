"use client";

import { useState } from "react";
import { FileText, Loader2, AlertCircle, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
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

const STATUS_LABELS: Record<string, string> = {
  received: "Reçu",
  diagnosing: "Diagnostic",
  awaiting_approval: "En attente",
  in_progress: "En cours",
  waiting_for_parts: "Att. pièces",
  complete: "Terminé",
  delivered: "Livré",
};

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
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold", colorClass)}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
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
          : "Erreur lors de la génération du rapport.";
      setError(msg);
      toast({ title: "Erreur", description: msg, variant: "error" });
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
        title: "Rapport envoyé",
        description: "Le rapport a été envoyé via WhatsApp.",
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Erreur lors de l'envoi du rapport.";
      toast({ title: "Erreur", description: msg, variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rapport journalier</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {today}
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : reportData ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generating
            ? "Génération…"
            : reportData
              ? "Régénérer le rapport"
              : "Générer le rapport"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!reportData && !generating && !error && (
        <div className="rounded-lg border bg-card p-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            Cliquez sur &quot;Générer le rapport&quot; pour créer le rapport de
            fin de journée.
          </p>
        </div>
      )}

      {/* Loading state */}
      {generating && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Report preview */}
      {reportData && !generating && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Véhicules reçus"
              value={reportData.carsReceived.length}
            />
            <SummaryCard
              label="Véhicules livrés"
              value={reportData.carsDelivered.length}
            />
            <SummaryCard
              label="Chiffre d'affaires"
              value={`${Number(reportData.totalRevenue).toFixed(2)} DH`}
              colorClass="text-emerald-600"
            />
          </div>

          {/* Vehicles received */}
          {reportData.carsReceived.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Véhicules reçus ({reportData.carsReceived.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Véhicule
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.carsReceived.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-semibold">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
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
                <CardTitle className="text-base">
                  Véhicules livrés ({reportData.carsDelivered.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Véhicule
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Recette
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.carsDelivered.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-semibold">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.car.make} {r.car.model}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-emerald-600">
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
                <CardTitle className="text-base">
                  Réparations en cours ({reportData.activeRepairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Véhicule
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Statut
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">
                        Mécanicien
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.activeRepairs.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-semibold">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.car.make} {r.car.model}
                        </td>
                        <td className="px-4 py-2">
                          {STATUS_LABELS[r.status] ?? r.status}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
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
            <Card className="border-red-200 dark:border-red-800/50">
              <CardHeader className="bg-red-50 dark:bg-red-950/30">
                <CardTitle className="text-base text-red-700 dark:text-red-400">
                  ⚠ Réparations en retard ({reportData.overdueRepairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-red-50/50 dark:bg-red-950/10">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Matricule
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Véhicule
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">
                        Raison
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                        Retard
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.overdueRepairs.map((r) => (
                      <tr key={r.id} className="hover:bg-red-50/30">
                        <td className="px-4 py-2 font-semibold">
                          {r.car.matricule}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.car.make} {r.car.model}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                          {r.reason || "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-red-600">
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
            <Card className="border-amber-200 dark:border-amber-800/50">
              <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
                <CardTitle className="text-base text-amber-700 dark:text-amber-400">
                  ⚠ Pièces en rupture de stock (
                  {reportData.lowStockParts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-amber-50/50 dark:bg-amber-950/10">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                        Pièce
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                        Quantité
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                        Seuil min.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.lowStockParts.map((p, i) => (
                      <tr key={i} className="hover:bg-amber-50/30">
                        <td className="px-4 py-2 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-center font-semibold text-amber-600">
                          {p.quantity}
                        </td>
                        <td className="px-4 py-2 text-center text-muted-foreground">
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
            <label className="text-sm font-medium">Notes du responsable</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajoutez vos observations, remarques ou instructions pour le superviseur…"
              rows={5}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {/* Send button */}
          <div className="flex justify-end">
            <Button onClick={handleSend} disabled={sending} size="lg">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending
                ? "Envoi en cours…"
                : "Envoyer au superviseur via WhatsApp"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
