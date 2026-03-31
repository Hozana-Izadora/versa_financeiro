import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authBridge } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser]               = useState(null);
  // true while we're attempting the initial silent refresh on page load
  const [bootstrapping, setBootstrapping] = useState(true);

  // Keep a ref so the api bridge can always call the latest silentRefresh
  const silentRefreshRef = useRef(null);

  const setAuth = useCallback((token, userData) => {
    setAccessToken(token);
    setUser(userData);
    authBridge.setToken(token);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    authBridge.setToken(null);
  }, []);

  // Calls POST /api/auth/refresh using the httpOnly cookie.
  // Returns the new access token on success, null on failure.
  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method:      'POST',
        credentials: 'include',   // send the httpOnly refresh cookie
      });
      if (!res.ok) {
        clearAuth();
        return null;
      }
      const data = await res.json();
      setAuth(data.accessToken, data.user);
      return data.accessToken;
    } catch {
      clearAuth();
      return null;
    }
  }, [setAuth, clearAuth]);

  // Keep the ref in sync so the api bridge always uses the latest version
  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
  }, [silentRefresh]);

  // Register the refresh function with the API bridge once on mount
  useEffect(() => {
    authBridge.setRefreshFn(() => silentRefreshRef.current?.());
  }, []);

  // On first load: attempt silent refresh to restore an existing session
  useEffect(() => {
    silentRefresh().finally(() => setBootstrapping(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password, clientId) => {
    const res = await fetch('/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ email, password, ...(clientId ? { clientId } : {}) }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Falha no login');

    // Server may ask the user to pick a client first
    if (data.requireClientSelection) return data;

    setAuth(data.accessToken, data.user);
    return data;
  }, [setAuth]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore network errors on logout */ }
    clearAuth();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{ accessToken, user, bootstrapping, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
