export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v));
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
  'RECEITA BRUTA': 'green',
  'CUSTOS DIRETOS': 'red',
  'DESPESAS OPERACIONAIS': 'yellow',
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
