"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Eye,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "manager" | "mechanic";
  specialty?: string | null;
  status: "active" | "inactive";
  createdAt: string;
}

interface EmployeesResponse {
  data: Employee[];
  meta: { total: number; page: number; limit: number };
}

type StatusFilter = "all" | "active" | "inactive";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  mechanic: "Mechanic",
};

export default function EmployeesPage() {
  const { success, error: toastError } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await api.get<EmployeesResponse>(`/employees${params}`);
      setEmployees(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load employees.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  async function handleToggleStatus(employee: Employee) {
    setActionLoadingId(employee.id);
    try {
      const action = employee.status === "active" ? "deactivate" : "activate";
      await api.patch(`/employees/${employee.id}/${action}`);
      success(
        employee.status === "active"
          ? `${employee.name} has been deactivated.`
          : `${employee.name} has been activated.`,
      );
      fetchEmployees();
    } catch (err) {
      if (err instanceof ApiError) {
        toastError("Action failed", err.message);
      } else {
        toastError("Action failed", "An unexpected error occurred.");
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage garage staff and their access
          </p>
        </div>
        <Button asChild>
          <Link href="/employees/new">
            <Plus className="h-4 w-4" />
            Add Employee
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setStatusFilter(btn.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === btn.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
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
            onClick={fetchEmployees}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {statusFilter === "active"
              ? "No active employees found."
              : statusFilter === "inactive"
                ? "No inactive employees found."
                : "No employees found."}
          </p>
          <Button asChild className="mt-4">
            <Link href="/employees/new">Add your first employee</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                  Phone
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                  Specialty
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => (
                <tr
                  key={emp.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={emp.role === "manager" ? "default" : "secondary"}
                    >
                      {ROLE_LABELS[emp.role] ?? emp.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {emp.email}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {emp.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {emp.specialty || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={emp.status === "active" ? "success" : "outline"}
                    >
                      {emp.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/employees/${emp.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(emp)}
                        disabled={actionLoadingId === emp.id}
                        title={
                          emp.status === "active" ? "Deactivate" : "Activate"
                        }
                      >
                        {actionLoadingId === emp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : emp.status === "active" ? (
                          <UserX className="h-4 w-4 text-destructive" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-600" />
                        )}
                        <span className="sr-only">
                          {emp.status === "active" ? "Deactivate" : "Activate"}
                        </span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
