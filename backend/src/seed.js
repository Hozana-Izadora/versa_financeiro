export const defaultPlano = [
  { cat: 'RECEITA BRUTA', grp: 'Receita Operacional', tipo: 'Venda de Produtos', nivel: 'Receita' },
  { cat: 'RECEITA BRUTA', grp: 'Receita Operacional', tipo: 'Venda de Serviços', nivel: 'Receita' },
  { cat: 'RECEITA BRUTA', grp: 'Receita Operacional', tipo: 'Outras Receitas Operacionais', nivel: 'Receita' },
  { cat: 'RECEITA BRUTA', grp: 'Receita Financeira', tipo: 'Juros Recebidos', nivel: 'Receita' },
  { cat: 'RECEITA BRUTA', grp: 'Receita Financeira', tipo: 'Rendimentos Financeiros', nivel: 'Receita' },
  { cat: 'CUSTOS DIRETOS', grp: 'Custo de Mercadorias', tipo: 'CMV - Custo Mercadoria Vendida', nivel: 'Custo' },
  { cat: 'CUSTOS DIRETOS', grp: 'Custo de Serviços', tipo: 'CSP - Custo Serviços Prestados', nivel: 'Custo' },
  { cat: 'CUSTOS DIRETOS', grp: 'Custo de Produção', tipo: 'Matéria-Prima', nivel: 'Custo' },
  { cat: 'CUSTOS DIRETOS', grp: 'Custo de Produção', tipo: 'Mão de Obra Direta', nivel: 'Custo' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas com Pessoal', tipo: 'Salários e Encargos', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas com Pessoal', tipo: 'Benefícios', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas com Pessoal', tipo: 'Pró-labore', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Administrativas', tipo: 'Aluguel', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Administrativas', tipo: 'Energia e Utilities', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Administrativas', tipo: 'Telefone e Internet', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Administrativas', tipo: 'Material de Escritório', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Comerciais', tipo: 'Marketing e Publicidade', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Comerciais', tipo: 'Comissões de Vendas', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Despesas Comerciais', tipo: 'Fretes e Logística', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Tecnologia', tipo: 'Softwares e Licenças', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS OPERACIONAIS', grp: 'Tecnologia', tipo: 'Infraestrutura de TI', nivel: 'Despesa Operacional' },
  { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Despesas Financeiras', tipo: 'Juros Pagos', nivel: 'Despesa Não Operacional' },
  { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Despesas Financeiras', tipo: 'Taxas Bancárias', nivel: 'Despesa Não Operacional' },
  { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Impostos e Tributos', tipo: 'Impostos sobre Lucro (IR/CSLL)', nivel: 'Despesa Não Operacional' },
  { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Impostos e Tributos', tipo: 'PIS/COFINS', nivel: 'Despesa Não Operacional' },
  { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Outras Não Operacionais', tipo: 'Multas e Penalidades', nivel: 'Despesa Não Operacional' },
  { cat: 'DESPESAS NÃO OPERACIONAIS', grp: 'Outras Não Operacionais', tipo: 'Perdas Diversas', nivel: 'Despesa Não Operacional' },
  { cat: 'ENTRADAS NÃO OPERACIONAIS', grp: 'Receitas Financeiras', tipo: 'Rendimentos de Aplicações', nivel: 'Entrada Não Operacional' },
  { cat: 'ENTRADAS NÃO OPERACIONAIS', grp: 'Outras Entradas', tipo: 'Venda de Ativos', nivel: 'Entrada Não Operacional' },
  { cat: 'ENTRADAS NÃO OPERACIONAIS', grp: 'Outras Entradas', tipo: 'Recuperação de Créditos', nivel: 'Entrada Não Operacional' },
];

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function rnd(n) { return Math.floor(Math.random() * n); }

export function generateSample(plano) {
  const thisYear = new Date().getFullYear();
  const nowM = new Date().getMonth();
  let id = 1;
  const out = { caixa: [], competencia: [] };

  for (let mi = 0; mi <= nowM; mi++) {
    const dd = d => `${thisYear}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // Receitas Caixa
    [
      [8000 + rnd(25000), 'Venda de Produtos'],
      [5000 + rnd(18000), 'Venda de Serviços'],
      [800 + rnd(3000), 'Juros Recebidos'],
    ].forEach(([v, tipo]) => {
      const p = plano.find(x => x.tipo === tipo) || plano[0];
      out.caixa.push({ id: id++, data: dd(rnd(26) + 1), desc: `${tipo} - ${MONTHS[mi]}`, cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel, valor: v, mov: 'Entrada', regime: 'Caixa' });
    });

    // Receitas Competência
    [
      [9000 + rnd(28000), 'Venda de Produtos'],
      [6000 + rnd(20000), 'Venda de Serviços'],
      [500 + rnd(2000), 'Rendimentos Financeiros'],
    ].forEach(([v, tipo]) => {
      const p = plano.find(x => x.tipo === tipo) || plano[0];
      out.competencia.push({ id: id++, data: dd(rnd(26) + 1), desc: `${tipo} - ${MONTHS[mi]}`, cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel, valor: v, mov: 'Entrada', regime: 'Competência' });
    });

    // Custos Caixa
    [
      ['CMV - Custo Mercadoria Vendida', 4000 + rnd(12000)],
      ['CSP - Custo Serviços Prestados', 2000 + rnd(8000)],
    ].forEach(([tipo, v]) => {
      const p = plano.find(x => x.tipo === tipo) || plano[5];
      out.caixa.push({ id: id++, data: dd(rnd(26) + 1), desc: `${tipo} - ${MONTHS[mi]}`, cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel, valor: v, mov: 'Saída', regime: 'Caixa' });
    });

    // Custos Competência
    [
      ['CMV - Custo Mercadoria Vendida', 4500 + rnd(13000)],
      ['CSP - Custo Serviços Prestados', 2500 + rnd(9000)],
      ['Mão de Obra Direta', 3000 + rnd(6000)],
    ].forEach(([tipo, v]) => {
      const p = plano.find(x => x.tipo === tipo) || plano[5];
      out.competencia.push({ id: id++, data: dd(rnd(26) + 1), desc: `${tipo} - ${MONTHS[mi]}`, cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel, valor: v, mov: 'Saída', regime: 'Competência' });
    });

    // Despesas operacionais (ambas as bases)
    [
      ['Salários e Encargos', 8000 + rnd(4000)],
      ['Aluguel', 2800 + rnd(500)],
      ['Marketing e Publicidade', 1500 + rnd(4000)],
      ['Softwares e Licenças', 800 + rnd(2000)],
      ['Benefícios', 1200 + rnd(1000)],
      ['Telefone e Internet', 400 + rnd(300)],
    ].forEach(([tipo, v]) => {
      const p = plano.find(x => x.tipo === tipo) || plano[9];
      ['caixa', 'competencia'].forEach(base => {
        out[base].push({
          id: id++, data: dd(rnd(26) + 1), desc: `${tipo} - ${MONTHS[mi]}`,
          cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel,
          valor: v * (base === 'competencia' ? 1.05 : 1),
          mov: 'Saída', regime: base === 'caixa' ? 'Caixa' : 'Competência',
        });
      });
    });

    // Despesas não operacionais (aleatório)
    if (Math.random() > 0.4) {
      [
        ['Juros Pagos', 300 + rnd(1500)],
        ['PIS/COFINS', 500 + rnd(1000)],
      ].forEach(([tipo, v]) => {
        const p = plano.find(x => x.tipo === tipo) || plano[21];
        ['caixa', 'competencia'].forEach(base => {
          out[base].push({ id: id++, data: dd(rnd(26) + 1), desc: `${tipo} - ${MONTHS[mi]}`, cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel, valor: v, mov: 'Saída', regime: base === 'caixa' ? 'Caixa' : 'Competência' });
        });
      });
    }

    // Entradas não operacionais (aleatório)
    if (Math.random() > 0.5) {
      const p = plano.find(x => x.tipo === 'Rendimentos de Aplicações');
      if (p) {
        const v = 200 + rnd(800);
        ['caixa', 'competencia'].forEach(base => {
          out[base].push({ id: id++, data: dd(rnd(26) + 1), desc: `Rendimentos de Aplicações - ${MONTHS[mi]}`, cat: p.cat, grp: p.grp, tipo: p.tipo, nivel: p.nivel, valor: v, mov: 'Entrada', regime: base === 'caixa' ? 'Caixa' : 'Competência' });
        });
      }
    }
  }

  return out;
}
