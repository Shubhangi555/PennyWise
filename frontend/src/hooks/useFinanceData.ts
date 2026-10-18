import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import type {
  BudgetMonth, Category, CategoryTotal, MonthlyPoint, Summary, TransactionFilters, TransactionPage,
} from '../types';

// One hook per endpoint; React Query de-duplicates, so components can call these freely.
// Every key starts with a name listed in lib/queries.ts so mutations can invalidate it.

// Drop empty values so the URL/query key only carries active filters
export function cleanFilters(f: TransactionFilters): TransactionFilters {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== '')) as TransactionFilters;
}

// Newest N transactions (dashboard)
export const useRecentTransactions = (limit: number) =>
  useQuery<TransactionPage>({
    queryKey: ['transactions', 'recent', limit],
    queryFn: () => api.get('/transactions', { params: { limit } }).then((r) => r.data),
  });

const PAGE_SIZE = 50;

// Filtered, paged list (Transactions page). Pages load on demand; totals cover all matches.
export const useTransactionSearch = (filters: TransactionFilters) => {
  const params = cleanFilters(filters);
  return useInfiniteQuery<TransactionPage>({
    queryKey: ['transactions', 'search', params],
    queryFn: ({ pageParam }) =>
      api.get('/transactions', { params: { ...params, limit: PAGE_SIZE, offset: pageParam } }).then((r) => r.data),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData, // keep showing old results while new filters load (no flash)
  });
};

export const useCategories = () =>
  useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

export const useSummary = () =>
  useQuery<Summary>({
    queryKey: ['summary'],
    queryFn: () => api.get('/analytics/summary').then((r) => r.data),
  });

export const useMonthly = () =>
  useQuery<MonthlyPoint[]>({
    queryKey: ['monthly'],
    queryFn: () => api.get('/analytics/monthly').then((r) => r.data),
  });

export const useByCategory = () =>
  useQuery<CategoryTotal[]>({
    queryKey: ['by-category'],
    queryFn: () => api.get('/analytics/by-category').then((r) => r.data),
  });

// month: 'YYYY-MM'
export const useBudgets = (month: string) =>
  useQuery<BudgetMonth>({
    queryKey: ['budgets', month],
    queryFn: () => api.get('/budgets', { params: { month } }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
