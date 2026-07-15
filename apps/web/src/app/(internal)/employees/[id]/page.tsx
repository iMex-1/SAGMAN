"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { normalizePhone } from "@/lib/phone";
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
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "manager" | "mechanic";
  specialty?: string;
  cin?: string;
  address?: string;
  imageUrl?: string;
  status: "active" | "inactive" | "deleted";
  createdAt: string;
  updatedAt?: string;
}

interface EmployeeResponse {
  data: Employee;
}

interface FieldErrors {
  name?: string;
  phone?: string;
  role?: string;
  specialty?: string;
  cin?: string;
  address?: string;
}

export default function EmployeeDetailPage() {
  const t = useTranslations();
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
    phone: "",
    role: "",
    specialty: "",
    cin: "",
    address: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Image error fallback
  const [profileImgError, setProfileImgError] = useState(false);

  const fetchEmployee = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<EmployeeResponse>(`/employees/${employeeId}`);
      const emp = res.data;
      setEmployee(emp);
      setForm({
        name: emp.name,
        phone: normalizePhone(emp.phone ?? ""),
        role: emp.role,
        specialty: emp.specialty ?? "",
        cin: emp.cin ?? "",
        address: emp.address ?? "",
      });
      setImagePreview(emp.imageUrl ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(
          err.statusCode === 404 ? t('employee.errors.notFound') : err.message,
        );
      } else {
        setLoadError(t('employee.errors.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    fetchEmployee();
  }, [fetchEmployee]);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm(): boolean {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = t('employee.validation.nameRequired');
    if (!form.role) errors.role = t('employee.validation.roleRequired');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      let imageUrl = employee?.imageUrl;
      if (imageFile) {
        setUploadingImage(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
        const uploadRes = await api.post<{ url: string }>(
          '/uploads/employee-image',
          { image: base64, mimeType: imageFile.type },
        );
        imageUrl = uploadRes.url;
        setUploadingImage(false);
      }

      const res = await api.patch<EmployeeResponse>(
        `/employees/${employeeId}`,
        {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          specialty: form.specialty.trim() || undefined,
          cin: form.cin.trim() || undefined,
          address: form.address.trim() || undefined,
          imageUrl,
        },
      );
      setEmployee(res.data);
      success(t('employee.edit.success'));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 422 && err.details) {
          setFieldErrors(err.details as Record<string, string>);
        } else {
          toastError(t('common.error'), err.message);
        }
      } else {
        toastError(t('common.error'), t('employee.errors.generic'));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!employee) return;
    setIsDeleting(true);
    try {
      await api.patch(`/employees/${employeeId}/delete`);
      success(t('employee.delete.success', { name: employee.name }));
      setDeleteDialogOpen(false);
      router.push("/employees");
    } catch (err) {
      if (err instanceof ApiError) {
        toastError(t('common.error'), err.message);
      } else {
        toastError(t('common.error'), t('employee.errors.generic'));
      }
    } finally {
      setIsDeleting(false);
    }
  }

  // --- Render states ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !employee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employees">
            <Icon name="arrow_back" size={16} />
            {t('employee.create.backLink')}
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{loadError ?? t('employee.errors.notFound')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmployee}
            className="ml-auto"
          >
            {t('common.retry')}
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
            <Icon name="arrow_back" size={16} />
            {t('employee.create.backLink')}
          </Link>
        </Button>
        <div className="flex-1" />
        <Badge
          variant={employee.status === "active" ? "success" : "outline"}
          className="text-sm"
        >
          {employee.status === "active" ? t('employee.status.active') : t('employee.status.inactive')}
        </Badge>
      </div>

      {/* Edit Form */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-4">
            {employee.imageUrl && !profileImgError ? (
              <img
                src={employee.imageUrl}
                alt={employee.name}
                className="w-16 h-16 rounded-full object-cover border"
                onError={() => setProfileImgError(true)}
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary select-none">
                {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <CardTitle className="font-headline-lg text-headline-lg">{employee.name}</CardTitle>
              <CardDescription className="font-body-md text-body-md text-on-surface-variant">
                {t('employee.edit.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6" noValidate>
            {/* Personal Info */}
            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {t('employee.sections.personalInfo')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t('employee.fields.fullName')} <span className="text-destructive">*</span>
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
                  <Label htmlFor="phone">{t('employee.fields.phone')}</Label>
                  <PhoneInput
                    id="phone"
                    value={form.phone}
                    onChange={(v) => setField("phone", v)}
                    error={fieldErrors.phone}
                  />
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {t('employee.sections.additionalInfo')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cin">{t('employee.fields.cin')}</Label>
                  <Input
                    id="cin"
                    value={form.cin}
                    onChange={(e) => setField("cin", e.target.value)}
                    error={fieldErrors.cin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('employee.fields.address')}</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    error={fieldErrors.address}
                  />
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {t('employee.fields.role')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">
                    {t('employee.fields.role')} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setField("role", v)}
                  >
                    <SelectTrigger id="role" error={fieldErrors.role}>
                      <SelectValue placeholder={t('employee.placeholders.role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">{t('employee.roles.manager')}</SelectItem>
                      <SelectItem value="mechanic">{t('employee.roles.mechanic')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">{t('employee.fields.specialty')}</Label>
                  <Input
                    id="specialty"
                    placeholder={t('employee.placeholders.specialty')}
                    value={form.specialty}
                    onChange={(e) => setField("specialty", e.target.value)}
                    error={fieldErrors.specialty}
                  />
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="space-y-4">
              <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wide">
                {t('employee.fields.photo')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="image">{t('employee.fields.photo')}</Label>
                <div className="flex items-center gap-3">
                  {imagePreview && (
                    <img src={imagePreview} alt={t('common.preview')} className="w-14 h-14 rounded-full object-cover border" />
                  )}
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setImageFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setImagePreview(employee?.imageUrl ?? null);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSaving || uploadingImage}
                isLoading={isSaving || uploadingImage}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md min-w-[100px]"
              >
                {uploadingImage ? t('employee.create.uploading') : isSaving ? t('common.saving') : t('employee.edit.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Delete section */}
      <Card className="bg-white border border-destructive/20 rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-title-md text-title-md text-destructive">{t('employee.actions.delete')}</CardTitle>
          <CardDescription className="font-body-md text-body-md text-on-surface-variant">
            {t('employee.actions.deleteDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Icon name="delete" size={16} />
            {t('employee.actions.delete')}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('employee.actions.delete')}</DialogTitle>
            <DialogDescription>
              {t('employee.actions.deleteConfirm', { name: employee.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border border-outline-variant text-on-surface-variant">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              isLoading={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? t('common.deleting') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
