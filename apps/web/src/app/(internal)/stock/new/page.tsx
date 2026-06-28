"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Package } from "lucide-react";
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
  "Engine",
  "Transmission",
  "Brakes",
  "Suspension",
  "Electrical",
  "Body",
  "Interior",
  "Fluids",
  "Filters",
  "Belts & Hoses",
  "Tools",
  "Other",
];

interface CreatePartForm {
  name: string;
  reference: string;
  category: string;
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

  const [form, setForm] = useState<CreatePartForm>({
    name: "",
    reference: "",
    category: "",
    unitCost: "",
    minThreshold: "5",
    supplier: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<CreatePartForm>>({});

  function updateForm(field: keyof CreatePartForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }

  function validateForm(): boolean {
    const newErrors: Partial<CreatePartForm> = {};

    if (!form.name.trim()) {
      newErrors.name = "Part name is required";
    }

    if (!form.reference.trim()) {
      newErrors.reference = "Reference number is required";
    }

    if (!form.category) {
      newErrors.category = "Category is required";
    }

    const unitCost = parseFloat(form.unitCost);
    if (!form.unitCost || isNaN(unitCost) || unitCost <= 0) {
      newErrors.unitCost = "Valid unit cost is required";
    }

    const minThreshold = parseInt(form.minThreshold);
    if (!form.minThreshold || isNaN(minThreshold) || minThreshold < 0) {
      newErrors.minThreshold = "Valid minimum threshold is required";
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
      const payload = {
        name: form.name.trim(),
        reference: form.reference.trim(),
        category: form.category,
        unitCost: parseFloat(form.unitCost),
        minThreshold: parseInt(form.minThreshold),
        supplier: form.supplier.trim() || undefined,
      };

      const response = await api.post<{ data: { id: string } }>("/parts", payload);
      
      success("Part created successfully");
      router.push(`/stock/${response.data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && typeof err.details === "object") {
          // Handle field-specific validation errors
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
            toastError("Creation failed", err.message);
          }
        } else {
          toastError("Creation failed", err.message);
        }
      } else {
        toastError("Creation failed", "An unexpected error occurred.");
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
            <ArrowLeft className="h-4 w-4" />
            Back to Stock
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Create New Part</h1>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle>Part Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Part Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="e.g., Brake Pad Set"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">
                  Reference Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reference"
                  value={form.reference}
                  onChange={(e) => updateForm("reference", e.target.value.toUpperCase())}
                  placeholder="e.g., BP-001"
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
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={form.category} onValueChange={(value) => updateForm("category", value)}>
                <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category}</p>
              )}
            </div>

            {/* Pricing & Stock */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unitCost">
                  Unit Cost (MAD) <span className="text-destructive">*</span>
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
                  Minimum Stock Threshold <span className="text-destructive">*</span>
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
                  Alert when stock falls below this level
                </p>
                {errors.minThreshold && (
                  <p className="text-sm text-destructive">{errors.minThreshold}</p>
                )}
              </div>
            </div>

            {/* Supplier (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier (Optional)</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(e) => updateForm("supplier", e.target.value)}
                placeholder="e.g., ABC Auto Parts"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/stock")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Part
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Card */}
      {(form.name || form.reference || form.category || form.unitCost) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              {form.name && (
                <>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{form.name}</dd>
                </>
              )}
              {form.reference && (
                <>
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono">{form.reference}</dd>
                </>
              )}
              {form.category && (
                <>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{form.category}</dd>
                </>
              )}
              {previewUnitCost > 0 && (
                <>
                  <dt className="text-muted-foreground">Unit Cost</dt>
                  <dd className="font-medium">{formatCurrency(previewUnitCost)}</dd>
                </>
              )}
              {form.minThreshold && (
                <>
                  <dt className="text-muted-foreground">Min Threshold</dt>
                  <dd>{form.minThreshold} units</dd>
                </>
              )}
              {form.supplier && (
                <>
                  <dt className="text-muted-foreground">Supplier</dt>
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