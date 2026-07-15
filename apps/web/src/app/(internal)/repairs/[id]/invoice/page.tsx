"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";
import { useTranslations, useLocale } from "next-intl";


interface InvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    amountBilled: number;
    partsTotal: number;
    laborTotal: number;
    discountAmount: number;
    finalTotal: number;
    amountReceived: number;
    changeDue: number;
    paidByName?: string;
    notes?: string;
    createdAt: string;
  };
  repair: {
    id: string;
    description: string;
    status: string;
  };
  car: {
    id: string;
    matricule: string;
    make: string;
    model: string;
    year?: number;
    color?: string;
  };
  client: {
    id: string;
    name: string;
    phone: string;
  } | null;
  laborItems: Array<{
    id: string;
    description: string;
    cost: number;
  }>;
  parts: Array<{
    id: string;
    quantityUsed: number;
    unitCostAtTime: number;
    part: {
      id: string;
      name: string;
      reference?: string;
    };
  }>;
  mechanics: Array<{
    id: string;
    name: string;
    specialty?: string;
  }>;
  createdBy: {
    id: string;
    name: string;
  };
  settings: {
    garageName: string;
    garageAddress: string;
    garagePhone: string;
    currencyLabel: string;
  };
}

function money(value: number, currency: string) {
  const n = Number(value);
  return `${isNaN(n) ? "0.00" : n.toFixed(2)} ${currency}`;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InvoicePage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: InvoiceData }>(
        `/payments/invoice/${id}`,
      );
      setData(res.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("repair.invoice.loadFailed"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="sync" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/repairs/${id}`}>
            <Icon name="arrow_back" size={16} />
            {t("repair.invoice.backLink")}
          </Link>
        </Button>
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <Icon name="info" size={20} className="shrink-0" />
          <p className="text-sm">{error ?? t("repair.invoice.notFound")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvoice}
            className="ml-auto"
          >
            {t("repair.invoice.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const { invoice, repair, car, client, laborItems, parts, mechanics, createdBy, settings } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="text-on-surface-variant">
          <Link href={`/repairs/${id}`}>
            <Icon name="arrow_back" size={16} />
            {t("common.back")}
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="border border-outline-variant text-on-surface-variant">
            <Icon name="download" size={16} className="mr-1" />
            {t("repair.invoice.print")}
          </Button>
        </div>
      </div>

      {/* Invoice Card */}
      <Card className="bg-white border border-outline-variant rounded-xl shadow-sm p-8 print:p-0 print:border-0 print:shadow-none max-w-4xl mx-auto">
        {/* Garage Header */}
        <div className="mb-8 pb-6 border-b">
          <h1 className="font-headline-xl text-headline-xl text-primary">{settings.garageName}</h1>
          {settings.garageAddress && (
            <p className="text-sm text-muted-foreground mt-1">
              {settings.garageAddress}
            </p>
          )}
          {settings.garagePhone && (
            <p className="text-sm text-muted-foreground">
              {t("repair.invoice.phone", { phone: settings.garagePhone })}
            </p>
          )}
        </div>

        {/* Invoice Title & Number */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">{t("repair.invoice.header")}</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t("repair.invoice.invoiceNum")}</span>
                <p className="font-mono font-bold text-lg">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("repair.invoice.date")}</span>
                <p className="font-medium">{formatDate(invoice.createdAt, locale)}</p>
              </div>
            </div>
          </div>

          <div className="text-right space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">{t("repair.invoice.repairId")}</p>
              <p className="font-mono">{repair.id}</p>
            </div>
          </div>
        </div>

        {/* Bill To & Car Info */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b">
          {/* Client */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
              {t("repair.invoice.billedTo")}
            </p>
            {client ? (
              <div className="space-y-1">
                <p className="font-semibold text-lg">{client.name}</p>
                <p className="text-sm text-muted-foreground">{client.phone}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">{t("repair.invoice.noClient")}</p>
            )}
          </div>

          {/* Vehicle */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
              {t("repair.invoice.vehicle")}
            </p>
            <div className="space-y-1">
              <p className="font-semibold text-lg font-mono">{car.matricule}</p>
              <p className="text-sm">
                {car.make} {car.model}
                {car.year && ` · ${car.year}`}
              </p>
              {car.color && (
                <p className="text-sm text-muted-foreground capitalize">
                  {t("repair.invoice.color", { color: car.color })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Repair Description */}
        <div className="mb-8 pb-8 border-b">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
            {t("repair.invoice.descriptionHeading")}
          </p>
          <p className="text-base">{repair.description}</p>
        </div>

        {/* Parts Table */}
        {parts.length > 0 && (
          <div className="mb-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-3">
              {t("repair.invoice.partsHeading")}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/20">
                  <th className="text-left pb-2 font-semibold">{t("repair.invoice.partName")}</th>
                  <th className="text-center pb-2 font-semibold">{t("repair.invoice.qty")}</th>
                  <th className="text-right pb-2 font-semibold">{t("repair.invoice.unitPrice")}</th>
                  <th className="text-right pb-2 font-semibold">{t("repair.invoice.subtotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parts.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3">
                      <p className="font-medium">{p.part.name}</p>
                      {p.part.reference && (
                        <p className="text-xs text-muted-foreground">
                          {t("repair.invoice.ref", { reference: p.part.reference })}
                        </p>
                      )}
                    </td>
                    <td className="text-center py-3">{p.quantityUsed}</td>
                    <td className="text-right py-3 font-mono">
                      {money(p.unitCostAtTime, settings.currencyLabel)}
                    </td>
                    <td className="text-right py-3 font-mono font-semibold">
                      {money(
                        p.quantityUsed * p.unitCostAtTime,
                        settings.currencyLabel,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Labor Items Table */}
        {laborItems.length > 0 && (
          <div className="mb-8">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-3">
              {t("repair.invoice.laborHeading")}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/20">
                  <th className="text-left pb-2 font-semibold">{t("repair.invoice.desc")}</th>
                  <th className="text-right pb-2 font-semibold">{t("repair.invoice.cost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {laborItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 font-medium">{item.description}</td>
                    <td className="text-right py-3 font-mono font-semibold">
                      {money(item.cost, settings.currencyLabel)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="mb-8 pb-8 border-b-2 border-primary/20">
          {(() => {
            const subtotal = invoice.partsTotal + invoice.laborTotal - invoice.discountAmount;
            const garageFees = Math.max(0, invoice.finalTotal - subtotal);
            return (
              <div className="flex justify-end max-w-xs">
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("repair.invoice.partsTotal")}</span>
                    <span className="font-mono">
                      {money(invoice.partsTotal, settings.currencyLabel)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("repair.invoice.laborTotal")}</span>
                    <span className="font-mono">
                      {money(invoice.laborTotal, settings.currencyLabel)}
                    </span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>{t("repair.invoice.discount")}</span>
                      <span className="font-mono">
                        − {money(invoice.discountAmount, settings.currencyLabel)}
                      </span>
                    </div>
                  )}
                  {garageFees > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("repair.invoice.garageFees")}</span>
                      <span className="font-mono">
                        {money(garageFees, settings.currencyLabel)}
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>{t("repair.invoice.total")}</span>
                    <span className="font-mono text-primary">
                      {money(invoice.finalTotal, settings.currencyLabel)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Payment Details */}
        <div className="mb-8 pb-8 border-b">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-3">
            {t("repair.invoice.paymentDetails")}
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm max-w-xs">
            <div>
              <span className="text-muted-foreground">{t("repair.invoice.amountReceived")}</span>
              <p className="font-mono font-semibold">
                {money(invoice.amountReceived, settings.currencyLabel)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t("repair.invoice.changeDue")}</span>
              <p className="font-mono font-semibold">
                {money(invoice.changeDue, settings.currencyLabel)}
              </p>
            </div>
          </div>
          {invoice.paidByName && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("repair.invoice.paidBy", { name: invoice.paidByName })}
            </p>
          )}
          {invoice.notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              {t("repair.invoice.notes", { notes: invoice.notes })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <div className="flex justify-center gap-6 text-xs">
            <div>
              <p className="text-muted-foreground">{t("repair.invoice.preparedBy")}</p>
              <p className="font-medium">{createdBy.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("repair.invoice.mechanic")}</p>
              <p className="font-medium">
                {mechanics[0]?.name || "—"}
              </p>
            </div>
          </div>
          <p className="pt-4 border-t text-muted-foreground">
            {t("repair.invoice.footer", { garage: settings.garageName })}
          </p>
        </div>
      </Card>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }

          div {
            page-break-inside: avoid;
          }

          button {
            display: none;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
