# Spec — Melhorias no Orçamento

Escopo: página `Orçamento` (`Orcamento.jsx`, aba "Metas" → `MetasTab.jsx`). Mesmo
formato do [spec-melhorias-demonstrativo.md](spec-melhorias-demonstrativo.md): cada
item traz o pedido, o estado atual do sistema (com referência a arquivo/linha) e a
proposta de implementação.

---

## 1º — Grupo não deve ter campo de valor aberto, só a soma das categorias

**Pedido do cliente:** a soma das categorias no orçamento já deve indicar o total no
grupo — não precisa ter um campo aberto para digitar valor diretamente no grupo.

**Estado atual: já implementado.**
Em `MetaCategoriaNode` ([MetasTab.jsx:144-235](../frontend/src/components/orcamento/MetasTab.jsx)),
qualquer nó com filhos (`hasChildren`, ou seja, Macro/Categoria/Grupo — todo nível
acima da folha "Categoria" do plano de contas) já não recebe input algum: em vez do
`MonthGrid` editável, ele renderiza apenas a legenda somada
([MetasTab.jsx:216-222](../frontend/src/components/orcamento/MetasTab.jsx)):
```jsx
{hasChildren ? (
  <div className="text-[10px] text-text-3 italic" ...>
    Soma dos itens abaixo: <span className="font-semibold not-italic text-text-2">{fmtBrl(totalNode)}</span>
  </div>
) : (
  // MonthGrid editável — só chega aqui quando !hasChildren (nó folha)
  ...
)}
```
O valor exibido no cabeçalho do nó (`totalNode`, linha 209) também já é a soma
recursiva (`computeNodeTotal`, [MetasTab.jsx:127](../frontend/src/components/orcamento/MetasTab.jsx)),
com o mesmo número aparecendo tanto no topo do card quanto na legenda "Soma dos itens
abaixo". Isso vale tanto para valor em R$ quanto para o modo "%" no caso de custo
direto.

**Conclusão:** nenhuma mudança de código necessária aqui — o comportamento pedido já
existe. Vale confirmar com o cliente (mostrando a tela) se talvez ele estivesse vendo
uma versão desatualizada, ou se o pedido é sobre outro lugar específico do orçamento
que não foi identificado nesta varredura (as únicas duas grades editáveis da aba Metas
são "Meta de Receita", que não é uma árvore — não se aplica — e "Metas por Categoria",
já coberta acima).

---

## 2º — Planilha base (Excel) para importação de dados do orçamento

**Pedido do cliente:** uma planilha modelo em Excel para importar valores de
orçamento em massa, mostrando a soma mensal em cada coluna (uma coluna por mês, com
totais).

**Estado atual: recurso inexistente.**
Hoje o orçamento só é preenchido manualmente, categoria por categoria, mês a mês, pela
grade `MonthGrid` em `MetasTab.jsx` — não existe nenhum fluxo de importar/exportar
arquivo para o orçamento. (Existe importação de **lançamentos** via Excel/CSV em
[Importar.jsx](../frontend/src/pages/Importar.jsx) → `POST /api/import`
([upload.js](../backend/src/routes/upload.js)), mas é um formato totalmente diferente —
uma linha por transação, não uma grade de categoria × mês — e não tem relação com
orçamento.)

O backend já expõe o necessário para salvar em lote:
`PUT /api/orcamento` ([routes/orcamento.js:15-31](../backend/src/routes/orcamento.js))
aceita um array `[{ ano, mes, tipo, referencia, valor }]` e faz upsert — é a mesma rota
que cada campo do `MonthGrid` já usa hoje ao salvar (`api.upsertOrcamento`,
[api/index.js:104](../frontend/src/api/index.js)). Ou seja, **não é necessária nenhuma
rota nova no backend** — só falta a camada de planilha (gerar modelo → usuário
preenche → ler o Excel de volta → converter para o array acima → chamar a rota que já
existe).

A biblioteca `xlsx` já está instalada tanto no backend quanto no
[frontend/package.json](../frontend/package.json) (usada hoje só no backend, em
`upload.js`, para ler os arquivos de lançamentos) — pode ser usada no frontend também,
para gerar e ler a planilha inteiramente no navegador, sem precisar de rota nova.

**Proposta:**
- Nova ação em `MetasTab.jsx` (ou num painel dedicado dentro da aba "Metas"): "Baixar
  planilha base" — gera um `.xlsx` client-side com `xlsx` (`XLSX.utils.aoa_to_sheet` /
  `XLSX.writeFile`), uma linha por categoria-folha do plano de contas (mesmas folhas
  de `leafNodeIds`, [MetasTab.jsx:388-392](../frontend/src/components/orcamento/MetasTab.jsx)),
  colunas: Categoria (Tipo) · Grupo · Categoria (Cat) · Jan · Fev · ... · Dez · Total.
  - A coluna "Total" (e, se fizer sentido, uma linha final "Total geral") deve conter
    fórmula de soma (`=SUM(...)`) em vez de um número estático, para já mostrar a soma
    mensal enquanto o cliente preenche — é o "aqui devem aparecer a soma mensal em cada
    coluna" do pedido.
  - Pré-preencher com os valores já salvos do ano corrente (mesmos dados que
    `orcMap.metaCat`/`metaCatMonthly` já têm em memória), para a planilha servir tanto
    de modelo em branco quanto de exportação do que já existe.
- Nova ação "Importar planilha": abre um `<input type="file">`, lê o `.xlsx` com
  `XLSX.read`, para cada linha resolve a categoria-folha correspondente (casando
  Categoria+Grupo+Tipo contra a árvore do plano — mesma lógica de resolução que
  `leafNodeIds` já usa, não pedir para o usuário digitar um id manualmente), monta o
  array `{ ano, mes, tipo: 'meta_cat', referencia: node.id, valor }` por mês
  preenchido, e chama `api.upsertOrcamento(entries)` uma vez para todo o lote.
  - Linhas cuja Categoria+Grupo+Tipo não bater com nenhuma folha do plano devem ser
    reportadas ao usuário (ex. num modal de resumo antes de confirmar a importação),
    em vez de silenciosamente ignoradas ou de criar uma categoria nova.
- Reaproveitar os componentes de UI já existentes em `Importar.jsx`
  (`upload-zone`, notificação de sucesso/erro) para manter a mesma experiência visual
  do import de lançamentos.

---

## 3º — Cálculo automático do Ponto de Equilíbrio

**Pedido do cliente:** o ponto de equilíbrio do orçamento deve ser calculado
automaticamente pela regra `Soma(valores absolutos) / (1 - (%))`.

**Estado atual: valor morto, nunca calculado nem preenchível pela UI.**
`orcMap.breakeven` é lido de uma entrada de orçamento com `tipo === 'breakeven'`
([Orcamento.jsx:90](../frontend/src/pages/Orcamento.jsx) e
[Orcamento.jsx:95](../frontend/src/pages/Orcamento.jsx)), convertido para milhares em
[Orcamento.jsx:274](../frontend/src/pages/Orcamento.jsx)
(`const breakeven = orcMap.breakeven > 0 ? +(orcMap.breakeven / 1000).toFixed(1) : null;`)
e usado só como uma `<ReferenceLine>` no gráfico "Receita Bruta — Realizado vs Orçado"
([Orcamento.jsx:639](../frontend/src/pages/Orcamento.jsx) e
[Orcamento.jsx:655](../frontend/src/pages/Orcamento.jsx)). **Não existe, em nenhum
lugar do frontend, um campo ou botão que grave uma entrada `tipo: 'breakeven'`** — ou
seja, hoje essa linha do gráfico nunca aparece na prática (não há como o cliente
preencher esse valor), independentemente do que a fórmula devesse ser.

**Interpretação da fórmula proposta pelo cliente** (`Soma(valores absolutos) /
(1 - %)`) — é a fórmula clássica de ponto de equilíbrio em receita:
```
PE = Custos Fixos / (1 − (Custos Variáveis / Receita))
```
Mapeando para as categorias já existentes no plano de contas / orçamento deste
sistema:
- **Custos Variáveis (a "%")** → Custos Diretos (`custoMeta`/`custoReal` em
  [Orcamento.jsx:364-366](../frontend/src/pages/Orcamento.jsx)), como % da Receita
  Orçada do período.
- **Custos Fixos (a "Soma dos valores absolutos")** → Despesas Operacionais +
  Despesas Não Operacionais (`despOpMeta`/`nopMeta`, já calculados em `kpiCards`
  [Orcamento.jsx:304](../frontend/src/pages/Orcamento.jsx) e
  [Orcamento.jsx:313](../frontend/src/pages/Orcamento.jsx)).
- **"Valores absolutos"** provavelmente só reforça que custos/despesas — armazenados
  como valores positivos de saída (`mov: 'Saída'`) — devem entrar somados sem sinal,
  o que já é como esses agregados são calculados hoje.

**Pendência a confirmar com o cliente antes de codar** (a spec documenta a leitura
mais provável, mas a fórmula tem mais de uma leitura possível):
1. O "%" é Custos Diretos / Receita (contribuição variável), como assumido acima —
   ou é outro percentual (ex. Custos Diretos + parte variável das Despesas
   Operacionais)?
2. O cálculo deve usar valores **orçados** (meta) ou **realizados** (real) — ou os
   dois, um PE "planejado" e um PE "realizado"? Dado que fica na aba Orçamento, o mais
   natural é orçado.
3. Anual (soma dos 12 meses) ou por período selecionado (`visMonths`, igual ao resto
   da página, ver `periodoLabel`
   [Orcamento.jsx:176-184](../frontend/src/pages/Orcamento.jsx))?

**Proposta de implementação** (assumindo a leitura acima, período = `visMonths`,
valores orçados):
```js
const custosFixosMeta = despOpMetaPeriodo + nopMetaPeriodo; // soma dos valores absolutos
const pctCustoVariavel = receitaOrcadaPeriodo > 0 ? custoMetaPeriodo / receitaOrcadaPeriodo : 0;
const breakeven = pctCustoVariavel < 1 ? custosFixosMeta / (1 - pctCustoVariavel) : null;
```
- Substituir a leitura de `orcMap.breakeven` (linha 274) por esse cálculo derivado —
  remove a necessidade de qualquer UI para digitar o breakeven manualmente, já que ele
  passa a ser 100% derivado do que o cliente já preenche em "Metas por Categoria" e
  "Meta de Receita".
- Manter o uso na `<ReferenceLine>` já existente no gráfico (linhas 639/655), e
  considerar também exibir o valor como um KPI card dedicado (ex. ao lado dos cards em
  `kpiCards`, [Orcamento.jsx:573-575](../frontend/src/pages/Orcamento.jsx)) — hoje
  ninguém vê esse número em lugar nenhum além da linha pontilhada do gráfico.
- Proteger contra `pctCustoVariavel >= 1` (custo variável maior ou igual à receita —
  margem de contribuição zero ou negativa): a fórmula diverge/inverte sinal nesse
  caso, então o KPI deve mostrar algo como "não atingível" em vez de um número
  negativo ou `Infinity`.
