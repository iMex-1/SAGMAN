"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  Search,
  User,
  Car,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronRight,
  FileText,
  Wrench,
  Package,
  DollarSign,
  History,
  CreditCard,
} from "lucide-react";
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
import { StatusBadge, STATUS_LABELS } from "@/components/repairs/StatusBadge";
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
  appointment?: { id: string; status: string; purpose: string };
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
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value: number) {
  return Number(value).toFixed(2);
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
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Reopen dialog
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Deliver dialog (just a confirm — checks payment)
  const [deliverOpen, setDeliverOpen] = useState(false);

  async function changeStatus(
    status: string,
    extra?: {
      note?: string;
      cancellationReason?: string;
      reopenedReason?: string;
    },
  ) {
    setBusy(true);
    try {
      await api.patch(`/repairs/${repair.id}/status`, { status, ...extra });
      toast({
        title: `Status updated to "${STATUS_LABELS[status] ?? status}"`,
      });
      onRefresh();
    } catch (err) {
      toast({
        title: "Status change failed",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
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
            <ArrowLeft className="h-4 w-4" />
            Repairs
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
              >
                Start Diagnosis
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
              >
                Cancel
              </Button>
            </>
          )}

          {repair.status === "diagnosing" && (
            <>
              <Button
                size="sm"
                onClick={() => changeStatus("awaiting_approval")}
                disabled={busy}
                isLoading={busy}
              >
                Submit for Approval
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
              >
                Cancel
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
              >
                Waiting for Parts
              </Button>
              <Button
                size="sm"
                onClick={() => changeStatus("complete")}
                disabled={busy}
                isLoading={busy}
              >
                Mark Complete
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
              >
                Cancel
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
              >
                Resume Repair
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
              >
                Cancel
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
                      title: "Payment required",
                      description:
                        "Register payment before marking as delivered.",
                      variant: "error",
                    });
                    return;
                  }
                  setDeliverOpen(true);
                }}
                disabled={busy}
              >
                Mark Delivered
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReopenOpen(true)}
                disabled={busy}
              >
                Reopen
              </Button>
            </>
          )}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Repair</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this repair. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Cancellation Reason *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder="Enter reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Back</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || busy}
              isLoading={busy}
            >
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Repair</DialogTitle>
            <DialogDescription>
              Provide a reason for reopening this repair.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              placeholder="Why is this repair being reopened?"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Back</Button>
            </DialogClose>
            <Button
              onClick={handleReopen}
              disabled={!reopenReason.trim() || busy}
              isLoading={busy}
            >
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver Confirm Dialog */}
      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Delivered</DialogTitle>
            <DialogDescription>
              Confirm that the vehicle has been delivered to the client.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Back</Button>
            </DialogClose>
            <Button onClick={handleDeliver} disabled={busy} isLoading={busy}>
              Confirm Delivery
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
      toast({ title: "Delay report submitted" });
      setOpen(false);
      setReason("");
      setEvidenceNote("");
      onReported();
    } catch (err) {
      toast({
        title: "Failed to submit report",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">
          ⚠️ This repair is overdue! File a delay report to continue.
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="ml-auto shrink-0"
          onClick={() => setOpen(true)}
        >
          File Delay Report
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File Delay Report</DialogTitle>
            <DialogDescription>
              Document the reason for the delay. This will be recorded in the
              repair history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={3}
                placeholder="Explain why the repair is delayed..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence / Additional Notes</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder="Any supporting evidence or notes..."
                value={evidenceNote}
                onChange={(e) => setEvidenceNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleSubmit}
              disabled={!reason.trim() || busy}
              isLoading={busy}
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── RepairInfoCard ────────────────────────────────────────────────────────────

function RepairInfoCard({ repair }: { repair: RepairDetail }) {
  const isOverdue = repair.isOverdue;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Repair Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </p>
          <p className="mt-1">{repair.description}</p>
        </div>

        {repair.internalNotes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Internal Notes
            </p>
            <p className="mt-1 text-muted-foreground">{repair.internalNotes}</p>
          </div>
        )}

        {repair.cancellationReason && (
          <div>
            <p className="text-xs font-medium text-red-500 uppercase tracking-wide">
              Cancellation Reason
            </p>
            <p className="mt-1 text-red-600">{repair.cancellationReason}</p>
          </div>
        )}

        {repair.reopenedReason && (
          <div>
            <p className="text-xs font-medium text-amber-500 uppercase tracking-wide">
              Reopened Reason
            </p>
            <p className="mt-1 text-amber-600">{repair.reopenedReason}</p>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Created by</p>
            <p className="font-medium">{repair.createdBy.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{formatDate(repair.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target Date</p>
            <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
              {formatDate(repair.targetCompletionDate)}
              {isOverdue && " 🔴"}
            </p>
          </div>
          {repair.actualCompletionDate && (
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-medium">
                {formatDate(repair.actualCompletionDate)}
              </p>
            </div>
          )}
          {repair.estimatedDurationHours && (
            <div>
              <p className="text-xs text-muted-foreground">Est. Duration</p>
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
  const { car } = repair;
  const client = car.client;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-4 w-4" />
          Car &amp; Client
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
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
              Color: {car.color}
            </p>
          )}
        </div>

        {client ? (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{client.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{client.phone}</span>
                <a
                  href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700 hover:bg-green-100"
                >
                  <MessageSquare className="h-3 w-3" />
                  WhatsApp
                </a>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No client linked to this car.
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<MechanicEmployee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState(repair.primaryMechanic.id);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  function openDialog() {
    setSelected(repair.mechanics.map((m) => m.mechanicId));
    setPrimaryId(repair.primaryMechanic.id);
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
      toast({ title: "Select at least one mechanic", variant: "error" });
      return;
    }
    if (!selected.includes(primaryId)) {
      toast({ title: "Primary mechanic must be selected", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const secondaryMechanicIds = selected.filter((id) => id !== primaryId);
      await api.patch(`/repairs/${repair.id}/assign`, {
        primaryMechanicId: primaryId,
        secondaryMechanicIds,
      });
      toast({ title: "Mechanics updated" });
      setOpen(false);
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to update mechanics",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4" />
            Mechanics
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={openDialog}>
            Reassign
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {repair.mechanics.length === 0 ? (
          <p className="text-muted-foreground">No mechanics assigned.</p>
        ) : (
          repair.mechanics.map((m) => (
            <div key={m.mechanicId} className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{m.mechanic.name}</span>
              {m.mechanic.specialty && (
                <span className="text-xs text-muted-foreground">
                  — {m.mechanic.specialty}
                </span>
              )}
              {m.isPrimary && (
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Primary
                </span>
              )}
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Mechanics</DialogTitle>
            <DialogDescription>
              Select mechanics and set the primary mechanic.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  <Label>Primary Mechanic</Label>
                  <Select value={primaryId} onValueChange={setPrimaryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary..." />
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
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={busy || loading}
              isLoading={busy}
            >
              Save
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

  // Approval state
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [bypassReason, setBypassReason] = useState("");
  const [bypassOpen, setBypassOpen] = useState(false);

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
      toast({ title: "Add at least one issue", variant: "error" });
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
      toast({ title: "Diagnosis saved" });
      setFormOpen(false);
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to save diagnosis",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleShareDiagnosis() {
    setBusy(true);
    try {
      await api.patch(`/repairs/${repair.id}/share-diagnosis`);
      toast({ title: "Diagnosis shared with client" });
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to share diagnosis",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleApproval(
    status: "approved" | "rejected" | "bypassed",
    extra?: { bypassReason?: string; rejectionReason?: string },
  ) {
    setApprovalBusy(true);
    try {
      await api.patch(`/repairs/${repair.id}/client-approval`, {
        status,
        ...extra,
      });
      toast({ title: `Client approval: ${status}` });
      onUpdate();
    } catch (err) {
      toast({
        title: "Approval action failed",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setApprovalBusy(false);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            Diagnosis
            {repair.diagnosisShared && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                Shared with Client
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={openForm}>
                {repair.diagnosisReport ? "Edit Diagnosis" : "Fill Diagnosis"}
              </Button>
            )}
            {repair.diagnosisReport &&
              repair.status === "diagnosing" &&
              !repair.diagnosisShared && (
                <Button
                  size="sm"
                  onClick={handleShareDiagnosis}
                  disabled={busy}
                  isLoading={busy}
                >
                  Share with Client
                </Button>
              )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!repair.diagnosisReport ? (
          <p className="text-muted-foreground">No diagnosis report yet.</p>
        ) : (
          <>
            {/* Issues */}
            <div className="space-y-2">
              <p className="font-medium">Issues Found</p>
              {repair.diagnosisReport.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border p-2"
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[issue.severity] ?? ""}`}
                  >
                    {issue.severity}
                  </span>
                  <span>{issue.description}</span>
                </div>
              ))}
            </div>

            {repair.diagnosisReport.recommendedRepairs && (
              <div>
                <p className="font-medium">Recommended Repairs</p>
                <p className="mt-1 text-muted-foreground">
                  {repair.diagnosisReport.recommendedRepairs}
                </p>
              </div>
            )}

            {repair.diagnosisReport.estimatedDurationHours && (
              <p className="text-muted-foreground">
                Estimated:{" "}
                <span className="font-medium text-foreground">
                  {repair.diagnosisReport.estimatedDurationHours}h
                </span>
              </p>
            )}

            {repair.diagnosisReport.additionalNotes && (
              <div>
                <p className="font-medium">Additional Notes</p>
                <p className="mt-1 text-muted-foreground">
                  {repair.diagnosisReport.additionalNotes}
                </p>
              </div>
            )}
          </>
        )}

        {/* Client approval section */}
        {repair.diagnosisShared && repair.status === "awaiting_approval" && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="font-medium">Client Approval</p>
              <p className="text-xs text-muted-foreground">
                Current status:{" "}
                <span className="font-medium capitalize">
                  {repair.clientApprovalStatus}
                </span>
              </p>
              {repair.clientApprovalStatus === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApproval("approved")}
                    disabled={approvalBusy}
                    isLoading={approvalBusy}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectOpen(true)}
                    disabled={approvalBusy}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBypassOpen(true)}
                    disabled={approvalBusy}
                  >
                    Bypass Approval
                  </Button>
                </div>
              )}
              {repair.clientApprovalBypassReason && (
                <p className="text-xs text-amber-600">
                  Bypassed: {repair.clientApprovalBypassReason}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Diagnosis Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {repair.diagnosisReport ? "Edit Diagnosis" : "Fill Diagnosis"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Issues Found *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addIssue}
                >
                  <Plus className="h-3 w-3" />
                  Add Issue
                </Button>
              </div>
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border p-3"
                >
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Describe the issue..."
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
                        <SelectItem value="Minor">Minor</SelectItem>
                        <SelectItem value="Moderate">Moderate</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
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
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Recommended Repairs</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder="What repairs are recommended?"
                value={recommendedRepairs}
                onChange={(e) => setRecommendedRepairs(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Estimated Duration (hours)</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 6"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder="Any additional notes..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSubmitDiagnosis}
              disabled={busy}
              isLoading={busy}
            >
              Save Diagnosis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Diagnosis</DialogTitle>
            <DialogDescription>
              Provide the reason for rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Back</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                handleApproval("rejected", {
                  rejectionReason: rejectReason.trim(),
                });
                setRejectOpen(false);
                setRejectReason("");
              }}
              disabled={!rejectReason.trim() || approvalBusy}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bypass Dialog */}
      <Dialog open={bypassOpen} onOpenChange={setBypassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bypass Client Approval</DialogTitle>
            <DialogDescription>
              Explain why you are bypassing the client approval process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Bypass Reason *</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              rows={3}
              value={bypassReason}
              onChange={(e) => setBypassReason(e.target.value)}
              placeholder="Reason for bypassing approval..."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Back</Button>
            </DialogClose>
            <Button
              onClick={() => {
                handleApproval("bypassed", {
                  bypassReason: bypassReason.trim(),
                });
                setBypassOpen(false);
                setBypassReason("");
              }}
              disabled={!bypassReason.trim() || approvalBusy}
            >
              Bypass Approval
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
      toast({ title: "Part added" });
      setAddOpen(false);
      setSelectedPart(null);
      setPartQuery("");
      setPartResults([]);
      setQuantity("1");
      setStockOverride(false);
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to add part",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
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
      toast({ title: "Part removed" });
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to remove part",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setRemoveId(null);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Parts Used
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Part
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.parts.length === 0 ? (
          <p className="text-muted-foreground">No parts added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Part</th>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Unit</th>
                <th className="pb-2 font-medium text-right">Subtotal</th>
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
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
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
                  Total Parts:
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
            <DialogTitle>Add Part</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Part search */}
            <div className="space-y-2">
              <Label>Search Part</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
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
                  Parts module coming soon — cannot search parts right now.
                </p>
              )}

              {partsLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Searching...
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
                    {money(selectedPart.unitCost)} / unit
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Quantity *</Label>
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
              Override stock check
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAddPart}
              disabled={!selectedPart || !quantity || busy}
              isLoading={busy}
            >
              Add Part
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
      toast({ title: "Labor item added" });
      setAddOpen(false);
      setDescription("");
      setCost("");
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to add labor",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
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
      toast({ title: "Labor item removed" });
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to remove labor",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setRemoveId(null);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            Labor
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Labor
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.laborItems.length === 0 ? (
          <p className="text-muted-foreground">No labor items added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-right">Cost</th>
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
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
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
                  Total Labor:
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
            <DialogTitle>Add Labor Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Oil change service"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cost *</Label>
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
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAdd}
              disabled={!description.trim() || !cost || busy}
              isLoading={busy}
            >
              Add
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
      toast({ title: "Work log added" });
      setAddOpen(false);
      setDescription("");
      setHours("");
      onUpdate();
    } catch (err) {
      toast({
        title: "Failed to add work log",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const canEdit = !["delivered", "cancelled"].includes(repair.status);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Work Log
          </CardTitle>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.workLogs.length === 0 ? (
          <p className="text-muted-foreground">No work logs yet.</p>
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
                      <Clock className="h-3 w-3" />
                      {log.hoursSpent}h
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
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
            <DialogTitle>Add Work Log Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={3}
                placeholder="What work was done?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hours Spent *</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 2.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAdd}
              disabled={!description.trim() || !hours || busy}
              isLoading={busy}
            >
              Add Entry
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
  const { toast } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [amountBilled, setAmountBilled] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function openPayment() {
    setAmountBilled(String(repair.finalTotal));
    setAmountReceived("");
    setPaidByName("");
    setPayNotes("");
    setPayOpen(true);
  }

  const changeDue =
    amountReceived && amountBilled
      ? Math.max(0, Number(amountReceived) - Number(amountBilled))
      : 0;

  async function handlePayment() {
    setBusy(true);
    try {
      const res = await api.post<{ data: { invoiceNumber: string } }>(
        "/payments",
        {
          repairId: repair.id,
          amountBilled: Number(amountBilled),
          amountReceived: Number(amountReceived),
          discountAmount: 0,
          paidByName: paidByName.trim() || undefined,
          notes: payNotes.trim() || undefined,
        },
      );
      toast({ title: "Payment registered successfully" });
      setPayOpen(false);
      onUpdate();
    } catch (err) {
      toast({
        title: "Payment failed",
        description:
          err instanceof ApiError ? err.message : "An error occurred.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (repair.status !== "complete") {
    return null; // Only show when repair is complete
  }

  if (repair.payment) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Payment Received
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-green-700">Amount Billed</span>
            <span className="font-medium text-green-700">
              {money(repair.payment.amountBilled)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-700">Amount Received</span>
            <span className="font-medium text-green-700">
              {money(repair.payment.amountReceived)}
            </span>
          </div>
          <div className="flex justify-between border-t border-green-200 pt-2">
            <span className="text-green-700">Change Due</span>
            <span className="font-bold text-green-700">
              {money(repair.payment.changeDue)}
            </span>
          </div>
          {(repair.payment as any).paidByName && (
            <p className="text-xs text-green-600 pt-2 italic">
              Paid by: {(repair.payment as any).paidByName}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full mt-4"
          >
            <Link href={`/repairs/${repair.id}/invoice`}>
              View Invoice #{repair.payment.invoiceNumber}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Register Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={openPayment}>
          <Plus className="h-4 w-4 mr-2" />
          Register Payment
        </Button>
      </CardContent>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Payment</DialogTitle>
            <DialogDescription>
              Record the payment received for this repair.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Billed</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountBilled}
                onChange={(e) => setAmountBilled(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Amount Received *</Label>
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
                <span className="text-green-700">Change Due: </span>
                <span className="font-semibold text-green-700">
                  {money(changeDue)}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Paid By Name</Label>
              <Input
                placeholder="Optional — customer name"
                value={paidByName}
                onChange={(e) => setPaidByName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional payment notes..."
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handlePayment}
              disabled={!amountReceived || busy}
              isLoading={busy}
            >
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── CostSummaryCard ───────────────────────────────────────────────────────────

function CostSummaryCard({ repair }: { repair: RepairDetail }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Cost Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Parts Total</span>
          <span>{money(repair.partsTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Labor Total</span>
          <span>{money(repair.laborTotal)}</span>
        </div>
        {repair.discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>— {money(repair.discountAmount)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-base font-bold">
          <span>Final Total</span>
          <span>{money(repair.finalTotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── StatusHistoryCard ─────────────────────────────────────────────────────────

function StatusHistoryCard({ repair }: { repair: RepairDetail }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {repair.statusLogs.length === 0 ? (
          <p className="text-muted-foreground">No status changes yet.</p>
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
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
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
  const { id } = useParams() as { id: string };
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRepair = useCallback(async () => {
    try {
      const res = await api.get<{ data: RepairDetail }>(`/repairs/${id}`);
      setRepair(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load repair");
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error ?? "Repair not found."}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRepair}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
        <div className="mt-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/repairs">
              <ArrowLeft className="h-4 w-4" />
              Back to Repairs
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
