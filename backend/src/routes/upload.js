import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { requirePermission } from '../middleware/permission.js';
import * as txStore from '../store/transactions.js';
import * as planoStore from '../store/plano.js';
import * as historyStore from '../store/importHistory.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const COL_ALIASES = {
  data:      ['data', 'date', 'dt', 'vencimento', 'competencia'],
  descricao: ['descrição', 'descricao', 'description', 'historico', 'memo', 'obs'],
  categoria: ['categoria', 'category', 'conta', 'plano'],
  valor:     ['valor', 'value', 'amount', 'montante'],
  movimento: ['tipo', 'movimento', 'operacao', 'entrada_saida'],
  regime:    ['regime', 'tipo_lancamento'],
};

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

function mapCol(headers, field) {
  const aliases = COL_ALIASES[field];
  for (const a of aliases) {
    const h = headers.find(h => h.toLowerCase().includes(a));
    if (h) return h;
  }
  return null;
}

function autoPlano(desc, plano) {
  const d = (desc || '').toLowerCase();
  for (const p of plano) {
    if (d.includes(p.tipo.toLowerCase().substring(0, 8))) return p;
  }
  return plano[Math.floor(Math.random() * plano.length)];
}

function parseRows(rows, plano) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const cm = {};
  ['data', 'descricao', 'categoria', 'valor', 'movimento', 'regime'].forEach(f => {
    cm[f] = mapCol(headers, f);
  });

  return rows.map(r => {
    const cat = cm.categoria ? r[cm.categoria] : '';
    const p = plano.find(x => x.cat === cat || x.tipo === cat) || autoPlano(cm.descricao ? r[cm.descricao] : '', plano);

    const rawDate = cm.data ? r[cm.data] : '';
    let dateFmt = new Date().toISOString().split('T')[0];
    if (rawDate !== '') {
      const s = String(rawDate).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) dateFmt = s.substring(0, 10);
      else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) {
        const pts = s.split(/[\/\-]/);
        dateFmt = `${pts[2]}-${pts[1].padStart(2, '0')}-${pts[0].padStart(2, '0')}`;
      } else if (/^\d{4,5}$/.test(s)) {
        const d = new Date(Math.round((parseFloat(s) - 25569) * 86400 * 1000));
        if (!isNaN(d)) dateFmt = d.toISOString().split('T')[0];
      }
    }

    const valor = parseValor(cm.valor ? r[cm.valor] : 0);
    const rawMov = cm.movimento ? r[cm.movimento] : '';
    const mov = /entrada|receit|crédito|credito|income/i.test(rawMov) ? 'Entrada' : 'Saída';
    const rawReg = cm.regime ? r[cm.regime] : '';
    const regime = /competên|competenc|accrual/i.test(rawReg) ? 'Competência' : 'Caixa';

    return {
      data: dateFmt,
      desc: cm.descricao ? r[cm.descricao] : 'Lançamento',
      cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel,
      valor: Math.abs(valor), mov, regime,
    };
  }).filter(r => r.valor > 0);
}

function parseCSV(text) {
  function countSep(line, sep) { let c = 0, q = false; for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === sep) c++; } return c; }
  const fl = text.split('\n')[0] || '';
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
    f.push(cur.trim());
    return f;
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const v = parseLine(l);
    const o = {};
    headers.forEach((h, i) => o[h] = (v[i] || '').replace(/^"|"$/g, ''));
    return o;
  });
}

// POST /api/import
router.post('/', requirePermission('importar', 'write'), upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const base = req.body.base === 'competencia' ? 'Competência' : 'Caixa';
  const ext = req.file.originalname.split('.').pop().toLowerCase();

  try {
    const { plano } = await planoStore.getPlano(req.tenantSchema);

    let rows = [];
    if (ext === 'csv') {
      rows = parseCSV(req.file.buffer.toString('utf-8'));
    } else {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });
      rows = raw.map(row => {
        const o = {};
        Object.entries(row).forEach(([k, v]) => { o[k] = v instanceof Date ? v.toISOString().split('T')[0] : v; });
        return o;
      });
    }

    // Force regime to match the chosen base
    const parsed = parseRows(rows, plano).map(r => ({ ...r, regime: base }));

    await txStore.bulkInsertTransactions(req.tenantSchema, parsed);

    const history = await historyStore.addImportEntry(req.tenantSchema, {
      name: req.file.originalname,
      rows: parsed.length,
      base,
    });

    res.json({ imported: parsed.length, history });
  } catch (err) { next(err); }
});

// GET /api/import/history
router.get('/history', requirePermission('importar', 'read'), async (req, res, next) => {
  try {
    res.json(await historyStore.getImportHistory(req.tenantSchema));
  } catch (err) { next(err); }
});

// DELETE /api/import/history
router.delete('/history', requirePermission('importar', 'write'), async (req, res, next) => {
  try {
    await historyStore.clearImportHistory(req.tenantSchema);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
