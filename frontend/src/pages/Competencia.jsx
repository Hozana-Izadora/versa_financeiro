import React, { useState, useMemo } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import { buildDRE } from '../utils/dreBuilder.js';
import { MONTHS, fmt, fmtK, fmtPct, pct, getAvailableMonths } from '../utils/formatters.js';
import KpiCard from '../components/ui/KpiCard.jsx';
import DreTable from '../components/dre/DreTable.jsx';
import Icon from '../components/ui/Icon.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartOpts = (unit) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#475569', font: { family: 'Outfit', size: 11 } } },
    tooltip: { callbacks: { label: ctx => ` ${unit === '%' ? ctx.raw + '%' : fmt(ctx.raw)}` } },
  },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
    y: { ticks: { color: '#94a3b8', callback: v => unit === '%' ? v + '%' : fmtK(v) }, grid: { color: 'rgba(0,0,0,0.06)' } },
  },
});

const DONUT_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#10b981', '#6366f1'];

function CNode({ label, value, sub, color, result, first, last }) {
  return (
    <div
      className={`kpi-card flex-1 min-w-0 ${result ? 'kpi-result' : ''}`}
      style={{
        borderRadius: first ? '8px 0 0 8px' : last ? '0 8px 8px 0' : '0',
        borderRight: last ? undefined : 'none',
      }}
    >
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-1.5">{label}</div>
      <div className="font-inter font-bold text-[20px] tracking-tight mb-0.5" style={{ color }}>{value}</div>
      <div className="text-[11px] text-text-3">{sub}</div>
    </div>
  );
}

function CSep({ symbol }) {
  return <div className="cascade-sep">{symbol}</div>;
}

export default function Competencia() {
  const { state, actions } = useApp();
  const { transactions, plano, saldosIniciais, filterState } = state;
  const [showPct, setShowPct] = useState(true);

  const tx = transactions.competencia;
  const filteredTx = useMemo(() => tx.filter(r => {
    const d = new Date(r.data + 'T12:00');
    const yOk = d.getFullYear() === filterState.year;
    const mOk = filterState.months.size === 0 || filterState.months.has(d.getMonth());
    const gOk = filterState.group === 'all' || r.grp === filterState.group;
    return yOk && mOk && gOk;
  }), [tx, filterState]);

  const visMonths = useMemo(() => {
    if (filterState.months.size > 0) return [...filterState.months].sort((a, b) => a - b);
    const avail = getAvailableMonths(tx, filterState.year);
    return avail.length ? avail : [new Date().getMonth()];
  }, [tx, filterState]);

  const dre = useMemo(() => buildDRE(filteredTx, plano, visMonths, 'competencia', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  const labels = visMonths.map(m => MONTHS[m]);

  // Expense groups for donut + breakdown
  const expGroups = dre.rows.filter(r => r.type === 'group' && !r.isPos);
  const totalExp = expGroups.reduce((s, r) => s + Math.abs(r.total), 0);

  const donutData = {
    labels: expGroups.map(r => r.label),
    datasets: [{
      data: expGroups.map(r => Math.abs(r.total)),
      backgroundColor: DONUT_COLORS.slice(0, expGroups.length),
      borderWidth: 2, borderColor: '#ffffff', hoverOffset: 6,
    }],
  };
  const donutOpts = {
    responsive: true, maintainAspectRatio: false, cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} (${totalExp > 0 ? (ctx.raw / totalExp * 100).toFixed(1) : 0}%)` } },
    },
  };

  const margins = [
    { pctVal: fmtPct(pct(dre.totMgB, dre.totRec)), label: 'Margem Bruta', val: fmtK(dre.totMgB), color: '#10b981', w: Math.min(100, Math.max(0, pct(dre.totMgB, dre.totRec))) },
    { pctVal: fmtPct(pct(dre.totMgOp, dre.totRec)), label: 'Margem Operacional', val: fmtK(dre.totMgOp), color: '#06b6d4', w: Math.min(100, Math.max(0, pct(dre.totMgOp, dre.totRec))) },
    { pctVal: fmtPct(pct(dre.totLL, dre.totRec)), label: 'Margem Líquida', val: fmtK(dre.totLL), color: '#8b5cf6', w: Math.min(100, Math.max(0, pct(dre.totLL, dre.totRec))) },
    { pctVal: fmtPct(pct(dre.totCost, dre.totRec)), label: '% Custo s/ Receita', val: fmtK(dre.totCost), color: '#ef4444', w: Math.min(100, Math.max(0, pct(dre.totCost, dre.totRec))) },
  ];

  const dreChartData = {
    labels,
    datasets: [
      { label: 'Receita', data: dre.mRec, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 4, borderSkipped: false },
      { label: 'Custos+Desp', data: dre.mCost.map((v, i) => v + dre.mDespOp[i] + dre.mDespNop[i]), backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 4, borderSkipped: false },
      { label: 'Lucro Líq.', data: dre.mLL, type: 'line', borderColor: 'rgba(139,92,246,.9)', backgroundColor: 'rgba(139,92,246,.08)', tension: .4, fill: true, pointRadius: 4 },
    ],
  };

  const mbPct = dre.mMgB.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);
  const moPct = dre.mMgOp.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);
  const llPct = dre.mLL.map((v, i) => dre.mRec[i] > 0 ? +(v / dre.mRec[i] * 100).toFixed(1) : 0);

  const mgData = {
    labels,
    datasets: [
      { label: 'Mg. Bruta %', data: mbPct, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,.08)', tension: .4, fill: false, pointRadius: 4 },
      { label: 'Mg. Op. %', data: moPct, borderColor: 'rgba(6,182,212,1)', backgroundColor: 'rgba(6,182,212,.08)', tension: .4, fill: false, pointRadius: 4 },
      { label: 'Mg. Líq. %', data: llPct, borderColor: 'rgba(139,92,246,1)', backgroundColor: 'rgba(139,92,246,.08)', tension: .4, fill: false, pointRadius: 4 },
    ],
  };

  function exportDRE() {
    const rows = [['Descrição', ...visMonths.map(m => MONTHS[m]), 'Total']];
    dre.rows.forEach(row => {
      if (row.type === 'section') return;
      rows.push([row.label, ...row.monthValues.map(v => v.toFixed(2)), row.total.toFixed(2)]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `DRE_${filterState.year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ani">

      {/* ── Cascade: DRE waterfall ── */}
      <div className="kpi-cascade mb-3.5">
        <CNode first
          label="Receita Bruta"
          value={fmtK(dre.totRec)}
          sub={`${visMonths.length} mês(es)`}
          color="#10b981"
        />
        <CSep symbol="−" />
        <CNode
          label="Custos Diretos"
          value={fmtK(dre.totCost)}
          sub={fmtPct(pct(dre.totCost, dre.totRec)) + ' da receita'}
          color="#ef4444"
        />
        <CSep symbol="=" />
        <CNode result
          label="Margem Bruta"
          value={fmtK(dre.totMgB)}
          sub={fmtPct(pct(dre.totMgB, dre.totRec)) + ' de margem'}
          color={dre.totMgB >= 0 ? '#10b981' : '#ef4444'}
        />
        <CSep symbol="−" />
        <CNode
          label="Desp. Operacionais"
          value={fmtK(dre.totDespOp)}
          sub={fmtPct(pct(dre.totDespOp, dre.totRec)) + ' da receita'}
          color="#f59e0b"
        />
        <CSep symbol="=" />
        <CNode last result
          label="EBIT"
          value={fmtK(dre.totMgOp)}
          sub={fmtPct(pct(dre.totMgOp, dre.totRec)) + ' de margem op.'}
          color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'}
        />
      </div>

      {/* ── Resumo não-operacional + lucro líquido ── */}
      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <KpiCard
          label="Desp. Não Operacionais"
          value={fmtK(dre.totDespNop)}
          sub={fmtPct(pct(dre.totDespNop, dre.totRec)) + ' da receita'}
          icon="money_off" colorClass="kc-p"
        />
        <KpiCard
          label="Lucro Líquido"
          value={fmtK(dre.totLL)}
          sub={fmtPct(pct(dre.totLL, dre.totRec)) + ' de margem líquida'}
          icon="diamond" colorClass={dre.totLL >= 0 ? 'kc-g' : 'kc-r'}
        />
        <KpiCard
          label="Margem Operacional"
          value={fmtPct(pct(dre.totMgOp, dre.totRec))}
          sub={`EBIT ${fmtK(dre.totMgOp)}`}
          icon="gps_fixed" colorClass="kc-c"
        />
      </div>

      {/* ── Margin cards ── */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        {margins.map((m, i) => (
          <div key={i} className="bg-card border border-slate-100 rounded-card px-4 py-3.5 text-center">
            <div className="font-inter font-black text-[28px] mb-0.5" style={{ color: m.color }}>{m.pctVal}</div>
            <div className="text-[9.5px] uppercase tracking-widest text-text-3">{m.label}</div>
            <div className="text-xs text-text-2 mt-0.5 font-mono">{m.val}</div>
            <div className="h-[3px] bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.w}%`, background: m.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts: resultado mensal + composição das margens ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Receita × Custos × Resultado</div>
              <div className="text-[10px] text-text-3 mt-0.5">Evolução mensal do resultado econômico</div>
            </div>
          </div>
          <div className="p-4" style={{ height: 252 }}>
            <Bar data={dreChartData} options={chartOpts('R$')} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Composição das Margens</div>
              <div className="text-[10px] text-text-3 mt-0.5">Margem bruta, operacional e líquida %</div>
            </div>
          </div>
          <div className="p-4" style={{ height: 252 }}>
            <Line data={mgData} options={chartOpts('%')} />
          </div>
        </div>
      </div>

      {/* ── Composição das despesas: donut + breakdown ── */}
      <div className="grid grid-cols-[2fr_3fr] gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Composição das Despesas</div>
              <div className="text-[10px] text-text-3 mt-0.5">Distribuição por categoria de despesa</div>
            </div>
          </div>
          <div className="p-4 flex items-center justify-center" style={{ height: 240 }}>
            {expGroups.length > 0
              ? <Doughnut data={donutData} options={donutOpts} />
              : <span className="text-text-3 text-sm">Sem dados no período</span>}
          </div>
        </div>
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Detalhamento por Grupo</div>
              <div className="text-[10px] text-text-3 mt-0.5">Participação % sobre total das despesas e sobre receita</div>
            </div>
          </div>
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 240 }}>
            {expGroups.map((grp, i) => {
              const pctExp = totalExp > 0 ? Math.abs(grp.total) / totalExp * 100 : 0;
              const pctRec = dre.totRec > 0 ? Math.abs(grp.total) / dre.totRec * 100 : 0;
              return (
                <div key={grp.label} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                      <span className="text-[12px] text-text-base font-medium">{grp.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] font-semibold text-fin-red">{fmtK(Math.abs(grp.total))}</span>
                      <span className="text-[10px] text-text-3 ml-1.5">{pctExp.toFixed(1)}% · {pctRec.toFixed(1)}% rec.</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, pctExp)}%`, background: DONUT_COLORS[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DRE horizontal ── */}
      <div className="panel">
        <div className="panel-hdr">
          <div>
            <div className="font-inter font-semibold text-[13px]">DRE Gerencial — Análise Horizontal</div>
            <div className="text-[10px] text-text-3 mt-0.5">Clique nas categorias para expandir · Clique nos itens para ver lançamentos</div>
          </div>
          <div className="flex gap-1.5 items-center">
            <label className="text-[11px] text-text-3 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={showPct} onChange={e => setShowPct(e.target.checked)} />
              Mostrar %
            </label>
            <button className="btn btn-ghost btn-sm" onClick={exportDRE}>
              <Icon name="download" size="text-[14px]" /> Exportar
            </button>
          </div>
        </div>
        <DreTable
          dre={dre}
          showPct={showPct}
          onDrillItem={() => actions.setPage('lancamentos')}
          onDrillGroup={() => actions.setPage('lancamentos')}
        />
      </div>

    </div>
  );
}
