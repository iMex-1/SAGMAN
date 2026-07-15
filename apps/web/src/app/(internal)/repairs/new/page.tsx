"use client";

import { Suspense } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface Car {
  id: string;
  matricule: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  client?: { id: string; name: string; phone: string };
}

interface Employee {
  id: string;
  name: string;
  specialty?: string;
}

interface CarsResponse {
  data: Car[];
  meta?: { total: number };
}

interface EmployeesResponse {
  data: Employee[];
  meta?: { total: number };
}

interface CreateRepairResponse {
  data: { id: string };
}

function NewRepairPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Car search
  const [carQuery, setCarQuery] = useState("");
  const [carResults, setCarResults] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [carLoading, setCarLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mechanics
  const [mechanics, setMechanics] = useState<Employee[]>([]);
  const [mechanicsLoading, setMechanicsLoading] = useState(true);

  // Form fields
  const [primaryMechanicId, setPrimaryMechanicId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pre-fill carId from URL param
  const prefilledCarId = searchParams.get("carId");

  // Load pre-filled car if carId in URL
  useEffect(() => {
    if (!prefilledCarId) return;
    api
      .get<{ data: Car }>(`/cars/${prefilledCarId}`)
      .then((res) => {
        setSelectedCar(res.data);
        setCarQuery(res.data.matricule);
      })
      .catch(() => {
        // ignore — user can search manually
      });
  }, [prefilledCarId]);

  // Load mechanics
  useEffect(() => {
    api
      .get<EmployeesResponse>("/employees?role=mechanic&status=active")
      .then((res) => setMechanics(res.data))
      .catch(() => setMechanics([]))
      .finally(() => setMechanicsLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced car search
  const searchCars = useCallback((query: string) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) {
      setCarResults([]);
      setShowDropdown(false);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setCarLoading(true);
      try {
        const res = await api.get<CarsResponse>(
          `/cars?q=${encodeURIComponent(query)}&limit=5`,
        );
        setCarResults(res.data);
        setShowDropdown(true);
      } catch {
        setCarResults([]);
      } finally {
        setCarLoading(false);
      }
    }, 300);
  }, []);

  function handleCarQueryChange(value: string) {
    setCarQuery(value);
    if (selectedCar) {
      setSelectedCar(null);
    }
    searchCars(value);
  }

  function handleSelectCar(car: Car) {
    setSelectedCar(car);
    setCarQuery(car.matricule);
    setShowDropdown(false);
    setCarResults([]);
  }

  function clearCarSelection() {
    setSelectedCar(null);
    setCarQuery("");
    setCarResults([]);
    setShowDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedCar) {
      setFormError(t("repair.validation.vehicleRequired"));
      return;
    }
    if (!primaryMechanicId) {
      setFormError(t("repair.validation.mechanicRequired"));
      return;
    }
    if (!description.trim()) {
      setFormError(t("repair.validation.descriptionRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<CreateRepairResponse>("/repairs", {
        carId: selectedCar.id,
        primaryMechanicId,
        priority,
        description: description.trim(),
        internalNotes: internalNotes.trim() || undefined,
        targetCompletionDate: targetDate || undefined,
        estimatedDurationHours: estimatedHours
          ? Number(estimatedHours)
          : undefined,
      });
      toast({ title: t("repair.toasts.created"), variant: "default" });
      router.push(`/repairs/${res.data.id}`);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t("repair.toasts.error"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/repairs">
            <Icon name="arrow_back" size={16} />
            {t("repair.create.backLink")}
          </Link>
        </Button>
      </div>

      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline-lg text-headline-lg">
            {t("repair.create.title")}
          </CardTitle>
          <CardDescription className="font-body-md text-body-md text-on-surface-variant">
            {t("repair.create.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {/* Car Search */}
            <div className="space-y-2">
              <Label htmlFor="car-search">
                {t("repair.fields.vehicle")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Icon
                    name="search"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="car-search"
                    placeholder={t("repair.placeholders.searchVehicle")}
                    value={carQuery}
                    onChange={(e) => handleCarQueryChange(e.target.value)}
                    onFocus={() =>
                      carResults.length > 0 && setShowDropdown(true)
                    }
                    className="pl-9 pr-9"
                    autoComplete="off"
                  />
                  {(selectedCar || carQuery) && (
                    <button
                      type="button"
                      onClick={clearCarSelection}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                  {carLoading && (
                    <Icon
                      name="sync"
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
                    />
                  )}
                </div>

                {/* Dropdown results */}
                {showDropdown && carResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-md">
                    {carResults.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => handleSelectCar(car)}
                      >
                        <div>
                          <span className="font-semibold">
                            {car.matricule}
                          </span>
                          <span className="ml-1 text-muted-foreground">
                            {car.make} {car.model}
                            {car.year ? ` (${car.year})` : ""}
                          </span>
                          {car.client && (
                            <span className="ml-1 text-muted-foreground">
                              — {car.client.name}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown &&
                  carResults.length === 0 &&
                  !carLoading &&
                  carQuery.trim() && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-md">
                      {t("repair.placeholders.noVehicleFound")}
                    </div>
                  )}
              </div>

              {/* Selected car info */}
              {selectedCar && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <Icon
                    name="check_circle"
                    size={16}
                    className="text-green-600 shrink-0"
                  />
                  <div>
                    <span className="font-semibold text-green-700">
                      {selectedCar.matricule}
                    </span>
                    <span className="ml-1 text-green-600">
                      — {selectedCar.make} {selectedCar.model}
                      {selectedCar.year ? ` (${selectedCar.year})` : ""}
                    </span>
                    {selectedCar.client && (
                      <span className="ml-1 text-green-600">
                        — {selectedCar.client.name}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Primary Mechanic */}
            <div className="space-y-2">
              <Label>
                {t("repair.fields.mechanic")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              {mechanicsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="sync" size={16} className="animate-spin" />
                  {t("repair.placeholders.loadingMechanics")}
                </div>
              ) : (
                <Select
                  value={primaryMechanicId}
                  onValueChange={setPrimaryMechanicId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("repair.placeholders.selectMechanic")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {mechanics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.specialty ? ` — ${m.specialty}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>{t("repair.fields.priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    {t("repair.priorities.low")}
                  </SelectItem>
                  <SelectItem value="normal">
                    {t("repair.priorities.normal")}
                  </SelectItem>
                  <SelectItem value="high">
                    {t("repair.priorities.high")}
                  </SelectItem>
                  <SelectItem value="emergency">
                    {t("repair.priorities.urgent")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t("repair.fields.description")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder={t("repair.placeholders.description")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Internal Notes */}
            <div className="space-y-2">
              <Label htmlFor="internal-notes">
                {t("repair.fields.internalNotes")}
              </Label>
              <textarea
                id="internal-notes"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder={t("repair.placeholders.internalNotes")}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>

            {/* Date + Duration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target-date">
                  {t("repair.fields.targetDate")}
                </Label>
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-hours">
                  {t("repair.fields.estimatedHours")}
                </Label>
                <Input
                  id="est-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={t("repair.placeholders.estimatedHours")}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                isLoading={submitting}
                className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md"
              >
                {submitting
                  ? t("repair.create.submitting")
                  : t("repair.create.submit")}
              </Button>
              <Button
                variant="outline"
                type="button"
                asChild
                className="border border-outline-variant text-on-surface-variant"
              >
                <Link href="/repairs">{t("common.cancel")}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewRepairPage() {
  const t = useTranslations();
  return (
    <Suspense
      fallback={
        <div className="p-6 text-muted-foreground">{t("common.loading")}</div>
      }
    >
      <NewRepairPageContent />
    </Suspense>
  );
}
