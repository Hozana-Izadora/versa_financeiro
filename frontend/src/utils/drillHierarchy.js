export const DRILL_TREE = {
  id: 'root',
  label: 'Saídas',
  level: -1,
  filter: {},
  children: [
    {
      id: 'gastos-op',
      label: 'Gastos Operacionais',
      level: 0,
      filter: { nivel: ['Custo', 'Despesa Operacional'] },
      children: [
        {
          id: 'custos-diretos',
          label: 'Custos Diretos',
          level: 1,
          filter: { cat: 'CUSTOS DIRETOS' },
          children: [
            { id: 'fornecedor',  label: 'Fornecedor',  level: 2, filter: { grp: 'Custo de Mercadorias' } },
            { id: 'operacional', label: 'Operacional', level: 2, filter: { grp: 'Custo de Serviços'    } },
            { id: 'producao',    label: 'Produção',    level: 2, filter: { grp: 'Custo de Produção'    } },
          ],
        },
        {
          id: 'desp-fixas',
          label: 'Despesas Fixas',
          level: 1,
          filter: { cat: 'DESPESAS OPERACIONAIS', grpIn: ['Despesas com Pessoal', 'Despesas Administrativas', 'Tecnologia'] },
          children: [
            { id: 'pessoas',   label: 'Pessoas',    level: 2, filter: { grp: 'Despesas com Pessoal'     } },
            { id: 'terceiros', label: 'Terceiros',  level: 2, filter: { grp: 'Despesas Administrativas' } },
            { id: 'estrutura', label: 'Estrutura',  level: 2, filter: { grp: 'Tecnologia'               } },
          ],
        },
        {
          id: 'desp-variaveis',
          label: 'Despesas Variáveis',
          level: 1,
          filter: { cat: 'DESPESAS OPERACIONAIS', grpIn: ['Despesas Comerciais'] },
          children: [
            { id: 'marketing',      label: 'Marketing',      level: 2, filter: { tipoIn: ['Marketing e Publicidade', 'Comissões de Vendas'] } },
            { id: 'administrativo', label: 'Administrativo', level: 2, filter: { tipoIn: ['Fretes e Logística'] } },
          ],
        },
      ],
    },
    {
      id: 'gastos-nop',
      label: 'Gastos Não Operacionais',
      level: 0,
      filter: { nivel: ['Despesa Não Operacional'] },
      children: [
        { id: 'passivos',       label: 'Passivos',                level: 1, filter: { grp: 'Despesas Financeiras'    } },
        { id: 'distrib-lucros', label: 'Distribuição de Lucros',  level: 1, filter: { grp: 'Impostos e Tributos'     } },
        { id: 'investimentos',  label: 'Outros / Investimentos',  level: 1, filter: { grp: 'Outras Não Operacionais' } },
      ],
    },
  ],
};

export function txMatchesFilter(tx, filter) {
  if (filter.nivel  && !filter.nivel.includes(tx.nivel))   return false;
  if (filter.cat    && tx.cat !== filter.cat)               return false;
  if (filter.grp    && tx.grp !== filter.grp)               return false;
  if (filter.grpIn  && !filter.grpIn.includes(tx.grp))     return false;
  if (filter.tipo   && tx.tipo !== filter.tipo)             return false;
  if (filter.tipoIn && !filter.tipoIn.includes(tx.tipo))   return false;
  return true;
}

export function sumNode(node, transactions, visMonths, year) {
  return transactions
    .filter(tx => {
      const d = new Date(tx.data + 'T12:00');
      return (
        d.getFullYear() === year &&
        visMonths.includes(d.getMonth()) &&
        tx.mov === 'Saída' &&
        txMatchesFilter(tx, node.filter)
      );
    })
    .reduce((s, tx) => s + tx.valor, 0);
}
