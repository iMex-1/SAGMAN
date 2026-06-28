"use client";

import { Suspense } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, X, CheckCircle2 } from "lucide-react";
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
      setFormError("Please select a car.");
      return;
    }
    if (!primaryMechanicId) {
      setFormError("Please select a primary mechanic.");
      return;
    }
    if (!description.trim()) {
      setFormError("Please enter a description / reported issue.");
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
      toast({ title: "Repair created successfully", variant: "default" });
      router.push(`/repairs/${res.data.id}`);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to create repair.",
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
            <ArrowLeft className="h-4 w-4" />
            Back to Repairs
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Repair</CardTitle>
          <CardDescription>Register a new vehicle repair job.</CardDescription>
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
                Car (Matricule) <span className="text-destructive">*</span>
              </Label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="car-search"
                    placeholder="Search by matricule..."
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
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {carLoading && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
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
                          <span className="font-semibold">{car.matricule}</span>
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
                      No cars found.
                    </div>
                  )}
              </div>

              {/* Selected car info */}
              {selectedCar && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
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
                Primary Mechanic <span className="text-destructive">*</span>
              </Label>
              {mechanicsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading mechanics...
                </div>
              ) : (
                <Select
                  value={primaryMechanicId}
                  onValueChange={setPrimaryMechanicId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mechanic..." />
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
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">🚨 Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description / Reported Issue{" "}
                <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Describe the issue reported by the client..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Internal Notes */}
            <div className="space-y-2">
              <Label htmlFor="internal-notes">Internal Notes</Label>
              <textarea
                id="internal-notes"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="Notes visible only to staff..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>

            {/* Date + Duration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target-date">Target Completion Date</Label>
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="est-hours">Estimated Duration (hours)</Label>
                <Input
                  id="est-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 4"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" isLoading={submitting}>
                {submitting ? "Creating..." : "Create Repair"}
              </Button>
              <Button variant="outline" type="button" asChild>
                <Link href="/repairs">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewRepairPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-muted-foreground">Loading...</div>}
    >
      <NewRepairPageContent />
    </Suspense>
  );
}
