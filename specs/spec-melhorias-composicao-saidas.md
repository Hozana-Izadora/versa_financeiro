# Spec — Substituição do gráfico "Composição das Saídas"

Origem: pedido do cliente, recebido em 2026-09-01, com prints de referência de como ele
monta esse gráfico hoje numa planilha Excel (uma aba chamada "Gráfico").
Escopo: `frontend/src/components/ui/DrillChart.jsx` (usado só na tela Caixa, ver
`frontend/src/pages/Caixa.jsx:664-676`), `frontend/src/utils/drillHierarchy.js`.

## Pedido do cliente (literal)

> "Gráfico para substituição da composição das saídas (informações na planilha 'Gráfico')."

Print de referência (aba "Gráfico" do Excel), com anotações do próprio cliente:

> "OBS: Seguir o filtro de datas, e os percentuais devem ser sobre o
> faturamento/receita. Adicionar % no gráfico de categoria tbm."

(Há um segundo print, "Real x Orçamento - análise mensal", com a observação "Pode ser
apenas 1 gráfico, onde eu tenha a opção escolher a análise por valores ou %... Preciso
ter as duas visões, não necessariamente os dois gráficos" — **esse já é o gráfico
"Gastos por Grupo" do Orçamento**, implementado com exatamente esse toggle R$/%
(`specs/FUNCIONALIDADES.md` secção 7.7). Não é pedido novo, só confirma que a
referência do cliente é a mesma que já guiou aquele gráfico — nenhuma ação necessária
aqui.)

---

## Estado atual — `DrillChart.jsx` ("Composição das Saídas")

Hoje é um **gráfico de rosca (donut) com navegação hierárquica em profundidade
arbitrária**, usando `useDrillDown` (`frontend/src/hooks/useDrillDown.js`) sobre a
árvore de `buildDrillTree(plano)` (`frontend/src/utils/drillHierarchy.js` — mesma
árvore usada em "Metas por Categoria" do Orçamento):

```
Saídas (raiz)
├── Gastos Operacionais       (nivel: Custo, Despesa Operacional)
│   └── <Categoria> → <Grupo> → <Tipo>
└── Gastos Não Operacionais   (nivel: Despesa Não Operacional)
    └── <Categoria> → <Grupo> → <Tipo>
```

- Cada clique numa fatia do donut ou item da lista lateral desce um nível
  (`handleDrillDown`); um breadcrumb no cabeçalho permite voltar a qualquer nível
  (`handleDrillUp`) — [DrillChart.jsx:76-103](../frontend/src/components/ui/DrillChart.jsx).
- Cada nível soma `sumNode(node, transactions, visMonths, year)` — soma bruta em R$,
  sem nenhum percentual sobre receita, só o percentual **relativo ao total daquele
  nível** (`item.value / total`), mostrado como barra de progresso ao lado do valor
  ([DrillChart.jsx:192](../frontend/src/components/ui/DrillChart.jsx)).
- Tem um `ChartFilterPicker` próprio (período independente do filtro global) — igual
  aos demais gráficos de Caixa ([Caixa.jsx:666-676](../frontend/src/pages/Caixa.jsx),
  via `drillCF = useChartFilter(tx, filterState)`).
- Não existe nenhuma visão de evolução mensal (série temporal) — é sempre um total
  agregado do período inteiro, em qualquer nível da árvore.

**Por que isso não atende ao pedido:** o cliente quer, para um Grupo específico
selecionado, (1) a evolução mês a mês em R$ e em % da receita, e (2) a composição
daquele Grupo por Tipo — duas visões simultâneas, lado a lado, não uma navegação
sequencial fatia-por-fatia sem contexto temporal.

---

## O que o print pede — três painéis

**Título:** "Gráfico composição das saídas". **OBS do cliente:** seguir o filtro de
datas ativo; os percentuais devem ser sobre o faturamento/receita (não sobre o total
do próprio gráfico, como hoje); adicionar % também no gráfico de categoria (o painel
inferior).

### 1. Lista de Grupos (painel esquerdo)

Lista simples, um clique seleciona um Grupo por vez (ex. "Custo Fornecedor" destacado
em azul no print). No print a lista é **plana** — mistura grupos de Custo, Despesa
Operacional e Despesa Não Operacional numa lista só, em vez da árvore atual que separa
primeiro por "Gastos Operacionais / Não Operacionais": `Custo Fornecedor, Custo
Operacional, Despesa financeira, Despesa Marketing/Comercial, Despesa Operacional,
Despesas Administrativas, Despesas com Estrutura, Despesas com pessoal, Despesas com
Terceiros, Impostos, Investimentos, Passivo`.

Isso bate exatamente com o campo `grp` do plano de contas — **um Grupo só existe em um
nível financeiro por vez** neste sistema (a hierarquia é `nivel → cat → grp → tipo`),
então "achatar" a árvore direto no nível de Grupo é só pular a etapa intermediária de
Categoria, sem ambiguidade.

### 2. Evolução mensal do Grupo selecionado (painel superior direito)

Gráfico combinado — barra (Valor R$) + linha (%) —, um ponto por mês do período
filtrado:
```
Valor[m] = sumNode(grupoSelecionado, transactions, [m], year)
%[m]     = Valor[m] ÷ receita[m] × 100
```
No print: 5 meses (Fev–Jun/26), barras em R$ com rótulo, linha laranja de % por cima.
Mesmo padrão visual (`ComposedChart`, barra + linha) já usado em outros gráficos do
dashboard (ex. Ciclo Financeiro).

### 3. Composição do Grupo por Tipo (painel inferior direito)

Barras, uma por Tipo dentro do Grupo selecionado, valor somado do período filtrado
inteiro (não por mês) — ex. para "Custo Fornecedor": "COMPRAS DE MERCADORIA PARA
VENDA", "MATÉRIA-PRIMA", "MERCADORIA PARA REVENDA" etc., ordenadas do maior para o
menor valor.
```
Valor[tipo] = sumNode(nóDoTipo, transactions, visMonths, year)
```
A OBS do cliente pede para **adicionar %** aqui também — hoje o print só mostra R$;
proposta: mesma base (receita do período), `%[tipo] = Valor[tipo] ÷ Σreceita(período) × 100`,
exibido junto ao rótulo de cada barra (mesmo tratamento do painel 2).

No print aparecem vários Tipos com valor **zero** ao final da lista (a planilha lista
todos os tipos cadastrados, mesmo sem movimento no período) — o padrão atual do
`DrillChart` filtra valores zerados (`item.value > 0`,
[DrillChart.jsx:32](../frontend/src/components/ui/DrillChart.jsx)); recomendo manter
esse filtro (barras vazias não agregam informação) em vez de replicar literalmente o
comportamento da planilha.

---

## Pendências a confirmar antes de implementar

1. **Base do "% sobre a receita/faturamento":** o cliente diz "faturamento/receita",
   que soa como Receita Bruta (`mRec`/`mRecOp` — antes de Deduções de Receita), não
   Receita Líquida. Isso é uma escolha **diferente** da que fizemos para o resto do
   demonstrativo depois do pedido de Deduções de Receita (onde toda % passou a ser
   sobre Receita Líquida, ver `specs/spec-melhorias-deducoes-receita.md`). Proposta:
   usar Receita Bruta (`mRec`, soma de todas as Entradas) aqui especificamente, por
   ser a leitura mais direta de "faturamento" — mas vale confirmar com o cliente, já
   que ele não tinha o conceito de Deduções de Receita quando desenhou essa planilha.
2. **Grupos do nível "Dedução de Receita" entram na lista?** Tecnicamente são
   `mov: 'Saída'` como qualquer Custo/Despesa, mas conceitualmente abatem a receita,
   não são "saída operacional". Proposta: **não incluir** — a lista fica restrita aos
   níveis que já formavam a árvore de Saídas antes desse pedido (Custo, Despesa
   Operacional, Despesa Não Operacional), mantendo "Composição das Saídas" com o
   mesmo escopo de sempre.
3. **O painel de evolução mensal (2) preserva o `ChartFilterPicker` próprio** (período
   independente do filtro global), como o gráfico atual já tem? O print não mostra
   esse controle, mas ele já existe hoje e nenhum outro gráfico do dashboard perdeu
   essa capacidade — proposta: manter.
4. **Primeiro Grupo selecionado por padrão:** ao carregar a tela, qual Grupo vem
   selecionado? Proposta: o de maior valor no período (mesma ordenação usada hoje pelo
   donut), evitando uma tela vazia até o primeiro clique.

---

## Resumo do que precisa mudar

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/ui/DrillChart.jsx` | Reescrever: lista de Grupos (achatada) + gráfico combinado mensal (R$ + %) + gráfico de Tipos do grupo selecionado (R$ + %), no lugar do donut com navegação em profundidade |
| `frontend/src/hooks/useDrillDown.js` | Não é mais necessário para este componente (a nova versão não navega em profundidade arbitrária, só Grupo → Tipo) — mas não mexer nele, pode estar em uso por outra tela no futuro |
| `frontend/src/pages/Caixa.jsx` | Ajustar só se a nova versão precisar de props adicionais (ex. dados de receita mensal) — o `ChartFilterPicker`/`drillCF` existentes continuam válidos |
| `specs/FUNCIONALIDADES.md` | Atualizar a secção 5.8 (DrillChart) depois de implementar |
