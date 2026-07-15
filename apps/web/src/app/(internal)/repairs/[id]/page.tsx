"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { StatusBadge } from "@/components/repairs/StatusBadge";
import { PriorityBadge } from "@/components/repairs/PriorityBadge";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface RepairDetail {
  id: string;
  status: string;
  priority: string;
  description: string;
  internalNotes?: string;
  isOverdue: boolean;
  hasDelayReport: boolean;
  diagnosisReport?: {
    issues: Array<{
      description: string;
      severity: "Minor" | "Moderate" | "Critical";
    }>;
    recommendedRepairs?: string;
    estimatedDurationHours?: number;
    additionalNotes?: string;
  };
  diagnosisShared: boolean;
  clientApprovalStatus: string;
  clientApprovalBypassReason?: string;
  estimatedDurationHours?: number;
  estimatedCost?: number;
  partsTotal: number;
  laborTotal: number;
  discountAmount: number;
  finalTotal: number;
  targetCompletionDate?: string;
  actualCompletionDate?: string;
  reopenedReason?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  car: {
    id: string;
    matricule: string;
    make: string;
    model: string;
    year?: number;
    color?: string;
    client?: { id: string; name: string; phone: string };
  };
  appointment?: { id: string; status: string; purpose: string; carImageUrl?: string };
  createdBy: { id: string; name: string };
  primaryMechanic: { id: string; name: string; specialty?: string };
  mechanics: Array<{
    mechanicId: string;
    isPrimary: boolean;
    mechanic: { id: string; name: string; specialty?: string };
  }>;
  statusLogs: Array<{
    id: string;
    fromStatus?: string;
    toStatus: string;
    note?: string;
    createdAt: string;
    changedBy: { name: string };
  }>;
  workLogs: Array<{
    id: string;
    description: string;
    hoursSpent: number;
    loggedAt: string;
    mechanic: { name: string };
  }>;
  delayReports: Array<{
    id: string;
    reason: string;
    evidenceNote?: string;
    createdAt: string;
    reportedBy: { name: string };
  }>;
  parts: Array<{
    id: string;
    quantityUsed: number;
    unitCostAtTime: number;
    stockOverride: boolean;
    addedAt: string;
    part: { id: string; name: string; reference?: string; category: string };
  }>;
  laborItems: Array<{
    id: string;
    description: string;
    cost: number;
    addedAt: string;
  }>;
  payment?: {
    id: string;
    amountBilled: number;
    amountReceived: number;
    changeDue: number;
    invoiceNumber: string;
    paymentType: string;
    checkImageUrl?: string;
    paidByName?: string;
    createdAt: string;
  };
  photos: Array<{
    id: string;
    type: string;
    filePath: string;
    createdAt: string;
    uploadedBy: { name: string };
  }>;
}

interface PartItem {
  id: string;
  name: string;
  reference?: string;
  category: string;
  unitCost: number;
  quantity: number;
}

interface MechanicEmployee {
  id: string;
  name: string;
  specialty?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value: number) {
  const n = Number(value);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

const SEVERITY_STYLES: Record<string, string> = {
  Minor: "bg-green-100 text-green-700",
  Moderate: "bg-amber-100 text-amber-700",
  Critical: "bg-red-100 text-red-700",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── RepairHeader ──────────────────────────────────────────────────────────────

function RepairHeader({
  repair,
  onRefresh,
}: {
  repair: RepairDetail;
  onRefresh: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Reopen dialog
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Complete dialog (set final price)
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeFinalPrice, setCompleteFinalPrice] = useState("");

  // Deliver dialog (just a confirm — checks payment)
  const [deliverOpen, setDeliverOpen] = useState(false);

  // Time estimation dialog (before moving to in_progress)
  const [timeEstOpen, setTimeEstOpen] = useState(false);
  const [estHours, setEstHours] = useState("");
  const [targetDate, setTargetDate] = useState("");

  async function changeStatus(
    status: string,
    extra?: {
      note?: string;
      cancellationReason?: string;
      reopenedReason?: string;
      finalTotal?: number;
    },
  ) {
    setBusy(true);
    try {
      await api.patch(`/repairs/${repair.id}/status`, { status, ...extra });
      toast({
        title: `${t('common.status')} ${t('repair.updatedTo')} "${t(`repair.status.${status}`)}"`,
      });
      onRefresh();
    } catch (err) {
      toast({
        title: t('common.error'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    await changeStatus("cancelled", {
      cancellationReason: cancelReason.trim(),
    });
    setCancelOpen(false);
    setCancelReason("");
  }

  async function handleReopen() {
    if (!reopenReason.trim()) return;
    await changeStatus("in_progress", { reopenedReason: reopenReason.trim() });
    setReopenOpen(false);
    setReopenReason("");
  }

  async function handleStartRepair() {
    setBusy(true);
    try {
      // Save time estimation first
      if (estHours || targetDate) {
        await api.patch(`/repairs/${repair.id}`, {
          estimatedDurationHours: estHours ? Number(estHours) : undefined,
          targetCompletionDate: targetDate || undefined,
        });
      }
      // Transition to in_progress
      await api.patch(`/repairs/${repair.id}/status`, { status: "in_progress" });
      toast({ title: `${t('common.status')} ${t('repair.updatedTo')} "${t('repair.status.in_progress')}"` });
      setTimeEstOpen(false);
      setEstHours("");
      setTargetDate("");
      onRefresh();

      // Notify client via WhatsApp
      const client = repair.car.client;
      if (client?.phone) {
        const phone = client.phone.replace(/[^0-9]/g, "");
        const durationText = estHours ? `${estHours}h` : "";
        const dateText = targetDate
          ? new Date(targetDate).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";
        let msg = t('repair.smsTemplates.inRepair', { name: client.name, matricule: repair.car.matricule });
        if (durationText || dateText) {
          msg += ` ${t('repair.smsTemplates.estimatedDuration')} ${durationText}${durationText && dateText ? " — " : ""}${dateText ? `${t('repair.smsTemplates.targetDate')} ${dateText}` : ""}.`;
        }
        msg += " Cordialement, Sagman Garage.";
        window.open(
          `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
          "_blank",
        );
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    const price = completeFinalPrice ? Number(completeFinalPrice) : undefined;
    await changeStatus("complete", price != null ? { finalTotal: price } : undefined);
    setCompleteOpen(false);
    setCompleteFinalPrice("");
  }

  async function handleDeliver() {
    await changeStatus("delivered");
    setDeliverOpen(false);
  }

  const isTerminal = ["delivered", "cancelled"].includes(repair.status);
  const hasPayment = !!repair.payment;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/repairs">
            <Icon name="arrow_back" size={16} />
            {t('nav.repairs')}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {repair.car.matricule}{" "}
            <span className="font-normal text-muted-foreground">
              — {repair.car.make} {repair.car.model}
            </span>
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={repair.status} />
            <PriorityBadge priority={repair.priority} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {!isTerminal && (
        <div className="flex flex-wrap items-center gap-2">
          {repair.status === "received" && (
            <>
              <Button
                size="sm"
                onClick={() => changeStatus("diagnosing")}
                disabled={busy}
                isLoading={busy}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('repair.actions.startDiagnosis')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('common.cancel')}
              </Button>
            </>
          )}

          {(repair.status === "diagnosing" || repair.status === "awaiting_approval") && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setEstHours(repair.estimatedDurationHours?.toString() ?? "");
                  setTargetDate(repair.targetCompletionDate?.slice(0, 10) ?? "");
                  setTimeEstOpen(true);
                }}
                disabled={busy}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('repair.actions.startRepair')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('common.cancel')}
              </Button>
            </>
          )}

          {repair.status === "in_progress" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => changeStatus("waiting_for_parts")}
                disabled={busy}
                isLoading={busy}
                className="border border-outline-variant text-on-surface-variant"
              >
                {t('repair.actions.waitingForParts')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setCompleteFinalPrice(repair.finalTotal?.toString() ?? "");
                  setCompleteOpen(true);
                }}
                disabled={busy}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('repair.actions.markComplete')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('common.cancel')}
              </Button>
            </>
          )}

          {repair.status === "waiting_for_parts" && (
            <>
              <Button
                size="sm"
                onClick={() => changeStatus("in_progress")}
                disabled={busy}
                isLoading={busy}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('repair.actions.resume')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('common.cancel')}
              </Button>
            </>
          )}

          {repair.status === "complete" && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  if (!hasPayment) {
                    toast({
                      title: t('common.error'),
                      description: t('repair.noPaymentWarning'),
                      variant: "error",
                    });
                    return;
                  }
                  setDeliverOpen(true);
                }}
                disabled={busy}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {t('repair.actions.markDelivered')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReopenOpen(true)}
                disabled={busy}
                className="border border-outline-variant text-on-surface-variant"
              >
                {t('repair.actions.reopen')}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.dialogs.cancel.title')}</DialogTitle>
            <DialogDescription>
              {t('repair.dialogs.cancel.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('repair.dialogs.cancel.reasonLabel')}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder={t('repair.dialogs.cancel.reasonPlaceholder')}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.back')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || busy}
              isLoading={busy}
              className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.dialogs.reopen.title')}</DialogTitle>
            <DialogDescription>
              {t('repair.dialogs.reopen.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('repair.dialogs.reopen.reasonLabel')}</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder={t('repair.dialogs.reopen.reasonPlaceholder')}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.back')}</Button>
            </DialogClose>
            <Button
              onClick={handleReopen}
              disabled={!reopenReason.trim() || busy}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('repair.actions.reopen')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Estimation Dialog (before moving to in_progress) */}
      <Dialog open={timeEstOpen} onOpenChange={setTimeEstOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.dialogs.timeEstimation.title')}</DialogTitle>
            <DialogDescription>
              {t('repair.dialogs.timeEstimation.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="est-hours">{t('repair.dialogs.timeEstimation.duration')}</Label>
              <Input
                id="est-hours"
                type="number"
                min="0"
                step="0.5"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                placeholder={t('repair.dialogs.timeEstimation.durationPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-date">{t('repair.dialogs.timeEstimation.targetDate')}</Label>
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            {repair.car.client?.phone && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-primary">
                <Icon name="info" size={14} className="mr-1 inline" />
                {t('repair.dialogs.timeEstimation.whatsappHint')}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button onClick={handleStartRepair} disabled={busy} isLoading={busy} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
              {t('repair.actions.sendToClient')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog (set final price) */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.dialogs.complete.title')}</DialogTitle>
            <DialogDescription>
              {t('repair.dialogs.complete.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-surface-container-low p-4">
              <p className="font-body-md text-body-md text-on-surface-variant mb-1">{t('repair.dialogs.complete.currentPrice')}</p>
              <p className="font-headline-lg text-headline-lg text-primary">
                {money(repair.finalTotal)} DH
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="final-price">{t('repair.dialogs.complete.finalPrice')}</Label>
              <Input
                id="final-price"
                type="number"
                min="0"
                step="0.01"
                value={completeFinalPrice}
                onChange={(e) => setCompleteFinalPrice(e.target.value)}
                placeholder={money(repair.finalTotal).toString()}
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {t('repair.dialogs.complete.hint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button onClick={handleComplete} disabled={busy} isLoading={busy} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver Confirm Dialog */}
      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.dialogs.deliver.title')}</DialogTitle>
            <DialogDescription>
              {t('repair.dialogs.deliver.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.back')}</Button>
            </DialogClose>
            <Button onClick={handleDeliver} disabled={busy} isLoading={busy} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
              {t('repair.actions.confirmDelivery')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── OverdueBanner ─────────────────────────────────────────────────────────────

function OverdueBanner({
  repairId,
  onReported,
}: {
  repairId: string;
  onReported: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/repairs/${repairId}/delay-report`, {
        reason: reason.trim(),
        evidenceNote: evidenceNote.trim() || undefined,
      });
      toast({ title: t('repair.delay.submitted') });
      setOpen(false);
      setReason("");
      setEvidenceNote("");
      onReported();
    } catch (err) {
      toast({
        title: t('repair.delay.failed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        <Icon name="info" size={20} className="shrink-0" />
        <span className="text-sm font-medium">
          ⚠️ {t('repair.overdueWarning')}
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="ml-auto shrink-0"
          onClick={() => setOpen(true)}
        >
          {t('repair.actions.fileDelayReport')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.actions.fileDelayReport')}</DialogTitle>
            <DialogDescription>
              {t('repair.delay.documentReason')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('repair.delay.reasonLabel')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={3}
                placeholder={t('repair.delay.reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('repair.delay.evidenceLabel')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder={t('repair.delay.evidencePlaceholder')}
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!reason.trim() || busy}
              isLoading={busy}
            >
              {t('repair.delay.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── RepairInfoCard ────────────────────────────────────────────────────────────

function RepairInfoCard({ repair }: { repair: RepairDetail }) {
  const t = useTranslations();
  const isOverdue = repair.isOverdue;

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
          <Icon name="description" size={16} />
          {t('repair.info.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('repair.info.description')}
          </p>
          <p className="mt-1">{repair.description}</p>
        </div>

        {repair.internalNotes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('repair.info.internalNotes')}
            </p>
            <p className="mt-1 text-muted-foreground">{repair.internalNotes}</p>
          </div>
        )}

        {repair.cancellationReason && (
          <div>
            <p className="text-xs font-medium text-red-500 uppercase tracking-wide">
              {t('repair.info.cancellationReason')}
            </p>
            <p className="mt-1 text-red-600">{repair.cancellationReason}</p>
          </div>
        )}

        {repair.reopenedReason && (
          <div>
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">
              {t('repair.info.reopenedReason')}
            </p>
            <p className="mt-1 text-amber-600">{repair.reopenedReason}</p>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t('repair.info.createdBy')}</p>
            <p className="font-medium">{repair.createdBy?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('repair.info.createdAt')}</p>
            <p className="font-medium">{formatDate(repair.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('repair.fields.targetDate')}</p>
            <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
              {formatDate(repair.targetCompletionDate)}
              {isOverdue && " 🔴"}
            </p>
          </div>
          {repair.actualCompletionDate && (
            <div>
              <p className="text-xs text-muted-foreground">{t('repair.info.completedAt')}</p>
              <p className="font-medium">
                {formatDate(repair.actualCompletionDate)}
              </p>
            </div>
          )}
          {repair.estimatedDurationHours && (
            <div>
              <p className="text-xs text-muted-foreground">{t('repair.fields.estimatedHours')}</p>
              <p className="font-medium">{repair.estimatedDurationHours}h</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── CarClientCard ─────────────────────────────────────────────────────────────

function CarClientCard({ repair }: { repair: RepairDetail }) {
  const t = useTranslations();
  const { car } = repair;
  const client = car.client;
  const [carImageError, setCarImageError] = useState(false);
  const carImageUrl = repair.appointment?.carImageUrl;

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
          <Icon name="directions_car" size={16} />
          {t('repair.vehicle.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {carImageUrl && !carImageError && (
          <img
            src={carImageUrl}
            alt={`${car.make} ${car.model}`}
            className="w-full h-40 object-cover rounded-lg border"
            onError={() => setCarImageError(true)}
          />
        )}
          <Link
            href={`/cars/${car.id}`}
            className="font-semibold text-primary hover:underline text-base"
          >
            {car.matricule}
          </Link>
          <p className="text-muted-foreground">
            {car.make} {car.model}
            {car.year ? ` — ${car.year}` : ""}
          </p>
          {car.color && (
            <p className="text-muted-foreground capitalize">
              {t('repair.vehicle.color')} : {car.color}
            </p>
          )}

        {client ? (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon name="person" size={16} className="text-muted-foreground" />
                <span className="font-medium">{client.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="phone" size={16} className="text-muted-foreground" />
                <span className="text-muted-foreground">{client.phone}</span>
                <a
                  href={`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(t('repair.whatsapp', { matricule: car.matricule, make: car.make, model: car.model }))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700 hover:bg-green-100"
                >
                  <Icon name="chat" size={12} />
                  WhatsApp
                </a>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('repair.vehicle.noClient')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── MechanicsCard ─────────────────────────────────────────────────────────────

function MechanicsCard({
  repair,
  onUpdate,
}: {
  repair: RepairDetail;
  onUpdate: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<MechanicEmployee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState(repair.primaryMechanic?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  function openDialog() {
    setSelected(repair.mechanics.map((m) => m.mechanicId));
    setPrimaryId(repair.primaryMechanic?.id ?? "");
    setOpen(true);
    setLoading(true);
    api
      .get<{ data: MechanicEmployee[] }>(
        "/employees?role=mechanic&status=active",
      )
      .then((res) => setAvailable(res.data))
      .catch(() => setAvailable([]))
      .finally(() => setLoading(false));
  }

  function toggleMechanic(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    if (selected.length === 0) {
      toast({ title: t('common.error'), variant: "error" });
      return;
    }
    if (!selected.includes(primaryId)) {
      toast({ title: t('common.error'), variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const secondaryMechanicIds = selected.filter((id) => id !== primaryId);
      await api.patch(`/repairs/${repair.id}/assign`, {
        primaryMechanicId: primaryId,
        secondaryMechanicIds,
      });
      toast({ title: t('common.save') });
      setOpen(false);
      onUpdate();
    } catch (err) {
      toast({
        title: t('common.error'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
            <Icon name="build" size={16} />
            {t('repair.mechanics')}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openDialog} className="border-primary text-primary hover:bg-primary/10">
            {t('repair.reassign')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {repair.mechanics.length === 0 ? (
          <p className="text-muted-foreground">            {t('repair.noMechanics')}</p>
        ) : (
          repair.mechanics.map((m) => (
            <div key={m.mechanicId} className="flex items-center gap-2">
              <Icon name="person" size={16} className="text-muted-foreground shrink-0" />
              <span className="font-medium">{m.mechanic.name}</span>
              {m.mechanic.specialty && (
                <span className="text-xs text-muted-foreground">
                  — {m.mechanic.specialty}
                </span>
              )}
              {m.isPrimary && (
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {t('repair.primary')}
                </span>
              )}
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('repair.reassignDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('repair.reassignDialog.description')}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-6">
              <Icon name="sync" size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {available.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(emp.id)}
                      onChange={() => toggleMechanic(emp.id)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{emp.name}</span>
                    {emp.specialty && (
                      <span className="text-xs text-muted-foreground">
                        — {emp.specialty}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {selected.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('repair.reassignDialog.selectPrimary')}</Label>
                  <Select value={primaryId} onValueChange={setPrimaryId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('repair.reassignDialog.selectPrimaryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {available
                        .filter((e) => selected.includes(e.id))
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={busy || loading}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── DiagnosisPanel ────────────────────────────────────────────────────────────

type DiagnosisIssue = {
  description: string;
  severity: "Minor" | "Moderate" | "Critical";
};

function DiagnosisPanel({
  repair,
  onUpdate,
}: {
  repair: RepairDetail;
  onUpdate: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state
  const [issues, setIssues] = useState<DiagnosisIssue[]>([
    { description: "", severity: "Minor" },
  ]);
  const [recommendedRepairs, setRecommendedRepairs] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");



  function openForm() {
    const existing = repair.diagnosisReport;
    if (existing) {
      setIssues(
        existing.issues.length > 0
          ? [...existing.issues]
          : [{ description: "", severity: "Minor" }],
      );
      setRecommendedRepairs(existing.recommendedRepairs ?? "");
      setAdditionalNotes(existing.additionalNotes ?? "");
      setEstimatedHours(existing.estimatedDurationHours?.toString() ?? "");
    } else {
      setIssues([{ description: "", severity: "Minor" }]);
      setRecommendedRepairs("");
      setAdditionalNotes("");
      setEstimatedHours("");
    }
    setFormOpen(true);
  }

  function addIssue() {
    setIssues((prev) => [...prev, { description: "", severity: "Minor" }]);
  }

  function removeIssue(idx: number) {
    setIssues((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateIssue(
    idx: number,
    field: keyof DiagnosisIssue,
    value: string,
  ) {
    setIssues((prev) =>
      prev.map((issue, i) =>
        i === idx ? { ...issue, [field]: value } : issue,
      ),
    );
  }

  async function handleSubmitDiagnosis() {
    const validIssues = issues.filter((i) => i.description.trim());
    if (validIssues.length === 0) {
      toast({ title: t('common.error'), variant: "error" });
      return;
    }
    setBusy(true);
    try {
      await api.post(`/repairs/${repair.id}/diagnosis`, {
        issues: validIssues,
        recommendedRepairs: recommendedRepairs.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
        estimatedDurationHours: estimatedHours
          ? Number(estimatedHours)
          : undefined,
      });
      toast({ title: t('repair.diagnosisSections.saved') });
      setFormOpen(false);
      onUpdate();
    } catch (err) {
      toast({
        title: t('repair.diagnosisSections.saveFailed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }



  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
            <Icon name="search" size={16} />
            {t('repair.fields.diagnosis')}
            {repair.diagnosisShared && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                {t('repair.diagnosisSections.shared')}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={openForm} className="border border-outline-variant text-on-surface-variant">
                {repair.diagnosisReport ? t('repair.diagnosisSections.editDiagnosis') : t('repair.diagnosisSections.fillDiagnosis')}
              </Button>
            )}

          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!repair.diagnosisReport ? (
          <p className="text-muted-foreground">{t('repair.diagnosisSections.noDiagnosis')}</p>
        ) : (
          <>
            {/* Issues */}
            <div className="space-y-2">
              <p className="font-medium">{t('repair.diagnosisSections.issues')}</p>
              {repair.diagnosisReport.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border p-2"
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity] ?? ""}`}
                  >
                    {t(`repair.diagnosisSections.severity.${issue.severity}`)}
                  </span>
                  <span>{issue.description}</span>
                </div>
              ))}
            </div>

            {repair.diagnosisReport.recommendedRepairs && (
              <div>
                <p className="font-medium">{t('repair.diagnosisSections.recommendations')}</p>
                <p className="mt-1 text-muted-foreground">
                  {repair.diagnosisReport.recommendedRepairs}
                </p>
              </div>
            )}

            {repair.diagnosisReport.estimatedDurationHours && (
              <p className="text-muted-foreground">
                {t('repair.diagnosisSections.estimated')}{" "}
                <span className="font-medium text-foreground">
                  {repair.diagnosisReport.estimatedDurationHours}h
                </span>
              </p>
            )}

            {repair.diagnosisReport.additionalNotes && (
              <div>
                <p className="font-medium">{t('repair.diagnosisSections.additionalNotes')}</p>
                <p className="mt-1 text-muted-foreground">
                  {repair.diagnosisReport.additionalNotes}
                </p>
              </div>
            )}
          </>
        )}


      </CardContent>

      {/* Diagnosis Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {repair.diagnosisReport ? t('repair.diagnosisSections.editDiagnosis') : t('repair.diagnosisSections.fillDiagnosis')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('repair.diagnosisSections.issues')} *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addIssue}
                  className="border border-outline-variant text-on-surface-variant"
                >
                  <Icon name="add" size={12} />
                  {t('repair.diagnosisSections.addIssue')}
                </Button>
              </div>
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border p-3"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder={t('repair.diagnosisSections.issuesPlaceholder')}
                      value={issue.description}
                      onChange={(e) =>
                        updateIssue(idx, "description", e.target.value)
                      }
                    />
                    <Select
                      value={issue.severity}
                      onValueChange={(v) => updateIssue(idx, "severity", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Minor">{t('repair.diagnosisSections.severity.Minor')}</SelectItem>
                        <SelectItem value="Moderate">{t('repair.diagnosisSections.severity.Moderate')}</SelectItem>
                        <SelectItem value="Critical">{t('repair.diagnosisSections.severity.Critical')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {issues.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeIssue(idx)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Icon name="delete" size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>{t('repair.diagnosisSections.recommendations')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder={t('repair.diagnosisSections.recommendationsPlaceholder')}
                value={recommendedRepairs}
                onChange={(e) => setRecommendedRepairs(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('repair.diagnosisSections.estimatedDuration')}</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder={t('common.example') + " 6"}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('repair.diagnosisSections.additionalNotes')}</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder={t('repair.diagnosisSections.additionalNotesPlaceholder')}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={handleSubmitDiagnosis}
              disabled={busy}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('repair.diagnosisSections.saveDiagnosis')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </Card>
  );
}

// ── PartsPanel ────────────────────────────────────────────────────────────────

function PartsPanel({
  repair,
  onUpdate,
}: {
  repair: RepairDetail;
  onUpdate: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [partQuery, setPartQuery] = useState("");
  const [partResults, setPartResults] = useState<PartItem[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [stockOverride, setStockOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function searchParts(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setPartResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setPartsLoading(true);
      setPartsError(false);
      try {
        const res = await api.get<{ data: PartItem[] }>(
          `/parts?q=${encodeURIComponent(q)}&limit=10`,
        );
        setPartResults(res.data);
      } catch {
        setPartsError(true);
        setPartResults([]);
      } finally {
        setPartsLoading(false);
      }
    }, 300);
  }

  async function handleAddPart() {
    if (!selectedPart) return;
    setBusy(true);
    try {
      await api.post(`/repairs/${repair.id}/parts`, {
        partId: selectedPart.id,
        quantityUsed: Number(quantity),
        stockOverride,
      });
      toast({ title: t('repair.parts.added') });
      setAddOpen(false);
      setSelectedPart(null);
      setPartQuery("");
      setPartResults([]);
      setQuantity("1");
      setStockOverride(false);
      onUpdate();
    } catch (err) {
      toast({
        title: t('repair.parts.addFailed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemovePart(partId: string) {
    setRemoveId(partId);
    try {
      await api.delete(`/repairs/${repair.id}/parts/${partId}`);
      toast({ title: t('repair.parts.removed') });
      onUpdate();
    } catch (err) {
      toast({
        title: t('repair.parts.removeFailed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setRemoveId(null);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
            <Icon name="package" size={16} />
            {t('repair.parts.title')}
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
              className="border border-outline-variant text-on-surface-variant"
            >
              <Icon name="add" size={16} />
              {t('repair.parts.addPart')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.parts.length === 0 ? (
          <p className="text-muted-foreground">{t('repair.parts.noPartsYet')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">{t('repair.parts.part')}</th>
                <th className="pb-2 font-medium">{t('repair.parts.category')}</th>
                <th className="pb-2 font-medium text-right">{t('repair.parts.quantity')}</th>
                <th className="pb-2 font-medium text-right">{t('repair.parts.unitCost')}</th>
                <th className="pb-2 font-medium text-right">{t('repair.parts.subtotal')}</th>
                {canEdit && <th className="pb-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {repair.parts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 font-medium">
                    {p.part.name}
                    {p.part.reference && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({p.part.reference})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground capitalize">
                    {p.part.category}
                  </td>
                  <td className="py-2 text-right">{p.quantityUsed}</td>
                  <td className="py-2 text-right">{money(p.unitCostAtTime)}</td>
                  <td className="py-2 text-right font-medium">
                    {money(p.quantityUsed * p.unitCostAtTime)}
                  </td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemovePart(p.id)}
                        disabled={removeId === p.id}
                      >
                        {removeId === p.id ? (
                          <Icon name="sync" size={12} className="animate-spin" />
                        ) : (
                          <Icon name="delete" size={12} />
                        )}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td
                  colSpan={canEdit ? 4 : 3}
                  className="pt-2 text-right text-muted-foreground"
                >
                  {t('repair.costs.partsTotal')} :
                </td>
                <td className="pt-2 text-right">{money(repair.partsTotal)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        )}
      </CardContent>

      {/* Add Part Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('repair.parts.addPart')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Part search */}
            <div className="space-y-2">
              <Label>{t('repair.parts.searchParts')}</Label>
              <div className="relative">
                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('repair.parts.searchPlaceholder')}
                  value={partQuery}
                  onChange={(e) => {
                    setPartQuery(e.target.value);
                    setSelectedPart(null);
                    searchParts(e.target.value);
                  }}
                  className="pl-9"
                />
              </div>

              {partsError && (
                <p className="text-xs text-muted-foreground">
                  {t('repair.parts.moduleComingSoon')}
                </p>
              )}

              {partsLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
<Icon name="sync" size={12} className="animate-spin" /> 
                  {t('common.loading')}
                </div>
              )}

              {partResults.length > 0 && !selectedPart && (
                <div className="rounded-md border divide-y">
                  {partResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setSelectedPart(p);
                        setPartQuery(p.name);
                        setPartResults([]);
                      }}
                    >
                      <div className="flex-1">
                        <span className="font-medium">{p.name}</span>
                        {p.reference && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({p.reference})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {p.category}
                      </span>
                      <span className="text-xs font-medium">
                        {money(p.unitCost)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedPart && (
                <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <span className="font-medium text-green-700">
                    {selectedPart.name}
                  </span>
                  <span className="text-green-600">
                    {money(selectedPart.unitCost)} {t('repair.parts.unitLabel')}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('repair.parts.quantityLabel')}</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stockOverride}
                onChange={(e) => setStockOverride(e.target.checked)}
                className="h-4 w-4"
              />
              {t('repair.parts.stockOverride')}
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={handleAddPart}
              disabled={!selectedPart || !quantity || busy}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('repair.parts.addPart')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── LaborPanel ────────────────────────────────────────────────────────────────

function LaborPanel({
  repair,
  onUpdate,
}: {
  repair: RepairDetail;
  onUpdate: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  async function handleAdd() {
    if (!description.trim() || !cost) return;
    setBusy(true);
    try {
      await api.post(`/repairs/${repair.id}/labor`, {
        description: description.trim(),
        cost: Number(cost),
      });
      toast({ title: t('repair.labor.added') });
      setAddOpen(false);
      setDescription("");
      setCost("");
      onUpdate();
    } catch (err) {
      toast({
        title: t('repair.labor.addFailed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoveId(id);
    try {
      await api.delete(`/repairs/${repair.id}/labor/${id}`);
      toast({ title: t('repair.labor.removed') });
      onUpdate();
    } catch (err) {
      toast({
        title: t('repair.labor.removeFailed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setRemoveId(null);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
            <Icon name="attach_money" size={16} />
            {t('repair.labor.title')}
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="add" size={16} />
              {t('repair.labor.addItem')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.laborItems.length === 0 ? (
          <p className="text-muted-foreground">{t('repair.labor.noLaborYet')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">{t('repair.labor.description')}</th>
                <th className="pb-2 font-medium text-right">{t('repair.labor.cost')}</th>
                {canEdit && <th className="pb-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {repair.laborItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right font-medium">
                    {money(item.cost)}
                  </td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(item.id)}
                        disabled={removeId === item.id}
                      >
                        {removeId === item.id ? (
                          <Icon name="sync" size={12} className="animate-spin" />
                        ) : (
                          <Icon name="delete" size={12} />
                        )}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="pt-2 text-right text-muted-foreground">
                  {t('repair.costs.laborTotal')} :
                </td>
                <td className="pt-2 text-right">{money(repair.laborTotal)}</td>
                {canEdit && <td />}
              </tr>
            </tfoot>
          </table>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.labor.addItem')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('repair.labor.description')} *</Label>
              <Input
                placeholder={t('repair.labor.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('repair.labor.costLabel')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={handleAdd}
              disabled={!description.trim() || !cost || busy}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── WorkLogsPanel ─────────────────────────────────────────────────────────────

function WorkLogsPanel({
  repair,
  onUpdate,
}: {
  repair: RepairDetail;
  onUpdate: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!description.trim() || !hours) return;
    setBusy(true);
    try {
      await api.post(`/repairs/${repair.id}/work-logs`, {
        description: description.trim(),
        hoursSpent: Number(hours),
      });
      toast({ title: t('repair.workLog.added') });
      setAddOpen(false);
      setDescription("");
      setHours("");
      onUpdate();
    } catch (err) {
      toast({
        title: t('repair.workLog.failed'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
            <Icon name="schedule" size={16} />
            {t('repair.workLog.title')}
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="add" size={16} />
              {t('repair.workLog.addEntry')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.workLogs.length === 0 ? (
          <p className="text-muted-foreground">{t('repair.noWorkLogs')}</p>
        ) : (
          <div className="space-y-3">
            {repair.workLogs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="pb-3 flex-1">
                  <p className="font-medium">{log.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Icon name="schedule" size={12} />
                      {log.hoursSpent}h
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="person" size={12} />
                      {log.mechanic.name}
                    </span>
                    <span>{formatDateTime(log.loggedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.workLog.addEntry')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('repair.workLog.description')} *</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={3}
                placeholder={t('repair.workLog.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('repair.workLog.hours')}</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder={t('repair.workLog.hoursPlaceholder')}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={handleAdd}
              disabled={!description.trim() || !hours || busy}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('repair.workLog.addEntry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── PaymentPanel ──────────────────────────────────────────────────────────────

function PaymentPanel({
  repair,
  onUpdate,
}: {
  repair: RepairDetail;
  onUpdate: () => void;
}) {
  const t = useTranslations();
  const { toast } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [amountBilled, setAmountBilled] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [checkFile, setCheckFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const PAYMENT_TYPE_OPTIONS = [
    { value: "cash", label: t('repair.payment.cash') },
    { value: "check", label: t('repair.payment.check') },
    { value: "card", label: t('repair.payment.card') },
    { value: "transfer", label: t('repair.payment.transfer') },
  ];

  const PAYMENT_TYPE_LABELS: Record<string, string> = {
    cash: t('repair.payment.cash'),
    check: t('repair.payment.check'),
    card: t('repair.payment.card'),
    transfer: t('repair.payment.transfer'),
  };

  function openPayment() {
    setAmountBilled(String(repair.finalTotal));
    setAmountReceived("");
    setPaidByName("");
    setPayNotes("");
    setPaymentType("cash");
    setCheckFile(null);
    setPayOpen(true);
  }

  const changeDue =
    amountReceived && amountBilled
      ? Math.max(0, Number(amountReceived) - Number(amountBilled))
      : 0;

  async function handlePayment() {
    setBusy(true);
    try {
      let checkImageUrl: string | undefined;

      if (paymentType === "check") {
        if (!checkFile) {
          toast({
            title: t('repair.payment.checkImageRequired'),
            description: t('repair.payment.checkImageHint'),
            variant: "error",
          });
          setBusy(false);
          return;
        }
        const base64 = btoa(
          String.fromCharCode(...new Uint8Array(await checkFile.arrayBuffer()))
        );
        const uploadRes = await api.post<{ data: { url: string } }>(
          "/payments/check-upload",
          { image: base64, mimeType: checkFile.type },
        );
        checkImageUrl = uploadRes.data.url;
      }

      await api.post<{ data: { invoiceNumber: string } }>(
        "/payments",
        {
          repairId: repair.id,
          amountBilled: Number(amountBilled),
          amountReceived: Number(amountReceived),
          discountAmount: 0,
          paymentType,
          checkImageUrl,
          paidByName: paidByName.trim() || undefined,
          notes: payNotes.trim() || undefined,
        },
      );
      toast({ title: t('common.success') });
      setPayOpen(false);
      onUpdate();
    } catch (err) {
      toast({
        title: t('common.error'),
        description:
          err instanceof ApiError ? err.message : t('common.error'),
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (repair.status !== "complete" && repair.status !== "delivered") {
    return null; // Only show when repair is complete or delivered
  }

  if (repair.payment) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-green-700">
            <Icon name="check_circle" size={16} />
            {t('repair.payment.received')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-green-700">{t('repair.payment.amountBilled')}</span>
            <span className="font-medium text-green-700">
              {money(repair.payment.amountBilled)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">{t('repair.payment.amountReceived')}</span>
            <span className="font-medium text-green-700">
              {money(repair.payment.amountReceived)}
            </span>
          </div>
          <div className="flex justify-between border-t border-green-200 pt-2">
            <span className="text-green-700">{t('repair.payment.changeDue')}</span>
            <span className="font-bold text-green-700">
              {money(repair.payment.changeDue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">{t('repair.payment.method')}</span>
            <span className="font-medium text-green-700">
              {PAYMENT_TYPE_LABELS[repair.payment.paymentType] ?? repair.payment.paymentType}
            </span>
          </div>
          {repair.payment.checkImageUrl && (
            <div>
              <p className="text-xs text-green-600 mb-1">{t('repair.payment.checkImage')}</p>
              <a
                href={repair.payment.checkImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-green-200 overflow-hidden"
              >
                <img
                  src={repair.payment.checkImageUrl}
                  alt={t('repair.payment.check')}
                  className="w-full h-32 object-cover"
                />
              </a>
            </div>
          )}
          {repair.payment.paidByName && (
            <p className="text-xs text-green-600 pt-2 italic">
              {t('repair.payment.paidBy')} : {repair.payment.paidByName}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full mt-4 border border-outline-variant text-on-surface-variant"
          >
            <Link href={`/repairs/${repair.id}/invoice`}>
              {t('repair.payment.viewInvoice')}{repair.payment.invoiceNumber}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
          <Icon name="credit_card" size={16} />
          {t('repair.payment.register')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button className="w-full bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md" onClick={openPayment}>
          <Icon name="add" size={16} className="mr-2" />
          {t('repair.payment.register')}
        </Button>
      </CardContent>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('repair.payment.register')}</DialogTitle>
            <DialogDescription>
              {t('repair.payment.title')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('repair.payment.amountBilled')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountBilled}
                onChange={(e) => setAmountBilled(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('repair.payment.amountReceived')} *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
            </div>
            {amountReceived && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm">
                <span className="text-green-700">{t('repair.payment.changeDue')} : </span>
                <span className="font-semibold text-green-700">
                  {money(changeDue)}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('repair.payment.method')}</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentType === "check" && (
              <div className="space-y-2">
                <Label>{t('repair.payment.checkImage')} *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCheckFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('repair.payment.paidBy')}</Label>
              <Input
                placeholder={t('repair.payment.paidByNamePlaceholder')}
                value={paidByName}
                onChange={(e) => setPaidByName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.notes')}</Label>
              <Input
                placeholder={t('repair.payment.notesPlaceholder')}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border border-outline-variant text-on-surface-variant">{t('common.cancel')}</Button>
            </DialogClose>
            <Button
              onClick={handlePayment}
              disabled={!amountReceived || busy}
              isLoading={busy}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {t('repair.payment.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── CostSummaryCard ───────────────────────────────────────────────────────────

function CostSummaryCard({ repair }: { repair: RepairDetail }) {
  const t = useTranslations();
  const subtotal = repair.partsTotal + repair.laborTotal - repair.discountAmount;
  const garageFees = Math.max(0, repair.finalTotal - subtotal);
  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
          <Icon name="attach_money" size={16} />
          {t('repair.costs.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('repair.costs.partsTotal')}</span>
          <span>{money(repair.partsTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('repair.costs.laborTotal')}</span>
          <span>{money(repair.laborTotal)}</span>
        </div>
        {repair.discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>{t('repair.costs.discount')}</span>
            <span>— {money(repair.discountAmount)}</span>
          </div>
        )}
        {garageFees > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('repair.costs.garageFee')}</span>
            <span>{money(garageFees)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-base font-bold">
          <span>{t('repair.costs.finalTotal')}</span>
          <span>{money(repair.finalTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── StatusHistoryCard ─────────────────────────────────────────────────────────

function StatusHistoryCard({ repair }: { repair: RepairDetail }) {
  const t = useTranslations();
  return (
    <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
          <Icon name="history" size={16} />
          {t('repair.statusHistory')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.statusLogs.length === 0 ? (
          <p className="text-muted-foreground">{t('repair.noStatusHistory')}</p>
        ) : (
          <div className="space-y-0">
            {[...repair.statusLogs].reverse().map((log, idx) => (
              <div key={log.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  {idx < repair.statusLogs.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {log.fromStatus && (
                      <>
                        <StatusBadge status={log.fromStatus} />
                        <Icon name="chevron_right" size={12} className="text-muted-foreground" />
                      </>
                    )}
                    <StatusBadge status={log.toStatus} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.changedBy.name} · {formatDateTime(log.createdAt)}
                  </p>
                  {log.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground italic">
                      {log.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepairDetailPage() {
  const t = useTranslations();
  const { id } = useParams() as { id: string };
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRepair = useCallback(async () => {
    try {
      const res = await api.get<{ data: RepairDetail }>(`/repairs/${id}`);
      setRepair(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRepair();
  }, [loadRepair]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{error ?? t('repair.notFound')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRepair}
            className="ml-auto"
          >
            {t('common.retry')}
          </Button>
        </div>
        <div className="mt-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/repairs">
            <Icon name="arrow_back" size={16} />
              {t('common.back')} {t('nav.repairs')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <RepairHeader repair={repair} onRefresh={loadRepair} />

      {/* Overdue banner */}
      {repair.isOverdue && !repair.hasDelayReport && (
        <OverdueBanner repairId={repair.id} onReported={loadRepair} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-6">
          <DiagnosisPanel repair={repair} onUpdate={loadRepair} />
          <PartsPanel repair={repair} onUpdate={loadRepair} />
          <LaborPanel repair={repair} onUpdate={loadRepair} />
          <WorkLogsPanel repair={repair} onUpdate={loadRepair} />
        </div>

        {/* Right column — sidebar cards */}
        <div className="space-y-6">
          <RepairInfoCard repair={repair} />
          <CarClientCard repair={repair} />
          <MechanicsCard repair={repair} onUpdate={loadRepair} />
          <CostSummaryCard repair={repair} />
          <PaymentPanel repair={repair} onUpdate={loadRepair} />
          <StatusHistoryCard repair={repair} />
        </div>
      </div>
    </div>
  );
}
