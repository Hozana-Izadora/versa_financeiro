import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { fmt, fmtK } from '../utils/formatters.js';
import Icon from '../components/ui/Icon.jsx';

// ── Transaction form (unchanged) ────────────────────────────────────────────
function TransactionForm({ initial, plano, onSave, onCancel, title }) {
  const cats = [...new Set(plano.map(p => p.cat))];
  const [cat,  setCat]  = useState(initial?.cat  || cats[0] || '');
  const [grp,  setGrp]  = useState(initial?.grp  || '');
  const [tipo, setTipo] = useState(initial?.tipo  || '');
  const [form, setForm] = useState({
    data:   initial?.data   || new Date().toISOString().split('T')[0],
    desc:   initial?.desc   || '',
    valor:  initial?.valor  || '',
    mov:    initial?.mov    || 'Entrada',
    regime: initial?.regime || 'Caixa',
  });

  const grps  = [...new Set(plano.filter(p => p.cat === cat).map(p => p.grp))];
  const tipos = plano.filter(p => p.grp === grp);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleCatChange(c) {
    setCat(c);
    const gs = [...new Set(plano.filter(p => p.cat === c).map(p => p.grp))];
    setGrp(gs[0] || '');
    const ts = plano.filter(p => p.grp === (gs[0] || ''));
    setTipo(ts[0]?.tipo || '');
  }

  function handleGrpChange(g) {
    setGrp(g);
    const ts = plano.filter(p => p.grp === g);
    setTipo(ts[0]?.tipo || '');
  }

  function handleSubmit() {
    const p = plano.find(x => x.tipo === tipo) || plano[0];
    onSave({ ...form, cat, grp, tipo, nivel: p?.nivel || '', valor: parseFloat(form.valor) || 0 });
  }

  return (
    <div>
      <div className="font-inter font-bold text-base mb-4">{title}</div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="field"><label>Data</label><input type="date" value={form.data} onChange={e => set('data', e.target.value)} /></div>
        <div className="field"><label>Valor (R$)</label><input type="number" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" /></div>
      </div>
      <div className="field"><label>Descrição</label><input type="text" value={form.desc} onChange={e => set('desc', e.target.value)} placeholder="Descrição do lançamento" /></div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="field">
          <label>Categoria</label>
          <select value={cat} onChange={e => handleCatChange(e.target.value)}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Grupo</label>
          <select value={grp} onChange={e => handleGrpChange(e.target.value)}>
            {grps.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Tipo</label>
        <select value={tipo} onChange={e => setTipo(e.target.value)}>
          {tipos.map(p => <option key={p.tipo} value={p.tipo}>{p.tipo}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="field">
          <label>Movimento</label>
          <select value={form.mov} onChange={e => set('mov', e.target.value)}>
            <option>Entrada</option><option>Saída</option>
          </select>
        </div>
        <div className="field">
          <label>Regime</label>
          <select value={form.regime} onChange={e => set('regime', e.target.value)}>
            <option>Caixa</option><option>Competência</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary flex-1" onClick={handleSubmit}>Salvar</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Sortable column header ───────────────────────────────────────────────────
function SortTh({ col, label, sortCol, sortDir, onSort, className = '' }) {
  const active = sortCol === col;
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] transition-opacity ${active ? 'opacity-100 text-accent' : 'opacity-25'}`}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );
}

// ── Filter field wrapper ─────────────────────────────────────────────────────
function FF({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] uppercase tracking-[1.2px] text-text-3 font-medium">{label}</span>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Lancamentos() {
  const { state, actions } = useApp();
  const { transactions, plano, filterState } = state;

  // ── Filter state ────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [showFilters,   setShowFilters]   = useState(false);
  const [filterDateFrom,setFilterDateFrom]= useState('');
  const [filterDateTo,  setFilterDateTo]  = useState('');
  const [filterCat,     setFilterCat]     = useState('all');
  const [filterGrp,     setFilterGrp]     = useState('all');
  const [filterTipo,    setFilterTipo]    = useState('all');
  const [filterRegime,  setFilterRegime]  = useState('all');
  const [filterMov,     setFilterMov]     = useState('all');
  const [filterValMin,  setFilterValMin]  = useState('');
  const [filterValMax,  setFilterValMax]  = useState('');

  // ── Sort state ──────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState('data');
  const [sortDir, setSortDir] = useState('desc');

  // ── Pagination ──────────────────────────────────────────────────
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0);

  // Defer search input so keystrokes stay responsive with large datasets
  const deferredSearch = useDeferredValue(search);

  // ── Base transaction set (all regimes, current year) ────────────
  const allTx = useMemo(() => {
    const arr = [...transactions.caixa, ...transactions.competencia];
    return arr.filter(r => new Date(r.data + 'T12:00').getFullYear() === filterState.year);
  }, [transactions, filterState.year]);

  // ── Dropdown options (cascade Categoria → Grupo → Tipo) ─────────
  const catOptions = useMemo(() =>
    [...new Set(allTx.map(r => r.cat))].sort(),
    [allTx]);

  const grpOptions = useMemo(() => {
    const base = filterCat === 'all' ? allTx : allTx.filter(r => r.cat === filterCat);
    return [...new Set(base.map(r => r.grp))].sort();
  }, [allTx, filterCat]);

  const tipoOptions = useMemo(() => {
    const base = filterGrp !== 'all'
      ? allTx.filter(r => r.grp === filterGrp)
      : filterCat !== 'all' ? allTx.filter(r => r.cat === filterCat) : allTx;
    return [...new Set(base.map(r => r.tipo))].sort();
  }, [allTx, filterCat, filterGrp]);

  // ── Active filter count (for badge) ─────────────────────────────
  const activeCount = [
    search !== '',
    filterDateFrom !== '',
    filterDateTo !== '',
    filterCat     !== 'all',
    filterGrp     !== 'all',
    filterTipo    !== 'all',
    filterRegime  !== 'all',
    filterMov     !== 'all',
    filterValMin  !== '',
    filterValMax  !== '',
  ].filter(Boolean).length;

  // Reset to page 0 whenever filters or sort change
  useEffect(() => { setPage(0); }, [
    deferredSearch, filterDateFrom, filterDateTo, filterCat, filterGrp,
    filterTipo, filterRegime, filterMov, filterValMin, filterValMax, sortCol, sortDir,
  ]);

  // ── Filtered + sorted rows ───────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = allTx;

    if (deferredSearch) {
      const q = deferredSearch.toLowerCase();
      arr = arr.filter(r =>
        r.desc?.toLowerCase().includes(q) ||
        r.cat?.toLowerCase().includes(q)  ||
        r.grp?.toLowerCase().includes(q)  ||
        r.tipo?.toLowerCase().includes(q)
      );
    }
    if (filterDateFrom) arr = arr.filter(r => r.data >= filterDateFrom);
    if (filterDateTo)   arr = arr.filter(r => r.data <= filterDateTo);
    if (filterCat    !== 'all') arr = arr.filter(r => r.cat    === filterCat);
    if (filterGrp    !== 'all') arr = arr.filter(r => r.grp    === filterGrp);
    if (filterTipo   !== 'all') arr = arr.filter(r => r.tipo   === filterTipo);
    if (filterRegime !== 'all') arr = arr.filter(r => r.regime === filterRegime);
    if (filterMov    !== 'all') arr = arr.filter(r => r.mov    === filterMov);
    if (filterValMin !== '')    arr = arr.filter(r => r.valor  >= parseFloat(filterValMin));
    if (filterValMax !== '')    arr = arr.filter(r => r.valor  <= parseFloat(filterValMax));

    return [...arr].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === 'valor') { va = +va; vb = +vb; }
      else { va = String(va ?? ''); vb = String(vb ?? ''); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [allTx, deferredSearch, filterDateFrom, filterDateTo, filterCat, filterGrp, filterTipo,
      filterRegime, filterMov, filterValMin, filterValMax, sortCol, sortDir]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalRec = useMemo(() => filtered.filter(r => r.mov === 'Entrada').reduce((s, r) => s + r.valor, 0), [filtered]);
  const totalSai = useMemo(() => filtered.filter(r => r.mov === 'Saída')  .reduce((s, r) => s + r.valor, 0), [filtered]);

  // ── Handlers ─────────────────────────────────────────────────────
  function handleCatChange(v) { setFilterCat(v); setFilterGrp('all'); setFilterTipo('all'); }
  function handleGrpChange(v) { setFilterGrp(v); setFilterTipo('all'); }

  function clearFilters() {
    setSearch(''); setFilterDateFrom(''); setFilterDateTo('');
    setFilterCat('all'); setFilterGrp('all'); setFilterTipo('all');
    setFilterRegime('all'); setFilterMov('all');
    setFilterValMin(''); setFilterValMax('');
    setPage(0);
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  async function handleCreate(data) {
    try {
      await api.createTransaction(data);
      await actions.refreshTransactions();
      actions.closeModal();
      actions.notify('Lançamento criado!', 'ns');
    } catch (e) { actions.notify(e.message, 'ne'); }
  }

  async function handleUpdate(id, data) {
    try {
      await api.updateTransaction(id, data);
      await actions.refreshTransactions();
      actions.closeModal();
      actions.notify('Lançamento atualizado!', 'ns');
    } catch (e) { actions.notify(e.message, 'ne'); }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await api.deleteTransaction(id);
      await actions.refreshTransactions();
      actions.notify('Lançamento excluído.', 'ni');
    } catch (e) { actions.notify(e.message, 'ne'); }
  }

  function openNew() {
    actions.openModal(
      <TransactionForm plano={plano} title="Novo Lançamento" onSave={handleCreate} onCancel={actions.closeModal} />
    );
  }

  function openEdit(r) {
    actions.openModal(
      <TransactionForm plano={plano} title={`Editar Lançamento #${r.id}`} initial={r}
        onSave={(data) => handleUpdate(r.id, data)} onCancel={actions.closeModal} />
    );
  }

  function exportCSV() {
    const rows = [['ID','Data','Descrição','Categoria','Grupo','Tipo','Nível','Valor','Movimento','Regime']];
    filtered.forEach(r => rows.push([r.id, r.data, r.desc, r.cat, r.grp, r.tipo, r.nivel, r.valor, r.mov, r.regime]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lancamentos.csv'; a.click();
    URL.revokeObjectURL(url);
    actions.notify('Exportado!', 'ns');
  }

  const inputCls = 'text-[11px] border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent w-full';
  const selectCls = inputCls;

  return (
    <div className="ani">

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-inter font-bold text-sm">Lançamentos</div>
          <div className="text-[11px] text-text-3 mt-0.5">
            {filtered.length} de {allTx.length} registros
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Icon name="search" size="text-[13px]" className="absolute top-1/2 -translate-y-1/2 text-text-3 pointer-events-none" style={{ left: 12 }} />
            <input
              type="text"
              placeholder="Buscar descrição, categoria…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-[11px] border border-slate-200 dark:border-slate-600 rounded-md bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
              style={{ width: 280, paddingLeft: 36, paddingRight: 28, paddingTop: 6, paddingBottom: 6 }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute top-1/2 -translate-y-1/2 text-text-3 hover:text-text-base" style={{ right: 8 }}>
                <Icon name="close" size="text-[12px]" />
              </button>
            )}
          </div>

          {/* Toggle filters */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`btn btn-sm flex items-center gap-1.5 ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Icon name="tune" size="text-[13px]" />
            Filtros
            {activeCount > 0 && (
              <span className="ml-0.5 bg-accent text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {activeCount}
              </span>
            )}
          </button>

          <button className="btn btn-ghost btn-sm" onClick={openNew}>
            <Icon name="add_circle" size="text-[14px]" /> Novo
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
            <Icon name="download" size="text-[14px]" /> CSV
          </button>
        </div>
      </div>

      {/* ── Filter panel ─────────────────────────────────────────── */}
      {showFilters && (
        <div className="panel mb-3 px-4 py-3.5">
          {/* Row 1: date + regime + mov + value range */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-2.5">
            <FF label="Data de">
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputCls} />
            </FF>
            <FF label="Data até">
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={inputCls} />
            </FF>
            <FF label="Regime">
              <select value={filterRegime} onChange={e => setFilterRegime(e.target.value)} className={selectCls}>
                <option value="all">Todos</option>
                <option value="Caixa">Caixa</option>
                <option value="Competência">Competência</option>
              </select>
            </FF>
            <FF label="Movimento">
              <select value={filterMov} onChange={e => setFilterMov(e.target.value)} className={selectCls}>
                <option value="all">Todos</option>
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </FF>
            <FF label="Valor mínimo">
              <input type="number" min="0" step="0.01" placeholder="0,00"
                value={filterValMin} onChange={e => setFilterValMin(e.target.value)} className={inputCls} />
            </FF>
            <FF label="Valor máximo">
              <input type="number" min="0" step="0.01" placeholder="∞"
                value={filterValMax} onChange={e => setFilterValMax(e.target.value)} className={inputCls} />
            </FF>
          </div>

          {/* Row 2: categoria / grupo / tipo + clear */}
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex flex-wrap gap-2.5 flex-1 min-w-0">
              <div className="min-w-[160px] flex-1">
                <FF label="Categoria">
                  <select value={filterCat} onChange={e => handleCatChange(e.target.value)} className={selectCls}>
                    <option value="all">Todas</option>
                    {catOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FF>
              </div>
              <div className="min-w-[160px] flex-1">
                <FF label="Grupo">
                  <select value={filterGrp} onChange={e => handleGrpChange(e.target.value)} className={selectCls}>
                    <option value="all">Todos</option>
                    {grpOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FF>
              </div>
              <div className="min-w-[180px] flex-1">
                <FF label="Tipo">
                  <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={selectCls}>
                    <option value="all">Todos</option>
                    {tipoOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </FF>
              </div>
            </div>

            {activeCount > 0 && (
              <button onClick={clearFilters}
                className="btn btn-ghost btn-sm text-red-400 hover:text-red-500 whitespace-nowrap shrink-0">
                <Icon name="cancel" size="text-[13px]" /> Limpar {activeCount} filtro{activeCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="panel">
        <div className="overflow-x-auto">
          <table className="tx-tbl">
            <thead>
              <tr>
                <SortTh col="data"   label="Data"      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="desc"   label="Descrição" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="cat"    label="Categoria" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="grp"    label="Grupo"     sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="tipo"   label="Tipo"      sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="regime" label="Regime"    sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="mov"    label="Movimento" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <SortTh col="valor"  label="Valor"     sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="text-center py-12 text-text-3">
                      <Icon name="inbox" size="text-[40px]" className="opacity-30 text-text-3 block mx-auto mb-3" />
                      <div className="font-inter text-base text-text-2 mb-1.5">
                        {activeCount > 0 ? 'Nenhum resultado para os filtros aplicados' : 'Sem lançamentos'}
                      </div>
                      {activeCount > 0 ? (
                        <button onClick={clearFilters} className="btn btn-ghost btn-sm text-accent mt-1">
                          Limpar filtros
                        </button>
                      ) : (
                        <div className="text-xs max-w-[260px] mx-auto">Importe dados ou crie manualmente.</div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : pageRows.map(r => (
                <tr key={r.id} onClick={() => openEdit(r)}>
                  <td className="text-text-2 whitespace-nowrap">
                    {new Date(r.data + 'T12:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">{r.desc}</td>
                  <td><span className="t-cat">{r.cat}</span></td>
                  <td className="text-text-2 text-[11px]">{r.grp}</td>
                  <td className="text-text-3 text-[11px]">{r.tipo}</td>
                  <td><span className={`tag ${r.regime === 'Caixa' ? 't-caixa' : 't-comp'}`}>{r.regime}</span></td>
                  <td><span className={`tag ${r.mov === 'Entrada' ? 't-entrada' : 't-saida'}`}>{r.mov}</span></td>
                  <td className={`text-right font-mono ${r.mov === 'Entrada' ? 'cv-pos' : 'cv-neg'}`}>
                    {r.mov === 'Entrada' ? '+' : '−'}{fmt(r.valor)}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>
                        <Icon name="edit" size="text-[14px]" />
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}>
                        <Icon name="delete" size="text-[14px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-text-3 flex flex-wrap justify-between items-center gap-2">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
              {activeCount > 0 && ` (filtrado de ${allTx.length})`}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                >‹ Anterior</button>
                <span className="text-[10.5px] text-text-2 px-1">
                  {page + 1} / {pageCount}
                </span>
                <button
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="btn btn-ghost btn-sm disabled:opacity-30"
                >Próximo ›</button>
              </div>
            )}
            <span>
              Ordenado por <strong className="text-text-2">{sortCol}</strong> {sortDir === 'asc' ? '↑' : '↓'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
