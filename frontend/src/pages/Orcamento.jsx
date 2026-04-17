import React, { useState, useRef, useCallback } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend,
} from 'chart.js';
import { useApp } from '../context/AppContext.jsx';
import ChartModal from '../components/ui/ChartModal.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const MES12 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const GR = '#6DBF45', GY = 'rgba(200,208,218,.8)', RD = '#E53E3E', BL = '#2B6CB0', OR = '#F5A623';

const ORC_REALIZADO = [291, 288, 312, null, null, null, null, null, null, null, null, null];
const ORC_ORCADO    = [285, 290, 300, 305, 308, 310, 315, 318, 320, 325, 328, 335];
const BREAKEVEN     = 280;

const CENARIOS = {
  0: { label: 'Pessimista',     proj: [null,null,null,295,298,300,302,304,305,308,310,312], total: '3.423K', color: 'rgba(229,62,62,.55)',   desc: 'Projeção conservadora — crescimento abaixo do histórico' },
  1: { label: 'Moderado',       proj: [null,null,null,305,308,310,315,318,320,325,328,335], total: '3.718K', color: 'rgba(200,208,218,.6)',   desc: 'Projeção baseada no histórico recente' },
  2: { label: 'Otimista',       proj: [null,null,null,320,325,330,335,340,342,345,348,355], total: '3.919K', color: 'rgba(109,191,69,.55)',   desc: 'Projeção com aceleração de vendas' },
  3: { label: 'Muito Otimista', proj: [null,null,null,340,348,355,360,365,368,372,378,385], total: '4.162K', color: 'rgba(43,108,176,.55)',   desc: 'Projeção com forte expansão de receita' },
};

const GASTOS_TREE = {
  root: { label: 'Todos os Grupos', items: [
    { key: 'fixas',     label: 'Despesas Fixas',    meta: 152.5, real: 153,  color: BL },
    { key: 'variaveis', label: 'Despesas Variáveis', meta: 26,   real: 28,   color: RD },
    { key: 'custos',    label: 'Custos Diretos',    meta: 34,   real: 34,   color: '#9B59B6' },
    { key: 'naoOp',     label: 'Não Operacional',   meta: 39,   real: 39.7, color: OR },
  ]},
  custos: { label: 'Custos Diretos', items: [
    { key: null, label: 'Simples Nacional', meta: 17.5, real: 18,  color: '#c39bd3' },
    { key: null, label: 'ISS retido',       meta: 8.5,  real: 8.5, color: '#9B59B6' },
    { key: null, label: 'Parcelamento',     meta: 7.0,  real: 7.5, color: '#6c3483' },
    { key: null, label: 'Materiais Aplic.', meta: 1.5,  real: 0,   color: '#a29bfe' },
  ]},
  fixas: { label: 'Despesas Fixas', items: [
    { key: 'pessoal',   label: 'Pessoal',   meta: 80,   real: 82,  color: '#5b9bd5' },
    { key: 'estrutura', label: 'Estrutura', meta: 45,   real: 43,  color: BL },
    { key: 'terceiros', label: 'Terceiros', meta: 27.5, real: 28,  color: '#1a4a7a' },
  ]},
  variaveis: { label: 'Despesas Variáveis', items: [
    { key: null, label: 'Combustível',       meta: 13, real: 15,  color: '#f07070' },
    { key: null, label: 'Manut. Veículos',   meta: 8,  real: 12,  color: RD },
    { key: null, label: 'Taxas/Emolumentos', meta: 3,  real: 9,   color: '#a02020' },
    { key: null, label: 'Marketing',         meta: 2,  real: 2,   color: '#ff9999' },
  ]},
  naoOp: { label: 'Não Operacional', items: [
    { key: null, label: 'Distribuição Lucros', meta: 27, real: 27,  color: '#f5c26b' },
    { key: null, label: 'Parcela Empréstimo',  meta: 8,  real: 8,   color: OR },
    { key: null, label: 'Investimentos',       meta: 4,  real: 4.7, color: '#b07718' },
  ]},
  pessoal: { label: 'Pessoal', items: [
    { key: null, label: 'Prestador Serviço', meta: 34, real: 35,  color: '#a8e07f' },
    { key: null, label: 'Pró-labore',        meta: 25, real: 25,  color: GR },
    { key: null, label: 'FGTS / INSS',       meta: 10, real: 10,  color: '#3d8c24' },
    { key: null, label: 'Transporte Alt.',   meta: 11, real: 12,  color: '#5aaa36' },
  ]},
  estrutura: { label: 'Estrutura', items: [
    { key: null, label: 'Aluguel',  meta: 18, real: 18, color: '#5b9bd5' },
    { key: null, label: 'Software', meta: 9,  real: 9,  color: BL },
    { key: null, label: 'Energia',  meta: 9,  real: 8,  color: '#1a4a7a' },
    { key: null, label: 'Internet', meta: 9,  real: 8,  color: '#0d2d4f' },
  ]},
  terceiros: { label: 'Terceiros', items: [
    { key: null, label: 'Contabilidade', meta: 16.5, real: 17, color: '#f5c26b' },
    { key: null, label: 'Coworking',     meta: 6,    real: 6,  color: OR },
    { key: null, label: 'Consultoria',   meta: 5,    real: 5,  color: '#b07718' },
  ]},
};

const METRIC_DATA = {
  0: { label: 'Resultado Líquido (R$ mil)', real: [47,43,50,null,null,null,null,null,null,null,null,null], proj: [null,null,null,49,50,51,52,53,54,55,56,57], meta: 49, isCurrency: true },
  1: { label: 'Margem Bruta (%)',           real: [47.2,46.8,48.2,null,null,null,null,null,null,null,null,null], proj: [null,null,null,48.5,49.0,49.2,49.5,49.8,50.0,50.2,50.5,50.8], meta: 49.5, isCurrency: false },
  2: { label: 'Margem Operacional (%)',     real: [21.0,21.5,22.6,null,null,null,null,null,null,null,null,null], proj: [null,null,null,22.0,22.2,22.5,22.8,23.0,23.2,23.4,23.6,23.8], meta: 20.3, isCurrency: false },
  3: { label: 'Margem Líquida (%)',         real: [17.2,17.5,18.1,null,null,null,null,null,null,null,null,null], proj: [null,null,null,17.8,18.0,18.2,18.4,18.6,18.8,19.0,19.2,19.4], meta: 17.5, isCurrency: false },
};

const ORC_TABLE = [
  { sec: true, label: 'RECEITAS' },
  { label: 'Receita Bruta',   orcMes: 300000, realMes: 312000, orcAno: 3468000, projAno: 3718000, above: true },
  { label: 'Receita Líquida', orcMes: 267000, realMes: 278000, orcAno: 3085200, projAno: 3316000, above: true },
  { sec: true, label: 'CUSTOS E DESPESAS' },
  { label: 'CMV / CPV',       orcMes: 135000, realMes: 144000, orcAno: 1560000, projAno: 1716000, above: false },
  { res: true, label: '= Margem Bruta', orcMes: 132000, realMes: 134000, orcAno: 1525200, projAno: 1600000, above: true },
  { label: 'Pessoal',          orcMes: 80000,  realMes: 82000,  orcAno: 924000,  projAno: 978000,  above: false },
  { label: 'Estrutura',        orcMes: 45000,  realMes: 43000,  orcAno: 520200,  projAno: 512000,  above: true },
  { label: 'Desp. Variáveis',  orcMes: 26000,  realMes: 28000,  orcAno: 300300,  projAno: 334000,  above: false },
  { label: 'Terceiros',        orcMes: 27500,  realMes: 28000,  orcAno: 317900,  projAno: 334000,  above: false },
  { res: true, label: '= Resultado Líquido', orcMes: 49000, realMes: 50300, orcAno: 566200, projAno: 600000, above: true },
];

const chartBaseOpts = (cb) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: true, labels: { color: '#475569', font: { size: 10 }, boxWidth: 9, borderRadius: 2 } },
    tooltip: { backgroundColor: '#1C1C1C', titleColor: '#fff', bodyColor: '#aaa', padding: 9, cornerRadius: 5 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#8A96A3', font: { size: 10 } } },
    y: { grid: { color: '#F0F2F5' }, ticks: { color: '#8A96A3', font: { size: 10 }, callback: cb || (v => v) } },
  },
});

function fmtK(v) { return v == null ? '' : 'R$' + v + 'K'; }
function fmtBrl(v) { return v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR'); }
function varPct(real, orc) { const d = real - orc; return (d >= 0 ? '+' : '') + ((d / orc) * 100).toFixed(1) + '%'; }
function varAbs(real, orc) { const d = real - orc; return (d >= 0 ? '+' : '') + fmtBrl(Math.abs(d)); }

export default function Orcamento() {
  const { state } = useApp();
  const { darkMode } = state;

  const [scenario, setScenario] = useState(1);
  const [gastoStack, setGastoStack] = useState(['root']);
  const [metric, setMetric] = useState(0);
  const [modalChart, setModalChart] = useState(null);

  const gc = darkMode ? '#1e2d42' : '#F0F2F5';
  const tc = darkMode ? '#8aa3be' : '#8A96A3';

  function openModal(type, data, options, title) {
    setModalChart({ type, data, options, title });
  }

  // ── Receita Anual chart ──────────────────────────────────────
  const c = CENARIOS[scenario];
  const orcAnualData = {
    labels: MES12,
    datasets: [
      { label: 'Realizado',  data: ORC_REALIZADO, backgroundColor: GR, borderRadius: 4 },
      { label: 'Orçado',     data: ORC_ORCADO,    backgroundColor: GY, borderRadius: 4 },
      { label: c.label + ' (projeção)', data: c.proj, backgroundColor: c.color, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,.1)' },
      { label: 'Ponto de Equilíbrio', data: Array(12).fill(BREAKEVEN), type: 'line', borderColor: OR, borderWidth: 2, borderDash: [7, 4], pointRadius: 0, tension: 0, fill: false },
    ],
  };
  const orcAnualOpts = { ...chartBaseOpts(v => 'R$' + v + 'K'), scales: { ...chartBaseOpts().scales, x: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => 'R$' + v + 'K' } } } };

  // ── Gastos Drill-down chart ──────────────────────────────────
  const gastoNode = GASTOS_TREE[gastoStack[gastoStack.length - 1]];
  const gastoData = {
    labels: gastoNode.items.map(i => i.label),
    datasets: [
      { label: 'Meta',      data: gastoNode.items.map(i => i.meta), backgroundColor: GY, borderRadius: 4 },
      { label: 'Realizado', data: gastoNode.items.map(i => i.real), backgroundColor: gastoNode.items.map(i => i.real > i.meta ? 'rgba(229,62,62,.8)' : 'rgba(109,191,69,.8)'), borderRadius: 4 },
    ],
  };
  const gastoOpts = {
    ...chartBaseOpts(v => 'R$' + v + 'K'),
    scales: { ...chartBaseOpts().scales, x: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => 'R$' + v + 'K' } } },
    onClick: (evt, elements, chart) => {
      if (!elements.length) return;
      const child = gastoNode.items[elements[0].index].key;
      if (child && GASTOS_TREE[child]) setGastoStack(s => [...s, child]);
    },
  };

  // ── Evolução Meta vs Realizado chart ─────────────────────────
  const m = METRIC_DATA[metric];
  const cb = m.isCurrency ? v => 'R$' + v + 'K' : v => v + '%';
  const metricData = {
    labels: MES12,
    datasets: [
      { label: 'Realizado', data: m.real, backgroundColor: GR, borderRadius: 4, type: 'bar' },
      { label: 'Projeção',  data: m.proj, backgroundColor: 'rgba(200,208,218,.65)', borderRadius: 4, type: 'bar' },
      { label: 'Meta',      data: Array(12).fill(m.meta), type: 'line', borderColor: BL, borderWidth: 2, borderDash: [6, 3], pointRadius: 0, tension: 0, fill: false },
    ],
  };
  const metricOpts = { ...chartBaseOpts(cb), scales: { ...chartBaseOpts().scales, x: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } }, y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: cb } } } };

  const kpiCards = [
    { label: 'Receita Bruta',         meta: 'R$ 300K', real: 'R$ 312K', realColor: '#059669', delta: '▲ +4,0% vs meta', deltaUp: true },
    { label: 'Desp. Operacionais',    meta: 'R$ 181K', real: 'R$ 189K', realColor: RD,         delta: '▼ +4,4% acima da meta', deltaUp: false, red: true },
    { label: 'Margem Operacional',    meta: '20,3%',   real: '22,6%',   realColor: '#059669', delta: '▲ +2,3pp vs meta', deltaUp: true },
    { label: 'Gastos Não Operacionais', meta: 'R$ 12K', real: 'R$ 12,7K', realColor: RD,      delta: '▼ +5,8% acima da meta', deltaUp: false, red: true },
    { label: 'Resultado Líquido',     meta: 'R$ 49K',  real: 'R$ 50,3K', realColor: '#059669', delta: '▲ +2,7% vs meta', deltaUp: true },
  ];

  return (
    <div className="ani">
      {modalChart && <ChartModal chart={modalChart} onClose={() => setModalChart(null)} />}

      {/* ── KPIs Meta vs Realizado ── */}
      <div className="flex gap-2.5 flex-wrap mb-3.5">
        {kpiCards.map((k, i) => (
          <div key={i} className={`kpi-card flex-1 min-w-[155px] ${k.red ? 'kc-r' : 'kc-g'}`}>
            <div className="text-[9.5px] uppercase tracking-[1px] text-text-3 mb-2">{k.label}</div>
            <div className="flex gap-3 items-end mb-1">
              <div>
                <div className="text-[8.5px] text-text-3 mb-0.5">META</div>
                <div className="text-[14px] font-bold text-text-3">{k.meta}</div>
              </div>
              <div>
                <div className="text-[8.5px] mb-0.5" style={{ color: k.realColor }}>REALIZADO</div>
                <div className="text-[16px] font-black text-text-base">{k.real}</div>
              </div>
            </div>
            <div className="text-[9.5px] font-semibold" style={{ color: k.deltaUp ? '#059669' : RD }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* ── Seletor de cenários ── */}
      <div className="flex items-center gap-3 flex-wrap mb-3.5">
        <span className="text-[11px] font-semibold text-text-2">Cenário de Receita:</span>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(CENARIOS).map(([i, c]) => (
            <button
              key={i}
              onClick={() => setScenario(+i)}
              className={`px-3 py-1.5 rounded-sm border text-[11px] font-semibold transition-all cursor-pointer ${
                scenario === +i
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white dark:bg-[#1a2d42] text-text-2 dark:text-[#c4d4e4] border-slate-200 dark:border-[#2d4060] hover:border-accent hover:text-accent'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-text-3 italic">{CENARIOS[scenario].desc}</span>
      </div>

      {/* ── Gráficos: Receita + Gastos ── */}
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <div className="panel">
          <div className="panel-hdr">
            <div className="font-inter font-semibold text-[13px]">Receita Bruta — Realizado vs Orçado</div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(109,191,69,.12)', color: '#5aaa36' }}>
              Total proj.: R$ {CENARIOS[scenario].total}
            </span>
          </div>
          <div className="p-4 cursor-zoom-in" style={{ height: 210 }}
            onClick={() => openModal('bar', orcAnualData, orcAnualOpts, 'Receita Bruta — Realizado vs Orçado')}>
            <Bar data={orcAnualData} options={orcAnualOpts} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="font-inter font-semibold text-[13px]">Gastos por Categoria — Meta vs Realizado</div>
              {gastoStack.length > 1 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    onClick={() => setGastoStack(s => s.slice(0, -1))}
                    className="text-[10px] text-accent underline cursor-pointer"
                  >← Voltar</button>
                  <span className="text-[10px] text-text-3">› {gastoNode.label}</span>
                </div>
              )}
            </div>
            <span className="text-[9.5px] text-text-3">Clique numa barra para detalhar</span>
          </div>
          <div className="p-4 cursor-pointer" style={{ height: 230 }}>
            <Bar data={gastoData} options={gastoOpts} />
          </div>
        </div>
      </div>

      {/* ── Evolução Meta vs Realizado + seletor de métrica ── */}
      <div className="panel mb-3.5">
        <div className="panel-hdr">
          <div className="font-inter font-semibold text-[13px]">Evolução — Meta vs Realizado</div>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(METRIC_DATA).map(([i, d]) => (
              <button
                key={i}
                onClick={() => setMetric(+i)}
                className={`px-2.5 py-1 rounded-sm border text-[11px] font-medium transition-all cursor-pointer ${
                  metric === +i
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white dark:bg-[#1a2d42] text-text-2 dark:text-[#c4d4e4] border-slate-200 dark:border-[#2d4060] hover:border-accent hover:text-accent'
                }`}
              >
                {['Res. Líquido', 'Mg. Bruta', 'Mg. Op.', 'Mg. Líq.'][+i]}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 cursor-zoom-in" style={{ height: 250 }}
          onClick={() => openModal('bar', metricData, metricOpts, METRIC_DATA[metric].label)}>
          <Bar data={metricData} options={metricOpts} />
        </div>
      </div>

      {/* ── Tabela de acompanhamento orçamentário ── */}
      <div className="panel">
        <div className="panel-hdr">
          <div className="font-inter font-semibold text-[13px]">Acompanhamento Orçamentário — Março 2026</div>
          <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(109,191,69,.12)', color: '#5aaa36' }}>
            Rolling Forecast
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="orc-tbl w-full border-collapse" style={{ fontSize: 11.5 }}>
            <thead>
              <tr>
                {['Categoria','Orç. Mês','Real. Mês','Variação R$','Variação %','Orç. Ano','Proj. Ano','Status'].map(h => (
                  <th key={h} className={`py-2 px-3.5 text-[9px] uppercase tracking-widest border-b border-slate-100 whitespace-nowrap font-bold bg-[#1C2B3A] text-white ${h === 'Categoria' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ORC_TABLE.map((row, i) => {
                if (row.sec) return (
                  <tr key={i} className="r-sec">
                    <td colSpan={8} className="px-3.5 py-2 font-bold text-[9.5px] uppercase tracking-[0.5px] bg-[#1C2B3A] text-white">{row.label}</td>
                  </tr>
                );
                const varR = row.realMes - row.orcMes;
                const varP = ((varR / row.orcMes) * 100).toFixed(1);
                const pos = row.above ? varR >= 0 : varR <= 0;
                const varCls = pos ? 'text-fin-green font-semibold' : 'text-fin-red font-semibold';
                const statusTxt = row.above ? (varR >= 0 ? '✔ Acima' : '✖ Abaixo') : (varR <= 0 ? '✔ Abaixo' : '✖ Acima');
                const trCls = row.res ? 'r-res font-black' : '';
                return (
                  <tr key={i} className={`${trCls} border-b border-slate-100 hover:bg-slate-50 transition-colors`}
                    style={row.res ? { background: 'rgba(109,191,69,.07)', fontWeight: 800, borderTop: '2px solid rgba(109,191,69,.2)' } : {}}>
                    <td className="px-3.5 py-2 text-left text-text-base font-medium">{row.label}</td>
                    <td className="px-3.5 py-2 text-right text-text-2 font-mono">{fmtBrl(row.orcMes)}</td>
                    <td className="px-3.5 py-2 text-right text-text-base font-semibold font-mono">{fmtBrl(row.realMes)}</td>
                    <td className={`px-3.5 py-2 text-right font-mono ${varCls}`}>{varR >= 0 ? '+' : ''}{fmtBrl(Math.abs(varR))}</td>
                    <td className={`px-3.5 py-2 text-right font-mono ${varCls}`}>{varR >= 0 ? '+' : ''}{varP}%</td>
                    <td className="px-3.5 py-2 text-right text-text-2 font-mono">{fmtBrl(row.orcAno)}</td>
                    <td className={`px-3.5 py-2 text-right font-mono ${pos ? 'text-fin-green font-semibold' : 'text-fin-red font-semibold'}`}>{fmtBrl(row.projAno)}</td>
                    <td className={`px-3.5 py-2 text-right ${pos ? 'text-fin-green font-semibold' : 'text-fin-red font-semibold'}`}>{statusTxt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
