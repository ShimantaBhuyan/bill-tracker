import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Bill, Category, SortOption } from "./types";
import { api } from "./api";
import { BillGrid } from "./components/BillGrid";
import { BillDetail } from "./components/BillDetail";
import { Modal } from "./components/Modal";
import { StatsBar } from "./components/StatsBar";
import { MonthlyChart } from "./components/MonthlyChart";
import {
  Search,
  RefreshCw,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ArrowDown10,
  ArrowUp10,
  CalendarDays,
} from "lucide-react";

const CATEGORIES: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "food", label: "Food" },
  { value: "fuel", label: "Fuel" },
  { value: "parking", label: "Parking" },
  { value: "others", label: "Others" },
];

const SORTS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: "date_desc", label: "Date: Newest first", icon: <CalendarDays className="w-3.5 h-3.5" /> },
  { value: "date_asc", label: "Date: Oldest first", icon: <CalendarDays className="w-3.5 h-3.5" /> },
  { value: "amount_desc", label: "Price: High to Low", icon: <ArrowDown10 className="w-3.5 h-3.5" /> },
  { value: "amount_asc", label: "Price: Low to High", icon: <ArrowUp10 className="w-3.5 h-3.5" /> },
];

const PAGE_SIZE = 24;

export default function App() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<SortOption>("date_desc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBills({
        category,
        search,
        sort,
        page,
        page_size: PAGE_SIZE,
      });
      setBills(res.bills);
      setTotal(res.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [category, search, sort, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Reset to page 1 on filter/search/sort change
  useEffect(() => {
    setPage(1);
  }, [category, search, sort]);

  // Close sort dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    if (showSortMenu) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [showSortMenu]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 400);
  };

  const handleSelectId = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleBillUpdated = useCallback((updated: Bill) => {
    setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const selectedBill = useMemo(
    () => bills.find((b) => b.id === selectedId) || null,
    [bills, selectedId]
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Bill Tracker</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search vendor, description..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <button
            onClick={fetchBills}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar — Spending Summary */}
        <aside className="shrink-0">
          <StatsBar onUpload={fetchBills} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Monthly chart */}
          <div className="mb-6">
            <MonthlyChart />
          </div>

          {/* Filters row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          {/* Category filter tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${category === cat.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-indigo-600 hover:bg-indigo-50"
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortMenu((s) => !s)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-indigo-300 transition-colors"
            >
              {SORTS.find((s) => s.value === sort)?.icon}
              <span className="text-xs">
                {SORTS.find((s) => s.value === sort)?.label ?? "Sort"}
              </span>
            </button>

            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-20 w-56 py-1 overflow-hidden">
                {SORTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      setSort(s.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                      ${sort === s.value
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bills grid */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
            {error}. Make sure the backend is running on port 8000.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white animate-pulse">
                <div className="h-36 bg-gray-100 rounded-t-xl" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No bills found</p>
            <p className="text-sm mt-1">
              {search ? "Try a different search term" : "Run the analyzer script to get started"}
            </p>
          </div>
        ) : (
          <>
            <BillGrid
              bills={bills}
              selectedId={selectedId}
              onSelectId={handleSelectId}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        </main>
      </div>

      {/* Bill detail modal */}
      {selectedBill && (
        <Modal onClose={handleCloseModal} maxWidth="max-w-6xl">
          <BillDetail
            bill={selectedBill}
            onUpdated={handleBillUpdated}
          />
        </Modal>
      )}
    </div>
  );
}
