"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface Part {
  id: string;
  name: string;
  reference: string;
  category: string;
  unitCost: number;
  quantity: number;
  minThreshold: number;
  supplier?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StockTransaction {
  id: string;
  type: "received" | "used" | "adjusted";
  quantityChange: number;
  stockAfter: number;
  unitCostAtTime?: number;
  note?: string;
  createdAt: string;
  repairId?: string;
  doneBy: {
    id: string;
    name: string;
  };
}

interface StockTransactionsResponse {
  data: StockTransaction[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

const TRANSACTION_ICONS: Record<string, string> = {
  received: "trending_up",
  used: "remove",
  adjusted: "trending_down",
};

const TRANSACTION_COLORS: Record<string, string> = {
  received: "text-green-600",
  used: "text-blue-600",
  adjusted: "text-orange-600",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations();
  const { id } = use(params);
  const { success, error: toastError } = useToast();

  const [part, setPart] = useState<Part | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [transactionsMeta, setTransactionsMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Add Stock dialog
  const [showAddStockDialog, setShowAddStockDialog] = useState(false);
  const [addStockQuantity, setAddStockQuantity] = useState("");
  const [addStockNote, setAddStockNote] = useState("");
  const [addStockReceipt, setAddStockReceipt] = useState<File | null>(null);
  const [addStockReceiptPreview, setAddStockReceiptPreview] = useState<string>("");
  const [addStockLoading, setAddStockLoading] = useState(false);
  const [addStockError, setAddStockError] = useState<string | null>(null);

  // Adjust Stock dialog
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchPart = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Part }>(`/parts/${id}`);
      setPart(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('stock.errors.loadFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  const fetchTransactions = useCallback(async (page = 1) => {
    setTransactionsLoading(true);
    try {
      const res = await api.get<StockTransactionsResponse>(
        `/parts/${id}/transactions?page=${page}&pageSize=10`
      );
      setTransactions(res.data);
      setTransactionsMeta(res.meta);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPart();
    fetchTransactions();
  }, [fetchPart, fetchTransactions]);

  // Add stock handler
  async function handleAddStock() {
    const quantity = parseInt(addStockQuantity);
    if (!quantity || quantity <= 0) {
      setAddStockError(t('stock.addDialog.errors.quantity'));
      return;
    }
    if (!addStockNote.trim()) {
      setAddStockError(t('stock.addDialog.errors.note'));
      return;
    }

    setAddStockLoading(true);
    setAddStockError(null);
    try {
      let receiptImageUrl = "";
      if (addStockReceipt) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(addStockReceipt);
        });
        const uploadRes = await api.post<{ url: string }>("/uploads/stock-receipt", {
          image: base64,
          mimeType: addStockReceipt.type,
        });
        receiptImageUrl = uploadRes.url;
      }

      await api.post(`/parts/${id}/stock`, {
        quantity,
        note: addStockNote.trim(),
        receiptImageUrl: receiptImageUrl || undefined,
      });
      success(t('stock.addDialog.success', { quantity }));
      setShowAddStockDialog(false);
      setAddStockQuantity("");
      setAddStockNote("");
      setAddStockReceipt(null);
      setAddStockReceiptPreview("");
      fetchPart();
      fetchTransactions(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setAddStockError(err.message);
      } else {
        setAddStockError(t('common.unexpectedError'));
      }
    } finally {
      setAddStockLoading(false);
    }
  }

  // Adjust stock handler
  async function handleAdjustStock() {
    const quantityChange = parseInt(adjustQuantity);
    if (!quantityChange || quantityChange === 0) {
      setAdjustError(t('stock.adjustDialog.errors.quantity'));
      return;
    }
    if (!adjustNote.trim()) {
      setAdjustError(t('stock.adjustDialog.errors.reason'));
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await api.post(`/parts/${id}/adjust`, {
        quantityChange,
        note: adjustNote.trim(),
      });
      const key = quantityChange > 0 ? 'stock.adjustDialog.successIncreased' : 'stock.adjustDialog.successDecreased';
      success(t(key, { quantity: Math.abs(quantityChange) }));
      setShowAdjustDialog(false);
      setAdjustQuantity("");
      setAdjustNote("");
      fetchPart();
      fetchTransactions(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setAdjustError(err.message);
      } else {
        setAdjustError(t('common.unexpectedError'));
      }
    } finally {
      setAdjustLoading(false);
    }
  }

  // Render states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !part) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stock">
            <Icon name="arrow_back" size={16} />
            {t('stock.detail.backLink')}
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{error ?? t('stock.detail.notFound')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPart}
            className="ml-auto"
          >
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const isLowStock = part.quantity <= part.minThreshold;

  const typeLabels: Record<string, string> = {
    received: t('stock.detail.received'),
    used: t('stock.detail.used'),
    adjusted: t('stock.detail.adjusted'),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/stock">
            <Icon name="arrow_back" size={16} />
            {t('common.back')}
            </Link>
          </Button>
          <h1 className="font-headline-lg text-headline-lg">{t('stock.detail.title')}</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddStockDialog(true)} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
            <Icon name="add" size={16} />
            {t('stock.detail.addStock')}
          </Button>
          <Button variant="outline" onClick={() => setShowAdjustDialog(true)} className="border border-outline-variant text-on-surface-variant">
            <Icon name="package" size={16} />
            {t('stock.detail.adjust')}
          </Button>
        </div>
      </div>

      {/* Part Info Card */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-title-md text-title-md">{part.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('stock.detail.reference')} {part.reference}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={isLowStock ? "destructive" : "default"}>
                {part.quantity} {t('stock.detail.inStock')}
              </Badge>
              {isLowStock && (
                <Badge variant="outline" className="text-orange-600">
                  {t('stock.detail.lowStock')} {part.minThreshold})
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt className="text-muted-foreground">{t('stock.detail.category')}</dt>
            <dd className="font-medium">{part.category}</dd>

            <dt className="text-muted-foreground">{t('stock.detail.unitPrice')}</dt>
            <dd className="font-medium">{formatCurrency(part.unitCost)}</dd>

            <dt className="text-muted-foreground">{t('stock.detail.currentStock')}</dt>
            <dd className="font-medium">{part.quantity} {t('stock.detail.units')}</dd>

            <dt className="text-muted-foreground">{t('stock.detail.minThreshold')}</dt>
            <dd>{part.minThreshold} {t('stock.detail.units')}</dd>

            {part.supplier && (
              <>
                <dt className="text-muted-foreground">{t('stock.detail.supplier')}</dt>
                <dd>{part.supplier}</dd>
              </>
            )}

            <dt className="text-muted-foreground">{t('stock.detail.stockValue')}</dt>
            <dd className="font-medium">
              {formatCurrency(part.quantity * part.unitCost)}
            </dd>

            <dt className="text-muted-foreground">{t('stock.detail.createdOn')}</dt>
            <dd className="text-muted-foreground">{formatDate(part.createdAt)}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Stock Transactions */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-title-md text-title-md">
              <Icon name="history" size={16} />
              {t('stock.detail.transactions')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('stock.detail.totalTransactions', { count: transactionsMeta.total })}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Icon name="sync" size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Icon name="package" size={48} className="mx-auto opacity-50" />
              <p className="mt-2">{t('stock.detail.noTransactions')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stock.detail.type')}</TableHead>
                    <TableHead>{t('stock.detail.variation')}</TableHead>
                    <TableHead>{t('stock.detail.stockAfter')}</TableHead>
                    <TableHead>{t('stock.detail.user')}</TableHead>
                    <TableHead>{t('stock.detail.date')}</TableHead>
                    <TableHead>{t('stock.detail.note')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon name={TRANSACTION_ICONS[transaction.type] ?? 'help'} size={16} className={TRANSACTION_COLORS[transaction.type] ?? 'text-gray-500'} />
                            <span className="font-medium">{typeLabels[transaction.type] ?? transaction.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              transaction.quantityChange > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {transaction.quantityChange > 0 ? "+" : ""}
                            {transaction.quantityChange}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono">
                          {transaction.stockAfter}
                        </TableCell>
                        <TableCell>{transaction.doneBy?.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.note || "—"}
                          {transaction.repairId && (
                            <div className="text-xs text-muted-foreground">
                              {t('stock.detail.repairLabel')} {transaction.repairId.slice(0, 8)}...
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {transactionsMeta.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t('stock.detail.pageInfo', { page: transactionsMeta.page, totalPages: transactionsMeta.totalPages })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTransactions(transactionsMeta.page - 1)}
                      disabled={transactionsMeta.page <= 1}
                    >
                      {t('common.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTransactions(transactionsMeta.page + 1)}
                      disabled={transactionsMeta.page >= transactionsMeta.totalPages}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Stock Dialog */}
      <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stock.addDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('stock.addDialog.description', { name: part.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addStockError && (
              <p className="text-sm text-destructive">{addStockError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="addQuantity">
                {t('stock.addDialog.quantity')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="addQuantity"
                type="number"
                min="1"
                value={addStockQuantity}
                onChange={(e) => {
                  setAddStockQuantity(e.target.value);
                  setAddStockError(null);
                }}
                placeholder={t('stock.addDialog.quantityPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addNote">
                {t('stock.addDialog.note')} <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="addNote"
                value={addStockNote}
                onChange={(e) => {
                  setAddStockNote(e.target.value);
                  setAddStockError(null);
                }}
                rows={3}
                placeholder={t('stock.addDialog.notePlaceholder')}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiptImage">{t('stock.addDialog.receiptImage')}</Label>
              <Input
                id="receiptImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAddStockReceipt(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setAddStockReceiptPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  } else {
                    setAddStockReceiptPreview("");
                  }
                }}
              />
              {addStockReceiptPreview && (
                <img src={addStockReceiptPreview} alt={t('common.preview')} className="mt-2 max-h-32 rounded border object-contain" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddStockDialog(false);
                setAddStockQuantity("");
                setAddStockNote("");
                setAddStockError(null);
              }}
              disabled={addStockLoading}
              className="border border-outline-variant text-on-surface-variant"
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddStock} disabled={addStockLoading} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
              {addStockLoading && <Icon name="sync" size={16} className="animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stock.adjustDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('stock.adjustDialog.description', { name: part.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {adjustError && (
              <p className="text-sm text-destructive">{adjustError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="adjustQuantity">
                {t('stock.adjustDialog.quantity')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="adjustQuantity"
                type="number"
                value={adjustQuantity}
                onChange={(e) => {
                  setAdjustQuantity(e.target.value);
                  setAdjustError(null);
                }}
                placeholder={t('stock.adjustDialog.quantityPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('stock.adjustDialog.currentStock')} {part.quantity} {t('stock.adjustDialog.units')}
                {adjustQuantity && parseInt(adjustQuantity) !== 0 && (
                  <> → {t('stock.adjustDialog.newStock')} {part.quantity + parseInt(adjustQuantity || "0")} {t('stock.adjustDialog.units')}</>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustNote">
                {t('stock.adjustDialog.reason')} <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="adjustNote"
                value={adjustNote}
                onChange={(e) => {
                  setAdjustNote(e.target.value);
                  setAdjustError(null);
                }}
                rows={3}
                placeholder={t('stock.adjustDialog.reasonPlaceholder')}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAdjustDialog(false);
                setAdjustQuantity("");
                setAdjustNote("");
                setAdjustError(null);
              }}
              disabled={adjustLoading}
              className="border border-outline-variant text-on-surface-variant"
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdjustStock} disabled={adjustLoading} className="bg-primary text-on-primary rounded-lg px-lg py-sm font-title-md text-title-md">
              {adjustLoading && <Icon name="sync" size={16} className="animate-spin" />}
              {t('stock.adjustDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
