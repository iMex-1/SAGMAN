"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useTranslations } from "next-intl";

interface Part {
  id: string;
  name: string;
  reference?: string;
  category: string;
  unitCost: number;
  quantity: number;
  minThreshold: number;
  supplier?: string;
  isLowStock?: boolean;
  createdAt: string;
}

interface PartsResponse {
  data: Part[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface AddStockResponse {
  data: { id: string };
}

type FilterTab = "all" | "low_stock";

export default function StockPage() {
  const t = useTranslations();
  const { toast } = useToast();

  const CATEGORY_LABELS: Record<string, string> = {
    Engine: t('stock.categories.Engine'),
    Brakes: t('stock.categories.Brakes'),
    Electrical: t('stock.categories.Electrical'),
    Bodywork: t('stock.categories.Bodywork'),
    Suspension: t('stock.categories.Suspension'),
    Other: t('stock.categories.Other'),
  };
  const CATEGORIES = Object.keys(CATEGORY_LABELS);

  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lowStockCount, setLowStockCount] = useState(0);

  const [addStockPart, setAddStockPart] = useState<Part | null>(null);
  const [addQty, setAddQty] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const [adjustStockPart, setAdjustStockPart] = useState<Part | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filterTab === "low_stock") params.set("lowStock", "true");
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await api.get<PartsResponse>(`/parts?${params.toString()}`);
      setParts(res.data);
      setTotalPages(res.meta.totalPages);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('stock.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterTab, categoryFilter, page]);

  const loadLowStockCount = useCallback(async () => {
    try {
      const res = await api.get<PartsResponse>("/parts?lowStock=true&limit=1");
      setLowStockCount(res.meta.total);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => { loadParts(); }, [loadParts]);
  useEffect(() => { loadLowStockCount(); }, [loadLowStockCount]);

  async function handleAddStock() {
    if (!addStockPart) return;
    const qty = parseInt(addQty, 10);
    if (!addQty || isNaN(qty) || qty <= 0) {
      toast({ title: t('stock.errors.invalidQuantity'), description: t('stock.errors.positiveNumber'), variant: "error" });
      return;
    }
    setAddBusy(true);
    try {
      await api.post<AddStockResponse>(`/parts/${addStockPart.id}/stock`, {
        quantity: qty,
        note: addNote || undefined,
      });
      toast({ title: t('stock.stockAdded'), description: `${qty} ${t('stock.fields.quantity')} "${addStockPart.name}"`, variant: "default" });
      setAddStockPart(null);
      setAddQty("");
      setAddNote("");
      loadParts();
      loadLowStockCount();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : t('stock.errors.addFailed'),
        variant: "error",
      });
    } finally {
      setAddBusy(false);
    }
  }

  async function handleAdjustStock() {
    if (!adjustStockPart) return;
    const qtyChange = parseInt(adjustQty, 10);
    if (!adjustQty || isNaN(qtyChange) || qtyChange === 0) {
      toast({ title: t('stock.errors.invalidQuantity'), description: t('stock.errors.nonZeroNumber'), variant: "error" });
      return;
    }
    if (!adjustNote.trim()) {
      toast({ title: t('stock.errors.noteRequired'), description: t('stock.errors.adjustmentReason'), variant: "error" });
      return;
    }
    setAdjustBusy(true);
    try {
      await api.post(`/parts/${adjustStockPart.id}/adjust`, {
        quantityChange: qtyChange,
        note: adjustNote.trim(),
      });
      toast({
        title: t('stock.stockAdjusted'),
        description: `${Math.abs(qtyChange)} ${t('stock.fields.quantity')} "${adjustStockPart.name}"`,
        variant: "default",
      });
      setAdjustStockPart(null);
      setAdjustQty("");
      setAdjustNote("");
      loadParts();
      loadLowStockCount();
    } catch (err) {
      toast({
        title: t('common.error'),
        description: err instanceof ApiError ? err.message : t('stock.errors.adjustFailed'),
        variant: "error",
      });
    } finally {
      setAdjustBusy(false);
    }
  }

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 className="font-headline-xl text-headline-xl text-primary">{t('stock.title')}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">{t('stock.title')}</p>
        </div>
        <Link
          href="/stock/new"
          className="inline-flex items-center gap-sm bg-primary text-on-primary font-title-md text-title-md px-lg py-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          <Icon name="add" size={20} />
          {t('stock.newPart')}
        </Link>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <button
          onClick={() => { setFilterTab("low_stock"); setCategoryFilter("all"); setPage(1); }}
          className="w-full flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <Icon name="warning" size={20} className="text-amber-600" filled />
          <span className="text-sm font-medium">
            {lowStockCount} {t('stock.lowStock')} — {t('common.filter')}
          </span>
        </button>
      )}

      {/* Main card */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-md flex flex-wrap items-center gap-md border-b border-outline-variant">
          <div className="flex bg-surface-container rounded-lg p-xs">
            {([
              { label: t('common.all'), value: "all" as FilterTab },
              { label: t('stock.lowStock'), value: "low_stock" as FilterTab },
            ]).map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setFilterTab(tab.value); setPage(1); }}
                className={cn(
                  "px-md py-xs rounded-md font-label-sm text-label-sm transition-colors",
                  filterTab === tab.value
                    ? "bg-white text-primary shadow-sm"
                    : "text-on-surface-variant hover:text-primary",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="w-40">
            <Select
              value={categoryFilter}
              onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}
            >
              <SelectTrigger className="bg-surface border border-outline-variant rounded-lg">
                <SelectValue placeholder={t('stock.fields.category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('stock.allCategories')}</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-48 relative">
            <Icon name="search" size={18} className="absolute left-md top-1/2 -translate-y-1/2 text-outline" />
            <input
              placeholder={t('stock.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-xl pr-md py-sm bg-surface border border-outline-variant rounded-lg font-body-md text-body-md outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Icon name="sync" size={36} className="text-on-surface-variant animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-lg text-error">
            <Icon name="error" size={20} filled />
            <p className="text-sm flex-1">{error}</p>
            <Button variant="outline" size="sm" onClick={loadParts}>{t('common.retry')}</Button>
          </div>
        ) : parts.length === 0 ? (
          <div className="p-xl text-center">
            <Icon name="inventory_2" size={48} className="text-outline-variant mx-auto mb-md" />
            <p className="text-on-surface-variant">{t('stock.empty.noResults')}</p>
            <Link href="/stock/new" className="inline-block mt-md px-lg py-sm bg-primary text-on-primary rounded-lg font-title-md text-title-md">
              {t('stock.newPart')}
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('stock.fields.name')}</th>
                    <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">{t('stock.fields.reference')}</th>
                    <th className="px-lg py-md text-left font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden md:table-cell">{t('stock.fields.category')}</th>
                    <th className="px-lg py-md text-right font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('stock.fields.quantity')}</th>
                    <th className="px-lg py-md text-right font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">{t('stock.fields.minThreshold')}</th>
                    <th className="px-lg py-md text-right font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider hidden lg:table-cell">{t('stock.fields.unitCost')}</th>
                    <th className="px-lg py-md text-right font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {parts.map((part) => {
                    const isEmpty = part.quantity === 0;
                    const isLow = part.isLowStock && !isEmpty;
                    return (
                      <tr
                        key={part.id}
                        className={cn(
                          "transition-colors hover:bg-surface-container-low",
                          isEmpty && "bg-error-container/10",
                          isLow && "bg-amber-50",
                        )}
                      >
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-md">
                            <div className="w-10 h-10 bg-primary-container/10 flex items-center justify-center rounded text-primary">
                              <Icon name="inventory_2" size={20} />
                            </div>
                            <div>
                              <p className="font-body-md text-body-md font-bold text-on-surface">{part.name}</p>
                              {part.supplier && (
                                <p className="font-label-sm text-label-sm text-on-surface-variant">{part.supplier}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-md text-on-surface-variant hidden sm:table-cell font-body-md text-body-md">
                          {part.reference || "—"}
                        </td>
                        <td className="px-lg py-md hidden md:table-cell">
                          <span className="inline-flex items-center px-sm py-xs rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm font-bold">
                            {CATEGORY_LABELS[part.category] ?? part.category}
                          </span>
                        </td>
                        <td className="px-lg py-md text-right">
                          <span
                            className={cn(
                              "font-body-md text-body-md font-bold",
                              isEmpty ? "text-error" : isLow ? "text-amber-700" : "text-on-surface",
                            )}
                          >
                            {part.quantity}
                          </span>
                        </td>
                        <td className="px-lg py-md text-right text-on-surface-variant hidden lg:table-cell font-body-md text-body-md">
                          {part.minThreshold}
                        </td>
                        <td className="px-lg py-md text-right text-on-surface-variant hidden lg:table-cell font-body-md text-body-md">
                          {Number(part.unitCost).toFixed(2)} MAD
                        </td>
                        <td className="px-lg py-md text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/stock/${part.id}`}
                              className="p-sm hover:bg-surface-container rounded transition-colors text-primary"
                              title={t('common.view')}
                            >
                              <Icon name="visibility" size={20} />
                            </Link>
                            <button
                              onClick={() => { setAddStockPart(part); setAddQty(""); setAddNote(""); }}
                              className="p-sm hover:bg-surface-container rounded transition-colors text-primary"
                              title={t('stock.addStock')}
                            >
                              <Icon name="add_shopping_cart" size={20} />
                            </button>
                            <button
                              onClick={() => { setAdjustStockPart(part); setAdjustQty(""); setAdjustNote(""); }}
                              className="p-sm hover:bg-surface-container rounded transition-colors text-on-surface-variant"
                              title={t('stock.adjustStock')}
                            >
                              <Icon name="tune" size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-md flex items-center justify-between border-t border-outline-variant bg-surface-container-low">
                <p className="font-label-sm text-label-sm text-on-surface-variant">{t('stock.totalParts').replace('{total}', String(total))}</p>
                <div className="flex items-center gap-sm">
                  <button
                    className="p-xs rounded border border-outline-variant text-on-surface-variant hover:bg-white disabled:opacity-50"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <Icon name="chevron_left" size={20} />
                  </button>
                  <span className="font-label-sm text-label-sm px-sm font-bold">{t('common.page')} {page} {t('common.of')} {totalPages}</span>
                  <button
                    className="p-xs rounded border border-outline-variant text-on-surface-variant hover:bg-white disabled:opacity-50"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <Icon name="chevron_right" size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add stock dialog */}
      <Dialog open={!!addStockPart} onOpenChange={(open) => { if (!open) setAddStockPart(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('stock.addStock')}</DialogTitle>
            <DialogDescription>
              {addStockPart
                ? `${t('stock.addStock')} "${addStockPart.name}" (${addStockPart.quantity})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-qty">{t('stock.addQuantity')}</Label>
              <Input id="add-qty" type="number" min="1" placeholder={t('stock.addQuantityPlaceholder')} value={addQty} onChange={(e) => setAddQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-note">{t('stock.noteOptional')}</Label>
              <Input id="add-note" placeholder={t('stock.notePlaceholder')} value={addNote} onChange={(e) => setAddNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStockPart(null)} disabled={addBusy}>{t('common.cancel')}</Button>
            <Button onClick={handleAddStock} disabled={addBusy}>
              {addBusy && <Icon name="sync" size={16} className="animate-spin mr-2" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjustStockPart} onOpenChange={(open) => { if (!open) setAdjustStockPart(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('stock.adjustStock')}</DialogTitle>
            <DialogDescription>
              {adjustStockPart
                ? `${t('stock.adjustStock')} "${adjustStockPart.name}" (${adjustStockPart.quantity})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-qty">{t('stock.quantityChange')}</Label>
              <Input id="adjust-qty" type="number" placeholder={t('stock.quantityChangePlaceholder')} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              {adjustStockPart && adjustQty && !isNaN(parseInt(adjustQty)) && (
                <p className="text-xs text-on-surface-variant">
                  {t('stock.newStockValue').replace('{qty}', String(adjustStockPart.quantity + parseInt(adjustQty)))}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">{t('stock.adjustmentReason')}</Label>
              <textarea
                id="adjust-note"
                rows={3}
                placeholder={t('stock.adjustmentReasonPlaceholder')}
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                className="w-full resize-none rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary font-body-md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustStockPart(null)} disabled={adjustBusy}>{t('common.cancel')}</Button>
            <Button onClick={handleAdjustStock} disabled={adjustBusy}>
              {adjustBusy && <Icon name="sync" size={16} className="animate-spin mr-2" />}
{t('stock.confirmAdjust')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
