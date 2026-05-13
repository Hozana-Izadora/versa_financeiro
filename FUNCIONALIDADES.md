# Sistema de Gestão Financeira — Documentação de Funcionalidades

> Versão baseada no código-fonte atual. Cada secção descreve uma tela, os seus elementos interativos e as fórmulas exatas usadas nos cálculos.

---

## Índice

1. [Estrutura Geral](#1-estrutura-geral)
2. [Plano de Contas](#2-plano-de-contas)
3. [Lançamentos](#3-lançamentos)
4. [Fluxo de Caixa (Caixa)](#4-fluxo-de-caixa-caixa)
5. [Resultado por Competência](#5-resultado-por-competência)
6. [Orçamento](#6-orçamento)
7. [Importar](#7-importar)
8. [Motor de Cálculo — buildDRE](#8-motor-de-cálculo--builddre)
9. [Hierarquia do Plano de Contas](#9-hierarquia-do-plano-de-contas)
10. [Tratamento de Transferências entre Contas](#10-tratamento-de-transferências-entre-contas)

---

## 1. Estrutura Geral

### Regimes contábeis

O sistema mantém **duas bases de dados separadas** para transações:

| Base | Campo `regime` | Critério de data |
|---|---|---|
| **Caixa** | `"Caixa"` | Data do movimento financeiro efetivo |
| **Competência** | `"Competência"` | Data do fato gerador econômico |

Cada lançamento pertence a exatamente uma base. Os dashboards de Caixa e Competência operam sobre bases distintas e nunca se cruzam nos cálculos.

### Filtros globais

Disponíveis em todas as telas de análise, persistem durante a sessão:

- **Ano** — filtra todas as transações pelo ano da data
- **Meses** — seleção múltipla; quando vazio, considera todos os meses com dados
- **Grupo** — filtra pelo campo `grp` da transação; `"all"` desativa o filtro

---

## 2. Plano de Contas

**Arquivo:** `frontend/src/pages/Plano.jsx`

### Hierarquia de 4 níveis

```
Nível 1 — Nível Financeiro (campo: nivel)
  Receita
  Custo
  Despesa Operacional
  Despesa Não Operacional
  Entrada Não Operacional

Nível 2 — Categoria (campo: cat)
  Ex: RECEITA BRUTA, CUSTOS DIRETOS, DESPESAS FIXAS, DESPESAS VARIÁVEIS,
      DESPESAS NÃO OPERACIONAIS, ENTRADAS NÃO OPERACIONAIS

Nível 3 — Grupo (campo: grp)
  Ex: Pessoal, Estrutura, Tecnologia, Comercial, Custo de Mercadorias

Nível 4 — Tipo / Categoria Micro (campo: tipo) — chave primária
  Ex: Aluguel, Salários e Encargos, Marketing e Publicidade
```

**Exemplo de cascata completo:**

```
nivel: "Despesa Operacional"
  cat: "DESPESAS FIXAS"
    grp: "Estrutura"
      tipo: "Aluguel"
```

### Operações disponíveis

| Operação | Endpoint | Efeito colateral |
|---|---|---|
| Criar categoria (`+ Categoria`) | `POST /api/plano` com `grp: "Geral"` | Cria um placeholder de tipo junto |
| Editar categoria | `PUT /api/plano/categoria/:cat` | Renomeia `cat` em todos os tipos e em todas as transações existentes |
| Remover categoria | `DELETE /api/plano/categoria/:cat` | Remove todos os tipos da categoria |
| Criar tipo (`+ Tipo`) | `POST /api/plano` | — |
| Editar tipo | `PUT /api/plano/:tipo` | Atualiza `cat`, `grp`, `tipo`, `nivel` e propaga às transações vinculadas |
| Remover tipo | `DELETE /api/plano/:tipo` | — |

### Cor de categoria

Cada `cat` tem uma cor associada (campo `planoCores`), usada nas tags visuais do DRE. Opções: `green`, `red`, `yellow`, `purple`, `blue`.

---

## 3. Lançamentos

**Arquivo:** `frontend/src/pages/Lancamentos.jsx`

### Campos de um lançamento

| Campo | Tipo | Descrição |
|---|---|---|
| `data` | `YYYY-MM-DD` | Data do lançamento — **sempre parseada com `T12:00`** para evitar off-by-one de timezone |
| `desc` | string | Descrição livre |
| `cat` | string | Nível 2 do plano |
| `grp` | string | Nível 3 do plano |
| `tipo` | string | Nível 4 do plano (chave) |
| `nivel` | string | Nível 1 do plano (herdado do tipo) |
| `valor` | number | Sempre positivo — o sinal é dado por `mov` |
| `mov` | `"Entrada"` \| `"Saída"` \| `"Transferência"` | Direção do movimento |
| `regime` | `"Caixa"` \| `"Competência"` | Base de destino |

### Totalizadores do rodapé

```
Total Entradas = Σ valor  para  mov = 'Entrada'  (registros filtrados)
Total Saídas   = Σ valor  para  mov = 'Saída'    (registros filtrados)
```

### Filtros locais

- **Grupo** — filtra por `grp`
- **Base** — `Caixa`, `Competência` ou `Ambas`
- **Ano** — herdado do filtro global

### Exportação CSV

Exporta todos os campos do registro como texto, com BOM UTF-8 para compatibilidade com Excel brasileiro.

---

## 4. Fluxo de Caixa (Caixa)

**Arquivo:** `frontend/src/pages/Caixa.jsx`  
**Base de dados:** `transactions.caixa`

### Sub-abas

| Aba | Conteúdo |
|---|---|
| **Visão Geral** | Cascade, Painel de Margens, KPIs, 4 gráficos, DrillChart |
| **Demonstrativo** | Tabela DRE completa (DFCE) com expand/collapse |

---

### 4.1 Cascade Operacional

Barra de cinco blocos que mostra o fluxo simplificado do período:

```
Entradas / Receita
  − Custos Diretos       → % da receita
  − Despesas Operacionais → % da receita
  = Caixa Operacional    → % de margem
```

**Fórmulas:**

```
Entradas / Receita   = Σ mRec[i]      para os meses visíveis
Custos Diretos       = Σ mCost[i]
Despesas Operacionais = Σ mDespOp[i]
Caixa Operacional    = Σ mMgOp[i]     = Receita − Custos − Desp.Op.

% de cada item = valor_item ÷ Receita × 100
```

---

### 4.2 Painel de Margens

Três cartões lado a lado com valor absoluto, percentual e barra de progresso.

#### Margem Bruta

```
Margem Bruta (R$) = totRec − totCost
Margem Bruta (%)  = Margem Bruta ÷ totRec × 100
```

#### Margem Operacional (EBIT)

```
Margem Operacional (R$) = totMgB − totDespOp
                        = totRec − totCost − totDespOp
Margem Operacional (%)  = Margem Operacional ÷ totRec × 100
```

#### Resultado Líquido

```
Resultado Líquido (R$) = totMgOp + totEntNop − totDespNop
                       = totRec − totCost − totDespOp + Entradas Não Op. − Despesas Não Op.
Resultado Líquido (%)  = Resultado Líquido ÷ totRec × 100
```

> **Nota:** `totEntNop` vem das transações com `nivel = 'Entrada Não Operacional'`. O Resultado Líquido no MarginsPanel usa esta fórmula completa, diferente do `totLL` do buildDRE que não inclui `totEntNop`.

---

### 4.3 KPI Cards

| KPI | Fórmula |
|---|---|
| **Entradas Não Operacionais** | `Σ valor` onde `nivel = 'Entrada Não Operacional'` e `mov = 'Entrada'` |
| **Saídas Não Operacionais** | `Σ valor` onde `nivel = 'Despesa Não Operacional'` e `mov = 'Saída'` |
| **Saldo do Período** | `Σ mSaldo[i]` = `Σ (Entradas_totais[i] − Saídas_totais[i])` para todos os meses visíveis |
| **Saldo Acumulado** | `mAcum[último_mês]` = Saldo de Abertura + pré-período + saldo de cada mês visível (acumulado progressivo) |

**Delta do Saldo do Período:**

```
Delta = (mSaldo[último] − mSaldo[penúltimo]) ÷ |mSaldo[penúltimo]| × 100
```

---

### 4.4 Gráfico — Resultado Líquido mês a mês

Barras agrupadas + linha:

| Série | Dados | Cor |
|---|---|---|
| Entradas (barras) | `mRec[i]` | Verde |
| Saídas totais (barras) | `mCost[i] + mDespOp[i] + mDespNop[i]` | Vermelho |
| Saldo Líquido (linha) | `mSaldo[i] = mRec[i] − Σ_saídas_totais[i]` | Azul |

---

### 4.5 Gráfico — Saldo Acumulado

| Série | Dados | Cor |
|---|---|---|
| Acumulado (linha preenchida) | `mAcum[i]` | Verde |
| Tendência (linha tracejada) | Interpolação linear entre `mAcum[0]` e `mAcum[n-1]` | Azul |

**Fórmula da tendência:**

```
tendência[i] = mAcum[0] + (mAcum[n-1] − mAcum[0]) ÷ (n − 1) × i
```

**Fórmula do acumulado:**

```
saldoAcum_inicial = saldosIniciais["YYYY-abertura"]  (configurável)

// Acumula meses anteriores ao período filtrado:
para m de 0 até visMonths[0] − 1:
  saldoAcum += Entradas(m) − Saídas(m)

// Acumula meses visíveis:
mAcum[i] = saldoAcum + mSaldo[0] + mSaldo[1] + ... + mSaldo[i]
```

---

### 4.6 Gráfico — Ciclo Financeiro (PMR, PMP, Ciclo de Caixa)

Barras agrupadas + linha, calculadas em `cicloCalc.js`.

**PMR — Prazo Médio de Recebimento:**

```
PMR = Σ (dia_do_mês × valor)  /  Σ valor
       para todas as Entradas do mês (exceto Transferências)
```

**PMP — Prazo Médio de Pagamento:**

```
PMP = Σ (dia_do_mês × valor)  /  Σ valor
       para todas as Saídas do mês (exceto Transferências)
```

**Ciclo de Caixa:**

```
Ciclo = PMP − PMR

  Ciclo > 0 → empresa recebe antes de pagar (posição saudável)
  Ciclo < 0 → empresa paga antes de receber (pressão de liquidez)
  Ciclo = null → mês sem dados suficientes (uma das médias é nula)
```

> O dia é extraído como `new Date(tx.data + 'T12:00').getDate()` (1–31).  
> A ponderação pelo valor evita distorção causada por lançamentos de baixo valor em datas atípicas.

---

### 4.7 Gráfico — Margem Operacional Caixa vs Competência

Duas linhas comparando a Margem Operacional percentual calculada nas duas bases para os mesmos meses:

```
Margem Op. Caixa[i]        = mMgOp_caixa[i] ÷ mRec_caixa[i] × 100
Margem Op. Competência[i]  = mMgOp_comp[i]  ÷ mRec_comp[i]  × 100

  (retorna 0 quando mRec[i] = 0)
```

> A base Competência usa o mesmo período e filtros de grupo, mas carregada de `transactions.competencia`.

---

### 4.8 DrillChart — Composição das Saídas

Gráfico de rosca com drill-down de 4 níveis, usando `drillHierarchy.js`.

**Hierarquia de navegação:**

```
Raiz (Saídas)
  └─ Operacional / Não Operacional
       └─ Categoria (CUSTOS DIRETOS / DESPESAS FIXAS / ...)
            └─ Grupo (Pessoal, Estrutura, ...)
                 └─ Tipo (Aluguel, Salários ...) — expandido dinamicamente do plano
```

**Fórmula de cada fatia:**

```
valor_nó = Σ tx.valor
  onde:
    tx.data ∈ ano × meses_visíveis
    tx.mov = 'Saída'
    tx satisfaz o filtro hierárquico do nó (nivel / cat / grp / tipo)

percentual_nó = valor_nó ÷ total_nível_atual × 100
```

---

### 4.9 Demonstrativo (DFCE)

Tabela expandível com estrutura completa do DRE em regime de caixa. Ver [Secção 8 — Motor de Cálculo](#8-motor-de-cálculo--builddre) para a construção completa das linhas.

---

## 5. Resultado por Competência

**Arquivo:** `frontend/src/pages/Competencia.jsx`  
**Base de dados:** `transactions.competencia`

Estrutura equivalente à tela Caixa, com as seguintes diferenças:

### 5.1 Cascade DRE (waterfall)

```
Receita Bruta
  − Custos Diretos   → % da receita
  = Margem Bruta     → % de margem
  − Desp. Operacionais
  = EBIT             → % de margem operacional
```

### 5.2 KPI Cards

| KPI | Fórmula |
|---|---|
| **Desp. Não Operacionais** | `totDespNop` (saídas com `nivel = 'Despesa Não Operacional'`) |
| **Lucro Líquido** | `totLL = totMgOp − totDespNop` |

**Delta do Lucro Líquido:**

```
Delta = (mLL[último] − mLL[penúltimo]) ÷ |mLL[penúltimo]| × 100
```

### 5.3 Cartões de Percentual de Margens

Quatro cartões estáticos calculados sobre os totais do período:

| Cartão | Fórmula |
|---|---|
| **Margem Bruta** | `totMgB ÷ totRec × 100` |
| **Margem Operacional** | `totMgOp ÷ totRec × 100` |
| **Margem Líquida** | `totLL ÷ totRec × 100` |
| **% Custo s/ Receita** | `totCost ÷ totRec × 100` |

### 5.4 Gráfico — Resultado Operacional mês a mês

```
Receita (barras)       = mRec[i]
Custos+Desp (barras)   = mCost[i] + mDespOp[i] + mDespNop[i]
Lucro Líquido (linha)  = mLL[i] = mMgOp[i] − mDespNop[i]
```

### 5.5 Gráfico — Evolução das Margens

```
Margem Bruta %    = mMgB[i]  ÷ mRec[i] × 100
Margem Op. %      = mMgOp[i] ÷ mRec[i] × 100
Margem Líquida %  = mLL[i]   ÷ mRec[i] × 100

  (todos retornam 0 quando mRec[i] = 0)
```

---

## 6. Orçamento

**Arquivo:** `frontend/src/pages/Orcamento.jsx`  
**Base de dados:** `transactions.competencia` (somente leitura) + tabela `orcamento`

### 6.1 Tipos de entrada no orçamento

| `tipo` | `referencia` | `mes` | Significado |
|---|---|---|---|
| `"receita"` | `""` | 0–11 | Meta mensal de receita bruta |
| `"breakeven"` | `""` | `null` | Ponto de equilíbrio anual |
| `"cenario"` | `"pessimista"` / `"moderado"` / `"otimista"` / `"muito_otimista"` | 0–11 | Projeção de receita por cenário |
| `"meta_cat"` | `nodeId` do DRILL_TREE | `null` | Meta anual de gastos por nó hierárquico |

### 6.2 KPI Cards — Meta vs Realizado (último mês com dados reais)

| KPI | Meta | Realizado | Fórmula do Realizado |
|---|---|---|---|
| Receita Bruta | `orcMap.receita[m]` | `receitaReal[m]` | `Σ valor` onde `mov='Entrada'` e `nivel='Receita'` no mês `m` |
| Desp. Operacionais | `orcMap.metaCat['gastos-op'] ÷ 12` | `sumNodeMes(gastos-op, tx, year, m)` | Soma todas as Saídas do nó `gastos-op` no mês `m` |
| Margem Operacional | `(recMeta − despOpMeta) ÷ recMeta × 100` | `(recReal − despOpReal) ÷ recReal × 100` | Ver fórmula abaixo |
| Gastos Não Op. | `orcMap.metaCat['gastos-nop'] ÷ 12` | `sumNodeMes(gastos-nop, tx, year, m)` | Soma todas as Saídas do nó `gastos-nop` no mês `m` |
| Resultado Líquido | `recMeta − despOpMeta − nopMeta` | `recReal − despOpReal − nopReal` | — |

**Fórmula da Margem Operacional nos KPIs:**

```
mgOp_real (%) = (recReal − despOpReal) ÷ recReal × 100
mgOp_meta (%) = (recMeta − despOpMeta) ÷ recMeta × 100

  retorna 0 quando o denominador é 0
```

**Indicador de performance (delta):**

```
Para métricas onde "maior é melhor" (receita, margem):
  bom = realizado ≥ meta

Para métricas onde "menor é melhor" (despesas):
  bom = realizado ≤ meta

Delta percentual:  (realizado − meta) ÷ |meta| × 100
Delta percentuais (margens): realizado − meta  (em pontos percentuais, "pp")
```

### 6.3 Gráfico — Receita Bruta: Realizado vs Orçado

```
Realizado[m]  = receitaReal[m]  (null se sem dados)
Orçado[m]     = orcMap.receita[m]
Cenário[m]    = orcMap.cenarios[sc.key][m]
Ponto Equil.  = orcMap.breakeven ÷ 12  (linha horizontal constante)

  Todos os valores são exibidos em R$ mil (÷ 1000)
```

### 6.4 Gráfico — Gastos por Categoria: Meta vs Realizado

Barras comparativas com drill-down de 3 níveis (usando DRILL_TREE):

```
Realizado[nó] = sumNodeYear(nó, tx, year) ÷ 1000
Meta[nó]      = orcMap.metaCat[nó.id] ÷ 1000

Cor da barra "Realizado":
  Vermelho se realizado > meta E meta > 0
  Verde    nos demais casos
```

Clicar em uma barra com filhos navega para o próximo nível (máximo 3 níveis: root → L0 → L1 → filhos de L1).

### 6.5 Tabela de Acompanhamento Orçamentário (Rolling Forecast)

Para o último mês com dados reais (`lastRealMes`):

| Coluna | Fórmula |
|---|---|
| **Orç. Mês** | Meta mensal configurada |
| **Real. Mês** | Valor realizado no mês |
| **Variação R$** | `Real. Mês − Orç. Mês` |
| **Variação %** | `(Real. Mês − Orç. Mês) ÷ |Orç. Mês| × 100` |
| **Orç. Ano** | Meta anual total |
| **Proj. Ano** | `Σ realizado[m≤lastReal]` + `Σ orçado[m>lastReal]` |

**Margem Bruta e Resultado Líquido na tabela:**

```
Margem Bruta Real  = recRealMes − custoReal
Margem Bruta Meta  = recOrcMes  − custoMeta

Resultado Real     = recRealMes − despOpRealMes
Resultado Meta     = recOrcMes  − despOpMeta
```

### 6.6 Painel de Metas de Receita

Entrada direta: 12 campos numéricos (um por mês) + campo de Ponto de Equilíbrio anual. Salvamento automático ao perder foco (`onBlur`) se o valor for numérico e positivo.

---

## 7. Importar

**Arquivo:** `frontend/src/pages/Importar.jsx`  
**Backend:** `backend/src/routes/upload.js`

### Abas

| Aba | Função |
|---|---|
| **Upload** | Importação de arquivo com fluxo de preview em 2 etapas |
| **Saldos Iniciais** | Gerenciamento de saldo de abertura e ajustes mensais |
| **Histórico** | Lista de importações realizadas com opção de limpar dados |
| **Mapeamento** | Tabela de referência dos aliases de colunas reconhecidos |

---

### 7.1 Fluxo de importação em 2 etapas

**Etapa 1 — Upload e análise (sem inserção):**

```
POST /api/import/preview
  → Analisa o arquivo
  → Detecta colunas automaticamente (COL_ALIASES)
  → Aplica resolveCategory() em cada linha
  → Retorna: headers, colMap, rows, orphans, transfers, summary
  → Nenhum dado é gravado no banco
```

**Etapa 2 — Confirmação e inserção:**

```
POST /api/import
  → Re-processa o arquivo com colMap final
  → Valida saldo das transferências (|delta| < 0.01)
  → Insere todas as linhas (menos campos _orphan e _transfer)
  → Retorna: { imported, transfers, history }
  → HTTP 422 se transferências desequilibradas e forceImbalanced ≠ true
```

---

### 7.2 Detecção automática de colunas

Busca parcial (case-insensitive) nos cabeçalhos do arquivo:

| Campo do sistema | Aliases reconhecidos |
|---|---|
| `data` | data, date, dt, vencimento, competencia |
| `descricao` | descrição, descricao, description, historico, memo, obs |
| `categoria` | categoria, category, conta, plano |
| `valor` | valor, value, amount, montante |
| `movimento` | tipo, movimento, operacao, entrada_saida |
| `regime` | regime, tipo_lancamento |

O utilizador pode sobrescrever qualquer mapeamento no painel "Mapeamento de Colunas" antes de confirmar.

---

### 7.3 Resolução de categoria (prioridade decrescente)

```
1. Palavras-chave de transferência na descrição ou categoria:
   /transf[eê]r[eê]ncia\s+entre|entre\s+conta|conta\s+pr[oó]pria/i
   → classifica como mov='Transferência', excluído do DRE

2. Correspondência exata de tipo (case-insensitive)
   → plano.find(p => p.tipo.toLowerCase() === catLc)

3. Correspondência exata de cat
   → plano.find(p => p.cat.toLowerCase() === catLc)

4. Correspondência exata de grp
   → plano.find(p => p.grp.toLowerCase() === catLc)

5. Correspondência parcial na descrição (primeiros 10 chars do tipo)
   → plano.find(p => desc.includes(p.tipo.slice(0, 10)))

6. Fallback por mov:
   Saída   → tipo: "Material de Escritório"  (DESPESAS FIXAS > Estrutura)
   Entrada → tipo: "Outras Receitas Operacionais"  (RECEITA BRUTA > Receita Operacional)
   → marcado como _orphan = true
```

---

### 7.4 Validação de saldo das transferências

```
totalEntrada = Σ valor  onde isTransfer = true E mov = 'Entrada'
totalSaida   = Σ valor  onde isTransfer = true E mov = 'Saída'
delta        = totalEntrada − totalSaida

balanced = |delta| < 0.01

Se !balanced E !forceImbalanced → HTTP 422
```

---

### 7.5 Saldos Iniciais

Dois tipos de saldo:

| Tipo | Chave (`chave`) | Efeito no cálculo |
|---|---|---|
| **Saldo de Abertura** | `"YYYY-abertura"` | Ponto de partida do `mAcum` no início do ano |
| **Ajuste Mensal** | `"YYYY-MM"` | Não implementado ainda nos cálculos do DRE atual — reservado para ajustes manuais |

**Fórmula do saldo acumulado com abertura:**

```
saldoAcum = saldosIniciais["YYYY-abertura"] || 0

// soma meses anteriores ao período visível
para m de 0 até visMonths[0] − 1:
  saldoAcum += sumMonth(tx, year, m, 'Entrada') − sumMonth(tx, year, m, 'Saída')

// acumula progressivamente nos meses visíveis
mAcum[0] = saldoAcum + mSaldo[0]
mAcum[i] = mAcum[i−1] + mSaldo[i]
```

Todas as alterações de saldo ficam registradas na tabela de **Histórico de Alterações** com `old_valor`, `new_valor`, `changed_by` e `changed_at`.

---

## 8. Motor de Cálculo — buildDRE

**Arquivo:** `frontend/src/utils/dreBuilder.js`

`buildDRE(tx, plano, visMonths, mode, filterState, saldosIniciais)` é chamada em Caixa e Competência. Retorna arrays mensais e totais do período.

### Classificação das transações por nível

```javascript
entradaCats  = plano.filter(p => p.nivel === 'Receita')
custoCats    = plano.filter(p => p.nivel === 'Custo')
despOpCats   = plano.filter(p => p.nivel === 'Despesa Operacional')
despNopCats  = plano.filter(p => p.nivel === 'Despesa Não Operacional')
entNopCats   = plano.filter(p => p.nivel === 'Entrada Não Operacional')
```

> Transações com `mov = 'Transferência'` são automaticamente excluídas porque `sumMonth()` sempre filtra por `movFilter = 'Entrada'` ou `'Saída'`.

### Arrays mensais produzidos

| Array | Fórmula por mês `i` |
|---|---|
| `mRec[i]` | `Σ valor` onde `mov='Entrada'` (todas as entradas, fonte de verdade) |
| `mAllSaidas[i]` | `Σ valor` onde `mov='Saída'` (todas as saídas, fonte de verdade) |
| `mCost[i]` | `Σ valor` onde `mov='Saída'` e `nivel ∈ custoCats` |
| `mDespOp[i]` | `Σ valor` onde `mov='Saída'` e `nivel ∈ despOpCats` |
| `mDespNop[i]` | `Σ valor` onde `mov='Saída'` e `nivel ∈ despNopCats` |
| `mEntNop[i]` | `Σ valor` onde `mov='Entrada'` e `nivel ∈ entNopCats` |
| `mMgB[i]` | `mRec[i] − mCost[i]` |
| `mMgOp[i]` | `mMgB[i] − mDespOp[i]` |
| `mLL[i]` | `mMgOp[i] − mDespNop[i]` |
| `mSaldo[i]` | `mRec[i] − mAllSaidas[i]` (usa totais reais, não classificados) |
| `mAcum[i]` | Acumulado progressivo (ver Secção 7.5) |

### Reconciliação (lançamentos fora do plano)

```
mEntNaoClass[i]   = mRec[i]       − mClassRec[i]
mSaidaNaoClass[i] = mAllSaidas[i] − mCost[i] − mDespOp[i] − mDespNop[i]
```

Linhas com valor > 0 aparecem no demonstrativo como "Entradas não classificadas" e "Saídas não classificadas", garantindo que o total do DRE bata com o saldo real.

### Totais do período

```
totRec     = Σ mRec
totCost    = Σ mCost
totDespOp  = Σ mDespOp
totDespNop = Σ mDespNop
totEntNop  = Σ mEntNop
totMgB     = totRec − totCost
totMgOp    = totMgB − totDespOp
totLL      = totMgOp − totDespNop
```

### Estrutura das linhas do demonstrativo

| Tipo de linha | Classe CSS | Conteúdo |
|---|---|---|
| `section` | `dr-section` | Cabeçalho de secção (sem valores) |
| `group` | `dr-group` | Total de uma categoria (nível 2) |
| `subgroup` | `dr-subgroup` | Total de um grupo (nível 3) |
| `item` | `dr-item` | Total de um tipo (nível 4) |
| `subtotal` | `dr-subtotal` | Linha de soma parcial |
| `total` | `dr-total` | Linha de resultado principal |
| `ll` | `dr-ll` | Linha de Lucro Líquido (apenas competência) |
| `saldo` | `dr-saldo` | Linha de Saldo do Período (apenas caixa) |
| `saldo-acum` | `dr-saldo` | Linha de Saldo Acumulado (apenas caixa) |

---

## 9. Hierarquia do Plano de Contas

**Arquivo:** `frontend/src/utils/drillHierarchy.js`

A árvore estática `DRILL_TREE` mapeia os 4 níveis para os campos do plano:

```
Saídas (root)
├── Gastos Operacionais      { nivel: ['Custo', 'Despesa Operacional'] }
│   ├── Custos Diretos       { cat: 'CUSTOS DIRETOS' }
│   │   ├── Fornecedor       { grp: 'Custo de Mercadorias' }
│   │   ├── Operacional      { grp: 'Custo de Serviços' }
│   │   └── Produção         { grp: 'Custo de Produção' }
│   ├── Despesas Fixas       { cat: 'DESPESAS FIXAS' }
│   │   ├── Pessoal          { grp: 'Pessoal' }
│   │   ├── Estrutura        { grp: 'Estrutura' }
│   │   └── Tecnologia       { grp: 'Tecnologia' }
│   └── Despesas Variáveis   { cat: 'DESPESAS VARIÁVEIS' }
│       └── Comercial        { grp: 'Comercial' }
└── Gastos Não Operacionais  { nivel: ['Despesa Não Operacional'] }
    ├── Passivos              { grp: 'Despesas Financeiras' }
    ├── Distribuição Lucros   { grp: 'Impostos e Tributos' }
    └── Outros/Investimentos  { grp: 'Outras Não Operacionais' }
```

`buildDrillTree(plano)` estende dinamicamente os nós folha com os `tipo` do plano cadastrado, permitindo navegação ao 4.º nível quando há mais de um tipo por grupo.

---

## 10. Tratamento de Transferências entre Contas

### Detecção

Regex aplicada nos campos `categoria` e `descricao` de cada linha importada:

```
/transf[eê]r[eê]ncia\s+entre|entre\s+conta|conta\s+pr[oó]pria/i
```

### Classificação

```javascript
{
  cat:   'TRANSFERÊNCIAS',
  grp:   'Transferências',
  tipo:  'Transferência entre Contas',
  nivel: 'Transferência',
  mov:   'Transferência'   // ← chave do isolamento
}
```

### Exclusão do DRE

`sumMonth()` sempre recebe `movFilter = 'Entrada'` ou `'Saída'`. Como `'Transferência' ≠ 'Entrada'` e `≠ 'Saída'`, transferências nunca entram em nenhum cálculo do DRE, KPIs ou gráficos.

### Validação de saldo zero

```
delta = Σ valor[Transferência,Entrada] − Σ valor[Transferência,Saída]
balanced = |delta| < 0.01

Se !balanced:
  POST /api/import retorna HTTP 422
  O utilizador deve marcar "Importar mesmo assim" (forceImbalanced=true)
```

---

*Documento gerado a partir do código-fonte. Para atualizar, rever os ficheiros referenciados em cada secção.*
