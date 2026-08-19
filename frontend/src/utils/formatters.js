export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v));
}

// Like fmt(), but keeps the minus sign for genuinely negative totals (Margem, Lucro
// Líquido, Saldo) — fmt() alone strips it, leaving only color to signal direction.
export function fmtSigned(v) {
  return v < 0 ? `-${fmt(v)}` : fmt(v);
}

export function fmtK(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `R$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1000) return `R$${(v / 1000).toFixed(0)}K`;
  return fmt(v);
}

export function fmtPct(v) {
  return `${isFinite(v) ? v.toFixed(1) : 0}%`;
}

export function pct(a, b) {
  return b === 0 ? 0 : (a / b) * 100;
}

export const PLANO_CORES = {
  'RECEITA BRUTA':             'green',
  'CUSTOS DIRETOS':            'red',
  'DESPESAS FIXAS':            'yellow',
  'DESPESAS VARIÁVEIS':        'orange',
  'DESPESAS NÃO OPERACIONAIS': 'purple',
};

export const COLOR_VAR = {
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  orange: '#f97316',
};

/**
 * Cost-center / business-unit filter — reuses the free-form `extra` JSON field
 * (already used for per-client custom import columns) rather than a dedicated
 * column. `filterState.costCenterField` names WHICH extra key holds this value
 * (user-designated, since `extra` keys vary per client); `filterState.costCenter`
 * is the selected value ('all' = no filtering).
 */
export function matchesCostCenter(r, filterState) {
  const { costCenter, costCenterField } = filterState;
  if (!costCenter || costCenter === 'all') return true;
  if (!costCenterField) return false;
  return (r.extra?.[costCenterField] ?? '') === costCenter;
}

/** Distinct keys found across every transaction's `extra` object — candidates
 *  for the user to designate as the cost-center field. */
export function getExtraFieldKeys(transactions) {
  const keys = new Set();
  transactions.forEach(r => { if (r.extra) Object.keys(r.extra).forEach(k => keys.add(k)); });
  return [...keys].sort();
}

export function getAvailableMonths(transactions, year) {
  const ms = new Set(
    transactions.filter(r => new Date(r.data + 'T12:00').getFullYear() === year)
      .map(r => new Date(r.data + 'T12:00').getMonth())
  );
  return [...ms].sort((a, b) => a - b);
}

export function getYears(txBase) {
  const ys = new Set([...txBase.caixa, ...txBase.competencia]
    .map(r => new Date(r.data + 'T12:00').getFullYear()));
  if (!ys.size) ys.add(new Date().getFullYear());
  return [...ys].sort((a, b) => b - a);
}

/**
 * Linear trend (least-squares regression) over a series of values.
 * Returns one point per input value, forming a straight best-fit line —
 * used for "linha de tendência" overlays on evolution charts.
 */
export function linearTrend(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [values[0]];

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  values.forEach((y, x) => {
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  });
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return values.map(() => Math.round(sumY / n));

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, x) => Math.round(intercept + slope * x));
}
