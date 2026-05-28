import { useState, useMemo } from 'react';
import { getAvailableMonths } from '../utils/formatters.js';

export function useChartFilter(tx, globalFilterState) {
  const [override, setOverride] = useState(null);

  const effectiveYear   = override?.year   ?? globalFilterState.year;
  const effectiveMonths = override?.months ?? globalFilterState.months;

  const effectiveTx = useMemo(() =>
    tx.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === effectiveYear &&
        (effectiveMonths.size === 0 || effectiveMonths.has(d.getMonth())) &&
        (globalFilterState.group === 'all' || r.grp === globalFilterState.group);
    }),
    [tx, effectiveYear, effectiveMonths, globalFilterState.group]
  );

  const effectiveVisMonths = useMemo(() => {
    if (effectiveMonths.size > 0) return [...effectiveMonths].sort((a, b) => a - b);
    const avail = getAvailableMonths(tx, effectiveYear);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, effectiveYear, effectiveMonths]);

  return {
    override,
    setOverride,
    effectiveTx,
    effectiveVisMonths,
    effectiveYear,
    isOverriding: override !== null,
    reset: () => setOverride(null),
  };
}
