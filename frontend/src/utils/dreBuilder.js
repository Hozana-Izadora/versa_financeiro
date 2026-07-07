import { MONTHS } from './formatters.js';

export function sumMonth(tx, year, month, movFilter, tipoFilter, groupFilter) {
  return tx.filter(r => {
    const d = new Date(r.data + 'T12:00');
    return d.getFullYear() === year
      && d.getMonth() === month
      && (movFilter ? r.mov === movFilter : true)
      && (tipoFilter ? r.tipo === tipoFilter : true)
      && (groupFilter === 'all' || r.grp === groupFilter);
  }).reduce((s, r) => s + r.valor, 0);
}

export function buildDRE(tx, plano, visMonths, mode, filterState, saldosIniciais) {
  const { year, group: groupFilter = 'all' } = filterState;

  // Single pass over tx to build aggregation maps — O(n) instead of O(n × tipos × months)
  const byTipoMov = new Map(); // `${m}|${mov}|${tipo}` → sum
  const byMov     = new Map(); // `${m}|${mov}`         → sum
  // Raw transactions kept for unclassified drill-down (filtered to year+group)
  const txFiltered = [];
  for (const r of tx) {
    const d = new Date(r.data + 'T12:00');
    if (d.getFullYear() !== year) continue;
    if (groupFilter !== 'all' && r.grp !== groupFilter) continue;
    txFiltered.push({ ...r, _month: d.getMonth() });
    const m = d.getMonth();
    const kMov = `${m}|${r.mov}`;
    byMov.set(kMov, (byMov.get(kMov) ?? 0) + r.valor);
    const kTipo = `${kMov}|${r.tipo}`;
    byTipoMov.set(kTipo, (byTipoMov.get(kTipo) ?? 0) + r.valor);
  }

  function sm(month, movFilter, tipoFilter) {
    if (tipoFilter) return byTipoMov.get(`${month}|${movFilter}|${tipoFilter}`) ?? 0;
    return byMov.get(`${month}|${movFilter}`) ?? 0;
  }

  // Group plano by cat > grp > tipo
  const grouped = {};
  plano.forEach(p => {
    if (!grouped[p.cat]) grouped[p.cat] = {};
    if (!grouped[p.cat][p.grp]) grouped[p.cat][p.grp] = [];
    if (!grouped[p.cat][p.grp].includes(p.tipo)) grouped[p.cat][p.grp].push(p.tipo);
  });

  // Per-category level sets by nivel
  const entradaCats = [...new Set(plano.filter(p => p.nivel === 'Receita').map(p => p.cat))];
  const custoCats   = [...new Set(plano.filter(p => p.nivel === 'Custo').map(p => p.cat))];
  const despOpCats  = [...new Set(plano.filter(p => p.nivel === 'Despesa Operacional').map(p => p.cat))];
  const despNopCats = [...new Set(plano.filter(p => p.nivel === 'Despesa Não Operacional').map(p => p.cat))];
  const entNopCats  = [...new Set(plano.filter(p => p.nivel === 'Entrada Não Operacional').map(p => p.cat))];

  // Dynamic section labels: use the single cat name when there's only one, else fall back to a generic label
  function sectionLabel(cats, fallback) {
    return cats.length === 1 ? cats[0] : fallback;
  }
  const entradaLabel = sectionLabel(entradaCats, 'RECEITA BRUTA');
  const custoLabel   = sectionLabel(custoCats,   'CUSTOS DIRETOS');
  const despOpLabel  = sectionLabel(despOpCats,  'DESPESAS OPERACIONAIS');
  const entNopLabel  = sectionLabel(entNopCats,  'ENTRADAS NÃO OPERACIONAIS');
  const despNopLabel = sectionLabel(despNopCats, 'DESPESAS NÃO OPERACIONAIS');

  function catTotal(cats, movFilter, m) {
    let s = 0;
    cats.forEach(cat => {
      Object.values(grouped[cat] || {}).flat().forEach(tipo => { s += sm(m, movFilter, tipo); });
    });
    return s;
  }

  // ── FIX 1 & 2: separate real totals from classified totals ─────────────────
  // mRec = ALL entries (source of truth; feeds KPIs + charts unchanged)
  // mAllSaidas = ALL exits (source of truth for saldo)
  const mRec       = visMonths.map(m => sm(m, 'Entrada'));
  const mAllSaidas = visMonths.map(m => sm(m, 'Saída'));

  // Classified exits by nivel (for DRE structural breakdown)
  const mCost    = visMonths.map(m => catTotal(custoCats,   'Saída', m));
  const mDespOp  = visMonths.map(m => catTotal(despOpCats,  'Saída', m));
  const mDespNop = visMonths.map(m => catTotal(despNopCats, 'Saída', m));

  // Classified non-operational entries
  const mEntNop = visMonths.map(m => catTotal(entNopCats, 'Entrada', m));

  // Operational revenue only (excludes classified non-operational entries like loans)
  const mRecOp = visMonths.map((_, i) => mRec[i] - mEntNop[i]);

  // Classified entries (to detect orphaned entrada transactions)
  const mClassRec = visMonths.map(m => catTotal(entradaCats, 'Entrada', m) + catTotal(entNopCats, 'Entrada', m));

  // Reconciliation buckets — non-zero means transactions exist outside the plano
  const mEntNaoClass   = visMonths.map((_, i) => mRec[i] - mClassRec[i]);
  const mSaidaNaoClass = visMonths.map((_, i) =>
    mAllSaidas[i] - mCost[i] - mDespOp[i] - mDespNop[i]
  );

  // Analytical margins — operational margins are based on operational revenue only (mRecOp),
  // non-operational entries (e.g. loans) are added after Resultado Operacional, not before.
  const mMgB  = visMonths.map((_, i) => mRecOp[i] - mCost[i]);
  const mMgOp = visMonths.map((_, i) => mMgB[i] - mDespOp[i]);
  const mLL   = visMonths.map((_, i) => mMgOp[i] + mEntNop[i] - mDespNop[i]);

  // ── FIX 2: saldo = ALL entries − ALL exits (was: entries − classified only) ─
  const mSaldo = visMonths.map((_, i) => mRec[i] - mAllSaidas[i]);

  // ── FIX 3: mAcum pre-period now consistent — both legs use all movements ────
  // (pre-period already used all movements; now mSaldo also does → no more break)
  let saldoAcum = Number(saldosIniciais[`${year}-abertura`]) || 0;
  for (let m = 0; m < (visMonths[0] ?? 0); m++) {
    saldoAcum += (byMov.get(`${m}|Entrada`) ?? 0) - (byMov.get(`${m}|Saída`) ?? 0);
  }
  const mAcum = visMonths.map((_, i) => { saldoAcum += mSaldo[i]; return saldoAcum; });

  // Totals
  const totRec     = mRec.reduce((a, b) => a + b, 0);
  const totRecOp   = mRecOp.reduce((a, b) => a + b, 0);
  const totCost    = mCost.reduce((a, b) => a + b, 0);
  const totDespOp  = mDespOp.reduce((a, b) => a + b, 0);
  const totDespNop = mDespNop.reduce((a, b) => a + b, 0);
  const totEntNop  = mEntNop.reduce((a, b) => a + b, 0);
  const totMgB     = totRecOp - totCost;
  const totMgOp    = totMgB - totDespOp;
  const totLL      = totMgOp + totEntNop - totDespNop;

  const totEntNaoClass   = mEntNaoClass.reduce((a, b) => a + b, 0);
  const totSaidaNaoClass = mSaidaNaoClass.reduce((a, b) => a + b, 0);

  // ── Rows ──────────────────────────────────────────────────────────────────
  const rows = [];

  function addSection(label) {
    rows.push({ type: 'section', label });
  }

  function buildSection(cats, movFilter) {
    // totalSaidas for % reference includes unclassified exits
    const totalSaidas = visMonths.map((_, i) => mAllSaidas[i]);

    cats.forEach(cat => {
      const gs = grouped[cat];
      if (!gs) return;
      const catMonths = visMonths.map(m => {
        let s = 0;
        Object.values(gs).flat().forEach(tipo => { s += sm(m, movFilter, tipo); });
        return s;
      });
      const catTot = catMonths.reduce((a, b) => a + b, 0);
      if (catTot === 0) return;

      const isPos = movFilter === 'Entrada';
      const gid = 'cat-' + cat.replace(/\s/g, '-');

      rows.push({
        type: 'group', label: cat, gid, cat,
        monthValues: catMonths, total: catTot, isPos,
        refValues: isPos ? mRecOp : totalSaidas,
      });

      Object.entries(gs).forEach(([grp, tipos]) => {
        const grpMonths = visMonths.map(m => tipos.reduce((s, t) => s + sm(m, movFilter, t), 0));
        const grpTot = grpMonths.reduce((a, b) => a + b, 0);
        if (grpTot === 0) return;
        rows.push({
          type: 'subgroup', label: grp, parentGid: gid, cat,
          monthValues: grpMonths, total: grpTot, isPos, movFilter,
          refValues: isPos ? mRecOp : totalSaidas,
        });
        tipos.forEach(tipo => {
          const tipoMonths = visMonths.map(m => sm(m, movFilter, tipo));
          const tipoTot = tipoMonths.reduce((a, b) => a + b, 0);
          if (tipoTot === 0) return;
          rows.push({
            type: 'item', label: tipo, parentGid: gid, cat,
            monthValues: tipoMonths, total: tipoTot, isPos, movFilter,
            refValues: isPos ? mRecOp : totalSaidas,
          });
        });
      });
    });
  }

  if (entradaCats.length) addSection(entradaLabel);
  buildSection(entradaCats, 'Entrada');
  // ── FIX 1a: show unclassified entries so detail rows sum to the total ──────
  if (totEntNaoClass > 0) {
    rows.push({
      type: 'group', label: 'Entradas não classificadas', gid: 'naoclass-ent',
      monthValues: mEntNaoClass, total: totEntNaoClass, isPos: true,
      refValues: mRecOp,
    });

    // Drill-down: one item row per tipo not present in the plano as Receita / Entrada Não Op.
    const classifiedEntTipos = new Set(
      plano
        .filter(p => p.nivel === 'Receita' || p.nivel === 'Entrada Não Operacional')
        .map(p => p.tipo)
    );
    const monthIdx = new Map(visMonths.map((m, i) => [m, i]));
    const naoClassByTipo = new Map(); // tipo → monthly array

    for (const r of txFiltered) {
      if (r.mov !== 'Entrada') continue;
      if (classifiedEntTipos.has(r.tipo)) continue;
      const mi = monthIdx.get(r._month);
      if (mi === undefined) continue;
      const label = r.tipo || '(sem tipo)';
      if (!naoClassByTipo.has(label)) naoClassByTipo.set(label, new Array(visMonths.length).fill(0));
      naoClassByTipo.get(label)[mi] += r.valor;
    }

    [...naoClassByTipo.entries()]
      .map(([label, mv]) => ({ label, mv, total: mv.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .forEach(({ label, mv, total }) => {
        rows.push({
          type: 'item', label, parentGid: 'naoclass-ent',
          monthValues: mv, total, isPos: true,
          refValues: mRecOp, movFilter: 'Entrada',
        });
      });
  }
  rows.push({ type: 'total', label: `= TOTAL ${entradaLabel}`, monthValues: mRecOp, total: totRecOp, isPos: true });

  if (custoCats.length) addSection(custoLabel);
  buildSection(custoCats, 'Saída');
  rows.push({ type: 'subtotal', label: `( − ) Total ${custoLabel}`, monthValues: mCost, total: totCost, isPos: false });
  rows.push({ type: 'total', label: '= MARGEM BRUTA', monthValues: mMgB, total: totMgB, isPos: totMgB >= 0, showPct: true, refValues: mRecOp, totRef: totRecOp });

  if (despOpCats.length) addSection(despOpLabel);
  buildSection(despOpCats, 'Saída');
  rows.push({ type: 'subtotal', label: `( − ) Total ${despOpLabel}`, monthValues: mDespOp, total: totDespOp, isPos: false });
  rows.push({ type: 'total', label: '= MARGEM OPERACIONAL (EBIT)', monthValues: mMgOp, total: totMgOp, isPos: totMgOp >= 0, showPct: true, refValues: mRecOp, totRef: totRecOp });

  if (entNopCats.length) addSection(entNopLabel);
  buildSection(entNopCats, 'Entrada');
  if (totEntNop > 0) {
    rows.push({ type: 'subtotal', label: `( + ) Total ${entNopLabel}`, monthValues: mEntNop, total: totEntNop, isPos: true });
  }

  if (despNopCats.length) addSection(despNopLabel);
  buildSection(despNopCats, 'Saída');
  rows.push({ type: 'subtotal', label: `( − ) Total ${despNopLabel}`, monthValues: mDespNop, total: totDespNop, isPos: false });

  // ── FIX 1b: show unclassified exits so no cash movement is silently lost ───
  if (totSaidaNaoClass > 0) {
    rows.push({
      type: 'subtotal', label: '( − ) Saídas não classificadas',
      monthValues: mSaidaNaoClass, total: totSaidaNaoClass, isPos: false,
    });
  }

  if (mode === 'competencia') {
    rows.push({ type: 'll', label: 'LUCRO LÍQUIDO', monthValues: mLL, total: totLL, isPos: totLL >= 0, showPct: true, refValues: mRecOp, totRef: totRecOp });
  } else {
    // ── FIX 2 & 4: totSaldo now = sum of (all entries − all exits) per month ──
    const totSaldo = mSaldo.reduce((a, b) => a + b, 0);
    rows.push({ type: 'saldo', label: 'SALDO DO PERÍODO', monthValues: mSaldo, total: totSaldo, isPos: totSaldo >= 0 });
    const lastAcum = mAcum[mAcum.length - 1] || 0;
    rows.push({ type: 'saldo-acum', label: 'SALDO ACUMULADO', monthValues: mAcum, total: lastAcum, isPos: lastAcum >= 0 });
  }

  return {
    rows, visMonths,
    mRec, mRecOp, mCost, mDespOp, mDespNop, mEntNop, mMgB, mMgOp, mLL, mSaldo, mAcum,
    totRec, totRecOp, totCost, totDespOp, totDespNop, totEntNop, totMgB, totMgOp, totLL,
  };
}
