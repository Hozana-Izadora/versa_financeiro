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
            { id: 'custo-merc', label: 'Custo de Mercadorias', level: 2, filter: { cat: 'CUSTOS DIRETOS', grp: 'Custo de Mercadorias' } },
            { id: 'custo-serv', label: 'Custo de Serviços',    level: 2, filter: { cat: 'CUSTOS DIRETOS', grp: 'Custo de Serviços'    } },
            { id: 'custo-prod', label: 'Custo de Produção',    level: 2, filter: { cat: 'CUSTOS DIRETOS', grp: 'Custo de Produção'    } },
          ],
        },
        {
          id: 'desp-op',
          label: 'Despesas Operacionais',
          level: 1,
          filter: { cat: 'DESPESAS OPERACIONAIS' },
          children: [
            { id: 'pessoal',    label: 'Pessoal',        level: 2, filter: { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas com Pessoal'    } },
            { id: 'admin',      label: 'Administrativo', level: 2, filter: { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Administrativas' } },
            { id: 'comercial',  label: 'Comercial',      level: 2, filter: { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Comerciais'      } },
            { id: 'tecnologia', label: 'Tecnologia',     level: 2, filter: { cat: 'DESPESAS OPERACIONAIS', grp: 'Tecnologia'               } },
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
        { id: 'desp-fin',   label: 'Despesas Financeiras',    level: 1, filter: { nivel: ['Despesa Não Operacional'], cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Despesas Financeiras'    } },
        { id: 'impostos',   label: 'Impostos e Tributos',     level: 1, filter: { nivel: ['Despesa Não Operacional'], cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Impostos e Tributos'     } },
        { id: 'outras-nop', label: 'Outras Não Operacionais', level: 1, filter: { nivel: ['Despesa Não Operacional'], cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Outras Não Operacionais' } },
      ],
    },
  ],
};

/**
 * Builds a drill-down tree from the static DRILL_TREE structure, extending
 * leaf group nodes with tipo-level children sourced from the plano.
 *
 * This enables 4-level drill-down:
 *   Root → Macro → Sub-tipo → Grupo → Tipo
 *
 * @param {Array} plano – array of { tipo, grp, cat, nivel } plano items
 * @returns {object} – deep clone of DRILL_TREE with tipo children added to leaves
 */
export function buildDrillTree(plano) {
  const tree = JSON.parse(JSON.stringify(DRILL_TREE));

  function addLeaves(node) {
    if (!node.children?.length) return;
    for (const child of node.children) {
      if (child.children?.length) {
        addLeaves(child);
      } else {
        // Leaf node: find matching plano tipos for this filter
        const matchingTipos = plano.filter(p => txMatchesPlano(p, child.filter));
        // Only expand when there are multiple tipos (single item = no gain drilling)
        if (matchingTipos.length > 1) {
          // Inherit nivel and cat from parent filter so tipo-level nodes stay correctly scoped
          const inherited = {};
          if (child.filter.nivel) inherited.nivel = child.filter.nivel;
          if (child.filter.cat)   inherited.cat   = child.filter.cat;
          child.children = matchingTipos.map(p => ({
            id:     `tipo-${p.tipo.replace(/[\s/]+/g, '-').toLowerCase()}`,
            label:  p.tipo,
            level:  (child.level ?? 0) + 1,
            filter: { ...inherited, tipo: p.tipo },
          }));
        }
      }
    }
  }

  addLeaves(tree);
  return tree;
}

// Matches a plano item against a filter (same field names as txMatchesFilter)
function txMatchesPlano(p, filter) {
  if (filter.nivel  && !filter.nivel.includes(p.nivel))   return false;
  if (filter.cat    && p.cat !== filter.cat)               return false;
  if (filter.grp    && p.grp !== filter.grp)               return false;
  if (filter.grpIn  && !filter.grpIn.includes(p.grp))     return false;
  if (filter.tipo   && p.tipo !== filter.tipo)             return false;
  if (filter.tipoIn && !filter.tipoIn.includes(p.tipo))   return false;
  return true;
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
