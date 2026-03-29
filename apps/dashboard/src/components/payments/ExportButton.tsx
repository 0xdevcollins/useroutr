"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { type Payment } from "@/hooks/usePayments";
import { formatCurrency } from "@/lib/utils";

interface ExportButtonProps {
  payments: Payment[];
  isLoading?: boolean;
}

export function ExportButton({ payments, isLoading }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Prepare CSV data
      const headers = [
        "ID",
        "Amount",
        "Currency",
        "Status",
        "Source Chain",
        "Source Asset",
        "Dest Chain",
        "Dest Asset",
        "Created At",
        "Completed At",
      ];

      const rows = payments.map((payment) => [
        payment.id,
        Number(payment.amount).toFixed(6),
        payment.currency,
        payment.status,
        payment.sourceChain,
        payment.sourceAsset,
        payment.destChain,
        payment.destAsset,
        new Date(payment.createdAt).toISOString(),
        payment.completedAt
          ? new Date(payment.completedAt).toISOString()
          : "",
      ]);

      // Create CSV content
      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              // Escape cells containing commas or quotes
              if (String(cell).includes(",") || String(cell).includes('"')) {
                return `"${String(cell).replace(/"/g, '""')}"`;
              }
              return cell;
            })
            .join(",")
        )
        .join("\n");

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `payments-${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isLoading || isExporting || payments.length === 0}
      className="flex items-center gap-2 rounded-sm border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <DownloadSimple size={16} />
      Export CSV
    </button>
  );
}