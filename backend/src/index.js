import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pool } from './db/pool.js';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import transactionsRouter from './routes/transactions.js';
import planoRouter from './routes/plano.js';
import saldosRouter from './routes/saldos.js';
import uploadRouter from './routes/upload.js';
import orcamentoRouter from './routes/orcamento.js';
import { generateSample, defaultPlano } from './seed.js';
import * as txStore from './store/transactions.js';
import * as planoStore from './store/plano.js';
import * as saldosStore from './store/saldos.js';
import * as historyStore from './store/importHistory.js';

const app = express();
const PORT = process.env.PORT || 3001;

const DEFAULT_PLANO_CORES = {
  'RECEITA BRUTA':             'green',
  'CUSTOS DIRETOS':            'red',
  'DESPESAS OPERACIONAIS':     'yellow',
  'DESPESAS NÃO OPERACIONAIS': 'purple',
};

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,   // required for httpOnly refresh cookie in dev
}));
app.use(express.json());
app.use(cookieParser());

// ── Public routes (no auth required) ─────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', authRouter);

// ── Protected routes (JWT required) ──────────────────────────────────────────
app.use('/api', authMiddleware);

app.use('/api/transactions', transactionsRouter);
app.use('/api/plano',        planoRouter);
app.use('/api/saldos',       saldosRouter);
app.use('/api/import',       uploadRouter);
app.use('/api/orcamento',    orcamentoRouter);

// POST /api/seed
app.post('/api/seed', async (req, res, next) => {
  try {
    const { plano } = await planoStore.getPlano(req.tenantSchema);
    const sample    = generateSample(plano.length ? plano : defaultPlano);
    const allTx     = [...sample.caixa, ...sample.competencia];

    await txStore.clearTransactions(req.tenantSchema);
    await txStore.bulkInsertTransactions(req.tenantSchema, allTx);
    await historyStore.clearImportHistory(req.tenantSchema);
    await historyStore.addImportEntry(req.tenantSchema, {
      name: 'dados_exemplo.xlsx',
      rows: allTx.length,
      base: 'Ambas',
    });

    res.json({
      message:          'Dados de exemplo carregados',
      caixaCount:       sample.caixa.length,
      competenciaCount: sample.competencia.length,
    });
  } catch (err) { next(err); }
});

// DELETE /api/reset
app.delete('/api/reset', async (req, res, next) => {
  try {
    await txStore.clearTransactions(req.tenantSchema);
    await saldosStore.clearSaldos(req.tenantSchema);
    await historyStore.clearImportHistory(req.tenantSchema);
    await planoStore.resetPlano(req.tenantSchema, defaultPlano, DEFAULT_PLANO_CORES);
    res.json({ message: 'Dados resetados com sucesso' });
  } catch (err) { next(err); }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Versa Finanças API running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
