import { useEffect, useState } from 'react';

/**
 * مقدار ورودی را با تاخیر برمی‌گرداند تا جستجوی زنده
 * روی لیست‌های بزرگ هر کی‌استروک ری‌رندر سنگین نسازد.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
