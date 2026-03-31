import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { fmt, fmtK, MONTHS } from '../utils/formatters.js';
import Icon from '../components/ui/Icon.jsx';

function TransactionForm({ initial, plano, onSave, onCancel, title }) {
  const cats = [...new Set(plano.map(p => p.cat))];
  const [cat, setCat] = useState(initial?.cat || cats[0] || '');
  const [grp, setGrp] = useState(initial?.grp || '');
  const [tipo, setTipo] = useState(initial?.tipo || '');
  const [form, setForm] = useState({
    data: initial?.data || new Date().toISOString().split('T')[0],
    desc: initial?.desc || '',
    valor: initial?.valor || '',
    mov: initial?.mov || 'Entrada',
    regime: initial?.regime || 'Caixa',
  });

  const grps = [...new Set(plano.filter(p => p.cat === cat).map(p => p.grp))];
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
            <option>Entrada</option>
            <option>Saída</option>
          </select>
        </div>
        <div className="field">
          <label>Regime</label>
          <select value={form.regime} onChange={e => set('regime', e.target.value)}>
            <option>Caixa</option>
            <option>Competência</option>
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

export default function Lancamentos() {
  const { state, actions } = useApp();
  const { transactions, plano, filterState } = state;
  const [filterGrp, setFilterGrp] = useState('all');
  const [filterBase, setFilterBase] = useState('ambas');

  const allTx = useMemo(() => {
    let arr = [];
    if (filterBase !== 'competencia') arr = [...arr, ...transactions.caixa];
    if (filterBase !== 'caixa') arr = [...arr, ...transactions.competencia];
    return arr.filter(r => new Date(r.data + 'T12:00').getFullYear() === filterState.year);
  }, [transactions, filterBase, filterState.year]);

  const filtered = useMemo(() => {
    let arr = allTx;
    if (filterGrp !== 'all') arr = arr.filter(r => r.grp === filterGrp);
    return [...arr].sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [allTx, filterGrp]);

  const totalRec = filtered.filter(r => r.mov === 'Entrada').reduce((s, r) => s + r.valor, 0);
  const totalSai = filtered.filter(r => r.mov === 'Saída').reduce((s, r) => s + r.valor, 0);
  const allGroups = ['all', ...new Set(allTx.map(r => r.grp))].sort();

  async function handleCreate(data) {
    try {
      await api.createTransaction(data);
      await actions.refreshTransactions();
      actions.closeModal();
      actions.notify('Lançamento criado!', 'ns');
    } catch (e) {
      actions.notify(e.message, 'ne');
    }
  }

  async function handleUpdate(id, data) {
    try {
      await api.updateTransaction(id, data);
      await actions.refreshTransactions();
      actions.closeModal();
      actions.notify('Lançamento atualizado!', 'ns');
    } catch (e) {
      actions.notify(e.message, 'ne');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await api.deleteTransaction(id);
      await actions.refreshTransactions();
      actions.notify('Lançamento excluído.', 'ni');
    } catch (e) {
      actions.notify(e.message, 'ne');
    }
  }

  function openNew() {
    actions.openModal(
      <TransactionForm plano={plano} title="Novo Lançamento" onSave={handleCreate} onCancel={actions.closeModal} />
    );
  }

  function openEdit(r) {
    actions.openModal(
      <TransactionForm
        plano={plano} title={`Editar Lançamento #${r.id}`}
        initial={r}
        onSave={(data) => handleUpdate(r.id, data)}
        onCancel={actions.closeModal}
      />
    );
  }

  function exportCSV() {
    const rows = [['ID', 'Data', 'Descrição', 'Categoria', 'Grupo', 'Tipo', 'Nível', 'Valor', 'Movimento', 'Regime']];
    filtered.forEach(r => rows.push([r.id, r.data, r.desc, r.cat, r.grp, r.tipo, r.nivel, r.valor, r.mov, r.regime]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'lancamentos.csv'; a.click();
    URL.revokeObjectURL(url);
    actions.notify('Exportado!', 'ns');
  }

  return (
    <div className="ani">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="font-inter font-bold text-sm">Lançamentos</div>
          <div className="text-[11px] text-text-3 mt-0.5">
            {filtered.length} registros · Entradas: {fmtK(totalRec)} · Saídas: {fmtK(totalSai)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-[1.5px] text-text-3">Grupo</span>
            <select value={filterGrp} onChange={e => setFilterGrp(e.target.value)}>
              {allGroups.map(g => <option key={g} value={g}>{g === 'all' ? 'Todos os grupos' : g}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-[1.5px] text-text-3">Base</span>
            <select value={filterBase} onChange={e => setFilterBase(e.target.value)}>
              <option value="ambas">Ambas</option>
              <option value="caixa">Caixa</option>
              <option value="competencia">Competência</option>
            </select>
          </div>
          <button className="btn btn-ghost btn-sm mt-3" onClick={openNew}><Icon name="add_circle" size="text-[14px]" /> Novo</button>
          <button className="btn btn-ghost btn-sm mt-3" onClick={exportCSV}><Icon name="download" size="text-[14px]" /> CSV</button>
        </div>
      </div>

      <div className="panel">
        <div className="overflow-x-auto">
          <table className="tx-tbl">
            <thead>
              <tr>
                <th>Data</th><th>Descrição</th><th>Categoria</th><th>Grupo</th><th>Tipo</th>
                <th>Regime</th><th>Movimento</th><th className="text-right">Valor</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="text-center py-12 text-text-3">
                      <Icon name="inbox" size="text-[40px]" className="opacity-30 text-text-3 block mx-auto mb-3" />
                      <div className="font-inter text-base text-text-2 mb-1.5">Sem lançamentos</div>
                      <div className="text-xs max-w-[260px] mx-auto">Importe dados ou crie manualmente.</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} onClick={() => openEdit(r)}>
                  <td className="text-text-2 whitespace-nowrap">{new Date(r.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                  <td className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">{r.desc}</td>
                  <td><span className="t-cat">{r.cat}</span></td>
                  <td className="text-text-2 text-[11px]">{r.grp}</td>
                  <td className="text-text-3 text-[11px]">{r.tipo}</td>
                  <td><span className={`tag ${r.regime === 'Caixa' ? 't-caixa' : 't-comp'}`}>{r.regime}</span></td>
                  <td><span className={`tag ${r.mov === 'Entrada' ? 't-entrada' : 't-saida'}`}>{r.mov}</span></td>
                  <td className={`text-right font-mono ${r.mov === 'Entrada' ? 'cv-pos' : 'cv-neg'}`}>
                    {r.mov === 'Entrada' ? '+' : '-'}{fmt(r.valor)}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Icon name="edit" size="text-[14px]" /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}><Icon name="delete" size="text-[14px]" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
