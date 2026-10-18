import type { QueryClient } from '@tanstack/react-query';

// Every query whose data depends on the user's transactions (prefix match covers all
// variants, e.g. ['transactions', 'search', {...}] and ['budgets', '2026-10'])
const FINANCE_KEYS = [['transactions'], ['summary'], ['monthly'], ['by-category'], ['budgets']] as const;

// Call after any create/update/delete so lists, totals, charts and budgets all refresh together
export function invalidateFinanceData(queryClient: QueryClient) {
  return Promise.all(FINANCE_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

// After a category is renamed/deleted: names appear in lists, charts and budgets too
export function invalidateCategoryData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['categories'] }),
    invalidateFinanceData(queryClient),
  ]);
}
