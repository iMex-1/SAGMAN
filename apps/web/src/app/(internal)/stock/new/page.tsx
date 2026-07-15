"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from 'next-intl';
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = [
  "Moteur",
  "Transmission",
  "Freins",
  "Suspension",
  "Électrique",
  "Carrosserie",
  "Intérieur",
  "Fluides",
  "Filtres",
  "Courroies & Durites",
  "Outils",
  "Autre",
];

interface CreatePartForm {
  name: string;
  reference: string;
  category: string;
  customCategory: string;
  unitCost: string;
  minThreshold: string;
  supplier: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(amount);
}

export default function CreatePartPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const t = useTranslations();

  const [form, setForm] = useState<CreatePartForm>({
    name: "",
    reference: "",
    category: "",
    customCategory: "",
    unitCost: "",
    minThreshold: "5",
    supplier: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<CreatePartForm>>({});

  function updateForm(field: keyof CreatePartForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  function validateForm(): boolean {
    const newErrors: Partial<CreatePartForm> = {};

    if (!form.name.trim()) {
      newErrors.name = t('stock.validation.nameRequired');
    }

    if (!form.reference.trim()) {
      newErrors.reference = t('stock.validation.refRequired');
    }

    if (!form.category) {
      newErrors.category = t('stock.validation.categoryRequired');
    }

    const unitCost = parseFloat(form.unitCost);
    if (!form.unitCost || isNaN(unitCost) || unitCost <= 0) {
      newErrors.unitCost = t('stock.validation.priceRequired');
    }

    const minThreshold = parseInt(form.minThreshold);
    if (!form.minThreshold || isNaN(minThreshold) || minThreshold < 0) {
      newErrors.minThreshold = t('stock.validation.minStockRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const category = form.category === "Autre" ? form.customCategory.trim() : form.category;
      if (form.category === "Autre" && !category) {
        setErrors(prev => ({ ...prev, category: t('stock.validation.customCategoryRequired') }));
        setIsSubmitting(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        reference: form.reference.trim(),
        category,
        unitCost: parseFloat(form.unitCost),
        minThreshold: parseInt(form.minThreshold),
        supplier: form.supplier.trim() || undefined,
      };

      const response = await api.post<{ data: { id: string } }>("/parts", payload);
      
      success(t('stock.toasts.created'));
      router.push(`/stock/${response.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && typeof err.details === "object") {
          const apiErrors = err.details as Record<string, string>;
          const formErrors: Partial<CreatePartForm> = {};
          
          Object.entries(apiErrors).forEach(([field, message]) => {
            if (field in form) {
              formErrors[field as keyof CreatePartForm] = message;
            }
          });
          
          if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
          } else {
            toastError(t('stock.toasts.errorTitle'), err.message);
          }
        } else {
          toastError(t('stock.toasts.errorTitle'), err.message);
        }
      } else {
        toastError(t('stock.toasts.errorTitle'), t('stock.toasts.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const previewUnitCost = form.unitCost ? parseFloat(form.unitCost) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stock">
            <Icon name="arrow_back" size={16} />
            {t('stock.create.backLink')}
          </Link>
        </Button>
        <h1 className="text-xl font-bold">{t('stock.create.title')}</h1>
      </div>

      {/* Form Card */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon name="package" size={20} />
            <CardTitle className="font-headline-lg text-headline-lg">{t('stock.create.partInfo')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t('stock.fields.name')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder={t('stock.placeholders.name')}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">
                  {t('stock.fields.reference')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reference"
                  value={form.reference}
                  onChange={(e) => updateForm("reference", e.target.value.toUpperCase())}
                  placeholder={t('stock.placeholders.reference')}
                  className={errors.reference ? "border-destructive" : ""}
                />
                {errors.reference && (
                  <p className="text-sm text-destructive">{errors.reference}</p>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">
                {t('stock.fields.category')} <span className="text-destructive">*</span>
              </Label>
              <Select value={form.category} onValueChange={(value) => updateForm("category", value)}>
                <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder={t('stock.placeholders.category')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t('stock.categoriesMap.' + category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.category === "Autre" && (
                <div className="mt-2">
                  <Input
                    id="customCategory"
                    placeholder={t('stock.placeholders.customCategory')}
                    value={form.customCategory}
                    onChange={(e) => setForm(prev => ({ ...prev, customCategory: e.target.value }))}
                  />
                </div>
              )}
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category}</p>
              )}
            </div>

            {/* Pricing & Stock */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitCost">
                  {t('stock.fields.unitPrice')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitCost}
                  onChange={(e) => updateForm("unitCost", e.target.value)}
                  placeholder="0.00"
                  className={errors.unitCost ? "border-destructive" : ""}
                />
                {previewUnitCost > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(previewUnitCost)}
                  </p>
                )}
                {errors.unitCost && (
                  <p className="text-sm text-destructive">{errors.unitCost}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="minThreshold">
                  {t('stock.fields.minStock')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="minThreshold"
                  type="number"
                  min="0"
                  value={form.minThreshold}
                  onChange={(e) => updateForm("minThreshold", e.target.value)}
                  placeholder="5"
                  className={errors.minThreshold ? "border-destructive" : ""}
                />
                <p className="text-sm text-muted-foreground">
                  {t('stock.fields.stockAlert')}
                </p>
                {errors.minThreshold && (
                  <p className="text-sm text-destructive">{errors.minThreshold}</p>
                )}
              </div>
            </div>

            {/* Supplier (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="supplier">{t('stock.fields.supplier')}</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(e) => updateForm("supplier", e.target.value)}
                placeholder={t('stock.placeholders.supplier')}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/stock")}
                disabled={isSubmitting}
                className="border border-outline-variant text-on-surface-variant"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
                {isSubmitting && <Icon name="sync" size={16} className="animate-spin" />}
                {isSubmitting ? t('stock.create.submitting') : t('stock.create.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Card */}
      {(form.name || form.reference || form.category || form.unitCost) && (
        <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="font-body-lg text-body-lg">{t('stock.preview.title')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              {form.name && (
                <>
                  <dt className="text-muted-foreground">{t('stock.preview.name')}</dt>
                  <dd className="font-medium">{form.name}</dd>
                </>
              )}
              {form.reference && (
                <>
                  <dt className="text-muted-foreground">{t('stock.preview.reference')}</dt>
                  <dd className="font-mono">{form.reference}</dd>
                </>
              )}
              {(form.category || form.customCategory) && (
                <>
                  <dt className="text-muted-foreground">{t('stock.preview.category')}</dt>
                  <dd>{form.category === "Autre" ? form.customCategory : form.category}</dd>
                </>
              )}
              {previewUnitCost > 0 && (
                <>
                  <dt className="text-muted-foreground">{t('stock.preview.unitPrice')}</dt>
                  <dd className="font-medium">{formatCurrency(previewUnitCost)}</dd>
                </>
              )}
              {form.minThreshold && (
                <>
                  <dt className="text-muted-foreground">{t('stock.preview.minStock')}</dt>
                  <dd>{form.minThreshold} {t('stock.preview.units')}</dd>
                </>
              )}
              {form.supplier && (
                <>
                  <dt className="text-muted-foreground">{t('stock.preview.supplier')}</dt>
                  <dd>{form.supplier}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
