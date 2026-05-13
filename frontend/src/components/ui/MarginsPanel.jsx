import React from 'react';
import { fmt, fmtPct, pct } from '../../utils/formatters.js';
import InfoPopover from './InfoPopover.jsx';

/**
 * Displays Margem Bruta, Margem Operacional and Resultado Líquido
 * side-by-side with progress bars and formula breakdowns.
 *
 * Props:
 *   dre  – output from buildDRE() containing totRec, totCost, totMgB,
 *           totDespOp, totMgOp, totEntNop, totDespNop
 */

function MarginCard({ label, value, base, color, lines, info }) {
  const pctVal = base > 0 ? pct(value, base) : 0;
  const neg    = value < 0;
  const clamp  = Math.min(100, Math.max(0, Math.abs(pctVal)));

  return (
    <div className="flex-1 min-w-0 px-5 py-4">
      <div className="text-[10px] uppercase tracking-[1.2px] text-text-3 mb-2 flex items-center gap-1.5">
        {label}
        {info && <InfoPopover title={info.title || label} description={info.description} />}
      </div>

      <div
        className="font-inter font-bold text-[21px] tracking-tight mb-0.5"
        style={{ color: neg ? '#ef4444' : color }}
      >
        {neg ? '−' : ''}{fmt(Math.abs(value))}
      </div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="font-inter font-semibold text-[15px]" style={{ color: neg ? '#ef4444' : color }}>
          {fmtPct(Math.abs(pctVal))}
          {neg && <span className="text-[10px] text-red-400 ml-1">negativa</span>}
        </span>
        <span className="text-[10px] text-text-3">da receita</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamp}%`, background: neg ? '#ef4444' : color }}
        />
      </div>

      {/* Formula breakdown */}
      <div className="space-y-0.5">
        {lines.map((line, i) => (
          <div key={i} className="text-[10px] text-text-3 leading-relaxed">{line}</div>
        ))}
      </div>
    </div>
  );
}

export default function MarginsPanel({ dre }) {
  const { totRec, totCost, totMgB, totDespOp, totMgOp, totEntNop, totDespNop } = dre;
  const totRL = totMgOp + totEntNop - totDespNop;

  if (totRec === 0) return null;

  return (
    <div className="panel mb-3.5">
      <div className="panel-hdr">
        <div>
          <div className="font-inter font-semibold text-[13px]">Painel de Margens</div>
          <div className="text-[10px] text-text-3 mt-0.5">Decomposição automática do resultado</div>
        </div>
      </div>

      <div className="flex divide-x divide-slate-100 dark:divide-slate-700">
        <MarginCard
          label="Margem Bruta"
          value={totMgB}
          base={totRec}
          color="#10b981"
          lines={[
            `Receita Bruta: ${fmt(totRec)}`,
            `(−) Custos Diretos: ${fmtPct(pct(totCost, totRec))} · ${fmt(totCost)}`,
          ]}
          info={{
            title: 'Margem Bruta',
            description: 'Receita Bruta menos os Custos Diretos (mercadorias, serviços e produção).\n\nFórmula: Receita − Custos Diretos\n\nMede quanto sobra da receita depois de pagar o que foi diretamente consumido para gerar o produto/serviço.',
          }}
        />

        <MarginCard
          label="Margem Operacional"
          value={totMgOp}
          base={totRec}
          color="#2563eb"
          lines={[
            `Margem Bruta: ${fmtPct(pct(totMgB, totRec))}`,
            `(−) Desp. Operacionais: ${fmtPct(pct(totDespOp, totRec))} · ${fmt(totDespOp)}`,
          ]}
          info={{
            title: 'Margem Operacional (EBIT)',
            description: 'Margem Bruta menos todas as Despesas Operacionais (fixas e variáveis).\n\nFórmula: Margem Bruta − Despesas Fixas − Despesas Variáveis\n\nEquivalente ao EBIT — mede a eficiência operacional antes de itens financeiros e não operacionais.',
          }}
        />

        <MarginCard
          label="Resultado Líquido"
          value={totRL}
          base={totRec}
          color="#7c3aed"
          lines={[
            `Margem Op.: ${fmtPct(pct(totMgOp, totRec))}`,
            ...(totEntNop > 0 ? [`(+) Ent. Não Op.: ${fmtPct(pct(totEntNop, totRec))}`] : []),
            ...(totDespNop > 0 ? [`(−) Desp. Não Op.: ${fmtPct(pct(totDespNop, totRec))}`] : []),
          ]}
          info={{
            title: 'Resultado Líquido',
            description: 'Resultado final após todas as entradas e saídas, incluindo itens não operacionais.\n\nFórmula: Margem Operacional + Entradas Não Op. − Despesas Não Op.\n\nRepresenta o lucro (ou prejuízo) líquido do período.',
          }}
        />
      </div>
    </div>
  );
}
