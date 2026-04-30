import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import type { Stats } from "../types";
import {
  Upload,
  Receipt,
  IndianRupee,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ListChecks,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  food: "Dining",
  fuel: "Fuel",
  parking: "Parking",
  others: "Others",
};

interface Props {
  onUpload?: () => void;
}

export function StatsBar({ onUpload }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractLineItems, setExtractLineItems] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onUploadRef = useRef(onUpload);
  onUploadRef.current = onUpload;

  const loadStats = () => {
    api
      .getStats()
      .then((s) => setStats(s))
      .catch(console.error);
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Poll for pending analysis completion
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (stats && stats.pending > 0) {
      interval = setInterval(() => {
        api
          .getStats()
          .then((s) => {
            setStats(s);
            if (s.pending === 0) {
              if (interval) clearInterval(interval);
              setUploadStatus({
                type: "success",
                message: "Analysis complete!",
              });
              onUploadRef.current?.();
            }
          })
          .catch(console.error);
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [stats?.pending]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus({ type: "info", message: "Uploading..." });

    try {
      const res = await api.uploadReceipts(files, extractLineItems);
      const liMsg = extractLineItems ? " (with line items)" : "";
      setUploadStatus({
        type: "success",
        message: `${res.uploaded} receipt(s) uploaded${liMsg}. Analyzing...`,
      });
      loadStats();
      onUploadRef.current?.();
    } catch (err) {
      setUploadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!stats) {
    return (
      <div className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-gray-200 p-5 animate-pulse space-y-6">
        <div className="h-16 bg-gray-100 rounded-lg" />
        <div className="h-32 bg-gray-100 rounded-lg" />
        <div className="h-20 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  const totalSpend = stats.total_spend ?? 0;

  const sortedCategories = [...stats.by_category].sort(
    (a, b) => (b.total_amount || 0) - (a.total_amount || 0)
  );

  const statusIcon =
    uploadStatus?.type === "error" ? (
      <AlertCircle className="w-4 h-4" />
    ) : uploadStatus?.type === "success" && !isUploading && stats.pending === 0 ? (
      <CheckCircle2 className="w-4 h-4" />
    ) : (
      <Loader2 className="w-4 h-4 animate-spin" />
    );

  const statusClass =
    uploadStatus?.type === "error"
      ? "bg-red-50 border-red-100 text-red-700"
      : uploadStatus?.type === "success" && !isUploading && stats.pending === 0
        ? "bg-green-50 border-green-100 text-green-700"
        : "bg-indigo-50 border-indigo-100 text-indigo-700";

  return (
    <div className="w-full lg:w-72 shrink-0 bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-6">
      {/* Upload status toast */}
      {uploadStatus && (
        <div
          className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${statusClass}`}
        >
          {statusIcon}
          {uploadStatus.message}
        </div>
      )}

      {/* 1. Spending Overview */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Spending Overview
        </p>
        <div className="mb-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Total Spending</p>
          <div className="flex items-baseline gap-1">
            <IndianRupee className="w-5 h-5 text-gray-900" />
            <span className="text-3xl font-bold text-gray-900 tracking-tight">
              {totalSpend.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Receipt className="w-4 h-4 text-gray-400" />
          <span>
            <span className="font-semibold text-gray-900">{stats.total_bills}</span> receipt
            {stats.total_bills !== 1 ? "s" : ""} processed
          </span>
        </div>
        {stats.pending > 0 && (
          <div className="flex items-center gap-2 text-xs text-yellow-600 mt-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{stats.pending} analyzing</span>
          </div>
        )}
      </div>

      {/* 2. Categorized Breakdown */}
      {sortedCategories.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Categorized Breakdown
          </p>
          <div className="flex flex-col gap-3">
            {sortedCategories.map((cat) => {
              const pct =
                totalSpend > 0
                  ? Math.round(((cat.total_amount || 0) / totalSpend) * 100)
                  : 0;
              const displayPct =
                pct < 1 && (cat.total_amount || 0) > 0 ? "<1" : String(pct);

              return (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800 capitalize">
                      {CATEGORY_LABELS[cat.category] ?? cat.category}
                    </span>
                    <span className="text-gray-500">
                      ₹{(cat.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-950 rounded-full"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{displayPct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Action Area */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Actions
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={extractLineItems}
            onChange={(e) => setExtractLineItems(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-gray-400" />
            Extract line items
          </span>
        </label>

        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className="w-full group cursor-pointer rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors p-4 flex flex-col items-center gap-2 text-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm group-hover:shadow transition-shadow">
            <Upload className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Upload Receipts</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Receipts will be added to the table
            </p>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
