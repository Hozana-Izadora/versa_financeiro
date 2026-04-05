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

export default function Caixa() {
  const { state, actions } = useApp();
  const { transactions, plano, saldosIniciais, filterState } = state;
  const [showPct, setShowPct] = useState(true);

  const tx = transactions.caixa;

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

  const dre = useMemo(() => buildDRE(filteredTx, plano, visMonths, 'caixa', filterState, saldosIniciais),
    [filteredTx, plano, visMonths, filterState, saldosIniciais]);

  const labels = visMonths.map(m => MONTHS[m]);
  const totSaldo = dre.mSaldo.reduce((a, b) => a + b, 0);
  const lastAcum = dre.mAcum[dre.mAcum.length - 1] || 0;

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

  const flowData = {
    labels,
    datasets: [
      { label: 'Entradas', data: dre.mRec, backgroundColor: 'rgba(16,185,129,.7)', borderRadius: 4, borderSkipped: false },
      { label: 'Saídas', data: dre.mCost.map((v, i) => v + dre.mDespOp[i] + dre.mDespNop[i]), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4, borderSkipped: false },
      { label: 'Saldo', data: dre.mSaldo, type: 'line', borderColor: 'rgba(59,130,246,.9)', backgroundColor: 'rgba(59,130,246,.08)', tension: .4, fill: true, pointBackgroundColor: 'rgba(59,130,246,1)', pointRadius: 4 },
    ],
  };

  const acumData = {
    labels,
    datasets: [
      { label: 'Acumulado', data: dre.mAcum, borderColor: 'rgba(16,185,129,1)', backgroundColor: 'rgba(16,185,129,.1)', tension: .4, fill: true, pointBackgroundColor: 'rgba(16,185,129,1)', pointRadius: 5 },
      { label: 'Saldo Mês', data: dre.mSaldo, borderColor: 'rgba(59,130,246,.6)', backgroundColor: 'transparent', tension: .4, borderDash: [4, 4], pointRadius: 3 },
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
    const a = document.createElement('a'); a.href = url; a.download = `Caixa_${filterState.year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ani">

      {/* ── Cascade: fluxo operacional ── */}
      <div className="kpi-cascade mb-3.5">
        <CNode first
          label="Entradas / Receita"
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
        <CSep symbol="−" />
        <CNode
          label="Despesas Operacionais"
          value={fmtK(dre.totDespOp)}
          sub={fmtPct(pct(dre.totDespOp, dre.totRec)) + ' da receita'}
          color="#f59e0b"
        />
        <CSep symbol="=" />
        <CNode last result
          label="Caixa Operacional"
          value={fmtK(dre.totMgOp)}
          sub={fmtPct(pct(dre.totMgOp, dre.totRec)) + ' de margem'}
          color={dre.totMgOp >= 0 ? '#2563eb' : '#ef4444'}
        />
      </div>

      {/* ── Resumo não-operacional + saldos ── */}
      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <KpiCard
          label="Saídas Não Operacionais"
          value={fmtK(dre.totDespNop)}
          sub={fmtPct(pct(dre.totDespNop, dre.totRec)) + ' da receita'}
          icon="money_off" colorClass="kc-p"
        />
        <KpiCard
          label="Saldo do Período"
          value={fmtK(totSaldo)}
          sub={totSaldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
          icon="balance" colorClass={totSaldo >= 0 ? 'kc-g' : 'kc-r'}
        />
        <KpiCard
          label="Saldo Acumulado"
          value={fmtK(lastAcum)}
          sub={`Acumulado ${filterState.year}`}
          icon="trending_up" colorClass="kc-b"
        />
      </div>

      {/* ── Charts: fluxo mensal + acumulado ── */}
      <div className="grid grid-cols-[3fr_2fr] gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Fluxo de Caixa Mensal</div>
              <div className="text-[10px] text-text-3 mt-0.5">Entradas, saídas e saldo líquido do período</div>
            </div>
          </div>
          <div className="p-4" style={{ height: 252 }}>
            <Bar data={flowData} options={chartOpts('R$')} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Saldo Acumulado</div>
              <div className="text-[10px] text-text-3 mt-0.5">Evolução com saldos iniciais</div>
            </div>
          </div>
          <div className="p-4" style={{ height: 252 }}>
            <Line data={acumData} options={chartOpts('R$')} />
          </div>
        </div>
      </div>

      {/* ── Composição das saídas: donut + breakdown ── */}
      <div className="grid grid-cols-[2fr_3fr] gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Composição das Saídas</div>
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
              <div className="text-[10px] text-text-3 mt-0.5">Participação % sobre total das saídas e sobre receita</div>
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

      {/* ── DFC horizontal ── */}
      <div className="panel">
        <div className="panel-hdr">
          <div>
            <div className="font-inter font-semibold text-[13px]">Demonstrativo de Fluxo de Caixa — Análise Horizontal</div>
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
