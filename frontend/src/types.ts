export type Category = "food" | "fuel" | "parking" | "others";
export type AnalysisStatus = "pending" | "success" | "failed";
export type LineItemsStatus = "not_requested" | "pending" | "success" | "failed";

export interface LineItem {
  name: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
}

export interface Bill {
  id: number;
  filename: string;
  image_path: string;
  category: Category;
  description: string | null;
  vendor: string | null;
  amount: number | null;
  currency: string | null;
  bill_date: string | null;
  notes: string | null;
  analysis_status: AnalysisStatus;
  raw_analysis: string | null;
  line_items: string | null;
  line_items_status: LineItemsStatus | null;
  created_at: string;
  updated_at: string;
}

export interface BillUpdate {
  category?: Category;
  description?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  bill_date?: string;
  notes?: string;
}

export interface BillsResponse {
  total: number;
  page: number;
  page_size: number;
  bills: Bill[];
  category_summary: Record<string, number>;
}

export interface CategoryStat {
  category: string;
  count: number;
  total_amount: number;
  currency: string | null;
}

export interface Stats {
  total_bills: number;
  analyzed: number;
  pending: number;
  total_spend: number | null;
  by_category: CategoryStat[];
}

export interface MonthlyDataPoint {
  month: string;
  count: number;
  total_amount: number;
  currency: string | null;
}

export interface MonthlyResponse {
  data: MonthlyDataPoint[];
}

export type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
