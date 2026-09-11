import { useQuery } from "@tanstack/react-query";

import { api } from "../services/apiClient";

export interface BookInventory {
  book_id: string;
  code: string;
  title: string;
  author: string;
  category: string;
  cover_image_url: string | null;
  total: number;
  borrowing: number;
  remaining: number;
  created_at: string;
}

export interface InventoryReport {
  books: BookInventory[];
  total_titles: number;
  total_copies: number;
  total_borrowing: number;
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => api.get<InventoryReport>("/api/reports/inventory"),
  });
}

export interface DailyActivity {
  activity_date: string;
  borrowed: number;
  returned: number;
}

export interface ActivityTrend {
  days: DailyActivity[];
}

export function useActivityTrend(days = 14) {
  return useQuery({
    queryKey: ["reports", "trend", days],
    queryFn: () => api.get<ActivityTrend>(`/api/reports/trend?days=${days}`),
  });
}

export interface OverdueItem {
  loan_id: string;
  loan_code: string;
  book_id: string;
  book_title: string;
  book_cover_image_url: string | null;
  reader_id: string;
  reader_name: string;
  reader_code: string;
  due_date: string;
  days_overdue: number;
  quantity: number;
}

export interface OverdueReport {
  items: OverdueItem[];
}

export function useOverdueReport() {
  return useQuery({
    queryKey: ["reports", "overdue"],
    queryFn: () => api.get<OverdueReport>("/api/reports/overdue"),
  });
}

export type LoanDetailStatus = "borrowing" | "returned" | "pending_compensation" | "compensated";

export interface ActivityItem {
  loan_id: string;
  loan_code: string;
  book_id: string;
  book_title: string;
  book_cover_image_url: string | null;
  reader_id: string;
  reader_name: string;
  reader_code: string;
  quantity: number;
  loan_date: string;
  due_date: string;
  actual_return_date: string | null;
  status: LoanDetailStatus;
  renewed: boolean;
  is_overdue: boolean;
}

export interface ActivityLog {
  items: ActivityItem[];
}

export function useActivityLog(limit = 500) {
  return useQuery({
    queryKey: ["reports", "activities", limit],
    queryFn: () => api.get<ActivityLog>(`/api/reports/activities?limit=${limit}`),
  });
}
