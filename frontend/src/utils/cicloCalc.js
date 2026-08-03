/**
 * PMR (Prazo Médio de Recebimento) e PMP (Prazo Médio de Pagamento).
 *
 * PMR: média ponderada (pelo valor) do prazo — em dias — entre a Data de Emissão e a
 * Data de Vencimento das receitas operacionais (nivel = 'Receita').
 * Ex.: emitiu a nota hoje, cliente paga em 30 dias → prazo = 30.
 *
 * PMP: mesmo cálculo, mas para as saídas de Custo Direto (nivel = 'Custo' — matéria-prima,
 * serviços de terceiros: "custo fornecedor"/"compras"), não todas as despesas.
 *
 * Fórmula (igual à planilha de referência Ciclo_Financeiro_Exemplo.xlsx):
 *   média ponderada = SOMA(prazo_i × valor_i) ÷ SOMA(valor_i)
 * Cada título pesa conforme seu valor financeiro, não pela quantidade de títulos.
 *
 * Só entram no cálculo lançamentos com Data de Emissão E Data de Vencimento preenchidas
 * (campos opcionais) — lançamentos sem essas datas são ignorados nesta métrica.
 *
 * Ciclo Financeiro = PMR − PMP.
 *   Positivo → a empresa recebe, em média, depois de precisar pagar (precisa de capital de giro).
 *   Negativo → a empresa recebe antes de precisar pagar os fornecedores.
 */

function prazoDias(dataEmissao, dataVencimento) {
  const emissao    = new Date(dataEmissao + 'T12:00');
  const vencimento = new Date(dataVencimento + 'T12:00');
  return Math.round((vencimento - emissao) / 86400000);
}

function prazoMedioPonderado(txs) {
  const validos = txs.filter(tx => tx.dataEmissao && tx.dataVencimento);
  const totalValor = validos.reduce((s, tx) => s + tx.valor, 0);
  if (totalValor === 0) return null;
  const somaPonderada = validos.reduce(
    (s, tx) => s + prazoDias(tx.dataEmissao, tx.dataVencimento) * tx.valor,
    0
  );
  return +(somaPonderada / totalValor).toFixed(1);
}

/**
 * Calcula PMR, PMP e Ciclo para um único mês.
 * O mês considerado é o mês da Data de Emissão de cada título (não a data do movimento).
 * @returns {{ pmr: number|null, pmp: number|null, ciclo: number|null }}
 */
export function calcCicloMonth(transactions, year, month) {
  const emitidosNoMes = transactions.filter(tx => {
    if (!tx.dataEmissao) return false;
    const d = new Date(tx.dataEmissao + 'T12:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const receitasOperacionais = emitidosNoMes.filter(tx => tx.mov === 'Entrada' && tx.nivel === 'Receita');
  const custosFornecedor     = emitidosNoMes.filter(tx => tx.mov === 'Saída'   && tx.nivel === 'Custo');

  const pmr   = prazoMedioPonderado(receitasOperacionais);
  const pmp   = prazoMedioPonderado(custosFornecedor);
  const ciclo = pmr != null && pmp != null ? +(pmr - pmp).toFixed(1) : null;

  return { pmr, pmp, ciclo };
}

/**
 * Returns a series of { pmr, pmp, ciclo } for each month in visMonths.
 * Null entries indicate no títulos com Emissão+Vencimento naquele mês.
 */
export function calcCicloSeries(transactions, year, visMonths) {
  return visMonths.map(m => calcCicloMonth(transactions, year, m));
}
