# Spec — Deduções de Receita no Plano de Contas e no Demonstrativo

Escopo: `frontend/src/pages/Plano.jsx` (cadastro do plano de contas),
`frontend/src/utils/dreBuilder.js` (motor de cálculo do DRE) e as telas `Caixa`/
`Competencia` (cascade waterfall). Mesmo formato dos demais specs: pedido → estado
atual (com arquivo/linha) → proposta.

## Pedido do cliente (literal)

> "Incluir no plano de contas o Tipo 'Deduções de receita'. Esse campo precisa estar no dashboard, entre faturamento e custo."

**Nota de terminologia:** apesar do cliente falar em "Tipo", o que está sendo pedido é
uma nova classificação de **nível financeiro** (o campo `nivel`, nível 1 da hierarquia
— ver `specs/FUNCIONALIDADES.md` secção 3), não um `tipo` (nível 4, uma folha dentro
de um nível já existente). Isso porque o pedido é para aparecer como **uma linha
própria no demonstrativo**, entre Receita Bruta e Custos — o mesmo tratamento que
"Custo" ou "Despesa Operacional" já recebem —, e isso só é possível hoje quando algo é
um `nivel`, não um `tipo` dentro de um nivel existente. Dentro desse novo nível, o
cliente poderá cadastrar quantos `tipo`s quiser (ex.: "Impostos sobre Vendas",
"Devoluções", "Descontos Incondicionais"), do mesmo jeito que já faz hoje para Custo
ou Despesa Operacional.

---

## Estado atual

O sistema tem **5 níveis financeiros fixos**, hoje codificados em três lugares
diferentes que precisariam ser tocados para adicionar um sexto:

### 1. `Plano.jsx` — cadastro (dropdown de nível ao criar/editar um Tipo)

```js
// Plano.jsx:8-14
const NIVEL_CONFIG = {
  'Receita':                 { group: 'Entradas', ... },
  'Entrada Não Operacional': { group: 'Entradas', ... },
  'Custo':                   { group: 'Gasto Operacional', ... },
  'Despesa Operacional':     { group: 'Gasto Operacional', ... },
  'Despesa Não Operacional': { group: 'Gasto Não Operacional', ... },
};

// Plano.jsx:16-35
const NIVEL_GROUPS = [
  { label: 'Gasto Operacional',     niveis: ['Custo', 'Despesa Operacional'] },
  { label: 'Gasto Não Operacional', niveis: ['Despesa Não Operacional'] },
  { label: 'Entradas',              niveis: ['Receita', 'Entrada Não Operacional'] },
];
```
Sem um nível novo registrado aqui, não existe como cadastrar um Tipo com essa
classificação pela interface.

### 2. `dreBuilder.js` — classificação e fórmulas

```js
// dreBuilder.js:69-73 — um array de categorias por nível
const entradaCats = [...new Set(plano.filter(p => p.nivel === 'Receita')...)];
const custoCats   = [...new Set(plano.filter(p => p.nivel === 'Custo')...)];
// ... idem para despOp / despNop / entNop

// dreBuilder.js:109 — Receita Operacional exclui só as entradas não-operacionais
const mRecOp = visMonths.map((_, i) => mRec[i] - mEntNop[i]);

// dreBuilder.js:123 — Margem Bruta parte direto da Receita Operacional
const mMgB  = visMonths.map((_, i) => mRecOp[i] - mCost[i]);

// dreBuilder.js:263-264 — secção "RECEITA BRUTA" do demonstrativo
if (entradaCats.length) addSection(entradaLabel);
buildSection(entradaCats, 'Entrada', 'Receita');

// dreBuilder.js:304-305 — logo em seguida, já entra "CUSTOS DIRETOS"
if (custoCats.length) addSection(custoLabel);
buildSection(custoCats, 'Saída', 'Custo');
```
Hoje não existe nenhum valor entre essas duas secções — Receita Bruta é seguida
diretamente por Custos Diretos, sem um conceito de "Receita Líquida".

Além disso, `refValues`/`totRef` (a base do "% da receita" mostrado em toda linha do
demonstrativo — Custos, Despesas, Margem Bruta, Margem Operacional, Saldo, etc.) é
`mRecOp`/`totRecOp` em todo o arquivo — a Receita Operacional é a referência de 100%
usada hoje.

### 3. Cascade waterfall (Caixa/Competência) e árvore de Metas/Drill-down

O cascade de KPIs no topo de Caixa/Competência (`CNode`s encadeados por `CSep`) é uma
sequência fixa de cards escritos diretamente no JSX de cada página — não deriva do
`nivel` dinamicamente. A árvore usada em "Metas por Categoria" (Orçamento) e no
DrillChart (`drillHierarchy.js` → `buildDrillTree`) também só conhece hoje os níveis
`Custo`, `Despesa Operacional` e `Despesa Não Operacional` (agrupados em
`gastos-op`/`gastos-nop`) — um nível novo não apareceria automaticamente em nenhum dos
dois sem alteração explícita.

---

## Proposta

### 1. Novo nível: `Dedução de Receita`

- **Convenção de sinal:** igual a Custo/Despesa — lançamentos desse nível são
  `mov: 'Saída'` (reduzem o resultado), mesmo sendo tecnicamente um abatimento sobre a
  receita, não uma despesa. Isso mantém a mesma convenção do resto do sistema (`valor`
  sempre positivo, sinal dado por `mov`) e evita um caso especial no motor de cálculo.
- **`Plano.jsx`:** adicionar `'Dedução de Receita'` a `NIVEL_CONFIG` (cor própria —
  sugestão: um tom de laranja/âmbar mais claro que o de Custo, para diferenciar
  visualmente mas manter a família de "sai da receita") e a `NIVEL_GROUPS` — como um
  grupo próprio ("Deduções de Receita") ou dentro de "Entradas" (já que conceitualmente
  fica colado à receita). Recomendo grupo próprio, para não confundir com Receita/
  Entrada Não Operacional na tela de cadastro.

### 2. `dreBuilder.js` — nova secção e Receita Líquida

```js
const deducaoCats  = [...new Set(plano.filter(p => p.nivel === 'Dedução de Receita').map(p => p.cat))];
const deducaoLabel = sectionLabel(deducaoCats, 'DEDUÇÕES DE RECEITA');

const mDeducao = visMonths.map(m => catTotal(deducaoCats, 'Saída', m, 'Dedução de Receita'));

// Receita Líquida = Receita Operacional − Deduções
const mRecLiq = visMonths.map((_, i) => mRecOp[i] - mDeducao[i]);

// Margem Bruta passa a partir da Receita Líquida, não mais direto da Operacional
const mMgB = visMonths.map((_, i) => mRecLiq[i] - mCost[i]);
```

No array de `rows`, entre a secção de Receita Bruta (linha 263-264) e a de Custos
Diretos (linha 304-305):
```js
if (deducaoCats.length) addSection(deducaoLabel);
buildSection(deducaoCats, 'Saída', 'Dedução de Receita');
if (deducaoCats.length) {
  rows.push({ type: 'subtotal', label: '= RECEITA LÍQUIDA', monthValues: mRecLiq, total: totRecLiq, isPos: true, refValues: mRecOp, totRef: totRecOp });
}
```
A linha "= RECEITA LÍQUIDA" só aparece quando existir ao menos um Tipo cadastrado
nesse nível — clientes que não usam Deduções de Receita não veem nenhuma mudança no
demonstrativo.

**Pendência a confirmar com o cliente antes de codar:** hoje toda % exibida no
demonstrativo (Custos, Despesas, Margem Bruta, Margem Operacional, Saldo — inclusive o
Ponto de Equilíbrio do Orçamento, ver `specs/spec-melhorias-orcamento.md`) usa
`mRecOp`/`totRecOp` (Receita Bruta Operacional) como referência de 100%. Com Deduções
de Receita existindo, há duas leituras válidas:
1. **Manter a Receita Bruta Operacional como base de 100%** (mudança mínima — só
   adiciona a linha e recalcula a Margem Bruta em R$, sem tocar nas %).
2. **Trocar a base para Receita Líquida** (prática contábil mais comum quando existem
   deduções — todo % passa a ser "% da Receita Líquida"), o que muda visualmente todos
   os percentuais já exibidos hoje, mesmo para quem não usa Deduções de Receita, já
   que quando `mDeducao = 0`, `mRecLiq = mRecOp` e nada muda na prática — mas é uma
   mudança de definição que vale confirmar antes de implementar.

Recomendo a opção 2 (é o padrão contábil, e é inofensiva para quem não usar o nível
novo), mas como muda o significado de números já em uso, deve ser validada com o
cliente antes de implementar.

### 3. Cascade waterfall (Caixa/Competência)

Adicionar um novo `CNode` + `CSep` entre o card de Receita e o de Custos Diretos,
seguindo o mesmo padrão condicional da secção do demonstrativo (só aparece se houver
Tipo cadastrado no nível), ex.:
```jsx
<CNode label="Receita Operacional" value={fmtK(dre.totRecOp)} ... />
{dre.totDeducao > 0 && <>
  <CSep symbol="−" />
  <CNode label="Deduções de Receita" value={fmtK(dre.totDeducao)} ... color="#f59e0b" />
  <CSep symbol="=" />
  <CNode result label="Receita Líquida" value={fmtK(dre.totRecLiq)} ... />
</>}
<CSep symbol="−" />
<CNode label="Custos Diretos" value={fmtK(dre.totCost)} ... />
```
(`buildDRE` precisa expor `totDeducao`/`totRecLiq` no objeto retornado, análogo aos
demais totais.)

### 4. Metas por Categoria / DrillChart (Orçamento)

`drillHierarchy.js`'s `EXPENSE_NIVEL_GROUPS` (hoje só `gastos-op` e `gastos-nop`)
precisaria de um terceiro grupo para "Dedução de Receita", para que o cliente também
consiga orçar uma meta mensal de deduções em "Metas por Categoria" e ver o real vs.
orçado no DrillChart — do contrário, transações desse novo nível ficariam sem
representação em nenhuma das telas de Orçamento. Se o cliente não usa Orçamento para
deduções, isso pode ficar como um item separado, de menor prioridade que 1–3.

---

## Resumo do que precisa mudar

| Arquivo | Mudança |
|---|---|
| `frontend/src/pages/Plano.jsx` | Registrar `'Dedução de Receita'` em `NIVEL_CONFIG`/`NIVEL_GROUPS` |
| `frontend/src/utils/dreBuilder.js` | `deducaoCats`, `mDeducao`, `mRecLiq`, nova secção + linha "= RECEITA LÍQUIDA", `mMgB` passa a partir de `mRecLiq`, decidir a base do "% da receita" |
| `frontend/src/pages/Caixa.jsx` / `Competencia.jsx` | Novo card no cascade waterfall entre Receita e Custos |
| `frontend/src/utils/drillHierarchy.js` | (opcional/2ª fase) novo grupo para aparecer em Metas por Categoria e no DrillChart |
| `specs/FUNCIONALIDADES.md` | Atualizar secções 3 (níveis), 5/6 (cascade) e 9 (buildDRE) após implementar |
