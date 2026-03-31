import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { defaultPlano } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const DB_PATH = join(DATA_DIR, 'db.json');

const defaultState = {
  transactions: { caixa: [], competencia: [] },
  plano: defaultPlano,
  planoCores: {
    'RECEITA BRUTA': 'green',
    'CUSTOS DIRETOS': 'red',
    'DESPESAS OPERACIONAIS': 'yellow',
    'DESPESAS NÃO OPERACIONAIS': 'purple',
  },
  saldosIniciais: {},
  importHistory: [],
};

function load() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) return { ...defaultState, plano: [...defaultPlano] };
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return { ...defaultState, plano: [...defaultPlano] };
  }
}

function save(s) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(s, null, 2), 'utf-8');
}

let state = load();

export const store = {
  get: () => state,

  set(updates) {
    state = { ...state, ...updates };
    save(state);
  },

  getTransactions: () => state.transactions,

  setTransactions(tx) {
    state.transactions = tx;
    save(state);
  },

  reset() {
    state = { ...defaultState, plano: [...defaultPlano] };
    save(state);
  },
};
