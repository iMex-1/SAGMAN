"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Eye, Loader2, AlertCircle, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { StatusBadge } from "@/components/repairs/StatusBadge";
import { PriorityBadge } from "@/components/repairs/PriorityBadge";

interface Repair {
  id: string;
  status: string;
  priority: string;
  description: string;
  isOverdue: boolean;
  targetCompletionDate?: string;
  actualCompletionDate?: string;
  createdAt: string;
  car: { id: string; matricule: string; make: string; model: string };
  primaryMechanic: { id: string; name: string };
  _count?: { delayReports: number };
}

interface RepairsResponse {
  data: Repair[];
  meta: { total: number; page: number; limit: number };
}

type StatusTab = "all" | "active" | "overdue" | "delivered" | "cancelled";
type PriorityFilter = "all" | "emergency" | "high" | "normal" | "low";

const ACTIVE_STATUSES =
  "received,diagnosing,awaiting_approval,in_progress,waiting_for_parts,complete";

const STATUS_TABS: { label: string; value: StatusTab }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Overdue", value: "overdue" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const loadRepairs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (statusTab === "active") {
        params.set("status", ACTIVE_STATUSES);
      } else if (statusTab === "overdue") {
        params.set("isOverdue", "true");
      } else if (statusTab === "delivered") {
        params.set("status", "delivered");
      } else if (statusTab === "cancelled") {
        params.set("status", "cancelled");
      }

      if (priorityFilter !== "all") {
        params.set("priority", priorityFilter);
      }

      params.set("page", "1");
      params.set("limit", "50");

      const res = await api.get<RepairsResponse>(
        `/repairs?${params.toString()}`,
      );
      setRepairs(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load repairs.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusTab, priorityFilter]);

  useEffect(() => {
    loadRepairs();
  }, [loadRepairs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Repairs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage all vehicle repair jobs
          </p>
        </div>
        <Button asChild>
          <Link href="/repairs/new">
            <Plus className="h-4 w-4" />
            New Repair
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="w-40">
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="emergency">🚨 Emergency</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRepairs}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      ) : repairs.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            No repairs found for the selected filters.
          </p>
          <Button asChild className="mt-4">
            <Link href="/repairs/new">Create a repair</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Car
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Priority
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Mechanic
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                  Target Date
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {repairs.map((repair) => {
                const isOverdue = repair.isOverdue;
                return (
                  <tr
                    key={repair.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <Circle className="h-2 w-2 fill-red-500 text-red-500 shrink-0" />
                        )}
                        <div>
                          <span className="font-semibold">
                            {repair.car.matricule}
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            — {repair.car.make} {repair.car.model}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={repair.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={repair.priority} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {repair.primaryMechanic.name}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span
                        className={
                          isOverdue
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {formatDate(repair.targetCompletionDate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/repairs/${repair.id}`}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
