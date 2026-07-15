"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/use-toast";

type AppointmentStatus =
  "pending" | "confirmed" | "rescheduled" | "cancelled" | "converted";
type Priority = "low" | "normal" | "high" | "emergency";

interface AppointmentDetail {
  id: string;
  clientName: string;
  clientPhone: string;
  carMatricule?: string;
  purpose: string;
  requestedAt: string;
  status: AppointmentStatus;
  notes?: string;
  cancellationReason?: string;
  rescheduledTo?: string;
  repairJob?: { id: string };
  createdAt: string;
  car?: { id: string; matricule: string; make: string; model: string };
  client?: { id: string; name: string };
}

interface Mechanic {
  id: string;
  name: string;
}

const STATUS_VARIANTS: Record<
  AppointmentStatus,
  "warning" | "success" | "info" | "destructive" | "secondary"
> = {
  pending: "warning",
  confirmed: "success",
  rescheduled: "info",
  cancelled: "destructive",
  converted: "secondary",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations();
  const { id } = use(params);
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [appointment, setAppointment] = useState<AppointmentDetail | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Confirm ──
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState<{
    current: number;
    max: number;
  } | null>(null);

  // ── Reschedule ──
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // ── Cancel ──
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // ── Convert to Repair ──
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [mechanicsLoading, setMechanicsLoading] = useState(false);
  const [convertForm, setConvertForm] = useState({
    mechanicId: "",
    targetDate: "",
    description: "",
    priority: "normal" as Priority,
  });
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const fetchAppointment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AppointmentDetail }>(
        `/appointments/${id}`,
      );
      setAppointment(res.data);
      setConvertForm((prev) => ({ ...prev, description: res.data.purpose }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('appointment.errors.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  // ── Confirm handler ──
  async function handleConfirm(force = false) {
    setConfirmLoading(true);
    try {
      const path = force
        ? `/appointments/${id}/confirm?force=true`
        : `/appointments/${id}/confirm`;
      await api.patch(path);
      success(t('appointment.toasts.confirmed'));
      setShowConfirmDialog(false);
      setCapacityWarning(null);
      fetchAppointment();
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as Record<string, unknown> | undefined;
        if (details?.requiresAcknowledgement) {
          setCapacityWarning({
            current: details.current as number,
            max: details.max as number,
          });
        } else {
          toastError(t('appointment.errors.confirmFailed'), err.message);
          setShowConfirmDialog(false);
          setCapacityWarning(null);
        }
      } else {
        toastError(t('appointment.errors.confirmFailed'), t('common.unexpectedError'));
        setShowConfirmDialog(false);
        setCapacityWarning(null);
      }
    } finally {
      setConfirmLoading(false);
    }
  }

  function closeConfirmDialog() {
    setShowConfirmDialog(false);
    setCapacityWarning(null);
  }

  // ── Reschedule handler ──
  async function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError(t('appointment.detail.dateTimeRequired'));
      return;
    }
    setRescheduleLoading(true);
    setRescheduleError(null);
    try {
      const rescheduledTo = new Date(
        `${rescheduleDate}T${rescheduleTime}:00`,
      ).toISOString();
      await api.patch(`/appointments/${id}/reschedule`, { rescheduledTo });
      success(t('appointment.toasts.rescheduled'));
      setShowRescheduleDialog(false);
      setRescheduleDate("");
      setRescheduleTime("09:00");
      fetchAppointment();
    } catch (err) {
      if (err instanceof ApiError) {
        setRescheduleError(err.message);
      } else {
        setRescheduleError(t('common.unexpectedError'));
      }
    } finally {
      setRescheduleLoading(false);
    }
  }

  // ── Cancel handler ──
  async function handleCancel() {
    if (!cancelReason.trim()) {
      setCancelError(t('appointment.detail.cancelReasonRequired'));
      return;
    }
    setCancelLoading(true);
    setCancelError(null);
    try {
      await api.patch(`/appointments/${id}/cancel`, {
        cancellationReason: cancelReason.trim(),
      });
      success(t('appointment.toasts.cancelled'));
      setShowCancelDialog(false);
      setCancelReason("");
      fetchAppointment();
    } catch (err) {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else {
        setCancelError(t('common.unexpectedError'));
      }
    } finally {
      setCancelLoading(false);
    }
  }

  // ── Open convert dialog (fetch mechanics) ──
  async function openConvertDialog() {
    setShowConvertDialog(true);
    setConvertError(null);
    setMechanicsLoading(true);
    try {
      const res = await api.get<{ data: Mechanic[] }>(
        "/employees?role=mechanic&status=active",
      );
      setMechanics(res.data);
    } catch {
      setConvertError(t('appointment.errors.loadMechanicsFailed'));
    } finally {
      setMechanicsLoading(false);
    }
  }

  // ── Convert handler ──
  async function handleConvert() {
    if (!convertForm.mechanicId) {
      setConvertError(t('appointment.detail.selectMechanicRequired'));
      return;
    }
    setConvertLoading(true);
    setConvertError(null);
    try {
      const body: Record<string, unknown> = {
        primaryMechanicId: convertForm.mechanicId,
        description: convertForm.description.trim(),
        priority: convertForm.priority,
      };
      if (convertForm.targetDate) {
        body.targetCompletionDate = new Date(
          convertForm.targetDate,
        ).toISOString();
      }
      const res = await api.post<{
        data: { repairId: string; appointmentId: string };
      }>(`/appointments/${id}/convert`, body);
      success(t('appointment.toasts.converted'));
      router.push(`/repairs/${res.data.repairId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setConvertError(err.message);
      } else {
        setConvertError(t('common.unexpectedError'));
      }
    } finally {
      setConvertLoading(false);
    }
  }

  // ── Render states ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/appointments">
            <Icon name="arrow_back" size={16} />
            {t('appointment.backLink')}
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{error ?? t('appointment.detail.notFound')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAppointment}
            className="ml-auto"
          >
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const { status } = appointment;
  const isTerminal = status === "cancelled" || status === "converted";
  const canConfirm = status === "pending" || status === "rescheduled";
  const canReschedule =
    status === "pending" || status === "confirmed" || status === "rescheduled";
  const canCancel =
    status === "pending" || status === "confirmed" || status === "rescheduled";
  const canConvert = status === "confirmed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="text-on-surface-variant">
          <Link href="/appointments">
            <Icon name="arrow_back" size={16} />
            {t('common.back')}
          </Link>
        </Button>
        <h1 className="font-headline-lg text-headline-lg">{t('appointment.detail.title')}</h1>
      </div>

      {/* Info card */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="font-title-md text-title-md">{t('appointment.detail.infoCard')}</CardTitle>
            <Badge variant={STATUS_VARIANTS[status]}>
              {t('appointment.status.' + status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt className="text-muted-foreground">{t('appointment.detail.clientName')}</dt>
            <dd className="font-medium">{appointment.clientName}</dd>

            <dt className="text-muted-foreground">{t('appointment.detail.phone')}</dt>
            <dd>{appointment.clientPhone}</dd>

            <dt className="text-muted-foreground">{t('appointment.detail.vehicle')}</dt>
            <dd className="font-mono text-xs">
              {appointment.car
                ? `${appointment.car.matricule} — ${appointment.car.make} ${appointment.car.model}`
                : appointment.carMatricule || "—"}
            </dd>

            <dt className="text-muted-foreground">{t('appointment.detail.purpose')}</dt>
            <dd>{appointment.purpose}</dd>

            <dt className="text-muted-foreground">{t('appointment.detail.requestedDate')}</dt>
            <dd>{formatDate(appointment.requestedAt)}</dd>

            {appointment.rescheduledTo && (
              <>
                <dt className="text-muted-foreground">{t('appointment.detail.rescheduledTo')}</dt>
                <dd>{formatDate(appointment.rescheduledTo)}</dd>
              </>
            )}

            {appointment.notes && (
              <>
                <dt className="text-muted-foreground">{t('appointment.detail.notes')}</dt>
                <dd className="text-muted-foreground">{appointment.notes}</dd>
              </>
            )}

            {appointment.cancellationReason && (
              <>
                <dt className="text-muted-foreground">{t('appointment.detail.cancellationReason')}</dt>
                <dd className="text-destructive">
                  {appointment.cancellationReason}
                </dd>
              </>
            )}

            <dt className="text-muted-foreground">{t('appointment.detail.createdOn')}</dt>
            <dd className="text-muted-foreground">
              {formatDate(appointment.createdAt)}
            </dd>
          </dl>

          {appointment.repairJob && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('appointment.detail.relatedRepair')}
                </span>
                <Button variant="outline" size="sm" asChild className="border border-outline-variant text-on-surface-variant">
                  <Link href={`/repairs/${appointment.repairJob.id}`}>
                    {t('appointment.detail.viewRepair')}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions card — hidden for terminal states */}
      {!isTerminal && (
        <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="font-title-md text-title-md">{t('common.actions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {canConfirm && (
                <Button onClick={() => setShowConfirmDialog(true)} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
                  <Icon name="check_circle" size={16} />
                  {t('common.confirm')}
                </Button>
              )}
              {canReschedule && (
                <Button
                  variant="outline"
                  onClick={() => setShowRescheduleDialog(true)}
                  className="border border-outline-variant text-on-surface-variant"
                >
                  <Icon name="calendar_month" size={16} />
                  {t('appointment.detail.rescheduleButton')}
                </Button>
              )}
              {canConvert && (
                <Button variant="outline" onClick={openConvertDialog} className="border border-outline-variant text-on-surface-variant">
                  <Icon name="build" size={16} />
                  {t('appointment.detail.convertToRepair')}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <Icon name="cancel" size={16} />
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════
          Confirm Dialog
      ══════════════════════════════════════ */}
      <Dialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          if (!open) closeConfirmDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {capacityWarning
                ? t('appointment.detail.maxCapacity')
                : t('appointment.detail.confirmDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {capacityWarning
                ? t('appointment.detail.capacityWarningText', { current: capacityWarning.current, max: capacityWarning.max })
                : t('appointment.detail.confirmDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRescheduleDialog(false)}
              disabled={rescheduleLoading}
              className="border border-outline-variant text-on-surface-variant"
            >
              {t('common.cancel')}
            </Button>
            {capacityWarning ? (
              <Button
                onClick={() => handleConfirm(true)}
                disabled={confirmLoading}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {confirmLoading && <Icon name="sync" size={16} className="animate-spin" />}
                {t('appointment.detail.confirmAnyway')}
              </Button>
            ) : (
              <Button
                onClick={() => handleConfirm(false)}
                disabled={confirmLoading}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {confirmLoading && <Icon name="sync" size={16} className="animate-spin" />}
                {t('common.confirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          Reschedule Dialog
      ══════════════════════════════════════ */}
      <Dialog
        open={showRescheduleDialog}
        onOpenChange={setShowRescheduleDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('appointment.detail.rescheduleDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('appointment.detail.rescheduleDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {rescheduleError && (
              <p className="text-sm text-destructive">{rescheduleError}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reschDate">{t('appointment.detail.newDate')}</Label>
                <Input
                  id="reschDate"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleError(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschTime">{t('appointment.detail.newTime')}</Label>
                <Input
                  id="reschTime"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => {
                    setRescheduleTime(e.target.value);
                    setRescheduleError(null);
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRescheduleDialog(false)}
              disabled={rescheduleLoading}
              className="border border-outline-variant text-on-surface-variant"
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduleLoading} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
              {rescheduleLoading && (
                <Icon name="sync" size={16} className="animate-spin" />
              )}
              {t('appointment.detail.rescheduleButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          Cancel Dialog
      ══════════════════════════════════════ */}
      <Dialog
        open={showCancelDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCancelReason("");
            setCancelError(null);
          }
          setShowCancelDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('appointment.detail.cancelDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('appointment.detail.cancelDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {cancelError && (
              <p className="text-sm text-destructive">{cancelError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="cancelReason">
                {t('appointment.detail.cancelReasonLabel')} <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  setCancelError(null);
                }}
                rows={3}
                placeholder={t('appointment.detail.cancelReasonPlaceholder')}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false);
                setCancelReason("");
                setCancelError(null);
              }}
              disabled={cancelLoading}
              className="border border-outline-variant text-on-surface-variant"
            >
            {t('common.back')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
              className="bg-destructive text-destructive-foreground rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {cancelLoading && <Icon name="sync" size={16} className="animate-spin" />}
              {t('appointment.detail.cancelButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════
          Convert to Repair Dialog
      ══════════════════════════════════════ */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('appointment.convertDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('appointment.detail.convertDialogTitle')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {convertError && (
              <p className="text-sm text-destructive">{convertError}</p>
            )}

            {/* Mechanic */}
            <div className="space-y-2">
              <Label htmlFor="mechanic">
                {t('appointment.detail.convertMechanic')} <span className="text-destructive">*</span>
              </Label>
              {mechanicsLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Icon name="sync" size={16} className="animate-spin" />
                  {t('appointment.detail.loadingMechanics')}
                </div>
              ) : (
                <Select
                  value={convertForm.mechanicId}
                  onValueChange={(v) => {
                    setConvertForm((p) => ({ ...p, mechanicId: v }));
                    setConvertError(null);
                  }}
                >
                  <SelectTrigger id="mechanic">
                    <SelectValue placeholder={t('appointment.detail.selectMechanic')} />
                  </SelectTrigger>
                  <SelectContent>
                    {mechanics.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        {t('appointment.detail.noMechanics')}
                      </SelectItem>
                    ) : (
                      mechanics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="convertPriority">{t('appointment.detail.priority')}</Label>
              <Select
                value={convertForm.priority}
                onValueChange={(v) =>
                  setConvertForm((p) => ({ ...p, priority: v as Priority }))
                }
              >
                <SelectTrigger id="convertPriority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('repair.priority.low')}</SelectItem>
                  <SelectItem value="normal">{t('repair.priority.normal')}</SelectItem>
                  <SelectItem value="high">{t('repair.priority.high')}</SelectItem>
                  <SelectItem value="emergency">{t('repair.priority.emergency')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target date */}
            <div className="space-y-2">
              <Label htmlFor="convertTargetDate">{t('appointment.detail.targetDate')}</Label>
              <Input
                id="convertTargetDate"
                type="date"
                value={convertForm.targetDate}
                onChange={(e) =>
                  setConvertForm((p) => ({ ...p, targetDate: e.target.value }))
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="convertDesc">{t('appointment.convertDialog.description')}</Label>
              <textarea
                id="convertDesc"
                value={convertForm.description}
                onChange={(e) =>
                  setConvertForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={3}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRescheduleDialog(false)}
              disabled={rescheduleLoading}
              className="border border-outline-variant text-on-surface-variant"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertLoading || mechanicsLoading}
              className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
            >
              {convertLoading && <Icon name="sync" size={16} className="animate-spin" />}
              {t('appointment.detail.convertToRepair')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
