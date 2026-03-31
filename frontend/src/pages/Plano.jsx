import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/index.js';
import { COLOR_VAR } from '../utils/formatters.js';
import Icon from '../components/ui/Icon.jsx';

const NIVEIS = ['Receita', 'Custo', 'Despesa Operacional', 'Despesa Não Operacional'];
const COR_OPTS = [
  { value: 'green', label: 'Verde' },
  { value: 'red', label: 'Vermelho' },
  { value: 'yellow', label: 'Amarelo' },
  { value: 'purple', label: 'Roxo' },
  { value: 'blue', label: 'Azul' },
];

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function Plano() {
  const { state, actions } = useApp();
  const { plano, planoCores } = state;

  // Group plano by cat > grp
  const grouped = {};
  plano.forEach(p => {
    if (!grouped[p.cat]) grouped[p.cat] = {};
    if (!grouped[p.cat][p.grp]) grouped[p.cat][p.grp] = [];
    grouped[p.cat][p.grp].push(p);
  });

  async function refresh(data) {
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
              const res = await api.createPlanoItem({ cat: nome, grp: 'Geral', tipo: '(Novo tipo)', nivel: 'Receita' });
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
        <Field label="Nível Financeiro">
          <select onChange={e => { nivel = e.target.value; }}>
            {NIVEIS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
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
        <Field label="Nível">
          <select defaultValue={nivel} onChange={e => { nivel = e.target.value; }}>
            {NIVEIS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
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
        return (
          <div key={cat} className="panel mb-3">
            <div className="panel-hdr" style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center gap-2.5 flex-1">
                <Icon name="folder" size="text-[16px]" style={{ color }} />
                <div className="font-inter font-semibold text-[13px]" style={{ color }}>{cat}</div>
                <span className="t-cat">{Object.values(grupos).flat().length} tipos</span>
              </div>
              <div className="flex gap-1.5">
                <button className="btn btn-ghost btn-sm" onClick={() => openNewTipo(cat)}>+ Tipo</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEditCat(cat)}><Icon name="edit" size="text-[14px]" /></button>
                <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteCat(cat)}><Icon name="delete" size="text-[14px]" /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="dre-tbl" style={{ minWidth: 400 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Grupo</th>
                    <th style={{ textAlign: 'left' }}>Tipo</th>
                    <th style={{ textAlign: 'left' }}>Nível</th>
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
                          <td style={{ textAlign: 'left' }}><span className="t-cat">{item.nivel}</span></td>
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
