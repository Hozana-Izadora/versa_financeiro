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

  function sm(month, movFilter, tipoFilter) {
    return sumMonth(tx, year, month, movFilter, tipoFilter, groupFilter);
  }

  // Group plano by cat > grp > tipo
  const grouped = {};
  plano.forEach(p => {
    if (!grouped[p.cat]) grouped[p.cat] = {};
    if (!grouped[p.cat][p.grp]) grouped[p.cat][p.grp] = [];
    if (!grouped[p.cat][p.grp].includes(p.tipo)) grouped[p.cat][p.grp].push(p.tipo);
  });

  // Per-category level sets
  const entradaCats = [...new Set(plano.filter(p => p.nivel === 'Receita').map(p => p.cat))];
  const custoCats = [...new Set(plano.filter(p => p.nivel === 'Custo').map(p => p.cat))];
  const despOpCats = [...new Set(plano.filter(p => p.nivel === 'Despesa Operacional').map(p => p.cat))];
  const despNopCats = [...new Set(plano.filter(p => p.nivel === 'Despesa Não Operacional').map(p => p.cat))];

  function catTotal(cats, movFilter, m) {
    let s = 0;
    cats.forEach(cat => {
      Object.values(grouped[cat] || {}).flat().forEach(tipo => { s += sm(m, movFilter, tipo); });
    });
    return s;
  }

  const mRec = visMonths.map(m => sm(m, 'Entrada'));
  const mCost = visMonths.map(m => catTotal(custoCats, 'Saída', m));
  const mDespOp = visMonths.map(m => catTotal(despOpCats, 'Saída', m));
  const mDespNop = visMonths.map(m => catTotal(despNopCats, 'Saída', m));
  const mSaldo = visMonths.map((_, i) => mRec[i] - mCost[i] - mDespOp[i] - mDespNop[i]);
  const mMgB = visMonths.map((_, i) => mRec[i] - mCost[i]);
  const mMgOp = visMonths.map((_, i) => mMgB[i] - mDespOp[i]);
  const mLL = visMonths.map((_, i) => mMgOp[i] - mDespNop[i]);

  const totRec = mRec.reduce((a, b) => a + b, 0);
  const totCost = mCost.reduce((a, b) => a + b, 0);
  const totDespOp = mDespOp.reduce((a, b) => a + b, 0);
  const totDespNop = mDespNop.reduce((a, b) => a + b, 0);
  const totMgB = totRec - totCost;
  const totMgOp = totMgB - totDespOp;
  const totLL = totMgOp - totDespNop;

  // Accumulated balance
  let saldoAcum = saldosIniciais[year + '-base'] || 0;
  for (let m = 0; m < (visMonths[0] ?? 0); m++) {
    saldoAcum += sumMonth(tx, year, m, 'Entrada', null, groupFilter)
      - sumMonth(tx, year, m, 'Saída', null, groupFilter);
  }
  const mAcum = visMonths.map((_, i) => { saldoAcum += mSaldo[i]; return saldoAcum; });

  const rows = [];

  function addSection(label) {
    rows.push({ type: 'section', label });
  }

  function buildSection(cats, movFilter) {
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
      const totalSaidas = visMonths.map((_, i) => mCost[i] + mDespOp[i] + mDespNop[i]);

      rows.push({
        type: 'group', label: cat, gid,
        monthValues: catMonths, total: catTot, isPos,
        refValues: isPos ? mRec : totalSaidas,
      });

      Object.entries(gs).forEach(([grp, tipos]) => {
        const grpMonths = visMonths.map(m => tipos.reduce((s, t) => s + sm(m, movFilter, t), 0));
        const grpTot = grpMonths.reduce((a, b) => a + b, 0);
        if (grpTot === 0) return;
        rows.push({
          type: 'subgroup', label: grp, parentGid: gid,
          monthValues: grpMonths, total: grpTot, isPos, movFilter,
          refValues: isPos ? mRec : totalSaidas,
        });
        tipos.forEach(tipo => {
          const tipoMonths = visMonths.map(m => sm(m, movFilter, tipo));
          const tipoTot = tipoMonths.reduce((a, b) => a + b, 0);
          if (tipoTot === 0) return;
          rows.push({
            type: 'item', label: tipo, parentGid: gid,
            monthValues: tipoMonths, total: tipoTot, isPos, movFilter,
            refValues: isPos ? mRec : totalSaidas,
          });
        });
      });
    });
  }

  addSection('📥 ENTRADAS / RECEITA BRUTA');
  buildSection(entradaCats, 'Entrada');
  rows.push({ type: 'total', label: '= TOTAL RECEITA BRUTA', monthValues: mRec, total: totRec, isPos: true });

  addSection('📦 CUSTOS DIRETOS');
  buildSection(custoCats, 'Saída');
  rows.push({ type: 'subtotal', label: '( − ) Total Custos Diretos', monthValues: mCost, total: totCost, isPos: false });
  rows.push({ type: 'total', label: '= MARGEM BRUTA', monthValues: mMgB, total: totMgB, isPos: totMgB >= 0, showPct: true, refValues: mRec, totRef: totRec });

  addSection('📋 DESPESAS OPERACIONAIS');
  buildSection(despOpCats, 'Saída');
  rows.push({ type: 'subtotal', label: '( − ) Total Despesas Operacionais', monthValues: mDespOp, total: totDespOp, isPos: false });
  rows.push({ type: 'total', label: '= MARGEM OPERACIONAL (EBIT)', monthValues: mMgOp, total: totMgOp, isPos: totMgOp >= 0, showPct: true, refValues: mRec, totRef: totRec });

  addSection('🔻 DESPESAS NÃO OPERACIONAIS');
  buildSection(despNopCats, 'Saída');
  rows.push({ type: 'subtotal', label: '( − ) Total Não Operacional', monthValues: mDespNop, total: totDespNop, isPos: false });

  if (mode === 'competencia') {
    rows.push({ type: 'll', label: '💎 LUCRO LÍQUIDO', monthValues: mLL, total: totLL, isPos: totLL >= 0, showPct: true, refValues: mRec, totRef: totRec });
  } else {
    const totSaldo = mSaldo.reduce((a, b) => a + b, 0);
    rows.push({ type: 'saldo', label: '⚡ SALDO DO PERÍODO', monthValues: mSaldo, total: totSaldo, isPos: totSaldo >= 0 });
    const lastAcum = mAcum[mAcum.length - 1] || 0;
    rows.push({ type: 'saldo-acum', label: '📈 SALDO ACUMULADO', monthValues: mAcum, total: lastAcum, isPos: lastAcum >= 0 });
  }

  return {
    rows, visMonths,
    mRec, mCost, mDespOp, mDespNop, mMgB, mMgOp, mLL, mSaldo, mAcum,
    totRec, totCost, totDespOp, totDespNop, totMgB, totMgOp, totLL,
  };
}
