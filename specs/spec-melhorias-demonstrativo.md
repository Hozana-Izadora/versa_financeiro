# Spec — Melhorias no Demonstrativo Detalhado


Escopo: telas `Caixa` e `Competência`, componente `DreTable` (demonstrativo/DRE), e o
builder `dreBuilder.js` que o alimenta. Cada item abaixo traz o pedido do cliente, o
comportamento atual do sistema (com referência a arquivo/linha) e a proposta de
implementação, para permitir que qualquer sessão futura pegue este documento e
implemente sem precisar re-investigar o código.

---

## 1º — "Grupo" e "SubGrupo" em destaque (negrito)

**Pedido do cliente:** as linhas de "Grupo" e "SubGrupo" devem estar em negrito, para
melhorar a visualização da informação.

**Estado atual:**
Na hierarquia do demonstrativo (ver `buildDRE` em
[dreBuilder.js](../frontend/src/utils/dreBuilder.js)) existem 3 níveis de linha:
- `type: 'group'` → **Categoria** (ex.: "Receita Bruta", "Custos Diretos") — já em
  negrito via `.dr-group td { font-weight: 700; }`
  ([index.css:101](../frontend/src/index.css)).
- `type: 'subgroup'` → **Grupo** (ex.: "Despesa com pessoal") — usa a classe
  `.dr-item`, que **não** define `font-weight`, então renderiza em peso normal.
- `type: 'item'` → **Tipo** (folha, ex.: "Salários") — usa `.dr-item.dr-cat`, mas
  `.dr-cat td:first-child { font-weight: 600 }` só aplica negrito à **coluna de
  descrição**; as colunas de valores (meses/total) permanecem em peso normal.

Ver renderização em [DreTable.jsx:140-178](../frontend/src/components/dre/DreTable.jsx).

**Proposta:**
- Adicionar uma classe própria para a linha de Grupo (`subgroup`) — ex. `dr-subgroup`
  — com `font-weight: 600` em todas as células (label + valores).
- Estender `.dr-cat` (linha de Tipo) para aplicar negrito em todas as células, não só
  na primeira coluna.
- Manter a hierarquia visual: Categoria (700) > Grupo (600) 
- Retirar o negrito de tipo
---

## 3º — Parametrizar a visão do total acumulado (Bimestre/Trimestre/Quadrimestre/Semestre/Total)

**Pedido do cliente:** poder escolher a granularidade das colunas do demonstrativo —
hoje é sempre uma coluna por mês selecionado + uma coluna "Total"; o cliente quer poder
agrupar em Bimestre, Trimestre, Quadrimestre, Semestre ou Total (ano).

**Estado atual:**
`DreTable` recebe `dre.visMonths` (um mês por coluna, derivado do filtro global de
período) e sempre renderiza uma coluna por mês + uma coluna "Total"
([DreTable.jsx:98-105](../frontend/src/components/dre/DreTable.jsx)). Não existe hoje
nenhuma opção de agregação de colunas — a única forma de "ver menos colunas" é
restringir o filtro global de meses (`filterState.months`), o que muda os dados
mostrados, não apenas o agrupamento visual.

**Proposta:**
- Adicionar um seletor (ex.: segmented control, junto ao cabeçalho do
  `DreTable`/painel) com as opções: Mensal (atual) · Bimestral · Trimestral ·
  Quadrimestral · Semestral · Total.
- Implementar uma função de agregação de colunas que recebe `visMonths` +
  `monthValues` de cada linha e devolve buckets somados (ex.: Trimestral agrupa meses
  `[0,1,2]`, `[3,4,5]`, etc., respeitando apenas os meses presentes em `visMonths`
  quando o filtro global já restringe o período).
- O `Total` final não muda — só o número de colunas intermediárias.
- Cuidado: linhas de saldo acumulado (`saldo-acum`) não devem ser somadas dentro do
  bucket — o valor correto de um bucket é o do **último mês** do bucket (saldo é
  "foto", não "fluxo"). As demais linhas (`item`, `subgroup`, `group`, `subtotal`,
  `total`, `saldo`, `ll`) somam normalmente dentro do bucket.
- Sugestão de local para o estado: um `useState` local em `DreTable` (não precisa ir
  para o `AppContext`, é uma preferência de visualização, não um filtro de dados).

---

## 4º — Opção de recolher categorias em todos os níveis

**Pedido do cliente:** hoje só é possível recolher no nível de "Tipo"; o cliente quer
recolher em qualquer nível da hierarquia, dado o exemplo: Custo Direto > Custo
Fornecedor > Custo Operacional > Impostos.

**Estado atual:**
Hoje o collapse já funciona em dois níveis — Categoria (`group`, por `gid`) e Grupo
(`subgroup`, por `sid`) — via `allCollapsibleIds`, `collapsed` (Set) e a função
`toggle(id)` em
[DreTable.jsx:36-62](../frontend/src/components/dre/DreTable.jsx). O nível de Tipo
(`item`) é sempre uma folha e não tem filhos, então não há o que recolher nele —
provavelmente a percepção do cliente ("hoje só recolhe o tipo") é sobre uma versão
anterior ou sobre outro relatório de referência.

**Proposta:**
- Confirmar com o cliente, mostrando o comportamento atual (expandir/recolher em
  Categoria e Grupo já funciona, clicando na linha ou nos botões "Expandir tudo" /
  "Recolher tudo" no topo da tabela), antes de codar algo novo — pode já atender o
  pedido.
- Se o pedido for por um nível adicional de agrupamento no plano de contas (ex.: um
  nível extra entre Grupo e Tipo, como no exemplo "Custo Fornecedor > Custo
  Operacional"), isso exigiria alterar o modelo do plano de contas
  (`backend/src/routes/plano.js`, atualmente `nivel > cat > grp > tipo`, 3 níveis) —
  mudança estrutural maior, deve ser tratada como item separado após validar a real
  necessidade.

---

## 5º — Ampliar o demonstrativo (como os gráficos do dashboard)

**Pedido do cliente:** poder ampliar/expandir o demonstrativo detalhado, do mesmo jeito
que já é possível ampliar os gráficos do dashboard.

**Estado atual:**
Todos os painéis de gráfico em `Caixa.jsx` e `Competencia.jsx` têm um link "⤢ ampliar"
que abre o gráfico em tela cheia dentro do modal global via
`actions.openModal(titulo, conteudo)` — ex.
[Caixa.jsx:545](../frontend/src/pages/Caixa.jsx):
```jsx
<span className="text-[9.5px] text-text-3 cursor-pointer" onClick={() => openModal('Evolução da Receita Bruta — Caixa', renderRec('100%'))}>⤢ ampliar</span>
```
O `DreTable` (demonstrativo) não tem esse botão — hoje ele já ocupa a largura do card
e tem um scroll vertical interno limitado a `70vh`
([DreTable.jsx:98](../frontend/src/components/dre/DreTable.jsx)), mas não abre em
modal/tela cheia.

**Proposta:**
- Adicionar o mesmo link "⤢ ampliar" no cabeçalho do painel que envolve o `DreTable`
  em `Caixa.jsx` e `Competencia.jsx`, chamando
  `openModal('Demonstrativo — Caixa'|'Demonstrativo — Competência', <DreTable ... />)`.
  O modal já existe globalmente (`App.jsx`), só precisa reaproveitar o padrão.
- Dentro do modal, aumentar o `maxHeight` do scroll interno (hoje fixo em `70vh`) para
  aproveitar melhor a tela ampliada.

---

## 6º — Drill-down do demonstrativo para os lançamentos filtrados

**Pedido do cliente:** ao clicar no detalhe de uma categoria do demonstrativo, ir para
o detalhamento de lançamentos já filtrado. Alternativa também aceitável: abrir o caixa
(lançamentos) com as informações filtradas.

**Estado atual: já implementado.**
- `DreTable` recebe `onDrillItem`/`onDrillGroup` e dispara ao clicar numa linha de
  Grupo (`subgroup`) ou Tipo (`item`)
  ([DreTable.jsx:144](../frontend/src/components/dre/DreTable.jsx) e
  [DreTable.jsx:171](../frontend/src/components/dre/DreTable.jsx)), passando
  `{ cat, grp, tipo, mov, regime }`.
- `Caixa.jsx` e `Competencia.jsx` ligam ambos os callbacks a `actions.goToLancamentos`.
- `AppContext.jsx` guarda o filtro em `pendingLancamentosFilter` e navega para a
  página de Lançamentos (`SET_LANCAMENTOS_FILTER` + `SET_PAGE`).
- `Lancamentos.jsx` consome esse filtro pendente num `useEffect`, preenche
  `filterCat`/`filterGrp`/`filterTipo`/`filterMov`/`filterRegime` e abre o painel de
  filtros.

**Pendência (parte "ou abrir caixa"):** hoje o drill-down sempre **navega** para a
página de Lançamentos, trocando o que está em tela. Se o cliente quiser também a opção
de abrir os lançamentos filtrados **sem sair da tela atual** (ex. num modal, como já
existe para gráficos ampliados), isso é um adicional aberto — vale confirmar com o
cliente se a navegação atual já resolve, antes de investir num modal alternativo.

**Observação:** Só redirecionar para detalhamento com clique duplo, clique simples apenas expandirá ou recolherá

---

## 7º — % do saldo do período não aparece

**Pedido do cliente:** o percentual (em relação à receita) não está aparecendo na
linha de Saldo do Período.

**Estado atual: bug confirmado.**
Nas linhas `total` e `ll` (Margem Bruta, Margem Operacional, Lucro Líquido), a célula
renderiza o valor e, condicionalmente, um `<span className="cv-pct">` com o percentual
sobre a receita operacional (`row.showPct && showPct && ...`). As linhas `saldo` e
`saldo-acum`, porém, nunca recebem esse span — o JSX delas
([DreTable.jsx:226-248](../frontend/src/components/dre/DreTable.jsx), após as
correções de cor desta sessão) renderiza só `{fmtSigned(v)}`, sem nenhum bloco de
percentual, e o objeto da linha (`dreBuilder.js:352-354`) nem carrega `refValues`/
`totRef`/`showPct` para essas duas linhas.

**Proposta:**
- Em `dreBuilder.js`, ao criar as linhas `saldo` e `saldo-acum`
  ([dreBuilder.js:352](../frontend/src/utils/dreBuilder.js) e
  [dreBuilder.js:354](../frontend/src/utils/dreBuilder.js)), adicionar
  `showPct: true, refValues: mRecOp, totRef: totRecOp` (mesmo padrão usado nas linhas
  `total`/`ll`, para manter "% da Receita Operacional" como referência consistente em
  todo o demonstrativo).
- Em `DreTable.jsx`, adicionar o mesmo bloco `{row.showPct && showPct && refV > 0 &&
  <span className="cv-pct">...}` nas linhas `saldo` e `saldo-acum`, por mês e no
  total.
