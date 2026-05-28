import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/index.js';
import Icon from '../components/ui/Icon.jsx';

// ── Shared styles ─────────────────────────────────────────────────────────────

const ACCENT = '#10b981';
const ACCENT_DARK = '#059669';

const inputStyle = (dark) => ({
  width: '100%',
  padding: '9px 12px',
  fontSize: 13,
  borderRadius: 7,
  border: `1.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
  background: dark ? '#1e2635' : '#fff',
  color: dark ? '#e5e7eb' : '#111827',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
});

const labelStyle = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: '#6b7280',
  marginBottom: 5,
};

const btnPrimary = {
  padding: '8px 16px',
  background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'inherit',
};

const btnGhost = (dark) => ({
  padding: '7px 14px',
  background: 'transparent',
  color: dark ? 'rgba(255,255,255,0.55)' : '#6b7280',
  border: `1.5px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
});

const btnDanger = {
  padding: '7px 12px',
  background: 'rgba(239,68,68,0.10)',
  color: '#ef4444',
  border: '1.5px solid rgba(239,68,68,0.20)',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
};

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, dark }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: dark ? '#161b22' : '#fff',
        borderRadius: 12,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
        border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
      }}>
        <div style={{
          padding: '18px 24px 16px',
          borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: dark ? '#f0f6fc' : '#0f172a' }}>{title}</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af', padding: 4, display: 'flex' }}
          >
            <Icon name="close" size="text-[18px]" />
          </button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function Alert({ msg, type = 'error' }) {
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 7,
      fontSize: 12.5,
      display: 'flex', alignItems: 'center', gap: 8,
      background: isErr ? '#fef2f2' : '#f0fdf4',
      color: isErr ? '#dc2626' : '#16a34a',
      border: `1px solid ${isErr ? '#fecaca' : '#bbf7d0'}`,
      borderLeft: `3px solid ${isErr ? '#ef4444' : ACCENT}`,
      marginBottom: 12,
    }}>
      <Icon name={isErr ? 'error_outline' : 'check_circle'} size="text-[14px]" />
      {msg}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
      background: active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
      color: active ? '#059669' : '#dc2626',
      border: `1px solid ${active ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.20)'}`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: active ? ACCENT : '#ef4444', flexShrink: 0,
      }} />
      {active ? 'Ativa' : 'Inativa'}
    </span>
  );
}

// ── Companies tab ─────────────────────────────────────────────────────────────

function CompaniesTab({ dark }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // 'create' | { type:'edit', company }

  const load = useCallback(async () => {
    setLoading(true);
    try { setCompanies(await api.adminListClients()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const thStyle = {
    padding: '10px 14px', fontSize: 10.5, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    color: dark ? 'rgba(255,255,255,0.38)' : '#9ca3af',
    textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
    background: dark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
  };
  const tdStyle = {
    padding: '11px 14px', fontSize: 12.5,
    color: dark ? '#d1d5db' : '#374151',
    borderBottom: dark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.05)',
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: dark ? '#f0f6fc' : '#0f172a' }}>Empresas</div>
          <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af', marginTop: 2 }}>
            {companies.length} empresa{companies.length !== 1 ? 's' : ''} cadastrada{companies.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button style={btnPrimary} onClick={() => setModal('create')}>
          <Icon name="add" size="text-[15px]" />
          Nova Empresa
        </button>
      </div>

      <div style={{
        background: dark ? '#161b22' : '#fff',
        borderRadius: 10,
        border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: dark ? 'rgba(255,255,255,0.3)' : '#9ca3af', fontSize: 13 }}>
            Carregando…
          </div>
        ) : companies.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? 'rgba(255,255,255,0.3)' : '#9ca3af', fontSize: 13 }}>
            Nenhuma empresa cadastrada.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Criado em</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} style={{ transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: dark ? '#f0f6fc' : '#0f172a' }}>{c.name}</td>
                  <td style={tdStyle}>
                    <code style={{
                      fontSize: 11.5, padding: '2px 6px', borderRadius: 4,
                      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: dark ? '#94a3b8' : '#64748b',
                    }}>{c.slug}</code>
                  </td>
                  <td style={tdStyle}><StatusBadge active={c.active} /></td>
                  <td style={{ ...tdStyle, color: dark ? 'rgba(255,255,255,0.38)' : '#9ca3af' }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button style={btnGhost(dark)} onClick={() => setModal({ type: 'edit', company: c })}>
                        <Icon name="edit" size="text-[13px]" /> Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'create' && (
        <CreateCompanyModal dark={dark} onClose={() => setModal(null)} onCreated={load} />
      )}
      {modal?.type === 'edit' && (
        <EditCompanyModal dark={dark} company={modal.company} onClose={() => setModal(null)} onSaved={load} />
      )}
    </>
  );
}

function CreateCompanyModal({ dark, onClose, onCreated }) {
  const [name, setName]     = useState('');
  const [slug, setSlug]     = useState('');
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const slugFromName = (n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_').slice(0, 32);

  const handleNameChange = (v) => {
    setName(v);
    if (!slug || slug === slugFromName(name)) setSlug(slugFromName(v));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.adminCreateClient({ name: name.trim(), slug: slug.trim() });
      onCreated();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Nova Empresa" onClose={onClose} dark={dark}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Alert msg={error} />
        <div>
          <label style={labelStyle}>Nome da empresa</label>
          <input
            style={inputStyle(dark)} value={name} required autoFocus
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ex: Minha Empresa Ltda"
          />
        </div>
        <div>
          <label style={labelStyle}>Slug (identificador único)</label>
          <input
            style={{ ...inputStyle(dark), fontFamily: 'monospace' }}
            value={slug} required
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="minha_empresa"
          />
          <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.35)' : '#9ca3af', marginTop: 4 }}>
            Somente letras minúsculas, números e underscores. Não pode ser alterado depois.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost(dark)} onClick={onClose}>Cancelar</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? 'Criando…' : 'Criar Empresa'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditCompanyModal({ dark, company, onClose, onSaved }) {
  const [name, setName]     = useState(company.name);
  const [active, setActive] = useState(company.active);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.adminUpdateClient(company.id, { name: name.trim(), active });
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Editar Empresa" onClose={onClose} dark={dark}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Alert msg={error} />
        <div>
          <label style={labelStyle}>Nome</label>
          <input style={inputStyle(dark)} value={name} required autoFocus onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Slug</label>
          <input style={{ ...inputStyle(dark), opacity: 0.6 }} value={company.slug} disabled />
          <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.35)' : '#9ca3af', marginTop: 4 }}>O slug não pode ser alterado.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: dark ? '#d1d5db' : '#374151', fontFamily: 'inherit' }}>Empresa ativa</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost(dark)} onClick={onClose}>Cancelar</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ dark }) {
  const [users, setUsers]       = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([api.adminListUsers(), api.adminListClients()]);
      setUsers(u);
      setCompanies(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const thStyle = {
    padding: '10px 14px', fontSize: 10.5, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    color: dark ? 'rgba(255,255,255,0.38)' : '#9ca3af',
    textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
    background: dark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
  };
  const tdStyle = {
    padding: '11px 14px', fontSize: 12.5,
    color: dark ? '#d1d5db' : '#374151',
    borderBottom: dark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.05)',
    verticalAlign: 'middle',
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: dark ? '#f0f6fc' : '#0f172a' }}>Usuários</div>
          <div style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.4)' : '#9ca3af', marginTop: 2 }}>
            {users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button style={btnPrimary} onClick={() => setModal('create')}>
          <Icon name="person_add" size="text-[15px]" />
          Novo Usuário
        </button>
      </div>

      <div style={{
        background: dark ? '#161b22' : '#fff',
        borderRadius: 10,
        border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: dark ? 'rgba(255,255,255,0.3)' : '#9ca3af', fontSize: 13 }}>Carregando…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: dark ? 'rgba(255,255,255,0.3)' : '#9ca3af', fontSize: 13 }}>Nenhum usuário cadastrado.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>E-mail</th>
                <th style={thStyle}>Nível</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Empresas</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: dark ? '#f0f6fc' : '#0f172a' }}>
                    {u.display_name || '—'}
                  </td>
                  <td style={{ ...tdStyle, color: dark ? '#94a3b8' : '#64748b' }}>{u.email}</td>
                  <td style={tdStyle}>
                    {u.is_superadmin ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
                        background: 'rgba(139,92,246,0.12)', color: '#8b5cf6',
                        border: '1px solid rgba(139,92,246,0.22)',
                      }}>
                        <Icon name="admin_panel_settings" size="text-[11px]" /> Admin
                      </span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.38)' : '#9ca3af' }}>Usuário</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 600,
                      background: u.active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                      color: u.active ? '#059669' : '#dc2626',
                      border: `1px solid ${u.active ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.20)'}`,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: u.active ? ACCENT : '#ef4444', flexShrink: 0 }} />
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {u.clients.length === 0
                        ? <span style={{ fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.28)' : '#d1d5db' }}>—</span>
                        : u.clients.slice(0, 2).map(c => (
                          <span key={c.id} style={{
                            padding: '2px 7px', borderRadius: 99, fontSize: 10.5, fontWeight: 500,
                            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                            color: dark ? '#94a3b8' : '#64748b',
                          }}>{c.name}</span>
                        ))
                      }
                      {u.clients.length > 2 && (
                        <span style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.38)' : '#9ca3af' }}>+{u.clients.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button style={btnGhost(dark)} onClick={() => setModal({ type: 'edit', user: u })}>
                        <Icon name="edit" size="text-[13px]" /> Editar
                      </button>
                      <button style={btnGhost(dark)} onClick={() => setModal({ type: 'clients', user: u })}>
                        <Icon name="business" size="text-[13px]" /> Empresas
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'create' && (
        <CreateUserModal dark={dark} companies={companies} onClose={() => setModal(null)} onCreated={loadUsers} />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal dark={dark} user={modal.user} onClose={() => setModal(null)} onSaved={loadUsers} />
      )}
      {modal?.type === 'clients' && (
        <ManageUserClientsModal dark={dark} user={modal.user} companies={companies} onClose={() => setModal(null)} onSaved={loadUsers} />
      )}
    </>
  );
}

function CreateUserModal({ dark, companies, onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', clientId: '', isSuperAdmin: false });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.adminCreateUser({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || undefined,
        clientId: form.clientId || undefined,
        isSuperAdmin: form.isSuperAdmin,
      });
      onCreated();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Novo Usuário" onClose={onClose} dark={dark}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Alert msg={error} />
        <div>
          <label style={labelStyle}>E-mail *</label>
          <input style={inputStyle(dark)} type="email" value={form.email} required autoFocus onChange={set('email')} placeholder="usuario@empresa.com" />
        </div>
        <div>
          <label style={labelStyle}>Nome</label>
          <input style={inputStyle(dark)} value={form.name} onChange={set('name')} placeholder="Nome completo" />
        </div>
        <div>
          <label style={labelStyle}>Senha *</label>
          <input style={inputStyle(dark)} type="password" value={form.password} required onChange={set('password')} placeholder="Mínimo 8 caracteres" />
        </div>
        <div>
          <label style={labelStyle}>Empresa (opcional)</label>
          <select style={{ ...inputStyle(dark) }} value={form.clientId} onChange={set('clientId')}>
            <option value="">— Sem empresa —</option>
            {companies.filter(c => c.active).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginTop: 2 }}>
          <input type="checkbox" checked={form.isSuperAdmin} onChange={set('isSuperAdmin')} style={{ width: 15, height: 15 }} />
          <span style={{ fontSize: 13, color: dark ? '#d1d5db' : '#374151', fontFamily: 'inherit' }}>
            Acesso administrativo (superadmin)
          </span>
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost(dark)} onClick={onClose}>Cancelar</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? 'Criando…' : 'Criar Usuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ dark, user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.display_name || '',
    active: user.active,
    isSuperAdmin: user.is_superadmin,
    password: '',
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || undefined,
        active: form.active,
        isSuperAdmin: form.isSuperAdmin,
      };
      if (form.password) payload.password = form.password;
      await api.adminUpdateUser(user.id, payload);
      onSaved();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Editar Usuário" onClose={onClose} dark={dark}>
      <div style={{ marginBottom: 14, fontSize: 12, color: dark ? '#94a3b8' : '#64748b' }}>{user.email}</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Alert msg={error} />
        <div>
          <label style={labelStyle}>Nome</label>
          <input style={inputStyle(dark)} value={form.name} autoFocus onChange={set('name')} placeholder="Nome completo" />
        </div>
        <div>
          <label style={labelStyle}>Nova senha (deixe em branco para não alterar)</label>
          <div style={{ position: 'relative' }}>
            <input
              style={inputStyle(dark)}
              type={showPass ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2, display: 'flex' }}
            >
              <Icon name={showPass ? 'visibility_off' : 'visibility'} size="text-[15px]" />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={form.active} onChange={set('active')} style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: dark ? '#d1d5db' : '#374151', fontFamily: 'inherit' }}>Usuário ativo</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={form.isSuperAdmin} onChange={set('isSuperAdmin')} style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: dark ? '#d1d5db' : '#374151', fontFamily: 'inherit' }}>Acesso administrativo (superadmin)</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" style={btnGhost(dark)} onClick={onClose}>Cancelar</button>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManageUserClientsModal({ dark, user, companies, onClose, onSaved }) {
  const [assigned, setAssigned] = useState(new Set(user.clients.map(c => c.id)));
  const [saving, setSaving]     = useState(null); // clientId being toggled
  const [error, setError]       = useState('');

  const activeCompanies = companies.filter(c => c.active);

  const toggle = async (clientId) => {
    setError('');
    setSaving(clientId);
    try {
      if (assigned.has(clientId)) {
        await api.adminRemoveUserClient(user.id, clientId);
        setAssigned(prev => { const s = new Set(prev); s.delete(clientId); return s; });
      } else {
        await api.adminAddUserClient(user.id, clientId);
        setAssigned(prev => new Set([...prev, clientId]));
      }
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  };

  return (
    <Modal title="Empresas do Usuário" onClose={onClose} dark={dark}>
      <div style={{ marginBottom: 14, fontSize: 12, color: dark ? '#94a3b8' : '#64748b' }}>{user.email}</div>
      <Alert msg={error} />
      {activeCompanies.length === 0 ? (
        <div style={{ textAlign: 'center', color: dark ? 'rgba(255,255,255,0.3)' : '#9ca3af', fontSize: 13, padding: '16px 0' }}>
          Nenhuma empresa cadastrada.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {activeCompanies.map(c => {
            const isAssigned = assigned.has(c.id);
            const isSaving   = saving === c.id;
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#f0f6fc' : '#0f172a' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.38)' : '#9ca3af', marginTop: 1 }}>{c.slug}</div>
                </div>
                <button
                  disabled={isSaving}
                  onClick={() => toggle(c.id)}
                  style={isAssigned ? btnDanger : btnPrimary}
                >
                  {isSaving
                    ? '…'
                    : isAssigned
                    ? <><Icon name="remove_circle_outline" size="text-[13px]" /> Remover</>
                    : <><Icon name="add_circle_outline" size="text-[13px]" /> Adicionar</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button style={btnGhost(dark)} onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export default function Admin({ standalone = false }) {
  const { user, logout } = useAuth();
  const [tab, setTab]     = useState('companies');
  const dark              = false; // Admin panel always uses light mode for clarity

  const tabs = [
    { id: 'companies', icon: 'business',  label: 'Empresas' },
    { id: 'users',     icon: 'group',     label: 'Usuários' },
  ];

  const content = (
    <>
      {/* Tab bar */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '0 32px',
        display: 'flex', gap: 0,
        flexShrink: 0,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t.id ? 600 : 500,
              color: tab === t.id ? ACCENT_DARK : '#6b7280',
              borderBottom: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'inherit',
              transition: 'all .15s', marginBottom: -1,
            }}
          >
            <Icon name={t.icon} size="text-[15px]" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {tab === 'companies'
            ? <CompaniesTab dark={dark} />
            : <UsersTab dark={dark} />
          }
        </div>
      </div>
    </>
  );

  if (standalone) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f6f8fa' }}>
        {/* Header */}
        <div style={{
          background: '#0d1117', padding: '14px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="admin_panel_settings" size="text-[16px]" style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                Versa Finanças
              </div>
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 9, letterSpacing: '1.6px', textTransform: 'uppercase', marginTop: 1 }}>
                Painel Administrativo
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: 12 }}>{user?.email}</span>
            <button
              onClick={logout}
              title="Sair"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.38)', display: 'flex', padding: 6, borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
            >
              <Icon name="logout" size="text-[16px]" />
            </button>
          </div>
        </div>
        {content}
      </div>
    );
  }

  // Embedded within Shell — just return the tab bar + content
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f8fa' }}>
      {content}
    </div>
  );
}
