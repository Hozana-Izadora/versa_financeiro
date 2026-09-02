# Spec — Ajustes no Saldo Mensal e Acumulado

Escopo: tela `Importar → Saldos Iniciais` (CRUD de Abertura/Ajuste Mensal) e o cálculo
de saldo em [dreBuilder.js](../frontend/src/utils/dreBuilder.js), usado pela tela
`Caixa` (linhas "Saldo do Período"/"Saldo Acumulado" do demonstrativo e o gráfico
"Saldo Acumulado"). Mesmo formato dos specs anteriores: pedido → estado atual (com
arquivo/linha) → proposta.

**Nota de contexto:** este mecanismo de "herdar o saldo do ano anterior" já tinha
sido implementado antes deste pedido — ver os comentários "FIX 1", "FIX 2" e
"Saldo de abertura do ano, com acumulado passando de um ano para o outro" em
[dreBuilder.js:130-173](../frontend/src/utils/dreBuilder.js). O cliente reporta que,
mesmo assim, continua não funcionando na prática. Esta spec identifica dois bugs
concretos que **isoladamente já explicam** o comportamento relatado, mesmo com a
fórmula de herança em si estando correta.

---

## Pedidos do cliente (literal)

1. "Ajuste de saldos mensal não funcionam."
2. "Os saldos acumulados não somam acumulado pro ano seguinte."
3. "O saldo que sobra de um ano deve entrar no próximo."

(2 e 3 são a mesma capacidade pedida de duas formas — o saldo final de um ano deve
virar o saldo de abertura do ano seguinte.)

---

## Bug 1 — "Ajuste Mensal" nunca aparece na linha de Saldo do Período

**Sintoma que bate com o pedido 1:** o usuário cadastra um "Ajuste Mensal" em
`Importar → Saldos Iniciais` (ex.: uma correção de R$ 500 em Março/2026), salva com
sucesso (a tela de CRUD e o histórico de auditoria funcionam normalmente — ver
[Importar.jsx:158-173](../frontend/src/pages/Importar.jsx)), mas ao olhar a linha
**"SALDO DO PERÍODO"** do demonstrativo em Caixa, o valor de Março não muda em nada.

**Causa raiz:** `mSaldo` — a linha "SALDO DO PERÍODO" (fluxo líquido do mês) — é
calculada em
[dreBuilder.js:128](../frontend/src/utils/dreBuilder.js)
```js
const mSaldo = visMonths.map((_, i) => mRec[i] - mAllSaidas[i]);
```
puramente a partir de lançamentos (Entradas − Saídas). **O ajuste mensal nunca entra
nessa conta.** Ele só é somado à linha seguinte, **"SALDO ACUMULADO"**
([dreBuilder.js:170-173](../frontend/src/utils/dreBuilder.js)):
```js
const mAcum = visMonths.map((m, i) => {
  saldoAcum += mSaldo[i] + ajusteMensal(year, m);
  return saldoAcum;
});
```
Ou seja: o ajuste existe e é lido (`ajusteMensal()`,
[dreBuilder.js:142-145](../frontend/src/utils/dreBuilder.js)), mas seu único efeito
visível é um salto na linha acumulada — nenhuma linha mostra "este mês teve um ajuste
de R$ X", o que faz parecer que o ajuste "não funciona" quando na verdade ele só está
invisível onde o usuário está olhando.

**Proposta:**
- Somar `ajusteMensal(year, m)` também em `mSaldo`, para que "Saldo do Período" reflita
  o ajuste no mês em que ele foi lançado — ou, alternativa mais transparente: manter
  `mSaldo` só como fluxo de caixa puro, mas adicionar uma linha própria no
  demonstrativo tipo "Ajustes Manuais" (visível, com valor por mês) antes de "Saldo
  Acumulado", para que o valor apareça explicitamente em vez de ficar escondido dentro
  do acumulado. A segunda opção é mais rastreável (o usuário vê exatamente o que foi
  ajustado e quando) e evita reabrir a discussão de "o que conta como saldo do
  período" — recomendada.

---

## Bug 2 — Saldo Acumulado ignora lançamentos de meses fora do filtro de período ativo

**Sintoma que bate com os pedidos 2 e 3:** com um filtro de período parcial ativo (ex.:
"só Setembro", ou qualquer seleção que não comece em Janeiro), o Saldo Acumulado some
resultado errado — inclusive de um ano para o outro, se o usuário estiver com esse
tipo de filtro ativo ao conferir.

**Causa raiz:** para calcular o acumulado até o primeiro mês visível, `buildDRE` tenta
"recuperar" os meses anteriores ao filtro somando `byMov`
([dreBuilder.js:165-169](../frontend/src/utils/dreBuilder.js)):
```js
let saldoAcum = saldoAbertura(year);
for (let m = 0; m < (visMonths[0] ?? 0); m++) {
  saldoAcum += (byMov.get(`${m}|Entrada`) ?? 0) - (byMov.get(`${m}|Saída`) ?? 0);
  saldoAcum += ajusteMensal(year, m);
}
```
O problema: `byMov` é construído a partir do parâmetro `tx` de `buildDRE` — e esse
`tx` é o **`filteredTx`** que a página chamadora já filtrou pelo período selecionado
(`filterState.months`), então **não contém lançamentos dos meses fora do filtro**. O
loop acima roda para `m` de 0 até o primeiro mês visível, mas como esses meses foram
excluídos de `tx` antes mesmo de chegar em `buildDRE`, `byMov.get(...)` sempre retorna
`undefined ?? 0` para eles — só o `ajusteMensal` (que lê direto de `saldosIniciais`,
independente do filtro) é somado corretamente; o **movimento real de caixa desses
meses é descartado**. Isso é visível em
[Caixa.jsx:140-145](../frontend/src/pages/Caixa.jsx) (onde `filteredTx` é montado só
com os meses do filtro) e
[Caixa.jsx:153-155](../frontend/src/pages/Caixa.jsx) (onde `filteredTx`, já reduzido,
é o `tx` passado para `buildDRE`).

Isso não quebra a herança do saldo de abertura em si — `saldoAbertura(year)`
([dreBuilder.js:158-163](../frontend/src/utils/dreBuilder.js)) usa `historyTx`
(`allTx`, o histórico completo sem filtro de mês, corretamente passado pela página em
[Caixa.jsx:154](../frontend/src/pages/Caixa.jsx) e nos demais 4 pontos onde
`buildDRE(..., tx)` é chamado com o 7º argumento) — mas **qualquer acumulado exibido
sob um filtro de período parcial fica sistematicamente errado** a partir do momento em
que existem meses pulados dentro do próprio ano, o que é exatamente o tipo de conta
que o usuário faz ao comparar "quanto sobrou no fim do ano passado vs. quanto começou
esse ano" se estiver com um filtro de mês específico ativo (em vez de "Ano todo").

**Proposta:**
- Em `buildDRE`, o catch-up dos meses anteriores ao filtro não deve depender do `tx`
  já filtrado por mês — precisa somar as entradas/saídas reais desses meses a partir
  de uma fonte sem esse corte (ex.: `historyTx`, filtrando por `year` e `mes < visMonths[0]`,
  em vez de reconstruir do `byMov` derivado do `tx` filtrado).
- Adicionar um teste manual simples de aceite antes de fechar: cadastrar um "Ajuste
  Mensal" e/ou lançamentos em Dez/2025, conferir que o "Saldo Acumulado" de Jan/2026
  já nasce com esse valor (com filtro "Ano todo"), e repetir a mesma checagem com um
  filtro de mês parcial ativo (ex. só Fev/2026 selecionado) para confirmar que o
  número não muda entre os dois modos de visualização — hoje muda, o que é o próprio
  bug.

---

## Observação — verificação pendente da herança entre anos em si

A fórmula de herança (`saldoAbertura`, recursiva ano a ano via `movimentoAno`) não
apresentou nenhum erro lógico nesta leitura de código — mas como os dois bugs acima já
bastam para produzir números errados em cenários comuns (filtro de período parcial, ou
"ajuste mensal" verificado na linha errada), a spec não descarta a possibilidade de um
terceiro problema ainda não identificado. Recomenda-se, depois de corrigir os Bugs 1 e
2, um teste dedicado só da herança entre anos: ano N sem "Abertura" explícita, ano N−1
com lançamentos e/ou "Ajuste Mensal" cadastrados, filtro "Ano todo" em ambos, conferir
se `SALDO ACUMULADO` de Janeiro do ano N já reflete o saldo final de N−1.
