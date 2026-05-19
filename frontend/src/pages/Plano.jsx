import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { COLOR_VAR } from '../utils/formatters.js';
import Icon from '../components/ui/Icon.jsx';

const NIVEL_CONFIG = {
  'Receita':                 { group: 'Entradas',             color: '#10b981', bg: 'rgba(16,185,129,0.13)',  desc: 'Valores recebidos pela atividade principal da empresa' },
  'Entrada Não Operacional': { group: 'Entradas',             color: '#06b6d4', bg: 'rgba(6,182,212,0.13)',   desc: 'Receitas financeiras ou não relacionadas à operação' },
  'Custo':                   { group: 'Gasto Operacional',    color: '#f97316', bg: 'rgba(249,115,22,0.13)',  desc: 'Custo direto do produto ou serviço vendido (CMV, CSP)' },
  'Despesa Operacional':     { group: 'Gasto Operacional',    color: '#f59e0b', bg: 'rgba(245,158,11,0.13)',  desc: 'Gastos de estrutura e funcionamento da empresa' },
  'Despesa Não Operacional': { group: 'Gasto Não Operacional',color: '#8b5cf6', bg: 'rgba(139,92,246,0.13)', desc: 'Financeiro, tributário ou eventual (IR, juros, multas)' },
};

const NIVEL_GROUPS = [
  {
    label: 'Gasto Operacional',
    icon: 'trending_up',
    hint: 'Gastos do dia a dia que fazem a empresa funcionar',
    niveis: ['Custo', 'Despesa Operacional'],
  },
  {
    label: 'Gasto Não Operacional',
    icon: 'account_balance',
    hint: 'Gastos financeiros, tributários e eventuais',
    niveis: ['Despesa Não Operacional'],
  },
  {
    label: 'Entradas',
    icon: 'payments',
    hint: 'Receitas operacionais e não operacionais',
    niveis: ['Receita', 'Entrada Não Operacional'],
  },
];

const COR_OPTS = [
  { value: 'green',  label: 'Verde' },
  { value: 'red',    label: 'Vermelho' },
  { value: 'yellow', label: 'Amarelo' },
  { value: 'purple', label: 'Roxo' },
  { value: 'blue',   label: 'Azul' },
];

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function NivelBadge({ nivel }) {
  const cfg = NIVEL_CONFIG[nivel];
  if (!cfg) return <span className="t-cat">{nivel}</span>;
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 99,
      color: cfg.color, background: cfg.bg,
      whiteSpace: 'nowrap',
    }}>
      {nivel}
    </span>
  );
}

function NivelSelector({ value, onChange }) {
  const [sel, setSel] = useState(value);

  function select(n) {
    setSel(n);
    onChange(n);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {NIVEL_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <Icon name={group.icon} size="text-[12px]" style={{ color: '#64748b' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {group.label}
            </span>
            <span style={{ fontSize: 10, color: '#475569' }}>— {group.hint}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {group.niveis.map(n => {
              const cfg = NIVEL_CONFIG[n];
              const active = sel === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => select(n)}
                  style={{
                    flex: 1, minWidth: 140, textAlign: 'left',
                    padding: '8px 11px', borderRadius: 8,
                    border: `1.5px solid ${active ? cfg.color : 'rgba(255,255,255,0.08)'}`,
                    background: active ? cfg.bg : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer', transition: 'all .13s',
                    outline: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: active ? cfg.color : '#475569',
                      flexShrink: 0, transition: 'background .13s',
                    }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? cfg.color : '#94a3b8' }}>
                      {n}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.45, paddingLeft: 13 }}>
                    {cfg.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CatClassificacao({ items }) {
  const groups = [...new Set(items.map(i => NIVEL_CONFIG[i.nivel]?.group).filter(Boolean))];
  if (!groups.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {groups.map(g => {
        const cfg = Object.values(NIVEL_CONFIG).find(c => c.group === g);
        return (
          <span key={g} style={{
            fontSize: 9.5, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
            color: cfg?.color || '#94a3b8',
            background: cfg?.bg || 'rgba(148,163,184,0.1)',
          }}>
            {g}
          </span>
        );
      })}
    </div>
  );
}

export default function Plano() {
  const { state, actions } = useApp();
  const { plano, planoCores } = state;

  const [collapsed, setCollapsed] = useState(new Set());

  function toggleCat(cat) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const grouped = {};
  plano.forEach(p => {
    if (!grouped[p.cat]) grouped[p.cat] = {};
    if (!grouped[p.cat][p.grp]) grouped[p.cat][p.grp] = [];
    grouped[p.cat][p.grp].push(p);
  });

  function refresh(data) {
    actions.dispatch({ type: 'SET_PLANO', payload: data });
  }

  // ---- Category modals ----
  function openNewCat() {
    let nome = '', cor = 'green';
    actions.openModal(
      <div>
        <div className="font-inter font-bold text-base mb-4 flex items-center gap-2">
          <Icon name="create_new_folder" size="text-[18px]" className="text-accent" /> Nova Categoria
        </div>
        <Field label="Nome">
          <input type="text" placeholder="Ex: RECEITAS ESPECIAIS" onChange={e => { nome = e.target.value.toUpperCase(); }} />
        </Field>
        <Field label="Cor">
          <select onChange={e => { cor = e.target.value; }}>
            {COR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary flex-1" onClick={async () => {
            if (!nome) return actions.notify('Informe o nome.', 'ne');
            try {
              await api.createPlanoItem({ cat: nome, grp: 'Geral', tipo: '(Novo tipo)', nivel: 'Receita' });
              await api.updateCategoria(nome, { newName: nome, cor });
              const planoData = await api.getPlano();
              refresh(planoData);
              actions.closeModal();
              actions.notify('Categoria criada!', 'ns');
            } catch (e) { actions.notify(e.message, 'ne'); }
          }}>Salvar</button>
          <button className="btn btn-ghost" onClick={actions.closeModal}>Cancelar</button>
        </div>
      </div>
    );
  }

  function openEditCat(cat) {
    let nome = cat, cor = planoCores[cat] || 'green';
    actions.openModal(
      <div>
        <div className="font-inter font-bold text-base mb-4 flex items-center gap-2">
          <Icon name="edit" size="text-[18px]" className="text-accent" /> Editar Categoria
        </div>
        <Field label="Nome">
          <input type="text" defaultValue={cat} onChange={e => { nome = e.target.value.toUpperCase(); }} />
        </Field>
        <Field label="Cor">
          <select defaultValue={cor} onChange={e => { cor = e.target.value; }}>
            {COR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary flex-1" onClick={async () => {
            try {
              const data = await api.updateCategoria(cat, { newName: nome, cor });
              refresh(data);
              const txRes = await api.getTransactions();
              actions.dispatch({ type: 'SET_TRANSACTIONS', payload: txRes });
              actions.closeModal();
              actions.notify('Categoria atualizada!', 'ns');
            } catch (e) { actions.notify(e.message, 'ne'); }
          }}>Salvar</button>
          <button className="btn btn-ghost" onClick={actions.closeModal}>Cancelar</button>
        </div>
      </div>
    );
  }

  async function deleteCat(cat) {
    if (!confirm(`Remover "${cat}" e todos os seus tipos?`)) return;
    try {
      const data = await api.deleteCategoria(cat);
      refresh(data);
      actions.notify('Removida.', 'ni');
    } catch (e) { actions.notify(e.message, 'ne'); }
  }

  // ---- Tipo modals ----
  function openNewTipo(catPre = '', grpPre = '') {
    const cats = [...new Set(plano.map(p => p.cat))];
    let cat = catPre || cats[0] || '', grp = grpPre || '', tipo = '', nivel = 'Receita';
    actions.openModal(
      <div>
        <div className="font-inter font-bold text-base mb-4 flex items-center gap-2">
          <Icon name="add_circle" size="text-[18px]" className="text-accent" /> Novo Tipo de Conta
        </div>
        <Field label="Categoria">
          <select defaultValue={cat} onChange={e => { cat = e.target.value; }}>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Grupo">
          <input type="text" defaultValue={grp} placeholder="Nome do grupo" onChange={e => { grp = e.target.value; }} />
        </Field>
        <Field label="Nome do Tipo">
          <input type="text" placeholder="Ex: Receita de Assinatura" onChange={e => { tipo = e.target.value; }} />
        </Field>
        <Field label="Classificação Financeira">
          <NivelSelector value={nivel} onChange={n => { nivel = n; }} />
        </Field>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary flex-1" onClick={async () => {
            if (!tipo) return actions.notify('Informe o tipo.', 'ne');
            try {
              const updated = await api.createPlanoItem({ cat, grp, tipo, nivel });
              actions.dispatch({ type: 'SET_PLANO', payload: { plano: updated, planoCores } });
              actions.closeModal();
              actions.notify('Tipo criado!', 'ns');
            } catch (e) { actions.notify(e.message, 'ne'); }
          }}>Salvar</button>
          <button className="btn btn-ghost" onClick={actions.closeModal}>Cancelar</button>
        </div>
      </div>
    );
  }

  function openEditTipo(item) {
    let cat = item.cat, grp = item.grp, tipo = item.tipo, nivel = item.nivel;
    actions.openModal(
      <div>
        <div className="font-inter font-bold text-base mb-4 flex items-center gap-2">
          <Icon name="edit" size="text-[18px]" className="text-accent" /> Editar Tipo
        </div>
        <Field label="Categoria">
          <select defaultValue={cat} onChange={e => { cat = e.target.value; }}>
            {[...new Set(plano.map(p => p.cat))].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Grupo">
          <input type="text" defaultValue={grp} onChange={e => { grp = e.target.value; }} />
        </Field>
        <Field label="Nome do Tipo">
          <input type="text" defaultValue={tipo} onChange={e => { tipo = e.target.value; }} />
        </Field>
        <Field label="Classificação Financeira">
          <NivelSelector value={nivel} onChange={n => { nivel = n; }} />
        </Field>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary flex-1" onClick={async () => {
            try {
              const updated = await api.updatePlanoItem(item.tipo, { cat, grp, tipo, nivel });
              actions.dispatch({ type: 'SET_PLANO', payload: { plano: updated, planoCores } });
              const txRes = await api.getTransactions();
              actions.dispatch({ type: 'SET_TRANSACTIONS', payload: txRes });
              actions.closeModal();
              actions.notify('Tipo atualizado!', 'ns');
            } catch (e) { actions.notify(e.message, 'ne'); }
          }}>Salvar</button>
          <button className="btn btn-ghost" onClick={actions.closeModal}>Cancelar</button>
        </div>
      </div>
    );
  }

  async function deleteTipo(tipo) {
    if (!confirm(`Remover "${tipo}"?`)) return;
    try {
      const updated = await api.deletePlanoItem(tipo);
      actions.dispatch({ type: 'SET_PLANO', payload: { plano: updated, planoCores } });
      actions.notify('Removido.', 'ni');
    } catch (e) { actions.notify(e.message, 'ne'); }
  }

  return (
    <div className="ani">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-inter font-bold text-sm">Plano de Contas</div>
          <div className="text-[11px] text-text-3 mt-0.5">{plano.length} tipos · {Object.keys(grouped).length} categorias</div>
        </div>
        <div className="flex gap-1.5">
          <button className="btn btn-ghost btn-sm" onClick={openNewCat}>+ Categoria</button>
          <button className="btn btn-primary btn-sm" onClick={() => openNewTipo()}>+ Tipo</button>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, grupos]) => {
        const cor = planoCores[cat] || 'blue';
        const color = COLOR_VAR[cor] || COLOR_VAR.blue;
        const allItems = Object.values(grupos).flat();
        const isCollapsed = collapsed.has(cat);
        return (
          <div key={cat} className="panel mb-3">
            <div
              className="panel-hdr"
              style={{ borderLeft: `3px solid ${color}`, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleCat(cat)}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Icon
                  name={isCollapsed ? 'chevron_right' : 'expand_more'}
                  size="text-[16px]"
                  style={{ color: '#64748b', flexShrink: 0, transition: 'transform .15s' }}
                />
                <Icon name="folder" size="text-[16px]" style={{ color }} />
                <div className="font-inter font-semibold text-[13px]" style={{ color }}>{cat}</div>
                <span className="t-cat">{allItems.length} tipos</span>
                <CatClassificacao items={allItems} />
              </div>
              <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={() => openNewTipo(cat)}>+ Tipo</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEditCat(cat)}><Icon name="edit" size="text-[14px]" /></button>
                <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteCat(cat)}><Icon name="delete" size="text-[14px]" /></button>
              </div>
            </div>
            {!isCollapsed && <div className="overflow-x-auto">
              <table className="dre-tbl" style={{ minWidth: 400 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Grupo</th>
                    <th style={{ textAlign: 'left' }}>Tipo</th>
                    <th style={{ textAlign: 'left' }}>Classificação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grupos).map(([grp, items]) => (
                    <React.Fragment key={grp}>
                      <tr className="dr-group">
                        <td>{grp}</td>
                        <td></td>
                        <td></td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openNewTipo(cat, grp)}>+ Tipo</button>
                        </td>
                      </tr>
                      {items.map(item => (
                        <tr key={item.tipo} className="dr-item">
                          <td style={{ paddingLeft: 28, color: '#94a3b8', fontSize: 11 }}>{grp}</td>
                          <td style={{ textAlign: 'left' }}>{item.tipo}</td>
                          <td style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <NivelBadge nivel={item.nivel} />
                              <span style={{ fontSize: 9.5, color: '#475569' }}>
                                {NIVEL_CONFIG[item.nivel]?.group}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-1 justify-end">
                              <button className="btn btn-ghost btn-sm" onClick={() => openEditTipo(item)}><Icon name="edit" size="text-[14px]" /></button>
                              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteTipo(item.tipo)}><Icon name="delete" size="text-[14px]" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        );
      })}
    </div>
  );
}
