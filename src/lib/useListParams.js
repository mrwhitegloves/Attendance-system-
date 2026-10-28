'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

/**
 * Filter, sort and page state kept in the address (?status=active&page=2), so a list can be
 * bookmarked, shared and survives refresh. Changing a filter goes back to page 1.
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const get = useCallback(
    (key, fallback = '') => searchParams.get(key) ?? fallback,
    [searchParams],
  );

  const set = useCallback(
    (changes) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in changes)) next.delete('page');
      const query = next.toString();
      startTransition(() =>
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
      );
    },
    [pathname, router, searchParams],
  );

  return { get, set, isPending };
}
