import { useState, useMemo } from 'react';
import { getAvailableMonthsWithAjustes, matchesCostCenter } from '../utils/formatters.js';

export function useChartFilter(tx, globalFilterState, saldosIniciais) {
  const [override, setOverride] = useState(null);

  const effectiveYear   = override?.year   ?? globalFilterState.year;
  const effectiveMonths = override?.months ?? globalFilterState.months;

  const effectiveTx = useMemo(() =>
    tx.filter(r => {
      const d = new Date(r.data + 'T12:00');
      return d.getFullYear() === effectiveYear &&
        (effectiveMonths.size === 0 || effectiveMonths.has(d.getMonth())) &&
        matchesCostCenter(r, globalFilterState);
    }),
    [tx, effectiveYear, effectiveMonths, globalFilterState.costCenter, globalFilterState.costCenterField]
  );

  const effectiveVisMonths = useMemo(() => {
    if (effectiveMonths.size > 0) return [...effectiveMonths].sort((a, b) => a - b);
    const avail = getAvailableMonthsWithAjustes(tx, effectiveYear, saldosIniciais);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, effectiveYear, effectiveMonths, saldosIniciais]);

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
