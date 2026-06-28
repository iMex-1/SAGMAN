"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  Package,
  History,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
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
  userId: string;
  user: {
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

const TRANSACTION_TYPES: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  received: { label: "Received", icon: TrendingUp, color: "text-green-600" },
  used: { label: "Used", icon: Minus, color: "text-blue-600" },
  adjusted: { label: "Adjusted", icon: TrendingDown, color: "text-orange-600" },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "MAD",
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
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
        setError("Failed to load part details.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

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
      setAddStockError("Please enter a valid quantity greater than 0.");
      return;
    }
    if (!addStockNote.trim()) {
      setAddStockError("Please enter a note describing this stock addition.");
      return;
    }

    setAddStockLoading(true);
    setAddStockError(null);
    try {
      await api.post(`/parts/${id}/stock`, {
        quantity,
        note: addStockNote.trim(),
      });
      success(`Added ${quantity} units to stock`);
      setShowAddStockDialog(false);
      setAddStockQuantity("");
      setAddStockNote("");
      fetchPart();
      fetchTransactions(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setAddStockError(err.message);
      } else {
        setAddStockError("An unexpected error occurred.");
      }
    } finally {
      setAddStockLoading(false);
    }
  }

  // Adjust stock handler
  async function handleAdjustStock() {
    const quantityChange = parseInt(adjustQuantity);
    if (!quantityChange || quantityChange === 0) {
      setAdjustError("Please enter a non-zero quantity change.");
      return;
    }
    if (!adjustNote.trim()) {
      setAdjustError("Please enter a note explaining this adjustment.");
      return;
    }

    setAdjustLoading(true);
    setAdjustError(null);
    try {
      await api.post(`/parts/${id}/adjust`, {
        quantityChange,
        note: adjustNote.trim(),
      });
      const action = quantityChange > 0 ? "increased" : "decreased";
      success(`Stock ${action} by ${Math.abs(quantityChange)} units`);
      setShowAdjustDialog(false);
      setAdjustQuantity("");
      setAdjustNote("");
      fetchPart();
      fetchTransactions(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setAdjustError(err.message);
      } else {
        setAdjustError("An unexpected error occurred.");
      }
    } finally {
      setAdjustLoading(false);
    }
  }

  // Render states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !part) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/stock">
            <ArrowLeft className="h-4 w-4" />
            Back to Stock
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error ?? "Part not found."}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPart}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isLowStock = part.quantity <= part.minThreshold;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/stock">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Stock Details</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddStockDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Stock
          </Button>
          <Button variant="outline" onClick={() => setShowAdjustDialog(true)}>
            <Package className="h-4 w-4" />
            Adjust
          </Button>
        </div>
      </div>

      {/* Part Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{part.name}</CardTitle>
              <p className="text-sm text-muted-foreground">Ref: {part.reference}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={isLowStock ? "destructive" : "default"}>
                {part.quantity} in stock
              </Badge>
              {isLowStock && (
                <Badge variant="outline" className="text-orange-600">
                  Low Stock (min: {part.minThreshold})
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="font-medium">{part.category}</dd>

            <dt className="text-muted-foreground">Unit Cost</dt>
            <dd className="font-medium">{formatCurrency(part.unitCost)}</dd>

            <dt className="text-muted-foreground">Current Stock</dt>
            <dd className="font-medium">{part.quantity} units</dd>

            <dt className="text-muted-foreground">Minimum Threshold</dt>
            <dd>{part.minThreshold} units</dd>

            {part.supplier && (
              <>
                <dt className="text-muted-foreground">Supplier</dt>
                <dd>{part.supplier}</dd>
              </>
            )}

            <dt className="text-muted-foreground">Stock Value</dt>
            <dd className="font-medium">
              {formatCurrency(part.quantity * part.unitCost)}
            </dd>

            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-muted-foreground">{formatDate(part.createdAt)}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Stock Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Stock Transactions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {transactionsMeta.total} total transactions
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-2">No stock transactions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Stock After</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const typeInfo = TRANSACTION_TYPES[transaction.type];
                    const IconComponent = typeInfo.icon;
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <IconComponent className={`h-4 w-4 ${typeInfo.color}`} />
                            <span className="font-medium">{typeInfo.label}</span>
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
                        <TableCell>{transaction.user.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.note || "—"}
                          {transaction.repairId && (
                            <div className="text-xs text-muted-foreground">
                              Repair: {transaction.repairId.slice(0, 8)}...
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
                    Page {transactionsMeta.page} of {transactionsMeta.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTransactions(transactionsMeta.page - 1)}
                      disabled={transactionsMeta.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTransactions(transactionsMeta.page + 1)}
                      disabled={transactionsMeta.page >= transactionsMeta.totalPages}
                    >
                      Next
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
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              Add received stock for {part.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addStockError && (
              <p className="text-sm text-destructive">{addStockError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="addQuantity">
                Quantity Received <span className="text-destructive">*</span>
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
                placeholder="Enter quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addNote">
                Note <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="addNote"
                value={addStockNote}
                onChange={(e) => {
                  setAddStockNote(e.target.value);
                  setAddStockError(null);
                }}
                rows={3}
                placeholder="e.g., Received from supplier ABC, Invoice #12345"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
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
            >
              Cancel
            </Button>
            <Button onClick={handleAddStock} disabled={addStockLoading}>
              {addStockLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Manual stock adjustment for {part.name}. Use positive numbers to increase, negative to decrease.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {adjustError && (
              <p className="text-sm text-destructive">{adjustError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="adjustQuantity">
                Quantity Change <span className="text-destructive">*</span>
              </Label>
              <Input
                id="adjustQuantity"
                type="number"
                value={adjustQuantity}
                onChange={(e) => {
                  setAdjustQuantity(e.target.value);
                  setAdjustError(null);
                }}
                placeholder="e.g., +5 or -3"
              />
              <p className="text-xs text-muted-foreground">
                Current stock: {part.quantity} units
                {adjustQuantity && parseInt(adjustQuantity) !== 0 && (
                  <> → New stock: {part.quantity + parseInt(adjustQuantity || "0")} units</>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustNote">
                Reason <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="adjustNote"
                value={adjustNote}
                onChange={(e) => {
                  setAdjustNote(e.target.value);
                  setAdjustError(null);
                }}
                rows={3}
                placeholder="e.g., Damaged parts removed, Inventory correction"
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
            >
              Cancel
            </Button>
            <Button onClick={handleAdjustStock} disabled={adjustLoading}>
              {adjustLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Adjust Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}