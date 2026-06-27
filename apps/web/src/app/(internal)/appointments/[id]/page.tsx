"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Wrench,
} from "lucide-react";
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

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  converted: "Converted",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
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
        setError("Failed to load appointment.");
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
      success("Appointment confirmed");
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
          toastError("Confirm failed", err.message);
          setShowConfirmDialog(false);
          setCapacityWarning(null);
        }
      } else {
        toastError("Confirm failed", "An unexpected error occurred.");
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
      setRescheduleError("Please select a date and time.");
      return;
    }
    setRescheduleLoading(true);
    setRescheduleError(null);
    try {
      const rescheduledTo = new Date(
        `${rescheduleDate}T${rescheduleTime}:00`,
      ).toISOString();
      await api.patch(`/appointments/${id}/reschedule`, { rescheduledTo });
      success("Appointment rescheduled");
      setShowRescheduleDialog(false);
      setRescheduleDate("");
      setRescheduleTime("09:00");
      fetchAppointment();
    } catch (err) {
      if (err instanceof ApiError) {
        setRescheduleError(err.message);
      } else {
        setRescheduleError("An unexpected error occurred.");
      }
    } finally {
      setRescheduleLoading(false);
    }
  }

  // ── Cancel handler ──
  async function handleCancel() {
    if (!cancelReason.trim()) {
      setCancelError("A cancellation reason is required.");
      return;
    }
    setCancelLoading(true);
    setCancelError(null);
    try {
      await api.patch(`/appointments/${id}/cancel`, {
        cancellationReason: cancelReason.trim(),
      });
      success("Appointment cancelled");
      setShowCancelDialog(false);
      setCancelReason("");
      fetchAppointment();
    } catch (err) {
      if (err instanceof ApiError) {
        setCancelError(err.message);
      } else {
        setCancelError("An unexpected error occurred.");
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
      setConvertError("Failed to load mechanics. Please close and try again.");
    } finally {
      setMechanicsLoading(false);
    }
  }

  // ── Convert handler ──
  async function handleConvert() {
    if (!convertForm.mechanicId) {
      setConvertError("Please select a primary mechanic.");
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
      success("Converted to repair");
      router.push(`/repairs/${res.data.repairId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setConvertError(err.message);
      } else {
        setConvertError("An unexpected error occurred.");
      }
    } finally {
      setConvertLoading(false);
    }
  }

  // ── Render states ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/appointments">
            <ArrowLeft className="h-4 w-4" />
            Back to Appointments
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error ?? "Appointment not found."}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAppointment}
            className="ml-auto"
          >
            Retry
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
        <Button variant="ghost" size="sm" asChild>
          <Link href="/appointments">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Appointment Details</h1>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">Appointment Info</CardTitle>
            <Badge variant={STATUS_VARIANTS[status]}>
              {STATUS_LABELS[status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt className="text-muted-foreground">Client Name</dt>
            <dd className="font-medium">{appointment.clientName}</dd>

            <dt className="text-muted-foreground">Phone</dt>
            <dd>{appointment.clientPhone}</dd>

            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="font-mono text-xs">
              {appointment.car
                ? `${appointment.car.matricule} — ${appointment.car.make} ${appointment.car.model}`
                : appointment.carMatricule || "—"}
            </dd>

            <dt className="text-muted-foreground">Purpose</dt>
            <dd>{appointment.purpose}</dd>

            <dt className="text-muted-foreground">Requested Date</dt>
            <dd>{formatDate(appointment.requestedAt)}</dd>

            {appointment.rescheduledTo && (
              <>
                <dt className="text-muted-foreground">Rescheduled To</dt>
                <dd>{formatDate(appointment.rescheduledTo)}</dd>
              </>
            )}

            {appointment.notes && (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="text-muted-foreground">{appointment.notes}</dd>
              </>
            )}

            {appointment.cancellationReason && (
              <>
                <dt className="text-muted-foreground">Cancellation Reason</dt>
                <dd className="text-destructive">
                  {appointment.cancellationReason}
                </dd>
              </>
            )}

            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-muted-foreground">
              {formatDate(appointment.createdAt)}
            </dd>
          </dl>

          {appointment.repairJob && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Linked Repair Job
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/repairs/${appointment.repairJob.id}`}>
                    View Repair
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions card — hidden for terminal states */}
      {!isTerminal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {canConfirm && (
                <Button onClick={() => setShowConfirmDialog(true)}>
                  <CheckCircle className="h-4 w-4" />
                  Confirm
                </Button>
              )}
              {canReschedule && (
                <Button
                  variant="outline"
                  onClick={() => setShowRescheduleDialog(true)}
                >
                  <Calendar className="h-4 w-4" />
                  Reschedule
                </Button>
              )}
              {canConvert && (
                <Button variant="outline" onClick={openConvertDialog}>
                  <Wrench className="h-4 w-4" />
                  Convert to Repair
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
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
                ? "Capacity Limit Reached"
                : "Confirm Appointment"}
            </DialogTitle>
            <DialogDescription>
              {capacityWarning
                ? `The garage is at capacity (${capacityWarning.current}/${capacityWarning.max} confirmed appointments). Do you want to confirm anyway?`
                : "Are you sure you want to confirm this appointment?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeConfirmDialog}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            {capacityWarning ? (
              <Button
                onClick={() => handleConfirm(true)}
                disabled={confirmLoading}
              >
                {confirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Anyway
              </Button>
            ) : (
              <Button
                onClick={() => handleConfirm(false)}
                disabled={confirmLoading}
              >
                {confirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
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
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Pick a new date and time for this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {rescheduleError && (
              <p className="text-sm text-destructive">{rescheduleError}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reschDate">New Date</Label>
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
                <Label htmlFor="reschTime">New Time</Label>
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
            >
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduleLoading}>
              {rescheduleLoading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Reschedule
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
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Provide a reason for cancelling this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {cancelError && (
              <p className="text-sm text-destructive">{cancelError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="cancelReason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  setCancelError(null);
                }}
                rows={3}
                placeholder="Explain why this appointment is being cancelled..."
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
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel Appointment
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
            <DialogTitle>Convert to Repair</DialogTitle>
            <DialogDescription>
              Create a repair job from this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {convertError && (
              <p className="text-sm text-destructive">{convertError}</p>
            )}

            {/* Mechanic */}
            <div className="space-y-2">
              <Label htmlFor="mechanic">
                Primary Mechanic <span className="text-destructive">*</span>
              </Label>
              {mechanicsLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading mechanics...
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
                    <SelectValue placeholder="Select a mechanic" />
                  </SelectTrigger>
                  <SelectContent>
                    {mechanics.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No active mechanics found
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
              <Label htmlFor="convertPriority">Priority</Label>
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
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target date */}
            <div className="space-y-2">
              <Label htmlFor="convertTargetDate">Target Completion Date</Label>
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
              <Label htmlFor="convertDesc">Description</Label>
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
              onClick={() => setShowConvertDialog(false)}
              disabled={convertLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertLoading || mechanicsLoading}
            >
              {convertLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Convert to Repair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
