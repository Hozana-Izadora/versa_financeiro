import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../api/index.js';
import InfoPopover from '../ui/InfoPopover.jsx';
import Icon from '../ui/Icon.jsx';
import { buildDrillTree, sumNode } from '../../utils/drillHierarchy.js';

const MES12 = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const ALL_MES = [0,1,2,3,4,5,6,7,8,9,10,11];
const emptyMonths = () => Array(12).fill('');

const DELTA_DEFS = [
  { key: 'pessimista',      label: 'Pessimista',      sign: -1, color: '#E53E3E', default: '15' },
  { key: 'otimista',        label: 'Otimista',        sign:  1, color: '#059669', default: '20' },
  { key: 'muito_otimista',  label: 'Muito Otimista',  sign:  1, color: '#2B6CB0', default: '40' },
];

function fmtBrl(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function fmtK(v) {
  const n = Number(v) || 0;
  return n > 0 ? 'R$' + (n / 1000).toFixed(0) + 'K' : '—';
}

// Colored icon badge used in each panel header — gives every section its own
// visual identity at a glance (payments/receita, receipt/gastos, tree/categoria, dice/cenários).
function SectionIcon({ name, color, bg }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: 28, height: 28, background: bg }}
    >
      <Icon name={name} size="text-[15px]" style={{ color }} />
    </span>
  );
}

function SectionTotal({ label, value }) {
  return value > 0 ? (
    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
      <span className="text-[11px] text-text-3">{label}</span>
      <span className="text-[13px] font-bold text-text-base">
        {'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
      </span>
    </div>
  ) : null;
}

// Botão que trava/destrava a edição de um campo já salvo — protege metas confirmadas
// de edição acidental: o usuário precisa destravar de propósito antes de ajustar o valor.
function LockToggle({ locked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={locked ? 'Valor já salvo — clique para editar' : 'Editando — ajuste e clique em Salvar'}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9.5px] font-semibold cursor-pointer transition-colors ${
        locked
          ? 'border-slate-200 dark:border-slate-600 text-text-3 hover:border-accent hover:text-accent'
          : 'border-accent text-accent bg-accent/10'
      }`}
    >
      <Icon name={locked ? 'lock' : 'lock_open'} size="text-[11px]" />
      {locked ? 'Editar' : 'Editando'}
    </button>
  );
}

// Controlled grid of 12 monthly inputs. Each filled month shows a small "replicate"
// icon that copies its value into the other 11 months — a quick way to set one value
// and reuse it everywhere, without giving up per-month editing.
function MonthGrid({ values, onChange, max, disabled }) {
  function replicate(m) {
    const v = values[m];
    if (v === '' || v == null) return;
    MES12.forEach((_, i) => { if (i !== m) onChange(i, v); });
  }

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-1.5">
      {MES12.map((mes, m) => {
        const filled = values[m] !== '' && values[m] != null;
        return (
          <div key={m}>
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[9px] uppercase tracking-widest text-text-3">{mes}</span>
              {filled && !disabled && (
                <button
                  type="button"
                  title={`Repetir valor de ${mes} para todos os meses`}
                  onClick={() => replicate(m)}
                  className="text-text-3 hover:text-accent transition-colors cursor-pointer"
                  style={{ lineHeight: 0, background: 'none', border: 'none', padding: 0 }}
                >
                  <Icon name="content_copy" size="text-[10px]" />
                </button>
              )}
            </div>
            <input
              type="number"
              min="0"
              max={max}
              disabled={disabled}
              className="w-full text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800"
              placeholder="0"
              value={values[m] === '' || values[m] == null ? '' : values[m]}
              onChange={e => onChange(m, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}

// Um nó de Custos Diretos pode ter sua meta indicada em R$ ou em % da receita —
// não é uma regra fixa igual para todos os clientes, então a escolha é livre por categoria.
function isCustoDireto(node, plano) {
  return !!node.filter?.cat && !!plano?.some(p => p.cat === node.filter.cat && p.nivel === 'Custo');
}

// Total de um nó da árvore de metas: se tem filhos, é sempre a soma recursiva dos filhos
// (nunca um valor digitado direto nele — evita contar a mesma meta duas vezes); só os
// nós-folha (sem filhos) guardam um valor próprio, em R$ ou % da receita do mês.
function computeNodeTotal(node, metaCat, metaCatPct, metaCatMode, receitaMensal) {
  if (node.children?.length) {
    return node.children.reduce((s, c) => s + computeNodeTotal(c, metaCat, metaCatPct, metaCatMode, receitaMensal), 0);
  }
  const mode = metaCatMode[node.id] || 'valor';
  if (mode === 'pct') {
    const arr = metaCatPct[node.id] || emptyMonths();
    return arr.reduce((s, v, m) => s + (Number(v) || 0) / 100 * (Number(receitaMensal?.[m]) || 0), 0);
  }
  const arr = metaCat[node.id] || emptyMonths();
  return arr.reduce((s, v) => s + (Number(v) || 0), 0);
}

// Uma linha da árvore de metas por categoria — recursiva, então funciona em qualquer
// profundidade do Plano de Contas: Categoria → Grupo → Tipo (tipo só existe como filho
// quando o grupo tem mais de um tipo cadastrado). Cada nível tem seu próprio grid de
// 12 meses (Jan a Dez), para preenchimento detalhado mês a mês.
function MetaCategoriaNode({
  node, depth, metaCat, metaCatPct, metaCatMode, onMetaChange, onPctChange, onModeChange,
  collapsedCats, onToggleCollapse, tx, year, plano, receitaMensal, savedLeafIds, unlockedRows, onToggleUnlock,
}) {
  const hasChildren = node.children?.length > 0;
  const isCollapsed = collapsedCats.has(node.id);
  const realizado   = tx ? sumNode(node, tx, ALL_MES, year) : 0;
  const isTop       = depth === 0;
  const isCusto     = isCustoDireto(node, plano);
  const mode        = isCusto ? (metaCatMode[node.id] || 'valor') : 'valor';
  const values       = metaCat[node.id] || emptyMonths();
  const pctValues    = metaCatPct[node.id] || emptyMonths();
  const totalNode    = computeNodeTotal(node, metaCat, metaCatPct, metaCatMode, receitaMensal);
  const isLocked      = !hasChildren && savedLeafIds.has(node.id) && !unlockedRows.has(node.id);

  return (
    <div className={isTop ? 'rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden transition-shadow hover:shadow-sm' : ''}>
      <div
        className={`flex items-center justify-between gap-2 py-2 transition-colors ${
          isTop ? 'px-3 bg-bg-2 hover:bg-slate-100 dark:hover:bg-slate-700/40' : 'pr-3 hover:bg-slate-50 dark:hover:bg-slate-800/40'
        }`}
        style={{ cursor: hasChildren ? 'pointer' : 'default', paddingLeft: isTop ? undefined : 12 + depth * 18 }}
        onClick={() => hasChildren && onToggleCollapse(node.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren && (
            <Icon
              name={isCollapsed ? 'chevron_right' : 'expand_more'}
              size="text-[13px]"
              style={{ color: '#94a3b8', flexShrink: 0 }}
            />
          )}
          <span className={`truncate ${isTop ? 'text-[12px] font-semibold text-text-base' : 'text-[11.5px] text-text-2'}`}>
            {node.label}
          </span>
          <span className="text-[10px] text-text-3 whitespace-nowrap">· realizado {fmtBrl(realizado)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {!hasChildren && isCusto && (
            <div className={`flex items-center rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden text-[9.5px] font-semibold ${isLocked ? 'opacity-50' : ''}`}>
              <button
                type="button"
                disabled={isLocked}
                title="Definir meta em valor (R$) por mês"
                onClick={() => onModeChange(node.id, 'valor')}
                className={`px-2 py-0.5 transition-colors ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${mode === 'valor' ? 'bg-accent text-white' : 'text-text-3 hover:text-text-2'}`}
              >
                R$
              </button>
              <button
                type="button"
                disabled={isLocked}
                title="Definir meta em % da receita do mês"
                onClick={() => onModeChange(node.id, 'pct')}
                className={`px-2 py-0.5 transition-colors ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${mode === 'pct' ? 'bg-accent text-white' : 'text-text-3 hover:text-text-2'}`}
              >
                %
              </button>
            </div>
          )}
          {!hasChildren && savedLeafIds.has(node.id) && (
            <LockToggle locked={isLocked} onClick={() => onToggleUnlock(node.id)} />
          )}
          <span>
            <span className={`font-bold text-text-base ${isTop ? 'text-[12px]' : 'text-[11.5px]'}`}>
              {!hasChildren && mode === 'pct' ? '≈ ' : ''}{fmtBrl(totalNode)}
            </span>
            <span className="text-[10px] text-text-3"> /ano</span>
          </span>
        </div>
      </div>

      {hasChildren ? (
        <div
          className="text-[10px] text-text-3 italic"
          style={{ paddingLeft: (isTop ? 12 : 12 + depth * 18 + 20), paddingBottom: 8, paddingTop: 2 }}
        >
          Soma dos itens abaixo: <span className="font-semibold not-italic text-text-2">{fmtBrl(totalNode)}</span>
        </div>
      ) : (
        <div
          className={isTop ? 'px-3 pb-2.5 pt-1' : 'pb-2 pt-1'}
          style={{ paddingLeft: isTop ? undefined : 12 + depth * 18 + 20 }}
          onClick={e => e.stopPropagation()}
        >
          {mode === 'pct' ? (
            <MonthGrid values={pctValues} onChange={(m, v) => onPctChange(node.id, m, v)} max={100} disabled={isLocked} />
          ) : (
            <MonthGrid values={values} onChange={(m, v) => onMetaChange(node.id, m, v)} disabled={isLocked} />
          )}
        </div>
      )}

      {hasChildren && !isCollapsed && (
        <div className={isTop ? 'divide-y divide-slate-100 dark:divide-slate-700' : 'space-y-0.5 pb-1'}>
          {node.children.map(child => (
            <MetaCategoriaNode
              key={child.id}
              node={child}
              depth={depth + 1}
              metaCat={metaCat}
              metaCatPct={metaCatPct}
              metaCatMode={metaCatMode}
              onMetaChange={onMetaChange}
              onPctChange={onPctChange}
              onModeChange={onModeChange}
              collapsedCats={collapsedCats}
              onToggleCollapse={onToggleCollapse}
              tx={tx}
              year={year}
              plano={plano}
              receitaMensal={receitaMensal}
              savedLeafIds={savedLeafIds}
              unlockedRows={unlockedRows}
              onToggleUnlock={onToggleUnlock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MetasTab({ orcamento, receitaReal, year, actions, plano, tx }) {
  const empty12 = emptyMonths;

  // ── Local state (controlled) ──────────────────────────────────
  const [receita,   setReceita]   = useState(empty12);
  const [deltas,    setDeltas]    = useState(() =>
    Object.fromEntries(DELTA_DEFS.map(d => [d.key, d.default]))
  );
  const [distMode,  setDistMode]  = useState('manual');
  const [annualRec, setAnnualRec] = useState('');
  const [metaCat,     setMetaCat]     = useState({});
  const [metaCatPct,  setMetaCatPct]  = useState({});
  const [metaCatMode, setMetaCatMode] = useState({}); // referencia → 'valor' | 'pct'
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [saving,    setSaving]    = useState(false);
  // Chaves ('receita', ou o nodeId de uma folha em Metas por Categoria) que o usuário
  // destravou de propósito para editar um valor já salvo. Reseta a cada recarga do
  // orçamento (inclusive logo após salvar), travando tudo de novo automaticamente.
  const [unlockedRows, setUnlockedRows] = useState(new Set());

  function toggleUnlock(key) {
    setUnlockedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Populate from orcamento ───────────────────────────────────
  useEffect(() => {
    const r   = empty12();
    const d   = Object.fromEntries(DELTA_DEFS.map(x => [x.key, x.default]));
    const mc  = {};
    const mcPct = {};
    const modeInit = {};
    const mcLegacyAnnual = {}; // referencia → valor anual (formato antigo, mes = null)

    for (const e of orcamento) {
      if (e.tipo === 'receita'       && e.mes >= 0 && e.mes <= 11)  r[e.mes]   = e.valor ?? '';
      if (e.tipo === 'cenario_delta')   d[e.referencia] = e.valor != null ? String(e.valor) : d[e.referencia];
      if (e.tipo === 'meta_cat') {
        if (e.mes == null) {
          mcLegacyAnnual[e.referencia] = e.valor;
        } else if (e.mes >= 0 && e.mes <= 11) {
          if (!mc[e.referencia]) mc[e.referencia] = empty12();
          mc[e.referencia][e.mes] = String(e.valor ?? '');
        }
      }
      if (e.tipo === 'meta_cat_pct' && e.mes >= 0 && e.mes <= 11) {
        if (!mcPct[e.referencia]) mcPct[e.referencia] = empty12();
        mcPct[e.referencia][e.mes] = String(e.valor ?? '');
        modeInit[e.referencia] = 'pct';
      }
    }

    // Metas antigas (um valor anual único, sem mês) ainda sem versão mensal:
    // distribui igualmente pelos 12 meses para não perder o valor já cadastrado.
    Object.entries(mcLegacyAnnual).forEach(([referencia, anual]) => {
      if (!mc[referencia] && !mcPct[referencia]) mc[referencia] = Array(12).fill(String(Math.round(anual / 12)));
    });

    setReceita(r);
    setDeltas(d);
    setMetaCat(mc);
    setMetaCatPct(mcPct);
    setMetaCatMode(modeInit);
    // Toda recarga do orçamento reflete o que está salvo agora — trava tudo de novo,
    // inclusive o campo que acabou de ser editado e salvo.
    setUnlockedRows(new Set());
  }, [orcamento]);

  // Chaves com valor já salvo (> 0) no servidor — usadas para decidir o que nasce
  // travado. 'receita' representa a Meta de Receita; os demais ids são folhas de
  // Metas por Categoria.
  const savedLeafIds = useMemo(() => {
    const ids = new Set();
    for (const e of orcamento) {
      if ((e.tipo === 'meta_cat' || e.tipo === 'meta_cat_pct') && Number(e.valor) > 0) ids.add(e.referencia);
    }
    return ids;
  }, [orcamento]);

  const receitaSaved = useMemo(
    () => orcamento.some(e => e.tipo === 'receita' && Number(e.valor) > 0),
    [orcamento]
  );
  const receitaLocked = receitaSaved && !unlockedRows.has('receita');

  // ── Árvore do Plano de Contas (mesma usada no gráfico "Gastos por Categoria") ──
  const gastoTree = useMemo(() => plano?.length ? buildDrillTree(plano) : { children: [] }, [plano]);

  function toggleCatCollapse(id) {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setMetaCatValue(nodeId, mes, value) {
    setMetaCat(m => {
      const arr = m[nodeId] ? [...m[nodeId]] : emptyMonths();
      arr[mes] = value;
      return { ...m, [nodeId]: arr };
    });
  }

  function setMetaCatPctValue(nodeId, mes, value) {
    setMetaCatPct(m => {
      const arr = m[nodeId] ? [...m[nodeId]] : emptyMonths();
      arr[mes] = value;
      return { ...m, [nodeId]: arr };
    });
  }

  function setMetaCatModeValue(nodeId, mode) {
    setMetaCatMode(m => ({ ...m, [nodeId]: mode }));
  }

  // Ids dos nós-folha (sem filhos) — só eles têm um valor próprio digitado; nós com
  // filhos (Categoria/Grupo) são sempre a soma dos filhos, calculada por computeNodeTotal.
  const leafNodeIds = useMemo(() => {
    const ids = new Set();
    (function walk(nodes) {
      nodes.forEach(n => { n.children?.length ? walk(n.children) : ids.add(n.id); });
    })(gastoTree.children ?? []);
    return ids;
  }, [gastoTree]);

  // Mesmas folhas de leafNodeIds, mas com o caminho legível (Categoria/Grupo/Tipo) —
  // usado para montar a planilha base de importação/exportação do orçamento.
  const leafRows = useMemo(() => {
    const rows = [];
    (gastoTree.children ?? []).forEach(macro => {
      (macro.children ?? []).forEach(catNode => {
        (catNode.children ?? []).forEach(grpNode => {
          if (grpNode.children?.length) {
            grpNode.children.forEach(tipoNode => {
              rows.push({ id: tipoNode.id, cat: catNode.label, grp: grpNode.label, tipo: tipoNode.label });
            });
          } else {
            // Grupo com um único Tipo cadastrado: a folha é o próprio Grupo — busca o
            // nome do Tipo no plano só para deixar a coluna "Tipo" da planilha legível.
            const single = plano?.find(p => p.cat === catNode.label && p.grp === grpNode.label);
            rows.push({ id: grpNode.id, cat: catNode.label, grp: grpNode.label, tipo: single?.tipo || grpNode.label });
          }
        });
      });
    });
    return rows;
  }, [gastoTree, plano]);

  const totalMetaCat = useMemo(
    () => (gastoTree.children ?? []).reduce((s, macro) => s + computeNodeTotal(macro, metaCat, metaCatPct, metaCatMode, receita), 0),
    [gastoTree, metaCat, metaCatPct, metaCatMode, receita]
  );

  // ── Sazonal weights from historical actuals ───────────────────
  const sazonalWeights = useMemo(() => {
    const total = (receitaReal || []).reduce((s, v) => s + (v ?? 0), 0);
    if (total === 0) return Array(12).fill(1 / 12);
    return (receitaReal || []).map(v => (v ?? 0) / total);
  }, [receitaReal]);

  const hasSazonalData = useMemo(
    () => (receitaReal || []).some(v => v != null && v > 0),
    [receitaReal]
  );

  // ── Distribute annual target to months ───────────────────────
  const applyDistribution = useCallback(() => {
    const annual = parseFloat(annualRec);
    if (!annual || annual <= 0) return;
    let newMonths;
    if (distMode === 'linear') {
      const monthly = Math.round(annual / 12);
      newMonths = Array(12).fill(monthly);
    } else {
      newMonths = sazonalWeights.map(w => Math.round(annual * w));
    }
    setReceita(newMonths);
  }, [annualRec, distMode, sazonalWeights]);

  // ── Computed totals ───────────────────────────────────────────
  const totalRec     = receita.reduce((s, v) => s + (Number(v) || 0), 0);

  // ── Resumo geral (usado no cabeçalho da aba) ───────────────────
  // Despesas Anual = soma de todas as metas por categoria (única fonte de meta de
  // gastos agora que a aba "Metas de Gastos" foi removida em favor dela).
  const totalDespesasAnual   = totalMetaCat;
  const resultadoProjetado   = totalRec - totalDespesasAnual;

  const totalCategoriaNodes = leafNodeIds.size;

  const categoriasComMeta = useMemo(() => {
    let count = 0;
    leafNodeIds.forEach(id => {
      const arr = metaCatMode[id] === 'pct' ? metaCatPct[id] : metaCat[id];
      if (arr?.some(v => Number(v) > 0)) count++;
    });
    return count;
  }, [leafNodeIds, metaCat, metaCatPct, metaCatMode]);

  // ── Scenario preview ─────────────────────────────────────────
  const cenarioPreview = useMemo(() => {
    const rows = [
      { key: 'moderado', label: 'Moderado', color: 'rgba(200,208,218,.9)',
        values: receita.map(v => Number(v) || 0),
        total: totalRec },
    ];
    for (const def of DELTA_DEFS) {
      const pct  = parseFloat(deltas[def.key]) || 0;
      const mult = 1 + def.sign * pct / 100;
      const vals = receita.map(v => Math.round((Number(v) || 0) * mult));
      rows.push({ key: def.key, label: def.label, color: def.color,
        values: vals, total: vals.reduce((s, x) => s + x, 0) });
    }
    return rows;
  }, [receita, deltas, totalRec]);

  // ── Save helpers ─────────────────────────────────────────────
  async function saveSection(entries) {
    if (!entries.length) { actions.notify('Nenhum valor para salvar.', 'ni'); return; }
    setSaving(true);
    try {
      await api.upsertOrcamento(entries.map(e => ({ ano: year, ...e })));
      const fresh = await api.getOrcamento(year);
      actions.dispatch({ type: 'SET_ORCAMENTO', payload: fresh });
      actions.notify('Metas salvas!', 'ns');
    } catch (err) {
      actions.notify(err.message, 'ne');
    } finally {
      setSaving(false);
    }
  }

  function saveReceita() {
    const entries = receita
      .map((v, m) => ({ mes: m, tipo: 'receita', referencia: '', valor: Number(v) || 0 }))
      .filter(e => e.valor > 0);
    saveSection(entries);
  }

  async function saveMetaCategorias() {
    const entries = [];
    const valorNodeIds = new Set();
    const pctNodeIds = new Set();

    // Só nós-folha têm valor próprio — nós com filhos (Categoria/Grupo) são sempre a
    // soma dos filhos, então nunca entram aqui mesmo que tenham um valor antigo salvo.
    Object.entries(metaCat).forEach(([nodeId, arr]) => {
      if (!leafNodeIds.has(nodeId)) return;
      if (metaCatMode[nodeId] === 'pct') return; // nó está em modo % agora — não salva o valor em R$ residual
      arr.forEach((v, mes) => {
        if (Number(v) > 0) { entries.push({ mes, tipo: 'meta_cat', referencia: nodeId, valor: Number(v) }); valorNodeIds.add(nodeId); }
      });
    });

    Object.entries(metaCatPct).forEach(([nodeId, arr]) => {
      if (!leafNodeIds.has(nodeId)) return;
      if (metaCatMode[nodeId] !== 'pct') return;
      arr.forEach((v, mes) => {
        if (Number(v) > 0) { entries.push({ mes, tipo: 'meta_cat_pct', referencia: nodeId, valor: Number(v) }); pctNodeIds.add(nodeId); }
      });
    });

    if (!entries.length) { actions.notify('Nenhum valor para salvar.', 'ni'); return; }
    setSaving(true);
    try {
      // Remove formatos obsoletos: meta anual antiga (mes = null); quando o modo R$/%
      // de um nó foi trocado, os valores do modo anterior; e qualquer meta salva antes
      // direto num nível que não é mais editável (Categoria/Grupo com filhos) — evita
      // contagem duplicada nos totais do Acompanhamento.
      const legacy = orcamento.filter(e =>
        (e.tipo === 'meta_cat'     && e.mes == null && valorNodeIds.has(e.referencia)) ||
        (e.tipo === 'meta_cat'     && pctNodeIds.has(e.referencia)) ||
        (e.tipo === 'meta_cat_pct' && valorNodeIds.has(e.referencia)) ||
        ((e.tipo === 'meta_cat' || e.tipo === 'meta_cat_pct') && !leafNodeIds.has(e.referencia))
      );
      for (const e of legacy) await api.deleteOrcamentoEntry(e.id);

      await api.upsertOrcamento(entries.map(e => ({ ano: year, ...e })));
      const fresh = await api.getOrcamento(year);
      actions.dispatch({ type: 'SET_ORCAMENTO', payload: fresh });
      actions.notify('Metas salvas!', 'ns');
    } catch (err) {
      actions.notify(err.message, 'ne');
    } finally {
      setSaving(false);
    }
  }

  // ── Planilha base (Excel) — export/import em massa das Metas por Categoria ────
  const fileInputRef = useRef(null);

  function exportPlanilhaBase() {
    const header = ['ID (não editar)', 'Categoria', 'Grupo', 'Tipo', ...MES12, 'Total'];
    const rows = leafRows.map(leaf => {
      const arr = metaCat[leaf.id] || emptyMonths();
      const vals = MES12.map((_, m) => Number(arr[m]) || 0);
      const total = vals.reduce((s, v) => s + v, 0);
      return [leaf.id, leaf.cat, leaf.grp, leaf.tipo, ...vals, total];
    });
    // Linha de totais no rodapé: soma de cada coluna de mês (e do total geral) —
    // é o "soma mensal em cada coluna" pedido, para servir de conferência ao preencher.
    const totalsRow = [
      '', '', '', 'TOTAL GERAL',
      ...MES12.map((_, m) => rows.reduce((s, r) => s + r[4 + m], 0)),
      rows.reduce((s, r) => s + r[16], 0),
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, totalsRow]);
    ws['!cols'] = [
      { wch: 4, hidden: true }, { wch: 26 }, { wch: 24 }, { wch: 24 },
      ...MES12.map(() => ({ wch: 10 })), { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento');
    XLSX.writeFile(wb, `orcamento-base-${year}.xlsx`);
  }

  async function importPlanilhaEntries(entries, touchedNodeIds) {
    setSaving(true);
    try {
      // A planilha só grava em modo R$ — remove eventuais metas em % já salvas para as
      // mesmas categorias, senão as duas coexistiriam e a soma contaria em dobro.
      const legacyPct = orcamento.filter(e => e.tipo === 'meta_cat_pct' && touchedNodeIds.has(e.referencia));
      for (const e of legacyPct) await api.deleteOrcamentoEntry(e.id);

      await api.upsertOrcamento(entries.map(e => ({ ano: year, ...e })));
      const fresh = await api.getOrcamento(year);
      actions.dispatch({ type: 'SET_ORCAMENTO', payload: fresh });
      actions.notify(`Planilha importada! ${touchedNodeIds.size} categoria(s) atualizada(s).`, 'ns');
    } catch (err) {
      actions.notify(err.message, 'ne');
    } finally {
      setSaving(false);
    }
  }

  function handleImportPlanilha(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const [, ...dataRows] = aoa; // descarta o cabeçalho

        const leafById = new Map(leafRows.map(l => [l.id, l]));
        // O ID da planilha é um slug do nome (Categoria/Grupo/Tipo) gerado na exportação,
        // não uma chave fixa do banco — se o Plano de Contas mudar depois (renomear,
        // mesclar/dividir um Grupo), o ID antigo fica obsoleto mesmo a linha continuando
        // "a mesma" pro usuário. Esse índice por caminho legível é o fallback: pega o
        // caso mais comum, em que só a forma do nó mudou (um Grupo com 1 Tipo virou uma
        // folha própria, por exemplo) mas Categoria/Grupo/Tipo continuam com o texto
        // idêntico ao de quando a planilha foi gerada.
        const leafByPath = new Map(leafRows.map(l => [`${l.cat}|||${l.grp}|||${l.tipo}`, l]));
        const entries = [];
        const touchedNodeIds = new Set();
        let unresolved = 0;
        let matchedByName = 0;

        dataRows.forEach(row => {
          const id = row[0];
          if (id == null || String(id).trim() === '') return; // linha em branco/rodapé de total
          let leaf = leafById.get(id);
          if (!leaf) {
            leaf = leafByPath.get(`${row[1]}|||${row[2]}|||${row[3]}`);
            if (leaf) matchedByName++;
          }
          if (!leaf) { unresolved++; return; }
          // Salva sempre com o id ATUAL da folha — no caso do fallback por nome, o id do
          // arquivo já está obsoleto; gravar com ele quebraria a exibição nas Metas/
          // Acompanhamento, que buscam pelo id corrente da árvore.
          touchedNodeIds.add(leaf.id);
          for (let m = 0; m < 12; m++) {
            const raw = row[4 + m];
            const valor = Number(raw);
            // 0 é um valor válido e precisa ser importado — é como o usuário zera uma
            // meta que existia antes (a planilha exportada, aliás, já escreve 0 em todo
            // mês sem meta, então tratar 0 como "vazio" faria a maioria das células
            // nunca serem reconhecidas). Só a célula em branco de verdade (raw === '')
            // significa "não mexe nesse mês".
            //
            // Math.abs: meta é sempre uma grandeza (quanto planeja gastar), mas é comum o
            // cliente preencher a planilha com o sinal negativo de saída (convenção de
            // fluxo de caixa da própria contabilidade dele) — sem isso, toda a planilha
            // era rejeitada silenciosamente e só as células em branco/zeradas entravam,
            // dando a impressão de "importou mas não apareceu nada".
            if (raw !== '' && raw != null && !Number.isNaN(valor)) {
              entries.push({ mes: m, tipo: 'meta_cat', referencia: leaf.id, valor: Math.abs(valor) });
            }
          }
        });

        if (!entries.length) {
          actions.notify(
            unresolved ? `Nenhum valor reconhecido (${unresolved} linha(s) não identificada(s) — o Plano de Contas mudou desde que essa planilha foi gerada? Exporte uma nova planilha base.)` : 'Planilha sem valores para importar.',
            'ne'
          );
          return;
        }

        importPlanilhaEntries(entries, touchedNodeIds).then(() => {
          if (matchedByName) actions.notify(`${matchedByName} linha(s) casadas por Categoria/Grupo/Tipo (o Plano de Contas mudou desde a exportação da planilha).`, 'ni');
          if (unresolved) actions.notify(`${unresolved} linha(s) da planilha não foram reconhecidas e não entraram na importação — o Plano de Contas mudou desde que essa planilha foi gerada. Exporte uma nova planilha base para essas categorias.`, 'ni');
        });
      } catch (err) {
        actions.notify('Não foi possível ler a planilha: ' + err.message, 'ne');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function saveCenarios() {
    const entries = DELTA_DEFS
      .filter(def => parseFloat(deltas[def.key]) > 0)
      .map(def => ({ mes: null, tipo: 'cenario_delta', referencia: def.key, valor: parseFloat(deltas[def.key]) }));
    saveSection(entries);
  }

  const btnCls = 'btn text-[11px] px-3.5 py-1.5 cursor-pointer';

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-3.5">

      {/* ════ Resumo geral ════════════════════════════════════════ */}
      <div className="kpi-cascade mb-3.5">
        <div className="kpi-card flex-1 min-w-0 kpi-tone-green">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="payments" size="text-[11px]" style={{ color: '#10b981' }} /> Receita Anual
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: '#10b981' }}>{fmtBrl(totalRec)}</div>
          <div className="text-[10.5px] text-text-3">Meta {year}</div>
        </div>
        <div className="kpi-card flex-1 min-w-0 kpi-tone-amber">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="receipt_long" size="text-[11px]" style={{ color: '#f59e0b' }} /> Despesas Anual
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: '#f59e0b' }}>{fmtBrl(totalDespesasAnual)}</div>
          <div className="text-[10.5px] text-text-3">Custo + Operacional + Não Operacional</div>
        </div>
        <div className={`kpi-card flex-1 min-w-0 ${resultadoProjetado >= 0 ? 'kpi-tone-blue' : 'kpi-tone-red'}`}>
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="trending_up" size="text-[11px]" style={{ color: resultadoProjetado >= 0 ? '#2563eb' : '#ef4444' }} /> Resultado Projetado
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: resultadoProjetado >= 0 ? '#2563eb' : '#ef4444' }}>{fmtBrl(resultadoProjetado)}</div>
          <div className="text-[10.5px] text-text-3">Receita − Despesas</div>
        </div>
        <div className="kpi-card flex-1 min-w-0 kpi-tone-purple">
          <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5 flex items-center gap-1">
            <Icon name="account_tree" size="text-[11px]" style={{ color: '#8b5cf6' }} /> Categorias com Meta
          </div>
          <div className="font-inter font-bold text-[18px] tracking-tight" style={{ color: '#8b5cf6' }}>{categoriasComMeta} <span className="text-[13px] text-text-3 font-semibold">/ {totalCategoriaNodes}</span></div>
          <div className="text-[10.5px] text-text-3">Definidas no Plano de Contas</div>
        </div>
      </div>

      {/* ════ Meta de Receita ════════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #10b981' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="payments" color="#10b981" bg="rgba(16,185,129,0.14)" />
            <div>
            <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
              Meta de Receita
              <InfoPopover
                title="Meta de Receita"
                description={'Define a receita esperada mês a mês para o ano selecionado.\n\n• Manual: edite cada mês individualmente.\n• Linear: informe a meta anual e ela é dividida igualmente entre os 12 meses.\n• Sazonal: distribui a meta anual proporcionalmente ao padrão histórico de receita do ano corrente.\n\nOs valores salvos aqui alimentam os KPIs e o gráfico de Acompanhamento.'}
              />
            </div>
            <div className="text-[10px] text-text-3 mt-0.5">Receita esperada mês a mês</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {receitaSaved && <LockToggle locked={receitaLocked} onClick={() => toggleUnlock('receita')} />}
            <button onClick={saveReceita} disabled={saving} className={btnCls}>
              {saving ? 'Salvando…' : 'Salvar Receita'}
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Distribution mode */}
          <div className={`flex items-center gap-2 flex-wrap ${receitaLocked ? 'opacity-50' : ''}`}>
            <span className="text-[11px] font-semibold text-text-2">Distribuição:</span>
            {[
              { id: 'manual',   label: 'Manual',            icon: 'tune' },
              { id: 'linear',   label: 'Linear (÷12)',      icon: 'trending_up' },
              { id: 'sazonal',  label: 'Sazonal (histórico)', icon: 'insert_chart' },
            ].map(({ id, label, icon }) => (
              <button key={id} disabled={receitaLocked} onClick={() => setDistMode(id)}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${receitaLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                  distMode === id
                    ? 'bg-accent text-white border-accent shadow-[0_2px_10px_rgba(16,185,129,0.35)]'
                    : 'bg-bg-1 text-text-2 border-slate-200 dark:border-slate-600 hover:border-accent hover:text-accent'
                }`}>
                <Icon name={icon} size="text-[13px]" />
                {label}
              </button>
            ))}
          </div>

          {/* Annual input for linear/sazonal */}
          {distMode !== 'manual' && (
            <div className={`flex items-center gap-3 flex-wrap p-3 rounded bg-bg-2 border border-slate-100 dark:border-slate-700 ${receitaLocked ? 'opacity-50' : ''}`}>
              <span className="text-[11px] font-semibold text-text-2">Meta Anual:</span>
              <input
                type="number"
                min="0"
                disabled={receitaLocked}
                className="text-[11px] border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
                style={{ width: 160 }}
                placeholder="R$ 0"
                value={annualRec}
                onChange={e => setAnnualRec(e.target.value)}
              />
              <button onClick={applyDistribution} disabled={receitaLocked} className={btnCls}>
                Distribuir
              </button>
              {distMode === 'sazonal' && !hasSazonalData && (
                <span className="text-[10px] text-fin-red">Sem histórico de receita para calcular sazonalidade</span>
              )}
              {distMode === 'sazonal' && hasSazonalData && (
                <span className="text-[10px] text-text-3">Pesos calculados com base no realizado de {year}</span>
              )}
            </div>
          )}

          <MonthGrid values={receita} onChange={(m, v) => setReceita(r => { const n = [...r]; n[m] = v; return n; })} disabled={receitaLocked} />
          <SectionTotal label="Total anual:" value={totalRec} />
        </div>
      </div>


      {/* ════ Metas por Categoria ════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #8b5cf6' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="account_tree" color="#8b5cf6" bg="rgba(139,92,246,0.14)" />
            <div>
              <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                Metas por Categoria
                <InfoPopover
                  title="Metas por Categoria"
                  description={'Define uma meta mês a mês (Jan a Dez) no nível mais detalhado do Plano de Contas — Tipo, ou Grupo quando ele não se divide em Tipos.\n\nClique numa linha com seta para expandir e ver os grupos/tipos dentro dela. Categoria e Grupo (quando têm filhos) não têm campo próprio — o total mostrado é sempre a soma dos itens abaixo, para não contar a mesma meta duas vezes.\n\nO valor "realizado" ao lado de cada linha é a soma do ano corrente, só para referência ao definir a meta.'}
                />
              </div>
              <div className="text-[10px] text-text-3 mt-0.5">Meta mês a mês (R$) por categoria, grupo ou tipo do plano de contas</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportPlanilha} />
            <button
              type="button"
              onClick={exportPlanilhaBase}
              title="Baixa uma planilha Excel com uma linha por categoria e uma coluna por mês, para preencher e importar de volta"
              className="btn text-[11px] px-3 py-1.5 cursor-pointer flex items-center gap-1"
            >
              <Icon name="download" size="text-[13px]" /> Planilha base
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              title="Importa uma planilha preenchida (mesmo formato da planilha base) para atualizar as metas em massa"
              className="btn text-[11px] px-3 py-1.5 cursor-pointer flex items-center gap-1"
            >
              <Icon name="upload_file" size="text-[13px]" /> Importar
            </button>
            <button onClick={saveMetaCategorias} disabled={saving} className={btnCls}>
              {saving ? 'Salvando…' : 'Salvar Metas por Categoria'}
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {!gastoTree.children?.length && (
            <div className="text-[11px] text-text-3">Nenhuma categoria de gasto encontrada no Plano de Contas.</div>
          )}

          {gastoTree.children?.map(macro => (
            <div key={macro.id}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-3 mb-2 flex items-center gap-1.5">
                <Icon name="folder_open" size="text-[12px]" style={{ color: '#94a3b8' }} />
                {macro.label}
              </div>
              <div className="space-y-1.5">
                {macro.children?.map(cat => (
                  <MetaCategoriaNode
                    key={cat.id}
                    node={cat}
                    depth={0}
                    metaCat={metaCat}
                    metaCatPct={metaCatPct}
                    metaCatMode={metaCatMode}
                    onMetaChange={setMetaCatValue}
                    onPctChange={setMetaCatPctValue}
                    onModeChange={setMetaCatModeValue}
                    collapsedCats={collapsedCats}
                    onToggleCollapse={toggleCatCollapse}
                    tx={tx}
                    year={year}
                    plano={plano}
                    receitaMensal={receita}
                    savedLeafIds={savedLeafIds}
                    unlockedRows={unlockedRows}
                    onToggleUnlock={toggleUnlock}
                  />
                ))}
              </div>
            </div>
          ))}

          <SectionTotal label="Total das metas por categoria:" value={totalMetaCat} />
        </div>
      </div>

      {/* ════ Cenários ═══════════════════════════════════════════ */}
      <div className="panel" style={{ borderTop: '3px solid #2B6CB0' }}>
        <div className="panel-hdr">
          <div className="flex items-center gap-2.5">
            <SectionIcon name="casino" color="#2B6CB0" bg="rgba(43,108,176,0.14)" />
            <div>
              <div className="font-inter font-semibold text-[13px] flex items-center gap-1.5">
                Configuração de Cenários
                <InfoPopover
                  title="Cenários de Receita"
                  description={'Permite projetar diferentes expectativas de faturamento aplicando variações percentuais sobre a meta definida.\n\n• Moderado: a própria meta (100%) — cenário base.\n• Pessimista: meta reduzida pelo % configurado. Use para simular queda de vendas ou perda de clientes.\n• Otimista: meta acrescida pelo % configurado. Simula crescimento acima do esperado.\n• Muito Otimista: crescimento ainda maior — útil para cenários de expansão ou sazonalidade positiva.\n\nOs cenários aparecem no gráfico "Receita Bruta" da aba Acompanhamento. A prévia abaixo mostra os valores calculados para cada mês.'}
                />
              </div>
              <div className="text-[10px] text-text-3 mt-0.5">Variações percentuais sobre a meta de receita</div>
            </div>
          </div>
          <button onClick={saveCenarios} disabled={saving} className={btnCls}>
            {saving ? 'Salvando…' : 'Salvar Cenários'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Delta cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Moderado — fixed base */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-bg-2" style={{ borderLeft: '3px solid #94a3b8' }}>
              <div className="text-[9.5px] uppercase tracking-widest text-text-3 mb-1.5">Moderado</div>
              <div className="text-[15px] font-black text-text-base">= 100%</div>
              <div className="text-[9.5px] text-text-3 mt-1">Meta definida (base)</div>
            </div>

            {DELTA_DEFS.map(({ key, label, sign, color }) => (
              <div key={key} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-bg-2" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="text-[9.5px] uppercase tracking-widest text-text-3 mb-1.5">{label}</div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold" style={{ color }}>
                    Meta {sign > 0 ? '+' : '−'}
                  </span>
                  <input
                    type="number" min="0" max="200" step="0.5"
                    className="text-[13px] font-bold border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
                    style={{ width: 54 }}
                    value={deltas[key]}
                    onChange={e => setDeltas(d => ({ ...d, [key]: e.target.value }))}
                  />
                  <span className="text-[11px] font-semibold" style={{ color }}>%</span>
                </div>
                <div className="text-[9.5px] text-text-3 mt-1">
                  Meta × (1 {sign > 0 ? '+' : '−'} {deltas[key] || '0'}%)
                </div>
              </div>
            ))}
          </div>

          {/* Preview table — only when receita exists */}
          {totalRec > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-text-2 mb-2">
                Prévia — Receita por Cenário
              </div>
              <div className="overflow-x-auto">
                <table style={{ fontSize: 10.5, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-3 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap"
                        style={{ minWidth: 110 }}>Cenário</th>
                      {MES12.map(m => (
                        <th key={m} className="px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-3 border-b border-slate-100 dark:border-slate-700 text-right whitespace-nowrap">{m}</th>
                      ))}
                      <th className="px-2 py-1.5 text-[9px] uppercase tracking-widest text-text-3 border-b border-slate-100 dark:border-slate-700 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cenarioPreview.map(({ key, label, color, values, total }) => (
                      <tr key={key} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color }}>
                          {label}
                        </td>
                        {values.map((v, m) => (
                          <td key={m} className="px-2 py-1.5 text-right font-mono whitespace-nowrap" style={{ color: v > 0 ? color : undefined }}>
                            {fmtK(v)}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right font-bold font-mono whitespace-nowrap" style={{ color }}>
                          {fmtK(total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
