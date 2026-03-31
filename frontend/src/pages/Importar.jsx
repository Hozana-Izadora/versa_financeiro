import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { MONTHS } from '../utils/formatters.js';
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

export default function Importar() {
  const { state, actions } = useApp();
  const { importHistory, saldosIniciais, filterState } = state;
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

  async function saveSaldos() {
    const base = parseFloat(document.getElementById('si-base')?.value || 0) || 0;
    const monthValues = {};
    MONTHS.forEach((_, i) => {
      const k = `${filterState.year}-${String(i + 1).padStart(2, '0')}`;
      monthValues[k] = parseFloat(document.getElementById(`si-${i}`)?.value || 0) || 0;
    });
    try {
      const res = await api.updateSaldos({ year: filterState.year, base, monthValues });
      actions.dispatch({ type: 'SET_SALDOS', payload: res });
      actions.notify('Saldos salvos! Acumulado atualizado.', 'ns');
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
      {activeTab === 'saldos' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-inter font-bold text-sm">Saldos Iniciais de Caixa</div>
              <div className="text-[11px] text-text-3 mt-0.5">Para cálculo correto do saldo acumulado</div>
            </div>
            <button className="btn btn-green btn-sm" onClick={saveSaldos}><Icon name="check" size="text-[14px]" /> Salvar</button>
          </div>

          <div className="panel p-[18px_20px] mb-3.5">
            <div className="font-inter font-semibold text-[13px] mb-2.5">Saldo Base do Ano — {filterState.year}</div>
            <div className="flex items-center gap-2.5">
              <label className="text-xs text-text-2">R$</label>
              <input
                type="number" id="si-base" step="0.01"
                defaultValue={saldosIniciais[filterState.year + '-base'] || 0}
                style={{ width: 200, fontFamily: 'Geist Mono, monospace', fontSize: 15, fontWeight: 600 }}
              />
              <span className="text-[11px] text-text-3">Saldo em caixa em 01/01/{filterState.year}</span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-hdr">
              <div>
                <div className="font-inter font-semibold text-[13px]">Ajustes Mensais — {filterState.year}</div>
                <div className="text-[10px] text-text-3 mt-0.5">Opcional: ajuste manual por mês</div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {MONTHS.map((m, i) => {
                  const k = `${filterState.year}-${String(i + 1).padStart(2, '0')}`;
                  return (
                    <div key={i} className="bg-white border border-slate-100 rounded-sm px-3.5 py-3">
                      <div className="text-[10px] text-text-3 mb-1.5">{m} {filterState.year}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-text-3">R$</span>
                        <input
                          type="number" id={`si-${i}`} step="0.01"
                          defaultValue={saldosIniciais[k] || 0}
                          className="flex-1"
                          style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
