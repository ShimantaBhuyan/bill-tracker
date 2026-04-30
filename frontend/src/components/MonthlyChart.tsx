import { useEffect, useState } from "react";
import { api } from "../api";
import type { MonthlyDataPoint } from "../types";
import { BarChart3, Loader2 } from "lucide-react";

export function MonthlyChart() {
  const [data, setData] = useState<MonthlyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMonthly()
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading monthly data…</span>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-gray-400 text-sm text-center">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
        {error ?? "No monthly data available yet"}
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.total_amount || 0), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Monthly Spend</h3>
        <p className="text-xs text-gray-500">
          {data.length} month{data.length !== 1 ? "s" : ""} of data
        </p>
      </div>

      <div className="flex items-end gap-3 h-40 md:h-48 overflow-x-auto pb-1 px-1">
        {data.map((point) => {
          const heightPct = Math.round((point.total_amount / maxAmount) * 100);
          const [year, month] = point.month.split("-");
          const label = `${month}/${year}`;

          return (
            <div
              key={point.month}
              className="flex flex-col items-center gap-1 min-w-[48px] flex-1 h-full justify-end"
            >
              <span className="text-[10px] text-gray-500 font-medium leading-none">
                {point.total_amount > 0 ? point.total_amount.toFixed(0) : ""}
              </span>
              {/* Fixed-height track so percentage heights work */}
              <div className="w-full h-28 md:h-32 flex items-end">
                <div
                  className="w-full rounded-t-md bg-indigo-500 hover:bg-indigo-600 transition-colors"
                  style={{ height: `${heightPct}%`, minHeight: "4px" }}
                  title={`${point.month}: ${point.total_amount.toFixed(2)} · ${point.count} bills`}
                />
              </div>
              <span className="text-[10px] text-gray-400 leading-none mt-0.5">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
