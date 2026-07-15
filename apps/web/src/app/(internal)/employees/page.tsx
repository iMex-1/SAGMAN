"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";

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

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  carCount: number;
  repairCount: number;
}

interface EmployeesResponse {
  data: Employee[];
  meta: { total: number; page: number; limit: number };
}

type StatusFilter = "all" | "active" | "inactive";
type Tab = "employees" | "clients";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function EmployeesPage() {
  const t = useTranslations();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Tab>("employees");

  const ROLE_LABELS: Record<string, string> = {
    manager: t('employee.roles.manager'),
    mechanic: t('employee.roles.mechanic'),
  };

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Clients
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

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
        setError(t('employee.errors.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const fetchClients = useCallback(async (search?: string) => {
    setClientsLoading(true);
    try {
      const params = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await api.get<{ data: Client[] }>(`/clients${params}`);
      setClients(res.data);
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "employees") fetchEmployees();
  }, [tab, fetchEmployees]);

  useEffect(() => {
    if (tab === "clients") fetchClients(clientSearch);
  }, [tab, fetchClients, clientSearch]);

  async function handleToggleStatus(employee: Employee) {
    setActionLoadingId(employee.id);
    try {
      const action = employee.status === "active" ? "deactivate" : "activate";
      await api.patch(`/employees/${employee.id}/${action}`);
      success(
        employee.status === "active"
          ? `${employee.name} ${t('employee.actions.deactivate')}`
          : `${employee.name} ${t('employee.actions.activate')}`,
      );
      fetchEmployees();
    } catch (err) {
      if (err instanceof ApiError) {
        toastError(t('employee.errors.actionFailed'), err.message);
      } else {
        toastError(t('employee.errors.actionFailed'), t('common.unexpectedError'));
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: t('common.all'), value: "all" },
    { label: t('employee.status.active'), value: "active" },
    { label: t('employee.status.inactive'), value: "inactive" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl">
            {tab === "employees" ? t('employee.title') : t('employee.clientsTitle')}
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            {tab === "employees"
              ? t('employee.subtitle')
              : t('employee.clientsSubtitle')}
          </p>
        </div>
        {tab === "employees" && (
          <Button asChild>
            <Link href="/employees/new">
              <Icon name="add" size={16} />
              {t('employee.newEmployee')}
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("employees")}
          className={`rounded-lg px-lg py-sm text-title-md font-title-md transition-colors ${
            tab === "employees"
              ? "bg-primary text-on-primary"
              : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          {t('employee.title')}
        </button>
        <button
          onClick={() => setTab("clients")}
          className={`rounded-lg px-lg py-sm text-title-md font-title-md transition-colors ${
            tab === "clients"
              ? "bg-primary text-on-primary"
              : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          {t('employee.clientsTitle')}
        </button>
      </div>

      {tab === "employees" && (
        <>
          {/* Filters */}
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setStatusFilter(btn.value)}
                className={`rounded-lg px-lg py-sm text-title-md font-title-md transition-colors ${
                  statusFilter === btn.value
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface p-4">
              <Icon name="error" size={20} className="shrink-0 text-primary" />
              <p className="font-body-md text-body-md text-primary">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchEmployees} className="ml-auto">
                {t('common.retry')}
              </Button>
            </div>
          ) : employees.length === 0 ? (
            <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                {statusFilter === "active"
                  ? t('employee.empty.noActive')
                  : statusFilter === "inactive"
                    ? t('employee.empty.noInactive')
                    : t('employee.empty.noResults')}
              </p>
              <Button asChild className="mt-4">
                <Link href="/employees/new">{t('employee.addFirst')}</Link>
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('common.name')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('employee.fields.role')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant hidden md:table-cell">{t('common.email')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">{t('common.phone')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant hidden lg:table-cell">{t('employee.fields.specialty')}</th>
                    <th className="px-4 py-3 text-left font-label-sm text-label-sm text-on-surface-variant">{t('common.status')}</th>
                    <th className="px-4 py-3 text-right font-label-sm text-label-sm text-on-surface-variant">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-surface-container-low">
                      <td className="px-4 py-3 font-title-md text-title-md">{emp.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={emp.role === "manager" ? "default" : "secondary"}>
                          {ROLE_LABELS[emp.role] ?? emp.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant font-body-md text-body-md hidden md:table-cell">{emp.email}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-body-md text-body-md hidden lg:table-cell">{emp.phone || "—"}</td>
                      <td className="px-4 py-3 text-on-surface-variant font-body-md text-body-md hidden lg:table-cell">{emp.specialty || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={emp.status === "active" ? "success" : "outline"}>
                          {emp.status === "active" ? t('employee.status.active') : t('employee.status.inactive')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/employees/${emp.id}`}>
                              <Icon name="visibility" size={16} />
                              <span className="sr-only">{t('common.view')}</span>
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(emp)}
                            disabled={actionLoadingId === emp.id}
                            title={emp.status === "active" ? t('employee.actions.deactivate') : t('employee.actions.activate')}
                          >
                            {actionLoadingId === emp.id ? (
                              <Icon name="progress_activity" size={16} className="animate-spin" />
                            ) : emp.status === "active" ? (
                              <Icon name="cancel" size={16} className="text-primary" />
                            ) : (
                              <Icon name="check_circle" size={16} className="text-on-surface-variant" />
                            )}
                            <span className="sr-only">
                              {emp.status === "active" ? t('employee.actions.deactivate') : t('employee.actions.activate')}
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
        </>
      )}

      {tab === "clients" && (
        <>
          {/* Search */}
          <div className="max-w-sm">
            <Input
              placeholder={t('employee.clientSearchPlaceholder')}
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
            />
          </div>

          {clientsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="progress_activity" size={32} className="animate-spin text-on-surface-variant" />
            </div>
          ) : clients.length === 0 ? (
            <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-12 text-center">
              <Icon name="person" size={48} className="text-on-surface-variant/40 mx-auto mb-4" />
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                {clientSearch ? t('employee.clientsNoResults') : t('employee.clientsEmpty')}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="bg-white border border-outline-variant rounded-xl shadow-sm p-5 block hover:ring-2 hover:ring-primary/20 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                      {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-title-md text-title-md text-primary truncate">{client.name}</p>
                      <p className="text-sm text-on-surface-variant">{client.phone}</p>
                      {client.email && (
                        <p className="text-xs text-on-surface-variant truncate">{client.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-4 text-sm">
                    <div>
                      <p className="font-title-md text-title-md text-primary">{client.carCount}</p>
                      <p className="text-xs text-on-surface-variant">{t('car.title')}</p>
                    </div>
                    <div>
                      <p className="font-title-md text-title-md text-primary">{client.repairCount}</p>
                      <p className="text-xs text-on-surface-variant">{t('car.repairCount')}</p>
                    </div>
                    <div className="ml-auto self-end">
                      <p className="text-xs text-on-surface-variant">{t('employee.clientSince').replace('{date}', formatDate(client.createdAt))}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
