import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { MONTHS, fmt } from '../utils/formatters.js';
import Icon from '../components/ui/Icon.jsx';

const COLUMN_ALIASES = [
  ['data', 'data, date, dt, vencimento, competencia'],
  ['descricao', 'descrição, descricao, description, historico, memo, obs'],
  ['categoria', 'categoria, category, conta, plano'],
  ['valor', 'valor, value, amount, montante'],
  ['movimento', 'tipo, movimento, operacao, entrada_saida'],
  ['regime', 'regime, tipo_lancamento, caixa_competencia'],
];

const TABS = [
  ['upload', 'upload_file', 'Upload'],
  ['saldos', 'account_balance_wallet', 'Saldos Iniciais'],
  ['historico', 'history', 'Histórico'],
  ['mapeamento', 'tune', 'Mapeamento'],
];

// ── helpers for chave ────────────────────────────────────────────────────────
function chaveLabel(chave) {
  if (!chave) return '';
  if (chave.endsWith('-abertura')) return `Abertura — ${chave.slice(0, 4)}`;
  const m = chave.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTHS[parseInt(m[2], 10) - 1]}/${m[1]}`;
  return chave;
}

function chaveType(chave) {
  return chave?.endsWith('-abertura') ? 'abertura' : 'mensal';
}

function buildChave(tipo, year, month) {
  if (tipo === 'abertura') return `${year}-abertura`;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtOp(op) {
  if (op === 'INSERT') return { label: 'Adicionado', cls: 'text-emerald-600' };
  if (op === 'UPDATE') return { label: 'Atualizado', cls: 'text-blue-600' };
  if (op === 'DELETE') return { label: 'Removido',   cls: 'text-red-500' };
  return { label: op, cls: 'text-text-3' };
}

// ── SaldosTab ────────────────────────────────────────────────────────────────
function SaldosTab({ actions }) {
  const [entries, setEntries]       = useState([]);
  const [auditLog, setAuditLog]     = useState([]);
  const [showLog, setShowLog]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [editRow, setEditRow]       = useState(null); // { chave, tipo, year, month, valor }
  const [addForm, setAddForm]       = useState(null); // null | { tipo, year, month, valor }
  const currentYear = new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, l] = await Promise.all([api.getSaldosEntries(), api.getSaldosLog()]);
      setEntries(e);
      setAuditLog(l);
    } catch (err) {
      actions.notify('Erro ao carregar saldos: ' + err.message, 'ne');
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setAddForm({ tipo: 'abertura', year: currentYear, month: 1, valor: '' });
    setEditRow(null);
  }

  function openEdit(entry) {
    const tipo  = chaveType(entry.chave);
    const year  = parseInt(entry.chave.slice(0, 4), 10);
    const month = tipo === 'mensal' ? parseInt(entry.chave.slice(5), 10) : 1;
    setEditRow({ oldChave: entry.chave, tipo, year, month, valor: String(entry.valor) });
    setAddForm(null);
  }

  async function saveEntry(form, oldChave) {
    const chave = buildChave(form.tipo, form.year, form.month);
    const valor = parseFloat(form.valor) || 0;
    try {
      const updated = await api.upsertSaldoEntry({ chave, valor, oldChave: oldChave || chave });
      setEntries(updated);
      const [l] = await Promise.all([api.getSaldosLog()]);
      setAuditLog(l);
      await actions.refreshAll();
      actions.notify('Saldo salvo com sucesso.', 'ns');
      setEditRow(null);
      setAddForm(null);
    } catch (err) {
      actions.notify('Erro: ' + err.message, 'ne');
    }
  }

  async function deleteEntry(chave) {
    if (!confirm(`Remover saldo "${chaveLabel(chave)}"?`)) return;
    try {
      const updated = await api.deleteSaldoEntry(chave);
      setEntries(updated);
      const l = await api.getSaldosLog();
      setAuditLog(l);
      await actions.refreshAll();
      actions.notify('Saldo removido.', 'ni');
    } catch (err) {
      actions.notify('Erro: ' + err.message, 'ne');
    }
  }

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  function EntryForm({ form, setForm, onSave, onCancel, oldChave }) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-4 mb-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Tipo</div>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="text-[12px] border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="abertura">Saldo de Abertura</option>
              <option value="mensal">Ajuste Mensal</option>
            </select>
          </div>
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Ano</div>
            <select
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
              className="text-[12px] border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {form.tipo === 'mensal' && (
            <div>
              <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Mês</div>
              <select
                value={form.month}
                onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))}
                className="text-[12px] border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Valor (R$)</div>
            <input
              type="number" step="0.01"
              value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              placeholder="0,00"
              className="text-[12px] border border-slate-200 dark:border-slate-600 rounded-md px-2.5 py-1.5 bg-bg-1 text-text-base focus:outline-none focus:ring-1 focus:ring-accent"
              style={{ width: 140, fontFamily: 'Geist Mono, monospace' }}
            />
          </div>
          <div className="flex gap-1.5 pb-0.5">
            <button className="btn btn-green btn-sm" onClick={() => onSave(form, oldChave)}>
              <Icon name="check" size="text-[13px]" /> Salvar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-inter font-bold text-sm">Saldos Iniciais de Caixa</div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Gerencie saldos de abertura e ajustes mensais para cálculo correto do acumulado
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Icon name="add" size="text-[14px]" /> Adicionar
        </button>
      </div>

      {/* Add form */}
      {addForm && (
        <EntryForm
          form={addForm}
          setForm={setAddForm}
          onSave={(f) => saveEntry(f, null)}
          onCancel={() => setAddForm(null)}
          oldChave={null}
        />
      )}

      {/* Entries table */}
      <div className="panel mb-4">
        <div className="panel-hdr">
          <div className="font-inter font-semibold text-[13px]">Registros</div>
          <span className="text-[11px] text-text-3">{entries.length} entrada{entries.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-3 text-sm">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-text-3">
            <Icon name="account_balance_wallet" size="text-[36px]" className="opacity-25 block mx-auto mb-3" />
            <div className="font-inter text-[13px] text-text-2 mb-1">Nenhum saldo cadastrado</div>
            <div className="text-[11px]">Clique em "Adicionar" para incluir o saldo de abertura.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Tipo</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Período</th>
                  <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Valor</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Atualizado por</th>
                  <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Em</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <React.Fragment key={entry.chave}>
                    <tr className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          chaveType(entry.chave) === 'abertura'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {chaveType(entry.chave) === 'abertura' ? 'Abertura' : 'Ajuste Mensal'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-text-base">{chaveLabel(entry.chave)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: entry.valor >= 0 ? '#10b981' : '#ef4444' }}>
                        {fmt(entry.valor)}
                      </td>
                      <td className="px-4 py-3 text-text-3">{entry.updatedBy || '—'}</td>
                      <td className="px-4 py-3 text-text-3">{fmtDateTime(entry.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '3px 8px' }}
                            onClick={() => openEdit(entry)}
                          >
                            <Icon name="edit" size="text-[13px]" />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-red-400 hover:text-red-600"
                            style={{ padding: '3px 8px' }}
                            onClick={() => deleteEntry(entry.chave)}
                          >
                            <Icon name="delete" size="text-[13px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editRow?.oldChave === entry.chave && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-2">
                          <EntryForm
                            form={editRow}
                            setForm={setEditRow}
                            onSave={(f) => saveEntry(f, editRow.oldChave)}
                            onCancel={() => setEditRow(null)}
                            oldChave={editRow.oldChave}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="panel">
        <div
          className="panel-hdr cursor-pointer select-none"
          onClick={() => setShowLog(v => !v)}
        >
          <div>
            <div className="font-inter font-semibold text-[13px]">Histórico de Alterações</div>
            <div className="text-[10px] text-text-3 mt-0.5">{auditLog.length} registro{auditLog.length !== 1 ? 's' : ''}</div>
          </div>
          <Icon
            name="expand_more"
            size="text-[18px]"
            className="text-text-3 transition-transform duration-200"
            style={{ transform: showLog ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>

        {showLog && (
          auditLog.length === 0 ? (
            <div className="p-6 text-center text-text-3 text-[12px]">Nenhuma alteração registrada ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Data/Hora</th>
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Período</th>
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Operação</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Antes</th>
                    <th className="text-right px-4 py-2 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Depois</th>
                    <th className="text-left px-4 py-2 text-[10px] uppercase tracking-wider text-text-3 font-semibold">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(log => {
                    const op = fmtOp(log.operacao);
                    return (
                      <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800">
                        <td className="px-4 py-2.5 text-text-3">{fmtDateTime(log.changed_at)}</td>
                        <td className="px-4 py-2.5 font-medium text-text-base">{chaveLabel(log.chave)}</td>
                        <td className={`px-4 py-2.5 font-semibold ${op.cls}`}>{op.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-3">
                          {log.old_valor !== null ? fmt(Number(log.old_valor)) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-base">
                          {log.new_valor !== null ? fmt(Number(log.new_valor)) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-text-3">{log.changed_by}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function Importar() {
  const { state, actions } = useApp();
  const { importHistory, filterState } = state;
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadBase, setUploadBase] = useState('caixa');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  async function processFile(file) {
    try {
      const res = await api.importFile(file, uploadBase);
      await actions.refreshAll();
      actions.notify(`${res.imported} lançamentos importados para a base ${uploadBase === 'caixa' ? 'Caixa' : 'Competência'}!`, 'ns');
    } catch (e) {
      actions.notify('Erro: ' + e.message, 'ne');
    }
  }

  async function loadSample() {
    try {
      const res = await api.seed();
      await actions.refreshAll();
      actions.notify(`${res.caixaCount + res.competenciaCount} lançamentos de exemplo carregados!`, 'ni');
    } catch (e) {
      actions.notify(e.message, 'ne');
    }
  }

  async function clearAll() {
    if (!confirm('Limpar todos os dados?')) return;
    try {
      await api.reset();
      await actions.refreshAll();
      actions.notify('Dados limpos.', 'ni');
    } catch (e) {
      actions.notify(e.message, 'ne');
    }
  }

  async function clearHistory() {
    await api.clearHistory();
    actions.dispatch({ type: 'SET_HISTORY', payload: [] });
    actions.notify('Histórico limpo.', 'ni');
  }

  return (
    <div className="ani">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 mb-4">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={`tab-btn flex items-center gap-1.5 ${activeTab === id ? 'act' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon name={icon} size="text-[15px]" />
            {label}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {activeTab === 'upload' && (
        <div>
          <div className="mb-5">
            <div className="font-inter font-bold text-sm mb-1.5">Selecionar base de destino</div>
            <div className="flex gap-2 items-center mb-4">
              <button
                className="btn btn-ghost"
                style={uploadBase === 'caixa' ? { borderColor: '#10b981', color: '#10b981' } : {}}
                onClick={() => setUploadBase('caixa')}
              >
                <Icon name="account_balance_wallet" size="text-[15px]" /> Base Caixa
              </button>
              <button
                className="btn btn-ghost"
                style={uploadBase === 'competencia' ? { borderColor: '#7c3aed', color: '#7c3aed' } : {}}
                onClick={() => setUploadBase('competencia')}
              >
                <Icon name="trending_up" size="text-[15px]" /> Base Competência
              </button>
              <span className="text-xs font-semibold" style={{ color: uploadBase === 'caixa' ? '#10b981' : '#7c3aed' }}>
                → Importando para: {uploadBase === 'caixa' ? 'Caixa' : 'Competência'}
              </span>
            </div>
          </div>

          <div
            className={`upload-zone ${dragging ? 'drag' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
          >
            <input
              type="file" accept=".xlsx,.xls,.csv" ref={fileRef}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              onChange={e => e.target.files[0] && processFile(e.target.files[0])}
            />
            <Icon name="folder_open" size="text-[42px]" className="text-text-3 opacity-40 block mx-auto mb-2.5" />
            <div className="font-inter font-bold text-[15px] mb-1.5">Arraste ou clique para selecionar</div>
            <div className="text-xs text-text-2 mb-2.5">Excel (.xlsx, .xls) ou CSV (vírgula ou ponto-e-vírgula)</div>
            <div className="flex gap-1.5 justify-center">
              {['.XLSX', '.XLS', '.CSV'].map(f => (
                <span key={f} className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] text-text-3 font-semibold">{f}</span>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="font-inter font-bold text-[13px] mb-2.5">Colunas esperadas</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['Data', 'DD/MM/AAAA ou ISO'],
                ['Descrição', 'Texto livre'],
                ['Categoria', 'Conforme plano de contas'],
                ['Valor', 'Numérico (R$ 1.250,00)'],
                ['Movimento / Tipo', 'Entrada ou Saída'],
                ['Regime', 'Caixa ou Competência'],
              ].map(([n, d]) => (
                <div key={n} className="bg-slate-50 border border-slate-100 rounded-sm px-3 py-2 text-xs">
                  <strong className="text-accent">{n}</strong>
                  <span className="text-text-3 ml-1.5">→ {d}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex gap-2.5 items-center">
            <button className="btn btn-green" onClick={loadSample}><Icon name="casino" size="text-[15px]" /> Carregar Dados de Exemplo</button>
            <span className="text-[11px] text-text-3">Carrega dados fictícios nas duas bases para explorar o dashboard</span>
          </div>
        </div>
      )}

      {/* Saldos tab */}
      {activeTab === 'saldos' && <SaldosTab actions={actions} />}

      {/* Histórico tab */}
      {activeTab === 'historico' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="font-inter font-bold text-sm">Histórico de Importações</div>
            <button className="btn btn-red btn-sm" onClick={clearHistory}><Icon name="delete" size="text-[14px]" /> Limpar histórico</button>
          </div>
          {importHistory.length === 0 ? (
            <div className="text-center py-12 text-text-3">
              <Icon name="inbox" size="text-[40px]" className="opacity-30 block mx-auto mb-3" />
              <div className="font-inter text-base text-text-2 mb-1.5">Nenhuma importação</div>
              <div className="text-xs">Faça upload de um arquivo para registrar aqui.</div>
            </div>
          ) : importHistory.map((h, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-sm px-4 py-3 mb-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[13px]">{h.name}</div>
                <div className="text-[11px] text-text-3">{h.rows} registros · Base: {h.base} · {h.date}</div>
              </div>
              <span className="tag t-entrada"><Icon name="check_circle" size="text-[12px]" className="mr-0.5" /> OK</span>
            </div>
          ))}
          <div className="mt-4 flex gap-2.5 items-center">
            <button className="btn btn-red btn-sm" onClick={async () => {
              if (!confirm('Limpar todos os dados?')) return;
              await api.reset();
              await actions.refreshAll();
              actions.notify('Dados limpos.', 'ni');
            }}><Icon name="delete_forever" size="text-[14px]" /> Limpar todos os dados</button>
          </div>
        </div>
      )}

      {/* Mapeamento tab */}
      {activeTab === 'mapeamento' && (
        <div className="panel">
          <div className="panel-hdr">
            <div className="font-inter font-semibold text-[13px]">Aliases de Colunas Reconhecidos</div>
          </div>
          <div className="overflow-x-auto">
            <table className="dre-tbl" style={{ minWidth: 300 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Campo</th>
                  <th style={{ textAlign: 'left' }}>Aliases aceitos (case-insensitive)</th>
                </tr>
              </thead>
              <tbody>
                {COLUMN_ALIASES.map(([field, aliases]) => (
                  <tr key={field}>
                    <td style={{ textAlign: 'left', color: '#2563eb', fontWeight: 600 }}>{field}</td>
                    <td style={{ textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>{aliases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
