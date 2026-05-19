// Macro-grupos de saída, na ordem em que aparecem no gráfico
const EXPENSE_NIVEL_GROUPS = [
  { id: 'gastos-op',  label: 'Gastos Operacionais',    niveis: ['Custo', 'Despesa Operacional'] },
  { id: 'gastos-nop', label: 'Gastos Não Operacionais', niveis: ['Despesa Não Operacional'] },
];

const EXPENSE_NIVEIS = new Set(['Custo', 'Despesa Operacional', 'Despesa Não Operacional']);

function slug(str) {
  return str.replace(/[\s/]+/g, '-').toLowerCase();
}

// Fallback estático exibido enquanto o plano ainda não carregou
export const DRILL_TREE = {
  id: 'root', label: 'Saídas', filter: {},
  children: [
    { id: 'gastos-op',  label: 'Gastos Operacionais',    filter: { nivel: ['Custo', 'Despesa Operacional'] }, children: [] },
    { id: 'gastos-nop', label: 'Gastos Não Operacionais', filter: { nivel: ['Despesa Não Operacional'] },     children: [] },
  ],
};

/**
 * Constrói a árvore de drill-down dinamicamente a partir do plano de contas,
 * espelhando exatamente a hierarquia: nivel-grupo → cat → grp → tipo.
 *
 * Estrutura resultante:
 *   Saídas
 *   ├── Gastos Operacionais        (nivel: Custo | Despesa Operacional)
 *   │   ├── CUSTOS DIRETOS         (cat)
 *   │   │   ├── Custo de Serviços  (grp)
 *   │   │   └── …
 *   │   └── DESPESAS OPERACIONAIS  (cat)
 *   │       ├── Pessoal            (grp → expande p/ tipos se > 1)
 *   │       └── …
 *   └── Gastos Não Operacionais    (nivel: Despesa Não Operacional)
 *       └── DESPESAS NÃO OPERACIONAIS
 *           ├── Impostos e Tributos
 *           └── …
 */
export function buildDrillTree(plano) {
  const saidas = plano.filter(p => EXPENSE_NIVEIS.has(p.nivel));

  const macroNodes = EXPENSE_NIVEL_GROUPS
    .map(group => {
      const groupItems = saidas.filter(p => group.niveis.includes(p.nivel));
      if (!groupItems.length) return null;

      // Agrupa por cat, depois por grp
      const byCat = {};
      groupItems.forEach(p => {
        if (!byCat[p.cat])        byCat[p.cat] = {};
        if (!byCat[p.cat][p.grp]) byCat[p.cat][p.grp] = [];
        byCat[p.cat][p.grp].push(p);
      });

      const catNodes = Object.entries(byCat).map(([cat, byGrp]) => {
        const grpNodes = Object.entries(byGrp).map(([grp, tipos]) => {
          const grpFilter = { nivel: group.niveis, cat, grp };

          // Expande para nível de tipo somente quando há mais de um tipo no grupo
          const tipoChildren = tipos.length > 1
            ? tipos.map(p => ({
                id:     `tipo-${slug(p.tipo)}`,
                label:  p.tipo,
                filter: { ...grpFilter, tipo: p.tipo },
              }))
            : undefined;

          return {
            id:       `grp-${slug(cat)}-${slug(grp)}`,
            label:    grp,
            filter:   grpFilter,
            ...(tipoChildren ? { children: tipoChildren } : {}),
          };
        });

        return {
          id:       `cat-${slug(cat)}`,
          label:    cat,
          filter:   { nivel: group.niveis, cat },
          children: grpNodes,
        };
      });

      return {
        id:       group.id,
        label:    group.label,
        filter:   { nivel: group.niveis },
        children: catNodes,
      };
    })
    .filter(Boolean);

  return { id: 'root', label: 'Saídas', filter: {}, children: macroNodes };
}

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
