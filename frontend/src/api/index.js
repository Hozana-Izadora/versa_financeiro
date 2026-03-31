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

async function req(url, opts = {}, isRetry = false) {
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
  getSaldos:    ()     => req('/api/saldos'),
  updateSaldos: (data) => req('/api/saldos', { method: 'PUT', ...json(data) }),

  // Import
  importFile: (file, base) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('base', base);
    return req('/api/import', { method: 'POST', body: fd });
  },
  getImportHistory: () => req('/api/import/history'),
  clearHistory:     () => req('/api/import/history', { method: 'DELETE' }),

  // Seed / Reset
  seed:  () => req('/api/seed',  { method: 'POST' }),
  reset: () => req('/api/reset', { method: 'DELETE' }),
};
