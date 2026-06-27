"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  KeyRound,
  UserX,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "manager" | "mechanic";
  specialty?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt?: string;
}

interface EmployeeResponse {
  data: Employee;
}

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  specialty?: string;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    specialty: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset password state
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Toggle status state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const fetchEmployee = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<EmployeeResponse>(`/employees/${employeeId}`);
      const emp = res.data;
      setEmployee(emp);
      setForm({
        name: emp.name,
        email: emp.email,
        phone: emp.phone ?? "",
        role: emp.role,
        specialty: emp.specialty ?? "",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(
          err.statusCode === 404 ? "Employee not found." : err.message,
        );
      } else {
        setLoadError("Failed to load employee.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm(): boolean {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Enter a valid email address.";
    }
    if (!form.role) errors.role = "Role is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const res = await api.patch<EmployeeResponse>(
        `/employees/${employeeId}`,
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          specialty: form.specialty.trim() || undefined,
        },
      );
      setEmployee(res.data);
      success("Employee updated successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.details) {
          setFieldErrors(err.details as Record<string, string>);
        } else if (err.code === "EMAIL_TAKEN") {
          setFieldErrors((prev) => ({
            ...prev,
            email: "This email is already in use.",
          }));
        } else {
          toastError("Update failed", err.message);
        }
      } else {
        toastError("Update failed", "An unexpected error occurred.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");

    if (!newPassword) {
      setPasswordError("Password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsResettingPassword(true);
    try {
      await api.patch(`/employees/${employeeId}/reset-password`, {
        newPassword: newPassword,
      });
      success("Password has been reset successfully.");
      setResetPasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError("Failed to reset password.");
      }
    } finally {
      setIsResettingPassword(false);
    }
  }

  async function handleToggleStatus() {
    if (!employee) return;
    setIsTogglingStatus(true);
    try {
      const action = employee.status === "active" ? "deactivate" : "activate";
      const res = await api.patch<EmployeeResponse>(
        `/employees/${employeeId}/${action}`,
      );
      setEmployee(res.data);
      success(
        res.data.status === "active"
          ? `${res.data.name} has been activated.`
          : `${res.data.name} has been deactivated.`,
      );
      setStatusDialogOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toastError("Action failed", err.message);
      } else {
        toastError("Action failed", "An unexpected error occurred.");
      }
    } finally {
      setIsTogglingStatus(false);
    }
  }

  // --- Render states ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
            Back to Employees
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{loadError ?? "Employee not found."}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmployee}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
            Back to Employees
          </Link>
        </Button>
        <div className="flex-1" />
        <Badge
          variant={employee.status === "active" ? "success" : "outline"}
          className="text-sm"
        >
          {employee.status === "active" ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>{employee.name}</CardTitle>
          <CardDescription>
            Update employee information. Email changes will take effect on next
            login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6" noValidate>
            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Personal Information
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    error={fieldErrors.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    error={fieldErrors.phone}
                  />
                </div>
              </div>
            </div>

            {/* Account */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Account
              </h3>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  error={fieldErrors.email}
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Role
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">
                    Role <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setField("role", v)}
                  >
                    <SelectTrigger id="role" error={fieldErrors.role}>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="mechanic">Mechanic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty</Label>
                  <Input
                    id="specialty"
                    placeholder="e.g. Engine, Electrical"
                    value={form.specialty}
                    onChange={(e) => setField("specialty", e.target.value)}
                    error={fieldErrors.specialty}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                isLoading={isSaving}
                className="min-w-[100px]"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Manage password and account access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reset Password */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                Set a new password for this employee.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetPasswordOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              Reset Password
            </Button>
          </div>

          <Separator />

          {/* Activate / Deactivate */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Account Status</p>
              <p className="text-xs text-muted-foreground">
                {employee.status === "active"
                  ? "Employee can currently access the system."
                  : "Employee is currently blocked from the system."}
              </p>
            </div>
            <Button
              variant={employee.status === "active" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setStatusDialogOpen(true)}
            >
              {employee.status === "active" ? (
                <>
                  <UserX className="h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {employee.name}. They will need to use this
              new password on their next login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {passwordError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError("");
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError("");
                }}
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" isLoading={isResettingPassword}>
                {isResettingPassword ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Confirmation Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {employee.status === "active"
                ? "Deactivate Employee"
                : "Activate Employee"}
            </DialogTitle>
            <DialogDescription>
              {employee.status === "active"
                ? `Are you sure you want to deactivate ${employee.name}? They will no longer be able to log in.`
                : `Are you sure you want to activate ${employee.name}? They will be able to log in again.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant={employee.status === "active" ? "destructive" : "default"}
              isLoading={isTogglingStatus}
              onClick={handleToggleStatus}
            >
              {isTogglingStatus
                ? employee.status === "active"
                  ? "Deactivating..."
                  : "Activating..."
                : employee.status === "active"
                  ? "Yes, Deactivate"
                  : "Yes, Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
