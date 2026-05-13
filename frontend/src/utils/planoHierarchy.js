/**
 * Hierarchy levels:
 *   Nivel 1 – macro    : derived from plano.nivel  (Receita | Operacional | Não Operacional)
 *   Nivel 2 – subtipo  : plano.cat                 (CUSTOS DIRETOS | DESPESAS FIXAS | …)
 *   Nivel 3 – grupo    : plano.grp                 (Pessoal | Estrutura | Comercial | …)
 *   Nivel 4 – categoria: plano.tipo                (Aluguel | Salários e Encargos | …)
 *
 * Income vs expense is separated by tx.mov ('Entrada' | 'Saída').
 * The macro level is DERIVED — never stored — so renaming nivel values is safe.
 */

const NIVEL_TO_MACRO = {
  'Receita':                 'Receita',
  'Custo':                   'Operacional',
  'Despesa Operacional':     'Operacional',
  'Despesa Não Operacional': 'Não Operacional',
  'Entrada Não Operacional': 'Não Operacional',
};

/**
 * Builds a fully nested hierarchy from a flat plano + flat transactions.
 *
 * @param {Array}  plano        – plano items: { tipo, grp, cat, nivel }
 * @param {Array}  transactions – transaction records: { data, tipo, valor, mov, ... }
 * @param {object} opts
 * @param {number}        [opts.year]       – filter by year (getFullYear())
 * @param {number[]}      [opts.visMonths]  – 0-based month indices to include
 * @param {'Entrada'|'Saída'|null} [opts.mov] – restrict to one movement direction
 *
 * @returns {MacroNode[]}
 *
 * MacroNode  { macro, total, subtypes: SubtypeNode[] }
 * SubtypeNode{ cat, label, total, groups: GroupNode[] }
 * GroupNode  { grp, total, categories: CategoryNode[] }
 * CategoryNode { tipo, total }
 */
export function buildNestedHierarchy(plano, transactions, { year, visMonths, mov = null } = {}) {
  const txFiltered = transactions.filter(tx => {
    const d = new Date(tx.data + 'T12:00');
    if (year      && d.getFullYear() !== year)              return false;
    if (visMonths && !visMonths.includes(d.getMonth()))     return false;
    if (mov       && tx.mov !== mov)                        return false;
    return true;
  });

  const sumByTipo = {};
  for (const tx of txFiltered) {
    sumByTipo[tx.tipo] = (sumByTipo[tx.tipo] ?? 0) + tx.valor;
  }

  const macroMap = new Map();

  for (const item of plano) {
    const macro = NIVEL_TO_MACRO[item.nivel] ?? item.nivel;
    const { cat, grp, tipo } = item;
    const tipoTotal = sumByTipo[tipo] ?? 0;

    if (!macroMap.has(macro))        macroMap.set(macro, { macro, total: 0, catMap: new Map() });
    const macroNode = macroMap.get(macro);

    if (!macroNode.catMap.has(cat))  macroNode.catMap.set(cat, { cat, total: 0, grpMap: new Map() });
    const catNode = macroNode.catMap.get(cat);

    if (!catNode.grpMap.has(grp))    catNode.grpMap.set(grp, { grp, total: 0, tipoMap: new Map() });
    const grpNode = catNode.grpMap.get(grp);

    grpNode.tipoMap.set(tipo, { tipo, total: tipoTotal });
    grpNode.total  += tipoTotal;
    catNode.total  += tipoTotal;
    macroNode.total += tipoTotal;
  }

  const byDesc = (a, b) => b.total - a.total;

  return [...macroMap.values()].map(mn => ({
    macro: mn.macro,
    total: mn.total,
    subtypes: [...mn.catMap.values()].map(cn => ({
      cat:    cn.cat,
      label:  toTitleCase(cn.cat),
      total:  cn.total,
      groups: [...cn.grpMap.values()].map(gn => ({
        grp:        gn.grp,
        total:      gn.total,
        categories: [...gn.tipoMap.values()].sort(byDesc),
      })).sort(byDesc),
    })).sort(byDesc),
  }));
}

/**
 * Flattens the nested hierarchy into rows for a sunburst / treemap chart.
 * Each row: { id, label, parent, value }
 *
 * Compatible with Plotly sunburst, Chart.js treemap, or any flat-parent model.
 */
export function hierarchyToChartData(nodes) {
  const rows = [{ id: 'root', label: 'Total', parent: '', value: 0 }];

  for (const mn of nodes) {
    rows.push({ id: mn.macro, label: mn.macro, parent: 'root', value: mn.total });

    for (const cn of mn.subtypes) {
      const catId = `${mn.macro}__${cn.cat}`;
      rows.push({ id: catId, label: cn.label, parent: mn.macro, value: cn.total });

      for (const gn of cn.groups) {
        const grpId = `${catId}__${gn.grp}`;
        rows.push({ id: grpId, label: gn.grp, parent: catId, value: gn.total });

        for (const tn of gn.categories) {
          rows.push({ id: `${grpId}__${tn.tipo}`, label: tn.tipo, parent: grpId, value: tn.total });
        }
      }
    }
  }

  return rows;
}

/**
 * Finds a single node anywhere in the tree by path.
 * Path is an array of keys at each level: [macro?, cat?, grp?, tipo?]
 * Returns the matching node or null.
 *
 * Example:
 *   drillInto(tree, { macro: 'Operacional', cat: 'DESPESAS FIXAS', grp: 'Estrutura' })
 *   → returns the GroupNode for Estrutura
 */
export function drillInto(tree, { macro, cat, grp, tipo } = {}) {
  for (const mn of tree) {
    if (macro && mn.macro !== macro) continue;
    if (!cat) return mn;
    for (const cn of mn.subtypes) {
      if (cn.cat !== cat) continue;
      if (!grp) return cn;
      for (const gn of cn.groups) {
        if (gn.grp !== grp) continue;
        if (!tipo) return gn;
        return gn.categories.find(tn => tn.tipo === tipo) ?? null;
      }
    }
  }
  return null;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
