import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { requirePermission } from '../middleware/permission.js';
import * as txStore from '../store/transactions.js';
import * as planoStore from '../store/plano.js';
import * as historyStore from '../store/importHistory.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Column auto-detection aliases ─────────────────────────────────────────────
const COL_ALIASES = {
  data:      ['data', 'date', 'dt', 'vencimento', 'competencia'],
  descricao: ['descrição', 'descricao', 'description', 'historico', 'memo', 'obs'],
  categoria: ['categoria', 'category', 'conta', 'plano'],
  valor:     ['valor', 'value', 'amount', 'montante'],
  movimento: ['tipo', 'movimento', 'operacao', 'entrada_saida'],
  regime:    ['regime', 'tipo_lancamento'],
};

// Fallback plano items for orphan categories
const FALLBACK_SAIDA   = { tipo: 'Material de Escritório',       grp: 'Estrutura',          cat: 'DESPESAS FIXAS',  nivel: 'Despesa Operacional' };
const FALLBACK_ENTRADA = { tipo: 'Outras Receitas Operacionais', grp: 'Receita Operacional', cat: 'RECEITA BRUTA',   nivel: 'Receita'             };

// Plano item for inter-account transfers (system-managed, not in user plano)
const TRANSFER_PLANO = { cat: 'TRANSFERÊNCIAS', grp: 'Transferências', tipo: 'Transferência entre Contas', nivel: 'Transferência' };

// Matches "transferência entre contas" / "conta própria" in pt-BR
const TRANSFER_RE = /transf[eê]r[eê]ncia\s+entre|entre\s+conta|conta\s+pr[oó]pria/i;

// ── Plano auto-classification rules ──────────────────────────────────────────
// Each rule: [regex, suggestion]. Applied in order; first match wins.
const PLANO_RULES = [
  [/(vend[a-z]*\s*(de\s*)?(produto|servi[cç])|receita|faturamento)/i,
   { cat: 'RECEITA BRUTA', grp: 'Receita Operacional', nivel: 'Receita' }],
  [/(juro[s]?\s*receb|rendimento\s*de\s*aplic|recebimento\s*de\s*juro)/i,
   { cat: 'RECEITA BRUTA', grp: 'Receita Financeira', nivel: 'Receita' }],
  [/ajuste\s*de\s*caixa\s*cr[eé]dito/i,
   { cat: 'ENTRADAS NÃO OPERACIONAIS', grp: 'Outras Entradas', nivel: 'Entrada Não Operacional' }],
  [/mat[eé]ria[\s\-]*prima/i,
   { cat: 'CUSTOS DIRETOS', grp: 'Custo de Produção', nivel: 'Custo' }],
  [/(simples\s*nacional|icms|iss\s*[\-–]|imposto\s*sob|pis\b|cofins|irpj|csll)/i,
   { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Impostos e Tributos', nivel: 'Despesa Não Operacional' }],
  [/(inss\s*[\-–]\s*empresa|fgts[\s\-]*empresa)/i,
   { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Impostos e Tributos', nivel: 'Despesa Não Operacional' }],
  [/(contribui[cç][aã]o\s*sindical)/i,
   { cat: 'DESPESAS FIXAS', grp: 'Pessoal', nivel: 'Despesa Operacional' }],
  [/(taxa[s]?\s*banc[aá]|tarifa[s]?\/taxa|tarifas?\/taxas?|emprest|cons[oó]rcio|pagamento\s*de\s*emprest)/i,
   { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Despesas Financeiras', nivel: 'Despesa Não Operacional' }],
  [/investimento[s]?\s*[\-–]/i,
   { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Investimentos', nivel: 'Despesa Não Operacional' }],
  [/(sal[aá]rio[s]?|hora\s*extra|pró[\s\-]*labore|pro[\s\-]*labore|f[eé]rias|rescis[aã]|indeniza|uniform|adiantamento\s*sal|exame[s]?\s*admiss)/i,
   { cat: 'DESPESAS FIXAS', grp: 'Pessoal', nivel: 'Despesa Operacional' }],
  [/(benef[íi]cio|plano\s*de\s*sa[úu]de|vale\s*trans|prêmio[s]?|b[oô]nus|distribui[cç][aã]o\s*de\s*lucro)/i,
   { cat: 'DESPESAS FIXAS', grp: 'Pessoal', nivel: 'Despesa Operacional' }],
  [/(inss\b|fgts\b|tempor[aá]rio[s]?|di[aá]ria[s]?|alimenta[cç])/i,
   { cat: 'DESPESAS FIXAS', grp: 'Pessoal', nivel: 'Despesa Operacional' }],
  [/(software|programa\s*de\s*computador|inform[aá]tica\s*(manut|infra)?)/i,
   { cat: 'DESPESAS FIXAS', grp: 'Tecnologia', nivel: 'Despesa Operacional' }],
  [/(aluguel|energia\s*el[eé]trica|[aá]gua\s*e\s*esgoto|internet|telefone|m[oó]vel\s*linha[s]?|limpeza|conserva[cç]|manutenção\s*e\s*reparo[s]?|copa\s*e\s*cozinha|vigil[aâ]nci|material\s*de\s*escrit)/i,
   { cat: 'DESPESAS FIXAS', grp: 'Estrutura', nivel: 'Despesa Operacional' }],
  [/(ve[íi]culo|combust[íi]vel|estacionamento|ipva|licenciamento|manutenção\s*ve[íi]cul|seguros?\s*[\-–]\s*ve[íi])/i,
   { cat: 'DESPESAS VARIÁVEIS', grp: 'Veículos', nivel: 'Despesa Operacional' }],
  [/(marketing|publicidade|propaganda\s*\/|evento[s]?|confratern|doa[cç][oõ]e?s?\/brindes?|comiss[aã]o\s*(vend|produ))/i,
   { cat: 'DESPESAS VARIÁVEIS', grp: 'Comercial', nivel: 'Despesa Operacional' }],
  [/(contabilidade|audit|consultor|honor[aá]rio|advocat|jur[íi]dico|viage[nm]|hosped|servi[cç]o[s]?\s*de\s*terceiro)/i,
   { cat: 'DESPESAS VARIÁVEIS', grp: 'Administrativo', nivel: 'Despesa Operacional' }],
];

const DEFAULT_SAIDA_PLANO   = { cat: 'DESPESAS FIXAS',  grp: 'Estrutura',           nivel: 'Despesa Operacional' };
const DEFAULT_ENTRADA_PLANO = { cat: 'RECEITA BRUTA',   grp: 'Receita Operacional', nivel: 'Receita'             };

function classifyCategory(tipo, primaryMov) {
  for (const [re, suggestion] of PLANO_RULES) {
    if (re.test(tipo)) return suggestion;
  }
  return primaryMov === 'Entrada' ? DEFAULT_ENTRADA_PLANO : DEFAULT_SAIDA_PLANO;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseValor(raw) {
  if (typeof raw === 'number') return Math.abs(raw);
  let s = String(raw).trim().replace(/[R$\s"']/g, '');
  if (!s || s === '-') return 0;
  const hD = s.includes('.'), hC = s.includes(',');
  if (hD && hC) {
    const lD = s.lastIndexOf('.'), lC = s.lastIndexOf(',');
    s = lC > lD ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hC && !hD) {
    const pts = s.split(',');
    s = pts.length === 2 && pts[1].length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (hD && !hC) {
    const pts = s.split('.');
    if (pts.length === 2 && pts[1].length === 3) s = s.replace('.', '');
  }
  const r = parseFloat(s);
  return isNaN(r) ? 0 : Math.abs(r);
}

/**
 * Builds field → column-header mapping, merging user overrides with auto-detection.
 * @param {string[]} headers - column headers from the file (original casing)
 * @param {object}   override - { fieldName: 'ExactColumnHeader', ... }
 */
function resolveColMap(headers, override = {}) {
  const cm = {};
  for (const field of Object.keys(COL_ALIASES)) {
    if (override[field]) {
      cm[field] = headers.find(h => h.toLowerCase() === override[field].toLowerCase()) ?? null;
    } else {
      const aliases = COL_ALIASES[field];
      cm[field] = headers.find(h => aliases.some(a => h.toLowerCase().includes(a))) ?? null;
    }
  }
  return cm;
}

function parseDate(rawDate) {
  if (rawDate === '' || rawDate == null) return new Date().toISOString().split('T')[0];
  const s = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s))            return s.substring(0, 10);
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
    const [d, m, y] = s.split(/[\/\-]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4,5}$/.test(s)) {
    const d = new Date(Math.round((parseFloat(s) - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function parseMov(raw) {
  return /entrada|receit[ao]|crédito|credito|income|créd\b|cred\b/i.test(String(raw ?? ''))
    ? 'Entrada' : 'Saída';
}

/**
 * Resolves a spreadsheet row's category to a plano item.
 *
 * Priority order:
 *   1. Transfer keywords in description or category cell
 *   2. Exact tipo match (case-insensitive)
 *   3. Exact cat match
 *   4. Exact grp match
 *   5. Description fuzzy match (first 10 chars of tipo)
 *   6. Orphan → apply fallback (Despesas Fixas/Estrutura for exits, Receita Bruta for entries)
 */
function resolveCategory(catRaw, descRaw, mov, plano) {
  const cat  = String(catRaw  ?? '').trim();
  const desc = String(descRaw ?? '').trim();

  if (TRANSFER_RE.test(cat) || TRANSFER_RE.test(desc)) {
    return { planoItem: TRANSFER_PLANO, isTransfer: true, isOrphan: false };
  }

  const catLc = cat.toLowerCase();
  const found = plano.find(p => p.tipo.toLowerCase() === catLc)
             ?? plano.find(p => p.cat.toLowerCase()  === catLc)
             ?? plano.find(p => p.grp.toLowerCase()  === catLc)
             ?? (desc ? plano.find(p => desc.toLowerCase().includes(p.tipo.toLowerCase().slice(0, 10))) : null);

  if (found) return { planoItem: found, isTransfer: false, isOrphan: false };

  const fallback = mov === 'Entrada' ? FALLBACK_ENTRADA : FALLBACK_SAIDA;
  const fallbackItem = plano.find(p => p.tipo === fallback.tipo) ?? fallback;
  return { planoItem: fallbackItem, isTransfer: false, isOrphan: true, originalCat: cat || '(sem categoria)' };
}

/**
 * Converts raw spreadsheet rows into structured transaction records.
 * Returns { records, orphans, transfers }.
 *
 * records[]  – ready to insert (with _orphan/_transfer metadata flags)
 * orphans[]  – { categoria, fallback, mov, count }
 * transfers  – { count, totalEntrada, totalSaida, delta, balanced }
 *
 * Transfer rows use mov='Transferência' so dreBuilder naturally excludes them
 * from all DRE sums (sumMonth filters by movFilter = 'Entrada' | 'Saída').
 */
function parseRows(rawRows, plano, cm, baseRegime) {
  const orphanMap = new Map();
  let transferEntrada = 0, transferSaida = 0;

  const records = rawRows.map((row, idx) => {
    const rawMov = cm.movimento ? row[cm.movimento] : '';
    const mov    = parseMov(rawMov);
    const valor  = parseValor(cm.valor ? row[cm.valor] : 0);
    if (valor === 0) return null;

    const rawCat  = cm.categoria ? row[cm.categoria] : '';
    const rawDesc = cm.descricao ? row[cm.descricao] : '';
    const { planoItem, isTransfer, isOrphan, originalCat } = resolveCategory(rawCat, rawDesc, mov, plano);

    if (isOrphan && originalCat) {
      if (!orphanMap.has(originalCat)) orphanMap.set(originalCat, { count: 0, fallback: planoItem.tipo, mov });
      orphanMap.get(originalCat).count++;
    }

    // Track transfer balance before overriding mov
    if (isTransfer) {
      if (mov === 'Entrada') transferEntrada += valor;
      else transferSaida += valor;
    }

    return {
      data:   parseDate(cm.data ? row[cm.data] : ''),
      desc:   String(rawDesc || `Lançamento ${idx + 1}`),
      cat:    planoItem.cat,
      grp:    planoItem.grp,
      tipo:   planoItem.tipo,
      nivel:  planoItem.nivel,
      valor,
      mov:    isTransfer ? 'Transferência' : mov,
      regime: baseRegime,
      _orphan:   isOrphan,
      _transfer: isTransfer,
    };
  }).filter(Boolean);

  const orphans = [...orphanMap.entries()].map(([categoria, info]) => ({
    categoria,
    fallback: info.fallback,
    mov:      info.mov,
    count:    info.count,
  }));

  const delta = Math.round((transferEntrada - transferSaida) * 100) / 100;
  const transfers = {
    count:        records.filter(r => r._transfer).length,
    totalEntrada: transferEntrada,
    totalSaida:   transferSaida,
    delta,
    balanced:     Math.abs(delta) < 0.01,
  };

  return { records, orphans, transfers };
}

// ── File readers ──────────────────────────────────────────────────────────────

function readFile(buffer, ext) {
  if (ext === 'csv') return parseCSV(buffer.toString('utf-8'));
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });
  return raw.map(row => {
    const o = {};
    Object.entries(row).forEach(([k, v]) => { o[k] = v instanceof Date ? v.toISOString().split('T')[0] : v; });
    return o;
  });
}

function parseCSV(text) {
  function countSep(line, sep) { let c = 0, q = false; for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === sep) c++; } return c; }
  const fl  = text.split('\n')[0] || '';
  const sep = countSep(fl, ';') >= countSep(fl, ',') ? ';' : ',';
  function parseLine(line) {
    const f = []; let cur = '', q = false, i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i += 2; continue; } q = !q; }
      else if (c === sep && !q) { f.push(cur.trim()); cur = ''; }
      else cur += c;
      i++;
    }
    f.push(cur.trim()); return f;
  }
  const lines   = text.split(/\r?\n/).filter(l => l.trim());
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const v = parseLine(l), o = {};
    headers.forEach((h, i) => { o[h] = (v[i] || '').replace(/^"|"$/g, ''); });
    return o;
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/import/preview
 *
 * Parses the file and returns a structured preview without inserting anything.
 * The client uses this to show column mapping, orphan warnings and transfer
 * balance before the user confirms the import.
 *
 * Multipart body:
 *   file   – xlsx / csv
 *   base   – 'caixa' | 'competencia'
 *   colMap – JSON string: { data?, descricao?, categoria?, valor?, movimento?, regime? }
 *            Each value is the exact column header to use for that field.
 *
 * Response: { headers, colMap, rows, orphans, transfers, summary }
 */
router.post('/preview', requirePermission('importar', 'write'), upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const base           = req.body.base === 'competencia' ? 'Competência' : 'Caixa';
  const ext            = req.file.originalname.split('.').pop().toLowerCase();
  const colMapOverride = req.body.colMap ? JSON.parse(req.body.colMap) : {};

  try {
    const { plano } = await planoStore.getPlano(req.tenantSchema);
    const rawRows   = readFile(req.file.buffer, ext);
    if (!rawRows.length) return res.status(400).json({ error: 'Arquivo sem dados' });

    const headers = Object.keys(rawRows[0]);
    const cm      = resolveColMap(headers, colMapOverride);
    const { records, orphans, transfers } = parseRows(rawRows, plano, cm, base);

    res.json({
      headers,
      colMap: cm,
      rows:   records,
      orphans,
      transfers,
      summary: {
        total:         records.length,
        orphanCount:   orphans.reduce((s, o) => s + o.count, 0),
        transferCount: transfers.count,
      },
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/import
 *
 * Parses the file, validates transfer balance and inserts transactions.
 *
 * Multipart body:
 *   file             – xlsx / csv
 *   base             – 'caixa' | 'competencia'
 *   colMap           – JSON string (optional column override)
 *   forceImbalanced  – 'true' to proceed even when transfers don't balance
 *
 * Response: { imported, transfers, history }
 * Error 422: transfer imbalance (unless forceImbalanced=true)
 */
router.post('/', requirePermission('importar', 'write'), upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const base            = req.body.base === 'competencia' ? 'Competência' : 'Caixa';
  const ext             = req.file.originalname.split('.').pop().toLowerCase();
  const colMapOverride  = req.body.colMap ? JSON.parse(req.body.colMap) : {};
  const forceImbalanced = req.body.forceImbalanced === 'true';

  try {
    const { plano } = await planoStore.getPlano(req.tenantSchema);
    const rawRows   = readFile(req.file.buffer, ext);
    if (!rawRows.length) return res.status(400).json({ error: 'Arquivo sem dados' });

    const headers = Object.keys(rawRows[0]);
    const cm      = resolveColMap(headers, colMapOverride);
    const { records, transfers } = parseRows(rawRows, plano, cm, base);

    if (!forceImbalanced && transfers.count > 0 && !transfers.balanced) {
      return res.status(422).json({
        error: `Transferências desequilibradas: delta de R$ ${transfers.delta.toFixed(2)}. Envie forceImbalanced=true para importar mesmo assim.`,
        transfers,
      });
    }

    const toInsert = records.map(({ _orphan, _transfer, ...r }) => r);

    // Register the import entry first to get the ID, then tag the transactions
    const { importId, history } = await historyStore.addImportEntry(req.tenantSchema, {
      name: req.file.originalname,
      rows: toInsert.length,
      base,
    });
    await txStore.bulkInsertTransactions(req.tenantSchema, toInsert, importId);

    res.json({ imported: toInsert.length, transfers, history });
  } catch (err) { next(err); }
});

// GET /api/import/history
router.get('/history', requirePermission('importar', 'read'), async (req, res, next) => {
  try {
    res.json(await historyStore.getImportHistory(req.tenantSchema));
  } catch (err) { next(err); }
});

// DELETE /api/import/history/:id — deletes a single import and its transactions
router.delete('/history/:id', requirePermission('importar', 'write'), async (req, res, next) => {
  const importId = parseInt(req.params.id, 10);
  if (!Number.isFinite(importId)) return res.status(400).json({ error: 'ID inválido' });
  try {
    const deleted = await historyStore.deleteImportEntry(req.tenantSchema, importId);
    if (!deleted) return res.status(404).json({ error: 'Importação não encontrada' });
    const txDeleted = await txStore.deleteImportTransactions(req.tenantSchema, importId);
    const history   = await historyStore.getImportHistory(req.tenantSchema);
    res.json({ deleted: { ...deleted, txDeleted }, history });
  } catch (err) { next(err); }
});

// DELETE /api/import/history — clears all import history (does NOT delete transactions)
router.delete('/history', requirePermission('importar', 'write'), async (req, res, next) => {
  try {
    await historyStore.clearImportHistory(req.tenantSchema);
    res.json({ success: true });
  } catch (err) { next(err); }
});

/**
 * POST /api/import/plano-preview
 *
 * Reads an xlsx/csv file and extracts unique categories for plano creation.
 * Returns suggested plano items (with auto-classification) and marks which
 * tipos already exist in the current plano.
 *
 * Response: { items: [{ tipo, cat, grp, nivel, primaryMov, count, exists }] }
 */
router.post('/plano-preview', requirePermission('importar', 'write'), upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();
  try {
    const { plano } = await planoStore.getPlano(req.tenantSchema);
    const existingTipos = new Set(plano.map(p => p.tipo.toLowerCase()));

    const rawRows = readFile(req.file.buffer, ext);
    if (!rawRows.length) return res.status(400).json({ error: 'Arquivo sem dados' });

    const headers = Object.keys(rawRows[0]);
    const cm = resolveColMap(headers, {});

    // Aggregate categories: { tipo -> { entradas, saidas } }
    const catMap = new Map();
    for (const row of rawRows) {
      const rawCat = cm.categoria ? row[cm.categoria] : '';
      const cat = String(rawCat ?? '').trim();
      if (!cat || TRANSFER_RE.test(cat)) continue;

      const rawMov = cm.movimento ? row[cm.movimento] : '';
      const mov = parseMov(rawMov);

      if (!catMap.has(cat)) catMap.set(cat, { entradas: 0, saidas: 0 });
      const entry = catMap.get(cat);
      if (mov === 'Entrada') entry.entradas++; else entry.saidas++;
    }

    const items = [...catMap.entries()].map(([tipo, { entradas, saidas }]) => {
      const primaryMov = entradas >= saidas ? 'Entrada' : 'Saída';
      const suggestion = classifyCategory(tipo, primaryMov);
      return {
        tipo,
        ...suggestion,
        primaryMov,
        count: entradas + saidas,
        exists: existingTipos.has(tipo.toLowerCase()),
      };
    });

    // Sort: new items first, then by cat+grp+tipo
    items.sort((a, b) => {
      if (a.exists !== b.exists) return a.exists ? 1 : -1;
      return (a.cat + a.grp + a.tipo).localeCompare(b.cat + b.grp + b.tipo, 'pt-BR');
    });

    res.json({ items });
  } catch (err) { next(err); }
});

/**
 * POST /api/import/plano
 *
 * Creates plano items from the confirmed list (skips existing tipos).
 *
 * Body: { items: [{ tipo, cat, grp, nivel }] }
 * Response: { created, skipped, plano }
 */
router.post('/plano', requirePermission('importar', 'write'), async (req, res, next) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Lista de itens vazia' });
  }

  try {
    const { created, skipped } = await planoStore.bulkCreatePlanoItems(req.tenantSchema, items);
    const { plano, planoCores } = await planoStore.getPlano(req.tenantSchema);
    res.json({ created, skipped, plano, planoCores });
  } catch (err) { next(err); }
});

export default router;
