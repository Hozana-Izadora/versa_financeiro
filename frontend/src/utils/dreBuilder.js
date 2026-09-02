import { MONTHS, matchesCostCenter } from './formatters.js';

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

export function buildDRE(tx, plano, visMonths, mode, filterState, saldosIniciais, allTx) {
  const { year } = filterState;
  // `tx` chega aqui já filtrado pelo ano selecionado (feito pela página chamadora),
  // então não tem como calcular o saldo acumulado herdado de anos anteriores só com
  // ele. `allTx` (opcional) é o histórico completo, sem esse filtro, usado só para o
  // saldo de abertura/acumulado — o resto do cálculo continua igual, baseado em `tx`.
  const historyTx = allTx || tx;

  // Single pass over tx to build aggregation maps — O(n) instead of O(n × tipos × months)
  const byTipoMov = new Map(); // `${m}|${mov}|${tipo}` → sum
  const byMov     = new Map(); // `${m}|${mov}`         → sum
  // Raw transactions kept for unclassified drill-down (filtered to year+cost center)
  const txFiltered = [];
  for (const r of tx) {
    const d = new Date(r.data + 'T12:00');
    if (d.getFullYear() !== year) continue;
    if (!matchesCostCenter(r, filterState)) continue;
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

  const monthIdx = new Map(visMonths.map((m, i) => [m, i]));

  // Group plano by nivel > cat > grp > tipo. Scoping by nivel FIRST matters: if a category
  // name is reused across two niveis (e.g. "RECEITA BRUTA" holds both Receita tipos and
  // Entrada Não Operacional tipos), grouping by cat alone would sum the whole category into
  // both sections — double-counting it. Keeping one grouped map per nivel prevents that.
  function groupByNivel(nivel) {
    const g = {};
    plano.forEach(p => {
      if (p.nivel !== nivel) return;
      if (!g[p.cat]) g[p.cat] = {};
      if (!g[p.cat][p.grp]) g[p.cat][p.grp] = [];
      if (!g[p.cat][p.grp].includes(p.tipo)) g[p.cat][p.grp].push(p.tipo);
    });
    return g;
  }
  const groupedByNivel = {
    'Receita': groupByNivel('Receita'),
    'Dedução de Receita': groupByNivel('Dedução de Receita'),
    'Custo': groupByNivel('Custo'),
    'Despesa Operacional': groupByNivel('Despesa Operacional'),
    'Despesa Não Operacional': groupByNivel('Despesa Não Operacional'),
    'Entrada Não Operacional': groupByNivel('Entrada Não Operacional'),
  };

  // Per-category level sets by nivel
  const entradaCats = [...new Set(plano.filter(p => p.nivel === 'Receita').map(p => p.cat))];
  const deducaoCats = [...new Set(plano.filter(p => p.nivel === 'Dedução de Receita').map(p => p.cat))];
  const custoCats   = [...new Set(plano.filter(p => p.nivel === 'Custo').map(p => p.cat))];
  const despOpCats  = [...new Set(plano.filter(p => p.nivel === 'Despesa Operacional').map(p => p.cat))];
  const despNopCats = [...new Set(plano.filter(p => p.nivel === 'Despesa Não Operacional').map(p => p.cat))];
  const entNopCats  = [...new Set(plano.filter(p => p.nivel === 'Entrada Não Operacional').map(p => p.cat))];

  // Dynamic section labels: use the single cat name when there's only one, else fall back to a generic label
  function sectionLabel(cats, fallback) {
    return cats.length === 1 ? cats[0] : fallback;
  }
  const entradaLabel = sectionLabel(entradaCats, 'RECEITA BRUTA');
  const deducaoLabel = sectionLabel(deducaoCats, 'DEDUÇÕES DE RECEITA');
  const custoLabel   = sectionLabel(custoCats,   'CUSTOS DIRETOS');
  const despOpLabel  = sectionLabel(despOpCats,  'DESPESAS OPERACIONAIS');
  const entNopLabel  = sectionLabel(entNopCats,  'ENTRADAS NÃO OPERACIONAIS');
  const despNopLabel = sectionLabel(despNopCats, 'DESPESAS NÃO OPERACIONAIS');

  function catTotal(cats, movFilter, m, nivel) {
    let s = 0;
    const g = groupedByNivel[nivel];
    cats.forEach(cat => {
      Object.values(g[cat] || {}).flat().forEach(tipo => { s += sm(m, movFilter, tipo); });
    });
    return s;
  }

  // ── FIX 1 & 2: separate real totals from classified totals ─────────────────
  // mRec = ALL entries (source of truth; feeds KPIs + charts unchanged)
  // mAllSaidas = ALL exits (source of truth for saldo)
  const mRec       = visMonths.map(m => sm(m, 'Entrada'));
  const mAllSaidas = visMonths.map(m => sm(m, 'Saída'));

  // Classified exits by nivel (for DRE structural breakdown)
  const mCost    = visMonths.map(m => catTotal(custoCats,   'Saída', m, 'Custo'));
  const mDespOp  = visMonths.map(m => catTotal(despOpCats,  'Saída', m, 'Despesa Operacional'));
  const mDespNop = visMonths.map(m => catTotal(despNopCats, 'Saída', m, 'Despesa Não Operacional'));
  // Deduções de Receita (impostos sobre vendas, devoluções, descontos incondicionais) —
  // registradas como Saída, igual Custo/Despesa, mas abatidas da Receita Bruta antes do
  // Custo, não misturadas com as demais saídas.
  const mDeducao = visMonths.map(m => catTotal(deducaoCats, 'Saída', m, 'Dedução de Receita'));

  // Classified non-operational entries
  const mEntNop = visMonths.map(m => catTotal(entNopCats, 'Entrada', m, 'Entrada Não Operacional'));

  // Operational revenue only (excludes classified non-operational entries like loans)
  const mRecOp = visMonths.map((_, i) => mRec[i] - mEntNop[i]);

  // Receita Líquida = Receita Operacional − Deduções de Receita. Quando não há nenhum
  // Tipo cadastrado no nível "Dedução de Receita", mDeducao é sempre 0 e mRecLiq === mRecOp.
  const mRecLiq = visMonths.map((_, i) => mRecOp[i] - mDeducao[i]);

  // Classified entries (to detect orphaned entrada transactions)
  const mClassRec = visMonths.map(m =>
    catTotal(entradaCats, 'Entrada', m, 'Receita') + catTotal(entNopCats, 'Entrada', m, 'Entrada Não Operacional'));

  // Reconciliation buckets — non-zero means transactions exist outside the plano
  const mEntNaoClass   = visMonths.map((_, i) => mRec[i] - mClassRec[i]);
  const mSaidaNaoClass = visMonths.map((_, i) =>
    mAllSaidas[i] - mCost[i] - mDespOp[i] - mDespNop[i] - mDeducao[i]
  );

  // Analytical margins — a análise vertical padrão do DRE parte da Receita Líquida
  // (Receita Operacional já descontadas as Deduções de Receita), não da Receita Bruta.
  // Entradas não-operacionais (ex. empréstimos) só entram depois do Resultado Operacional.
  const mMgB  = visMonths.map((_, i) => mRecLiq[i] - mCost[i]);
  const mMgOp = visMonths.map((_, i) => mMgB[i] - mDespOp[i]);
  const mLL   = visMonths.map((_, i) => mMgOp[i] + mEntNop[i] - mDespNop[i]);

  // ── FIX 2: saldo = ALL entries − ALL exits (was: entries − classified only) ─
  const mSaldo = visMonths.map((_, i) => mRec[i] - mAllSaidas[i]);

  // ── Saldo de abertura do ano, com acumulado passando de um ano para o outro ─
  // Um "Ajuste Mensal" (chave "YYYY-MM") é uma correção manual somada ao acumulado
  // naquele mês — estava sendo salvo mas nunca lido em lugar nenhum.
  // A "Abertura" de um ano (chave "YYYY-abertura"), quando definida, é sempre
  // autoritativa; quando não definida, o ano herda o saldo final do ano anterior
  // (recursivamente), em vez de sempre recomeçar do zero.
  let earliestTxYear = year;
  for (const r of historyTx) {
    const y = new Date(r.data + 'T12:00').getFullYear();
    if (y < earliestTxYear) earliestTxYear = y;
  }

  function ajusteMensal(y, mesIdx0) {
    const key = `${y}-${String(mesIdx0 + 1).padStart(2, '0')}`;
    return saldosIniciais[key] != null ? (Number(saldosIniciais[key]) || 0) : 0;
  }

  function movimentoAno(y) {
    let net = 0;
    for (const r of historyTx) {
      const d = new Date(r.data + 'T12:00');
      if (d.getFullYear() !== y) continue;
      net += r.mov === 'Entrada' ? r.valor : -r.valor;
    }
    for (let m = 0; m < 12; m++) net += ajusteMensal(y, m);
    return net;
  }

  function saldoAbertura(y) {
    const explicita = saldosIniciais[`${y}-abertura`];
    if (explicita != null) return Number(explicita) || 0;
    if (y <= earliestTxYear) return 0;
    return saldoAbertura(y - 1) + movimentoAno(y - 1);
  }

  // Recupera o movimento dos meses do ano corrente anteriores ao primeiro mês visível
  // (quando o filtro de período não começa em Janeiro) a partir de `historyTx`, não de
  // `byMov` — `byMov` vem de `tx`, que a página chamadora já filtrou pelos mesmos meses
  // selecionados no período, então não contém os meses que ficaram de fora do filtro.
  // Usar `byMov` aqui fazia esse catch-up sempre somar zero de movimento real para os
  // meses pulados (só o Ajuste Mensal, lido direto de `saldosIniciais`, entrava certo).
  const byMovAno = new Map(); // `${m}|${mov}` → soma, ano inteiro, sem o corte de mês do filtro
  for (const r of historyTx) {
    const d = new Date(r.data + 'T12:00');
    if (d.getFullYear() !== year) continue;
    if (!matchesCostCenter(r, filterState)) continue;
    const kMov = `${d.getMonth()}|${r.mov}`;
    byMovAno.set(kMov, (byMovAno.get(kMov) ?? 0) + r.valor);
  }

  let saldoAcum = saldoAbertura(year);
  for (let m = 0; m < (visMonths[0] ?? 0); m++) {
    saldoAcum += (byMovAno.get(`${m}|Entrada`) ?? 0) - (byMovAno.get(`${m}|Saída`) ?? 0);
    saldoAcum += ajusteMensal(year, m);
  }
  const mAcum = visMonths.map((m, i) => {
    saldoAcum += mSaldo[i] + ajusteMensal(year, m);
    return saldoAcum;
  });

  // Totals
  const totRec       = mRec.reduce((a, b) => a + b, 0);
  const totRecOp     = mRecOp.reduce((a, b) => a + b, 0);
  const totDeducao   = mDeducao.reduce((a, b) => a + b, 0);
  const totRecLiq    = mRecLiq.reduce((a, b) => a + b, 0);
  const totAllSaidas = mAllSaidas.reduce((a, b) => a + b, 0);
  const totCost    = mCost.reduce((a, b) => a + b, 0);
  const totDespOp  = mDespOp.reduce((a, b) => a + b, 0);
  const totDespNop = mDespNop.reduce((a, b) => a + b, 0);
  const totEntNop  = mEntNop.reduce((a, b) => a + b, 0);
  const totMgB     = totRecLiq - totCost;
  const totMgOp    = totMgB - totDespOp;
  const totLL      = totMgOp + totEntNop - totDespNop;

  const totEntNaoClass   = mEntNaoClass.reduce((a, b) => a + b, 0);
  const totSaidaNaoClass = mSaidaNaoClass.reduce((a, b) => a + b, 0);

  // ── Rows ──────────────────────────────────────────────────────────────────
  const rows = [];

  function addSection(label) {
    rows.push({ type: 'section', label });
  }

  function buildSection(cats, movFilter, nivel) {
    const g = groupedByNivel[nivel];

    cats.forEach(cat => {
      const gs = g[cat];
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
      // % reference is always Receita Líquida (Receita Operacional − Deduções de
      // Receita) — a análise vertical padrão do DRE usa a receita líquida como base de
      // 100%; quando não há Deduções cadastradas, mRecLiq === mRecOp e nada muda.
      const rowRef    = mRecLiq;
      const rowTotRef = totRecLiq;

      rows.push({
        type: 'group', label: cat, gid, cat,
        monthValues: catMonths, total: catTot, isPos,
        refValues: rowRef, totRef: rowTotRef,
      });

      Object.entries(gs).forEach(([grp, tipos]) => {
        const grpMonths = visMonths.map(m => tipos.reduce((s, t) => s + sm(m, movFilter, t), 0));
        const grpTot = grpMonths.reduce((a, b) => a + b, 0);
        if (grpTot === 0) return;
        const sid = gid + '::' + grp;
        rows.push({
          type: 'subgroup', label: grp, parentGid: gid, sid, cat,
          monthValues: grpMonths, total: grpTot, isPos, movFilter,
          refValues: rowRef, totRef: rowTotRef,
        });
        tipos.forEach(tipo => {
          const tipoMonths = visMonths.map(m => sm(m, movFilter, tipo));
          const tipoTot = tipoMonths.reduce((a, b) => a + b, 0);
          if (tipoTot === 0) return;
          rows.push({
            type: 'item', label: tipo, parentGid: gid, parentSid: sid, cat, grp,
            monthValues: tipoMonths, total: tipoTot, isPos, movFilter,
            refValues: rowRef, totRef: rowTotRef,
          });
        });
      });
    });
  }

  if (entradaCats.length) addSection(entradaLabel);
  buildSection(entradaCats, 'Entrada', 'Receita');
  // ── FIX 1a: show unclassified entries so detail rows sum to the total ──────
  if (totEntNaoClass > 0) {
    rows.push({
      type: 'group', label: 'Entradas não classificadas', gid: 'naoclass-ent',
      monthValues: mEntNaoClass, total: totEntNaoClass, isPos: true,
      refValues: mRecLiq, totRef: totRecLiq,
    });

    // Drill-down: one item row per tipo not present in the plano as Receita / Entrada Não Op.
    const classifiedEntTipos = new Set(
      plano
        .filter(p => p.nivel === 'Receita' || p.nivel === 'Entrada Não Operacional')
        .map(p => p.tipo)
    );
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
          refValues: mRecLiq, totRef: totRecLiq, movFilter: 'Entrada',
        });
      });
  }
  rows.push({ type: 'total', label: `= TOTAL ${entradaLabel}`, monthValues: mRecOp, total: totRecOp, isPos: true, showPct: true, refValues: mRecLiq, totRef: totRecLiq });

  // ── Deduções de Receita (impostos sobre vendas, devoluções, descontos incondicionais) ──
  // Só aparece quando existir algum Tipo cadastrado nesse nível — clientes que não usam
  // Deduções de Receita não veem nenhuma mudança no demonstrativo.
  if (deducaoCats.length) {
    addSection(deducaoLabel);
    buildSection(deducaoCats, 'Saída', 'Dedução de Receita');
    rows.push({ type: 'subtotal', label: `( − ) Total ${deducaoLabel}`, monthValues: mDeducao, total: totDeducao, isPos: false, refValues: mRecLiq, totRef: totRecLiq });
    rows.push({ type: 'total', label: '= RECEITA LÍQUIDA', monthValues: mRecLiq, total: totRecLiq, isPos: true, showPct: true, refValues: mRecLiq, totRef: totRecLiq });
  }

  if (custoCats.length) addSection(custoLabel);
  buildSection(custoCats, 'Saída', 'Custo');
  rows.push({ type: 'subtotal', label: `( − ) Total ${custoLabel}`, monthValues: mCost, total: totCost, isPos: false, refValues: mRecLiq, totRef: totRecLiq });
  rows.push({ type: 'total', label: '= MARGEM BRUTA', monthValues: mMgB, total: totMgB, isPos: totMgB >= 0, showPct: true, refValues: mRecLiq, totRef: totRecLiq });

  if (despOpCats.length) addSection(despOpLabel);
  buildSection(despOpCats, 'Saída', 'Despesa Operacional');
  rows.push({ type: 'subtotal', label: `( − ) Total ${despOpLabel}`, monthValues: mDespOp, total: totDespOp, isPos: false, refValues: mRecLiq, totRef: totRecLiq });
  rows.push({ type: 'total', label: '= MARGEM OPERACIONAL (EBIT)', monthValues: mMgOp, total: totMgOp, isPos: totMgOp >= 0, showPct: true, refValues: mRecLiq, totRef: totRecLiq });

  if (entNopCats.length) addSection(entNopLabel);
  buildSection(entNopCats, 'Entrada', 'Entrada Não Operacional');
  if (totEntNop > 0) {
    rows.push({ type: 'subtotal', label: `( + ) Total ${entNopLabel}`, monthValues: mEntNop, total: totEntNop, isPos: true, refValues: mRecLiq, totRef: totRecLiq });
  }

  if (despNopCats.length) addSection(despNopLabel);
  buildSection(despNopCats, 'Saída', 'Despesa Não Operacional');
  rows.push({ type: 'subtotal', label: `( − ) Total ${despNopLabel}`, monthValues: mDespNop, total: totDespNop, isPos: false, refValues: mRecLiq, totRef: totRecLiq });

  // ── FIX 1b: show unclassified exits so no cash movement is silently lost ───
  if (totSaidaNaoClass > 0) {
    rows.push({
      type: 'group', label: 'Saídas não classificadas', gid: 'naoclass-saida',
      monthValues: mSaidaNaoClass, total: totSaidaNaoClass, isPos: false,
      refValues: mRecLiq, totRef: totRecLiq,
    });

    // Drill-down: one item row per tipo not present in the plano as Custo / Despesa Operacional / Despesa Não Op.
    const classifiedSaidaTipos = new Set(
      plano
        .filter(p => p.nivel === 'Custo' || p.nivel === 'Despesa Operacional' || p.nivel === 'Despesa Não Operacional')
        .map(p => p.tipo)
    );
    const naoClassSaidaByTipo = new Map(); // tipo → monthly array

    for (const r of txFiltered) {
      if (r.mov !== 'Saída') continue;
      if (classifiedSaidaTipos.has(r.tipo)) continue;
      const mi = monthIdx.get(r._month);
      if (mi === undefined) continue;
      const label = r.tipo || '(sem tipo)';
      if (!naoClassSaidaByTipo.has(label)) naoClassSaidaByTipo.set(label, new Array(visMonths.length).fill(0));
      naoClassSaidaByTipo.get(label)[mi] += r.valor;
    }

    [...naoClassSaidaByTipo.entries()]
      .map(([label, mv]) => ({ label, mv, total: mv.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .forEach(({ label, mv, total }) => {
        rows.push({
          type: 'item', label, parentGid: 'naoclass-saida',
          monthValues: mv, total, isPos: false,
          refValues: mRecLiq, totRef: totRecLiq, movFilter: 'Saída',
        });
      });
  }

  if (mode === 'competencia') {
    rows.push({ type: 'll', label: 'LUCRO LÍQUIDO', monthValues: mLL, total: totLL, isPos: totLL >= 0, showPct: true, refValues: mRecLiq, totRef: totRecLiq });
  } else {
    // ── FIX 2 & 4: totSaldo now = sum of (all entries − all exits) per month ──
    const totSaldo = mSaldo.reduce((a, b) => a + b, 0);
    rows.push({ type: 'saldo', label: 'SALDO DO PERÍODO', monthValues: mSaldo, total: totSaldo, isPos: totSaldo >= 0, showPct: true, refValues: mRecLiq, totRef: totRecLiq });

    // Ajuste Mensal cadastrado em Saldos Iniciais — antes só entrava (invisível) no
    // Saldo Acumulado; agora aparece como linha própria, para o usuário conseguir ver
    // em qual mês um ajuste manual foi aplicado, e de quanto.
    const mAjustes = visMonths.map(m => ajusteMensal(year, m));
    const totAjustes = mAjustes.reduce((a, b) => a + b, 0);
    if (mAjustes.some(v => v !== 0)) {
      rows.push({ type: 'ajuste', label: 'AJUSTES MANUAIS', monthValues: mAjustes, total: totAjustes });
    }

    const lastAcum = mAcum[mAcum.length - 1] || 0;
    rows.push({ type: 'saldo-acum', label: 'SALDO ACUMULADO', monthValues: mAcum, total: lastAcum, isPos: lastAcum >= 0, showPct: true, refValues: mRecLiq, totRef: totRecLiq });
  }

  return {
    rows, visMonths, year,
    mRec, mRecOp, mDeducao, mRecLiq, mCost, mDespOp, mDespNop, mEntNop, mMgB, mMgOp, mLL, mSaldo, mAcum,
    totRec, totRecOp, totDeducao, totRecLiq, totCost, totDespOp, totDespNop, totEntNop, totMgB, totMgOp, totLL,
  };
}
