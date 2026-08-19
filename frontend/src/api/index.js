/**
 * authBridge allows AuthContext to inject the current access token and
 * the refresh function into this module without creating circular imports.
 * AuthContext calls authBridge.setToken() and authBridge.setRefreshFn()
 * whenever those values change.
 */
export const authBridge = {
  _token:     null,
  _refreshFn: null,
  setToken:     (t)  => { authBridge._token     = t; },
  setRefreshFn: (fn) => { authBridge._refreshFn = fn; },
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function req(path, opts = {}, isRetry = false) {
  const url = `${API_BASE}${path}`;
  const token = authBridge._token;

  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...opts, headers, credentials: 'include' });

  // On 401: attempt one silent refresh then retry
  if (res.status === 401 && !isRetry && authBridge._refreshFn) {
    const newToken = await authBridge._refreshFn();
    if (newToken) return req(url, opts, true);
    // Refresh failed — redirect to reload so the login screen shows
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  return res.json();
}

const json = (body) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  // Transactions
  getTransactions:    ()        => req('/api/transactions'),
  createTransaction:  (tx)      => req('/api/transactions',     { method: 'POST',   ...json(tx) }),
  updateTransaction:  (id, tx)  => req(`/api/transactions/${id}`, { method: 'PUT',  ...json(tx) }),
  deleteTransaction:  (id)      => req(`/api/transactions/${id}`, { method: 'DELETE' }),

  // Plano de contas
  getPlano:         ()           => req('/api/plano'),
  createPlanoItem:  (item)       => req('/api/plano',                                        { method: 'POST',   ...json(item) }),
  updatePlanoItem:  (tipo, item) => req(`/api/plano/${encodeURIComponent(tipo)}`,            { method: 'PUT',    ...json(item) }),
  deletePlanoItem:  (tipo)       => req(`/api/plano/${encodeURIComponent(tipo)}`,            { method: 'DELETE' }),
  updateCategoria:  (cat, data)  => req(`/api/plano/categoria/${encodeURIComponent(cat)}`,  { method: 'PUT',    ...json(data) }),
  deleteCategoria:  (cat)        => req(`/api/plano/categoria/${encodeURIComponent(cat)}`,  { method: 'DELETE' }),

  // Saldos iniciais
  getSaldos:       ()              => req('/api/saldos'),
  updateSaldos:    (data)          => req('/api/saldos',                          { method: 'PUT',    ...json(data) }),
  getSaldosEntries: ()             => req('/api/saldos/entries'),
  getSaldosLog:    (limit = 100)   => req(`/api/saldos/log?limit=${limit}`),
  upsertSaldoEntry: (data)         => req('/api/saldos/entry',                    { method: 'PUT',    ...json(data) }),
  deleteSaldoEntry: (chave)        => req(`/api/saldos/entry/${encodeURIComponent(chave)}`, { method: 'DELETE' }),

  // Import
  previewImport: (file, base, colMap = {}, categoryOverrides = {}, extraColMap = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('base', base);
    if (Object.keys(colMap).length)            fd.append('colMap',            JSON.stringify(colMap));
    if (Object.keys(categoryOverrides).length) fd.append('categoryOverrides', JSON.stringify(categoryOverrides));
    if (Object.keys(extraColMap).length)       fd.append('extraColMap',       JSON.stringify(extraColMap));
    return req('/api/import/preview', { method: 'POST', body: fd });
  },
  importFile: (file, base, colMap = {}, forceImbalanced = false, categoryOverrides = {}, extraColMap = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('base', base);
    if (Object.keys(colMap).length)            fd.append('colMap',            JSON.stringify(colMap));
    if (forceImbalanced)                        fd.append('forceImbalanced',   'true');
    if (Object.keys(categoryOverrides).length) fd.append('categoryOverrides', JSON.stringify(categoryOverrides));
    if (Object.keys(extraColMap).length)       fd.append('extraColMap',       JSON.stringify(extraColMap));
    return req('/api/import', { method: 'POST', body: fd });
  },
  getImportHistory:      () => req('/api/import/history'),
  deleteImport:          (id) => req(`/api/import/history/${id}`, { method: 'DELETE' }),
  clearHistory:          () => req('/api/import/history', { method: 'DELETE' }),
  previewPlanoImport: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('/api/import/plano-preview', { method: 'POST', body: fd });
  },
  importPlano: (items) => req('/api/import/plano', { method: 'POST', ...json({ items }) }),

  // Orçamento
  getOrcamento:    (ano) => req(`/api/orcamento?ano=${ano}`),
  upsertOrcamento: (entries) => req('/api/orcamento', { method: 'PUT', ...json(entries) }),
  deleteOrcamentoEntry: (id) => req(`/api/orcamento/${id}`, { method: 'DELETE' }),

  // Seed / Reset
  seed:  () => req('/api/seed',  { method: 'POST' }),
  reset: () => req('/api/reset', { method: 'DELETE' }),

  // Admin panel (superadmin only)
  adminListClients:  ()              => req('/api/admin/clients'),
  adminCreateClient: (data)          => req('/api/admin/clients',                          { method: 'POST',   ...json(data) }),
  adminUpdateClient: (id, data)      => req(`/api/admin/clients/${id}`,                    { method: 'PUT',    ...json(data) }),
  adminListUsers:    ()              => req('/api/admin/users'),
  adminCreateUser:   (data)          => req('/api/admin/users',                            { method: 'POST',   ...json(data) }),
  adminUpdateUser:   (id, data)      => req(`/api/admin/users/${id}`,                      { method: 'PUT',    ...json(data) }),
  adminAddUserClient:       (id, clientId)          => req(`/api/admin/users/${id}/clients`,                           { method: 'POST',   ...json({ clientId }) }),
  adminRemoveUserClient:    (id, clientId)          => req(`/api/admin/users/${id}/clients/${clientId}`,               { method: 'DELETE' }),
  adminSetUserClientRole:   (id, clientId, roleId)  => req(`/api/admin/users/${id}/clients/${clientId}/role`,          { method: 'PUT',    ...json({ roleId }) }),

  // Preferências do usuário (ex: colunas visíveis em Lançamentos)
  getPreferences: ()            => req('/api/preferences'),
  setPreference:  (key, value)  => req(`/api/preferences/${encodeURIComponent(key)}`, { method: 'PUT', ...json({ value }) }),

  // Auth — switch between companies without a full re-login
  myClients:    ()          => req('/api/auth/my-clients'),
  switchClient: (clientId)  => req('/api/auth/switch-client', { method: 'POST', ...json({ clientId }) }),

  // Roles (funções de acesso)
  adminListRoles:   (clientId)       => req(clientId ? `/api/admin/roles?clientId=${clientId}` : '/api/admin/roles'),
  adminCreateRole:  (data)           => req('/api/admin/roles',                            { method: 'POST',   ...json(data) }),
  adminUpdateRole:  (id, data)       => req(`/api/admin/roles/${id}`,                      { method: 'PUT',    ...json(data) }),
  adminDeleteRole:  (id)             => req(`/api/admin/roles/${id}`,                      { method: 'DELETE' }),
};
