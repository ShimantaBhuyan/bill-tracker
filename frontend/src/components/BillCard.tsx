import type { Bill } from "../types";
import { CategoryBadge } from "./CategoryBadge";
import { api } from "../api";
import { Calendar, Store, AlertCircle } from "lucide-react";

interface Props {
  bill: Bill;
  selected: boolean;
  onClick: () => void;
}

export function BillCard({ bill, selected, onClick }: Props) {
  const isPending = bill.analysis_status === "pending";
  const isFailed = bill.analysis_status === "failed";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all duration-150 overflow-hidden group
        ${selected
          ? "border-indigo-500 ring-2 ring-indigo-200 bg-white shadow-md"
          : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
        }`}
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-gray-100 overflow-hidden">
        <img
          src={api.imageUrl(bill.filename)}
          alt={bill.filename}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute top-2 left-2">
          <CategoryBadge
            category={isPending ? "pending" : bill.category}
            size="sm"
          />
        </div>
        {(isPending || isFailed) && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-white/80" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3 space-y-1">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {bill.description ?? bill.filename}
        </p>

        {bill.vendor && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Store className="w-3 h-3 shrink-0" />
            <span className="truncate">{bill.vendor}</span>
          </div>
        )}

        {bill.bill_date && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{bill.bill_date}</span>
          </div>
        )}

        {bill.amount != null && (
          <p className="text-sm font-bold text-gray-800 pt-0.5">
            {bill.currency ?? ""}{bill.amount.toFixed(2)}
          </p>
        )}

        {isPending && (
          <p className="text-xs text-yellow-600 font-medium">Not yet analyzed</p>
        )}
        {isFailed && (
          <p className="text-xs text-red-500 font-medium">Analysis failed</p>
        )}
      </div>
    </button>
  );
}
