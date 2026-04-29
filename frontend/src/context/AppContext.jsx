import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { api } from '../api/index.js';
import { getAvailableMonths, getYears } from '../utils/formatters.js';

const AppContext = createContext(null);

const storedDark = localStorage.getItem('theme') === 'dark';
if (storedDark) document.documentElement.classList.add('dark');

const initialState = {
  transactions: { caixa: [], competencia: [] },
  plano: [],
  planoCores: {},
  saldosIniciais: {},
  importHistory: [],
  orcamento: [],
  currentPage: 'caixa',
  filterState: {
    year: new Date().getFullYear(),
    months: new Set(),
    group: 'all',
    availableMonths: [],
  },
  darkMode: storedDark,
  loading: false,
  notification: null,
  modal: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    case 'SET_PLANO':
      return { ...state, plano: action.payload.plano, planoCores: action.payload.planoCores };
    case 'SET_SALDOS':
      return { ...state, saldosIniciais: action.payload };
    case 'SET_HISTORY':
      return { ...state, importHistory: action.payload };
    case 'SET_ORCAMENTO':
      return { ...state, orcamento: action.payload };
    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.payload,
        filterState: { ...state.filterState, months: new Set(), group: 'all' },
      };
    case 'SET_FILTER':
      return { ...state, filterState: { ...state.filterState, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_NOTIFICATION':
      return { ...state, notification: action.payload };
    case 'SET_MODAL':
      return { ...state, modal: action.payload };
    case 'TOGGLE_DARK':
      return { ...state, darkMode: !state.darkMode };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
    localStorage.setItem('theme', state.darkMode ? 'dark' : 'light');
  }, [state.darkMode]);

  const notify = useCallback((msg, cls = 'ns') => {
    dispatch({ type: 'SET_NOTIFICATION', payload: { msg, cls } });
    setTimeout(() => dispatch({ type: 'SET_NOTIFICATION', payload: null }), 3200);
  }, []);

  const openModal = useCallback((content) => {
    dispatch({ type: 'SET_MODAL', payload: content });
  }, []);

  const closeModal = useCallback(() => {
    dispatch({ type: 'SET_MODAL', payload: null });
  }, []);

  const setPage = useCallback((page) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const applyFilter = useCallback((updates) => {
    dispatch({ type: 'SET_FILTER', payload: updates });
  }, []);

  const refreshTransactions = useCallback(async () => {
    const tx = await api.getTransactions();
    dispatch({ type: 'SET_TRANSACTIONS', payload: tx });
    // Update available months for current filter year
    const txForPage = state.currentPage === 'caixa' ? tx.caixa : tx.competencia;
    const avail = getAvailableMonths(txForPage, state.filterState.year);
    dispatch({ type: 'SET_FILTER', payload: { availableMonths: avail } });
    return tx;
  }, [state.currentPage, state.filterState.year]);

  const refreshAll = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const year = state.filterState.year || new Date().getFullYear();
      const [tx, planoData, saldos, history, orc] = await Promise.all([
        api.getTransactions(),
        api.getPlano(),
        api.getSaldos(),
        api.getImportHistory(),
        api.getOrcamento(year),
      ]);
      dispatch({ type: 'SET_TRANSACTIONS', payload: tx });
      dispatch({ type: 'SET_PLANO', payload: planoData });
      dispatch({ type: 'SET_SALDOS', payload: saldos });
      dispatch({ type: 'SET_HISTORY', payload: history });
      dispatch({ type: 'SET_ORCAMENTO', payload: orc });

      // Set available months
      const txForPage = state.currentPage === 'caixa' ? tx.caixa : tx.competencia;
      const years = getYears(tx);
      const year = years[0] || new Date().getFullYear();
      const avail = getAvailableMonths(txForPage, year);
      dispatch({ type: 'SET_FILTER', payload: { year, availableMonths: avail } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentPage]);

  const toggleDark = useCallback(() => {
    dispatch({ type: 'TOGGLE_DARK' });
  }, []);

  const actions = {
    notify,
    openModal,
    closeModal,
    setPage,
    applyFilter,
    refreshAll,
    refreshTransactions,
    toggleDark,
    dispatch,
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
