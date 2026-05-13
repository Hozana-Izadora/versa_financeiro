/**
 * Cash timing metrics derived from existing transaction dates.
 *
 * PMR (Prazo Médio de Recebimento): value-weighted average day of month
 *   when Entrada transactions are recorded.
 * PMP (Prazo Médio de Pagamento): same for Saída transactions.
 * Ciclo de Caixa: PMP − PMR
 *   Positive → you receive before you pay (healthy)
 *   Negative → you pay before you receive (cash pressure)
 *
 * Without separate emissão/vencimento/liquidação fields, this uses the
 * transaction date as the settlement date and measures intra-month timing.
 */

function weightedAvgDay(txs) {
  const total = txs.reduce((s, tx) => s + tx.valor, 0);
  if (total === 0) return null;
  const sum = txs.reduce((s, tx) => {
    const day = new Date(tx.data + 'T12:00').getDate();
    return s + day * tx.valor;
  }, 0);
  return +(sum / total).toFixed(1);
}

/**
 * Calculates PMR, PMP and Ciclo for a single month.
 * @returns {{ pmr: number|null, pmp: number|null, ciclo: number|null }}
 */
export function calcCicloMonth(transactions, year, month) {
  const txMonth = transactions.filter(tx => {
    const d = new Date(tx.data + 'T12:00');
    return d.getFullYear() === year
      && d.getMonth() === month
      && tx.mov !== 'Transferência';
  });

  const pmr   = weightedAvgDay(txMonth.filter(tx => tx.mov === 'Entrada'));
  const pmp   = weightedAvgDay(txMonth.filter(tx => tx.mov === 'Saída'));
  const ciclo = pmr != null && pmp != null ? +(pmp - pmr).toFixed(1) : null;

  return { pmr, pmp, ciclo };
}

/**
 * Returns a series of { pmr, pmp, ciclo } for each month in visMonths.
 * Null entries indicate no transactions in that month.
 */
export function calcCicloSeries(transactions, year, visMonths) {
  return visMonths.map(m => calcCicloMonth(transactions, year, m));
}
