# Sistema de Gestão Financeira — Documentação de Funcionalidades

> Versão baseada no código-fonte atual. Cada secção descreve uma tela, os seus
> elementos interativos e as fórmulas exatas usadas nos cálculos. Para propostas de
> melhoria ainda não implementadas, ver os documentos em [`specs/`](.).

---

## Índice

1. [Estrutura Geral](#1-estrutura-geral)
2. [Autenticação e Multi-Tenant](#2-autenticação-e-multi-tenant)
3. [Plano de Contas](#3-plano-de-contas)
4. [Lançamentos](#4-lançamentos)
5. [Fluxo de Caixa (Caixa)](#5-fluxo-de-caixa-caixa)
6. [Resultado por Competência](#6-resultado-por-competência)
7. [Orçamento](#7-orçamento)
8. [Importar](#8-importar)
9. [Motor de Cálculo — buildDRE](#9-motor-de-cálculo--builddre)
10. [Hierarquia de Drill-Down (Saídas)](#10-hierarquia-de-drill-down-saídas)
11. [Tratamento de Transferências entre Contas](#11-tratamento-de-transferências-entre-contas)
12. [Administração](#12-administração)
13. [Recursos de Interface](#13-recursos-de-interface)

---

## 1. Estrutura Geral

### Backend / Frontend

```
Financeiro/
├── backend/     Node.js/Express REST API (porta 3001) + PostgreSQL
└── frontend/    React + Vite + Tailwind SPA (porta 5173)
```

### Regimes contábeis

O sistema mantém **duas bases de dados separadas** para transações:

| Base | Campo `regime` | Critério de data |
|---|---|---|
| **Caixa** | `"Caixa"` | Data do movimento financeiro efetivo |
| **Competência** | `"Competência"` | Data do fato gerador econômico |

Cada lançamento pertence a exatamente uma base. Os dashboards de Caixa e Competência operam sobre bases distintas e nunca se cruzam nos cálculos.

### Filtros globais

Disponíveis em todas as telas de análise, persistem durante a sessão (`AppContext.jsx` → `filterState`):

- **Ano** — filtra todas as transações pelo ano da data
- **Meses** — seleção múltipla; quando vazio ("Ano todo"), considera todos os meses com dados (transações **e** ajustes mensais de saldo, ver [Secção 9](#9-motor-de-cálculo--builddre))
- **Centro de Custo** — filtra por um campo dinâmico de `extra` escolhido pelo usuário (`costCenterField`)
- **Ano de comparação** (`compareYear`) — opcional, sobrepõe uma linha/coluna do ano anterior nos KPIs e gráficos

---

## 2. Autenticação e Multi-Tenant

**Arquivos:** `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `frontend/src/context/AuthContext.jsx`

### Isolamento por cliente

Cada cliente (tenant) tem um **schema PostgreSQL isolado** (`tenant_<slug>`), provisionado via `admin.provision_tenant()`. Não há dados compartilhados entre clientes nas tabelas `transactions`, `plano`, `plano_cores`, `saldos_iniciais`, `saldo_audit_log`, `orcamento` e `import_history` — cada uma existe uma vez por schema.

Um schema `admin` central (fora de qualquer tenant) guarda `clients`, `users`, `client_users`, `roles`, `role_permissions`, `user_roles` e `refresh_tokens`.

### Login e sessão

```
POST /api/auth/login  { email, password }
  → valida credencial, gera access token (JWT, curta duração — JWT_EXPIRES_IN)
  → grava refresh token em cookie httpOnly (REFRESH_TOKEN_EXPIRES_DAYS)
```

O JWT do access token carrega `clientId` (schema do tenant atual) e, quando aplicável, `isSuperAdmin`. `authMiddleware` roda em toda rota sob `/api/*` (exceto `/api/auth/*`) e resolve `req.tenantSchema` a partir do token — nenhuma rota de dados aceita um schema vindo do cliente.

Dois tipos de sessão:
- **Sessão de cliente** — usuário comum ou superadmin "dentro" de um cliente; todas as queries rodam no schema `tenant_<slug>` daquele cliente.
- **Sessão de superadmin sem cliente** — só acessa `/api/admin/*` (gestão de clientes/usuários/roles); `tenantSchema = null`.

### Controle de acesso — duas camadas

1. **Backend, por módulo** (`requirePermission(module, 'read'|'write')`, em `middleware/permission.js`) — bloqueia no nível da API. Módulos: `lancamentos`, `plano`, `saldos`, `importar`. Um usuário **sem nenhuma role atribuída** tem acesso total (comportamento de "owner", cobre o primeiro usuário criado via `createUser.js`).
2. **Frontend, por tela/gráfico/sub-aba** (`usePermissions()` hook, lido de `user.permissions`) — controla o que aparece na interface (`can(screen)`, `canChart(screen, chartId)`, `canSubtab(screen, key)`). Superadmin e usuários sem `permissions` definido sempre veem tudo.

Ambas as camadas são configuradas na tela **Admin → Permissões** (ver [Secção 12](#12-administração)).

---

## 3. Plano de Contas

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
Nível 3 — Grupo (campo: grp)
Nível 4 — Tipo (campo: tipo) — chave primária, folha da árvore
```

Os nomes de Categoria/Grupo/Tipo são livres — definidos pelo cliente ou pela importação automática (ver [Secção 8](#8-importar)), não há uma lista fixa de categorias no sistema.

### Operações disponíveis

| Operação | Endpoint | Efeito colateral |
|---|---|---|
| Criar categoria (`+ Categoria`) | `POST /api/plano` com `grp: "Geral"` | Cria um placeholder de tipo junto |
| Editar categoria | `PUT /api/plano/categoria/:cat` | Renomeia `cat` em todos os tipos e em todas as transações existentes |
| Remover categoria | `DELETE /api/plano/categoria/:cat` | Remove todos os tipos da categoria |
| Criar tipo (`+ Tipo`) | `POST /api/plano` | — |
| Editar tipo | `PUT /api/plano/:tipo` | Atualiza `cat`, `grp`, `tipo`, `nivel` e propaga às transações vinculadas |
| Remover tipo | `DELETE /api/plano/:tipo` | — |

> `PUT /api/plano/categoria/:cat` é declarado **antes** de `PUT /api/plano/:tipo` no router — Express casa rotas na ordem declarada, e a ordem inversa faria `/categoria/X` cair na rota de tipo por engano.

### Cor de categoria

Cada `cat` tem uma cor associada (campo `planoCores`), usada nas tags visuais do DRE. Opções: `green`, `red`, `yellow`, `purple`, `blue`, `cyan`.

---

## 4. Lançamentos

**Arquivo:** `frontend/src/pages/Lancamentos.jsx`

### Campos de um lançamento

| Campo | Tipo | Descrição |
|---|---|---|
| `data` | `YYYY-MM-DD` | Data do lançamento — **sempre parseada com `T12:00`** para evitar off-by-one de timezone |
| `desc` | string | Descrição livre |
| `cat` / `grp` / `tipo` / `nivel` | string | Herdados do Plano de Contas |
| `valor` | number | Sempre positivo — o sinal é dado por `mov` |
| `mov` | `"Entrada"` \| `"Saída"` \| `"Transferência"` | Direção do movimento |
| `regime` | `"Caixa"` \| `"Competência"` | Base de destino — trocar o regime na edição move o registro entre as duas bases |
| `fornecedor`, `dataEmissao`, `dataVencimento` | opcionais | Campos complementares, exibidos como colunas opcionais |
| `extra` | `{ [chave]: valor }` | Campos livres adicionais definidos pelo usuário por lançamento |

### Filtros e colunas

- Filtros: texto livre, data (de/até), Categoria, Grupo, Tipo, Regime, Movimento, faixa de valor
- **Seletor de colunas** — cada usuário escolhe quais colunas exibir na tabela; a preferência é salva via `PUT /api/preferences`
- Exportação CSV com BOM UTF-8 (compatibilidade com Excel brasileiro)

### Chegada via drill-down do demonstrativo

Ao dar duplo clique numa linha de Grupo ou Categoria no demonstrativo (Caixa/Competência), a página abre já filtrada por Categoria/Grupo/Tipo/Movimento/Regime **e pelo intervalo de datas correspondente ao período visível no demonstrativo** (ver [Secção 5.9](#59-demonstrativo-dfce)). Um botão **"Voltar ao demonstrativo"** aparece na barra de ferramentas enquanto esse contexto estiver ativo, retornando à página e sub-aba de origem.

### Confirmações

Exclusão de lançamento usa um modal SweetAlert2 (`confirmDialog`, ver [Secção 13](#13-recursos-de-interface)), não o `confirm()` nativo do navegador.

---

## 5. Fluxo de Caixa (Caixa)

**Arquivo:** `frontend/src/pages/Caixa.jsx`
**Base de dados:** `transactions.caixa`

### Sub-abas

| Aba | Conteúdo |
|---|---|
| **Visão Geral** | Cascade, Painel de Margens, KPIs, 5 gráficos (cada um com botões de ampliar/minimizar), DrillChart |
| **Demonstrativo** | Tabela DRE completa (DFCE) com expand/collapse, agregação por período e drill-down |

Cada gráfico da Visão Geral tem um botão **"⤢ ampliar"** (abre em modal de tela cheia) e um botão de **minimizar** (recolhe o corpo do painel, mantendo só o cabeçalho) — estado guardado localmente por painel, não persiste entre sessões.

---

### 5.1 Cascade Operacional

```
Entradas / Receita
  − Custos Diretos        → % da receita
  − Despesas Operacionais → % da receita
  = Caixa Operacional     → % de margem
```

```
Entradas / Receita    = Σ mRec[i]      para os meses visíveis
Custos Diretos        = Σ mCost[i]
Despesas Operacionais = Σ mDespOp[i]
Caixa Operacional     = Σ mMgOp[i]     = Receita − Custos − Desp.Op.

% de cada item = valor_item ÷ Receita × 100
```

O rótulo "Entrada Operacional" do primeiro card não quebra linha (`whitespace-nowrap`), para que o valor não fique deslocado em relação aos demais cards da cascata.

---

### 5.2 Painel de Margens

Três cartões lado a lado com valor absoluto, percentual e barra de progresso.

```
Margem Bruta (R$)       = totRec − totCost
Margem Bruta (%)        = Margem Bruta ÷ totRec × 100

Margem Operacional (R$) = totMgB − totDespOp
Margem Operacional (%)  = Margem Operacional ÷ totRec × 100

Resultado Líquido (R$)  = totMgOp + totEntNop − totDespNop
Resultado Líquido (%)   = Resultado Líquido ÷ totRec × 100
```

> **Nota:** o Resultado Líquido do MarginsPanel inclui `totEntNop` (Entradas Não Operacionais), diferente do `totLL` retornado por `buildDRE`.

---

### 5.3 KPI Cards

| KPI | Fórmula |
|---|---|
| **Entradas Não Operacionais** | `Σ valor` onde `nivel = 'Entrada Não Operacional'` e `mov = 'Entrada'` |
| **Saídas Não Operacionais** | `Σ valor` onde `nivel = 'Despesa Não Operacional'` e `mov = 'Saída'` |
| **Saldo do Período** | `Σ mSaldo[i]` — fluxo de caixa puro (Entradas − Saídas), não inclui Ajuste Mensal |
| **Saldo Acumulado** | `mAcum[último_mês]` — acumulado progressivo, herda o saldo final de anos anteriores (ver [Secção 9](#9-motor-de-cálculo--builddre)) |

---

### 5.4 Gráfico — Resultado Líquido mês a mês

| Série | Dados | Cor |
|---|---|---|
| Entradas (barras) | `mRec[i]` | Verde |
| Saídas totais (barras) | `mCost[i] + mDespOp[i] + mDespNop[i]` | Vermelho |
| Saldo Líquido (linha) | `mSaldo[i]` | Azul |

---

### 5.5 Gráfico — Saldo Acumulado

| Série | Dados | Cor |
|---|---|---|
| Acumulado (linha preenchida) | `mAcum[i]` | Verde |
| Tendência (linha tracejada) | Interpolação linear entre `mAcum[0]` e `mAcum[n-1]` | Azul |

```
tendência[i] = mAcum[0] + (mAcum[n-1] − mAcum[0]) ÷ (n − 1) × i
```

Ver a fórmula completa do acumulado (incluindo herança entre anos e Ajuste Mensal) na [Secção 9](#9-motor-de-cálculo--builddre). Os meses considerados incluem qualquer mês com Ajuste Mensal cadastrado, mesmo sem lançamentos.

---

### 5.6 Gráfico — Ciclo Financeiro (PMR, PMP, Ciclo de Caixa)

Barras agrupadas + linha, calculadas em `cicloCalc.js`.

```
PMR = Σ (dia_do_mês × valor) / Σ valor    para todas as Entradas do mês (exceto Transferências)
PMP = Σ (dia_do_mês × valor) / Σ valor    para todas as Saídas do mês (exceto Transferências)

Ciclo = PMP − PMR
  Ciclo > 0 → empresa recebe antes de pagar (posição saudável)
  Ciclo < 0 → empresa paga antes de receber (pressão de liquidez)
  Ciclo = null → mês sem dados suficientes
```

---

### 5.7 Gráfico — Margem Operacional Caixa vs Competência

```
Margem Op. Caixa[i]       = mMgOp_caixa[i] ÷ mRec_caixa[i] × 100
Margem Op. Competência[i] = mMgOp_comp[i]  ÷ mRec_comp[i]  × 100
  (retorna 0 quando mRec[i] = 0)
```

---

### 5.8 DrillChart — Composição das Saídas

Gráfico de rosca com drill-down dinâmico, usando `drillHierarchy.js` (ver [Secção 10](#10-hierarquia-de-drill-down-saídas)).

```
valor_nó = Σ tx.valor
  onde tx.data ∈ ano × meses_visíveis, tx.mov = 'Saída', tx satisfaz o filtro do nó

percentual_nó = valor_nó ÷ total_nível_atual × 100
```

---

### 5.9 Demonstrativo (DFCE)

**Componente:** `frontend/src/components/dre/DreTable.jsx`

Tabela expandível com a estrutura completa do DRE em regime de caixa (ver estrutura de linhas na [Secção 9](#9-motor-de-cálculo--builddre)).

- **Botão "⤢ ampliar"** — abre o demonstrativo em modal de tela cheia, com scroll interno ajustado ao espaço disponível
- **Visão por período** — seletor no topo da tabela agrupa as colunas de mês em Mensal (padrão) / Bimestral / Trimestral / Quadrimestral / Semestral / Total. Linhas de fluxo (Receita, Custos, Saldo do Período, etc.) somam os meses dentro de cada bucket; a linha "Saldo Acumulado" usa o valor do **último mês** do bucket (é uma foto, não um fluxo, então não se soma). A coluna "Total" (fim de ano) nunca muda, só o número de colunas intermediárias
- **Clique simples** numa linha de Categoria ou Grupo expande/recolhe seus filhos
- **Duplo clique** numa linha de Grupo ou Tipo navega para Lançamentos já filtrado (ver [Secção 4](#4-lançamentos))
- **Cor por sinal, não por convenção fixa** — cada célula é colorida pelo sinal real do valor (arredondado a centavos, para não marcar ruído de ponto flutuante como negativo); zero é sempre neutro (cinza), nunca verde nem vermelho
- **% da receita operacional** aparece como sub-linha em toda linha de total/margem, incluindo Saldo do Período e Saldo Acumulado

---

## 6. Resultado por Competência

**Arquivo:** `frontend/src/pages/Competencia.jsx`
**Base de dados:** `transactions.competencia`

Estrutura equivalente à tela Caixa (mesmo componente `DreTable`, mesmos botões de ampliar/minimizar), com as seguintes diferenças:

### 6.1 Cascade DRE (waterfall)

```
Receita Bruta
  − Custos Diretos   → % da receita
  = Margem Bruta     → % de margem
  − Desp. Operacionais
  = EBIT             → % de margem operacional
```

Os rótulos dos cards do cascade reservam altura para até duas linhas de texto (`min-h-[3em]`), para que o valor numérico comece sempre na mesma altura, mesmo quando alguns rótulos quebram linha e outros não (ex.: "Desp. Não Operacionais" vs. "Custos Diretos").

### 6.2 KPI Cards

| KPI | Fórmula |
|---|---|
| **Desp. Não Operacionais** | `totDespNop` |
| **Lucro Líquido** | `totLL = totMgOp − totDespNop` |

`saldo`/`saldo-acum` **não existem** em Competência — o demonstrativo termina na linha `ll` (Lucro Líquido). Ajuste Mensal e Saldo Acumulado são conceitos exclusivos de Caixa.

### 6.3 Cartões de Percentual de Margens

| Cartão | Fórmula |
|---|---|
| **Margem Bruta** | `totMgB ÷ totRec × 100` |
| **Margem Operacional** | `totMgOp ÷ totRec × 100` |
| **Margem Líquida** | `totLL ÷ totRec × 100` |
| **% Custo s/ Receita** | `totCost ÷ totRec × 100` |

### 6.4 Gráficos — Resultado Operacional mês a mês / Evolução das Margens

```
Receita (barras)       = mRec[i]
Custos+Desp (barras)   = mCost[i] + mDespOp[i] + mDespNop[i]
Lucro Líquido (linha)  = mLL[i]

Margem Bruta %   = mMgB[i]  ÷ mRec[i] × 100
Margem Op. %     = mMgOp[i] ÷ mRec[i] × 100
Margem Líquida % = mLL[i]   ÷ mRec[i] × 100
  (todos retornam 0 quando mRec[i] = 0)
```

---

## 7. Orçamento

**Arquivo:** `frontend/src/pages/Orcamento.jsx` (tela) + `frontend/src/components/orcamento/MetasTab.jsx` (aba Metas)
**Base de dados:** `transactions` (leitura, ambos os regimes conforme o gráfico) + tabela `orcamento`

Duas abas: **Acompanhamento** (comparativo orçado × realizado) e **Metas** (cadastro das metas).

### 7.1 Tipos de entrada gravados em `orcamento`

| `tipo` | `referencia` | `mes` | Significado |
|---|---|---|---|
| `receita` | `""` | 0–11 | Meta mensal de receita bruta |
| `meta_cat` | id do nó-folha da árvore de gastos | 0–11 | Meta mensal de uma categoria de gasto, em R$ |
| `meta_cat_pct` | id do nó-folha | 0–11 | Meta mensal de uma categoria de gasto, em % da receita do mês (só para nós de Custo Direto) |
| `cenario_delta` | `pessimista` / `otimista` / `muito_otimista` | `null` | Variação % aplicada sobre a meta de receita para projetar o cenário |

`cenario`, `meta_despesa` e `meta_custo_pct` ainda são lidos por compatibilidade com dados salvos por versões antigas da tela, mas não são mais gravados pela interface atual.

### 7.2 Metas por Categoria — árvore com soma automática

A árvore de gastos (mesma hierarquia de [Custos Diretos / Despesas Operacionais / Despesas Não Operacionais] usada no DrillChart) é totalmente navegável na aba Metas:

- **Só os nós-folha têm campo editável.** Qualquer nó com filhos (Categoria, Grupo) mostra apenas "Soma dos itens abaixo" com o total calculado recursivamente (`computeNodeTotal`) — nunca um campo para digitar um valor direto no grupo, o que evitaria contar a mesma meta duas vezes
- Cada folha tem uma grade de 12 meses (Jan–Dez); um ícone de "replicar" copia o valor de um mês para os outros 11
- Nós de Custo Direto podem alternar entre meta em **R$** ou em **%** da receita do mês
- **Campos já salvos nascem travados** (ícone de cadeado) — o usuário precisa clicar em "Editar" para destravar antes de alterar um valor, evitando edição acidental. Toda recarga do orçamento (inclusive logo após salvar) trava tudo de novo
- **Exportar/Importar planilha Excel** — botão "Planilha base" gera um `.xlsx` com uma linha por categoria-folha (Categoria/Grupo/Tipo + Jan–Dez + Total) e uma linha "TOTAL GERAL" somando cada coluna; botão "Importar" lê a planilha preenchida de volta, casando cada linha pela coluna oculta de ID e gravando tudo em lote na mesma rota (`PUT /api/orcamento`) usada pelo salvamento manual

### 7.3 Meta de Receita

Grade de 12 meses + distribuição automática a partir de um valor anual, em modo **Linear** (÷12) ou **Sazonal** (usa o histórico de receita realizada como peso por mês). Mesmo padrão de trava de campo salvo da secção 7.2.

### 7.4 Cenários

Pessimista / Moderado / Otimista / Muito Otimista — cada um aplica um delta percentual configurável sobre a Meta de Receita. O cenário selecionado aparece como série extra no gráfico de Receita Bruta.

### 7.5 Ponto de Equilíbrio — calculado automaticamente

```
PE = Custos Fixos ÷ (1 − (Custos Variáveis ÷ Receita))

  Custos Variáveis = meta de Custos Diretos do período selecionado
  Custos Fixos      = meta de Despesas Operacionais + Despesas Não Operacionais do período
  Receita           = meta de receita orçada do período selecionado (visMonths)
```

Se a % de Custos Variáveis for ≥ 100% da receita (margem de contribuição zero ou negativa), o Ponto de Equilíbrio não é exibido. O valor aparece como uma linha de referência tracejada no gráfico "Receita Bruta — Realizado vs Orçado" e como um selo no cabeçalho do painel.

### 7.6 Acompanhamento — segue o filtro de período global

O comparativo orçado × realizado (KPIs, tabela de acompanhamento, gráfico "Gastos por Grupo") respeita o mesmo filtro de Ano/Meses usado em Caixa e Competência — não é sempre o ano inteiro.

```
KPI Meta vs Realizado (último mês com dados reais):
  Receita Bruta          — Meta: orcMap.receita[m]         Realizado: Σ Entrada em nivel='Receita' no mês m
  Desp. Operacionais     — Meta: meta do nó gastos-op       Realizado: soma de Saídas do nó no mês m
  Margem Operacional     — (recMeta/Real − despOpMeta/Real) ÷ receita × 100
  Gastos Não Op.         — Meta: meta do nó gastos-nop      Realizado: soma de Saídas do nó no mês m
  Resultado Líquido      — recMeta/Real − despOpMeta/Real − nopMeta/Real
```

### 7.7 Gráfico — Gastos por Grupo: Orçado × Realizado

Barras horizontais comparando Meta e Realizado por Grupo (ex.: "Despesa com Pessoal", "Estrutura", "Impostos"), com toggle para exibir em **R$** ou em **% da receita**. A barra de Realizado fica vermelha quando ultrapassa a Meta, verde caso contrário — com legenda própria explicando a regra (não depende da legenda automática do gráfico, que não conseguia expressar cor condicional por barra).

### 7.8 Tabela de Acompanhamento Orçamentário (Rolling Forecast)

| Coluna | Fórmula |
|---|---|
| **Orç. Mês** / **Real. Mês** | Meta e realizado do mês |
| **Variação R$ / %** | `Real − Orç` / `(Real − Orç) ÷ |Orç| × 100` |
| **Orç. Ano** | Meta anual total |
| **Proj. Ano** | `Σ realizado[m ≤ lastReal]` + `Σ orçado[m > lastReal]` |

---

## 8. Importar

**Arquivo:** `frontend/src/pages/Importar.jsx`
**Backend:** `backend/src/routes/upload.js`, `backend/src/routes/saldos.js`

### Abas

| Aba | Função |
|---|---|
| **Upload** | Importação de arquivo com fluxo de preview em 2 etapas |
| **Plano de Contas** | Extrai categorias da planilha e classifica automaticamente |
| **Saldos Iniciais** | Gerenciamento de saldo de abertura e ajustes mensais, com histórico de auditoria |
| **Histórico** | Lista de importações realizadas, com opção de excluir um lote ou apagar tudo |
| **Mapeamento** | Tabela de referência dos aliases de colunas reconhecidos |

### 8.1 Fluxo de importação em 2 etapas

```
POST /api/import/preview
  → Analisa o arquivo, detecta colunas (COL_ALIASES), aplica resolveCategory() em cada linha
  → Retorna headers, colMap, rows, orphans, transfers, summary — nada é gravado

POST /api/import
  → Re-processa com o colMap final, valida saldo das transferências (|delta| < 0.01)
  → Insere as linhas, retorna { imported, transfers, history }
  → HTTP 422 se transferências desequilibradas e forceImbalanced ≠ true
```

### 8.2 Detecção automática de colunas

| Campo do sistema | Aliases reconhecidos |
|---|---|
| `data` | data, date, dt, vencimento, competencia |
| `descricao` | descrição, descricao, description, historico, memo, obs |
| `categoria` | categoria, category, conta, plano |
| `valor` | valor, value, amount, montante |
| `movimento` | tipo, movimento, operacao, entrada_saida |
| `regime` | regime, tipo_lancamento |

### 8.3 Resolução de categoria (prioridade decrescente)

```
1. Palavras-chave de transferência → mov='Transferência', excluído do DRE
2. Correspondência exata de tipo, depois cat, depois grp (case-insensitive)
3. Correspondência parcial na descrição (primeiros 10 chars do tipo)
4. Fallback por mov (Saída/Entrada) → tipo genérico, marcado _orphan = true
```

Ver a tabela completa de 18 regras de classificação automática no [README](../README.md#importar-o-plano-de-contas).

### 8.4 Saldos Iniciais

Dois tipos de entrada, gerenciados por um CRUD completo (adicionar, editar, excluir, histórico de auditoria com `updated_by`/`updated_at`):

| Tipo | Chave (`chave`) | Efeito no cálculo |
|---|---|---|
| **Saldo de Abertura** | `"YYYY-abertura"` | Autoritativo para aquele ano — quando ausente, o ano herda o saldo final do ano anterior automaticamente |
| **Ajuste Mensal** | `"YYYY-MM"` | Correção manual somada ao Saldo Acumulado naquele mês; aparece como linha própria "AJUSTES MANUAIS" no demonstrativo (ver [Secção 9](#9-motor-de-cálculo--builddre)) |

Um mês que só tem um Ajuste Mensal cadastrado (sem nenhum lançamento real) ainda assim ganha uma coluna no demonstrativo e nos gráficos de Caixa — os meses "disponíveis" para exibição não são só os que têm transação.

### 8.5 Excluir uma importação / Zona de perigo

Cada lote importado é vinculado por `import_id` e pode ser excluído individualmente (remove só os lançamentos daquele lote). O botão **Apagar todos os dados** (Histórico → Zona de perigo) remove transações, saldos e histórico, e redefine o plano de contas — com confirmação via modal.

---

## 9. Motor de Cálculo — buildDRE

**Arquivo:** `frontend/src/utils/dreBuilder.js`

```js
buildDRE(tx, plano, visMonths, mode, filterState, saldosIniciais, allTx)
```

- `tx` — transações já filtradas pelo período selecionado pela página chamadora
- `allTx` (opcional) — histórico completo, sem esse corte de período; usado só para calcular o saldo herdado de anos anteriores e o movimento real dos meses anteriores ao período filtrado. Quando omitido, `historyTx = tx` (relevante só em Competência, onde saldo/acumulado não existem)
- `mode` — `'caixa'` ou `'competencia'`, decide se as linhas de Saldo/Ajustes ou de Lucro Líquido são geradas

### Arrays mensais produzidos

| Array | Fórmula por mês `i` |
|---|---|
| `mRec[i]` | `Σ valor` onde `mov='Entrada'` (todas as entradas) |
| `mAllSaidas[i]` | `Σ valor` onde `mov='Saída'` (todas as saídas) |
| `mCost[i]` / `mDespOp[i]` / `mDespNop[i]` | `Σ valor` de Saídas classificadas em Custo / Despesa Operacional / Despesa Não Operacional |
| `mEntNop[i]` | `Σ valor` de Entradas classificadas em Entrada Não Operacional |
| `mRecOp[i]` | `mRec[i] − mEntNop[i]` (receita operacional, exclui entradas não operacionais) |
| `mMgB[i]` / `mMgOp[i]` / `mLL[i]` | Margem Bruta / Operacional / Lucro Líquido, cascata usual |
| `mSaldo[i]` | `mRec[i] − mAllSaidas[i]` (fluxo puro, **não** inclui Ajuste Mensal) |
| `mAcum[i]` | Acumulado progressivo, ver abaixo |

### Reconciliação (lançamentos fora do plano)

```
mEntNaoClass[i]   = mRec[i]       − mClassRec[i]
mSaidaNaoClass[i] = mAllSaidas[i] − mCost[i] − mDespOp[i] − mDespNop[i]
```

Linhas com valor > 0 aparecem no demonstrativo como "Entradas/Saídas não classificadas", garantindo que o total do DRE bata com o saldo real mesmo com lançamentos fora do plano.

### Saldo Acumulado — herança entre anos e Ajuste Mensal

```js
function ajusteMensal(y, mesIdx0) { /* lê saldosIniciais["y-MM"] */ }

function movimentoAno(y) {
  // soma Entrada−Saída de TODO o histórico (allTx) no ano y, + os 12 ajustes mensais do ano
}

function saldoAbertura(y) {
  // "y-abertura" explícita, se existir, é sempre autoritativa;
  // senão, herda recursivamente: saldoAbertura(y-1) + movimentoAno(y-1)
  // (base da recursão: 0 no ano mais antigo com transações)
}
```

```
saldoAcum = saldoAbertura(year)

// recupera, a partir do histórico completo (não do `tx` já filtrado por mês), os meses
// do ano corrente anteriores ao primeiro mês visível — necessário quando o filtro de
// período não começa em Janeiro
para m de 0 até visMonths[0] − 1:
  saldoAcum += movimento_real_do_mês(m) + ajusteMensal(year, m)

// acumula progressivamente nos meses visíveis
mAcum[i] = saldoAcum += mSaldo[i] + ajusteMensal(year, i)
```

> O acumulado precisa ler o movimento do catch-up a partir do histórico **sem** o corte de mês do filtro ativo — usar o `tx` já filtrado faz o catch-up contar zero de movimento real para os meses fora do filtro, mesmo que eles tenham lançamentos.

### Totais do período

```
totRec = Σ mRec   totCost = Σ mCost   totDespOp = Σ mDespOp   totDespNop = Σ mDespNop
totEntNop = Σ mEntNop
totMgB = totRecOp − totCost   totMgOp = totMgB − totDespOp   totLL = totMgOp + totEntNop − totDespNop
```

### Estrutura das linhas do demonstrativo

| Tipo de linha | Classe CSS | Conteúdo | Onde aparece |
|---|---|---|---|
| `section` | `dr-section` | Cabeçalho de secção (sem valores) | Ambos |
| `group` | `dr-group` | Total de uma Categoria (negrito) | Ambos |
| `subgroup` | `dr-subgroup` | Total de um Grupo (negrito) | Ambos |
| `item` | `dr-cat` | Total de um Tipo (peso normal) | Ambos |
| `subtotal` | `dr-subtotal` | Linha de soma parcial | Ambos |
| `total` | `dr-total` | Linha de resultado principal (Margem Bruta, Margem Operacional) | Ambos |
| `ll` | `dr-ll` | Lucro Líquido | Só Competência |
| `saldo` | `dr-saldo` | Saldo do Período | Só Caixa |
| `ajuste` | `dr-ajuste` | Ajustes Manuais (só aparece se houver algum ajuste no período visível) | Só Caixa |
| `saldo-acum` | `dr-saldo-acum` | Saldo Acumulado | Só Caixa |

A cor de cada célula segue o **sinal real do valor** (arredondado a centavos), não uma convenção fixa por linha — evita, por exemplo, uma Margem Bruta negativa aparecer em verde. Zero é sempre neutro.

---

## 10. Hierarquia de Drill-Down (Saídas)

**Arquivo:** `frontend/src/utils/drillHierarchy.js`

`buildDrillTree(plano)` constrói a árvore **dinamicamente** a partir do Plano de Contas cadastrado (não é uma lista fixa) — a mesma árvore alimenta o DrillChart de Caixa e a aba "Metas por Categoria" do Orçamento.

```
Saídas (root)
├── Gastos Operacionais       { nivel: ['Custo', 'Despesa Operacional'] }
│   └── <Categoria>            (cat do plano)
│       └── <Grupo>            (grp do plano)
│           └── <Tipo>         (só quando o grupo tem mais de um tipo cadastrado)
└── Gastos Não Operacionais   { nivel: ['Despesa Não Operacional'] }
    └── <Categoria> → <Grupo> → <Tipo>
```

- Quando um Grupo tem **apenas um** Tipo, a folha da árvore é o próprio nó de Grupo (não expande mais um nível) — o `filter` desse nó não tem `tipo`, só `{ nivel, cat, grp }`
- `sumNode(node, transactions, visMonths, year)` soma apenas Saídas que casam com o `filter` do nó, no ano e meses informados

---

## 11. Tratamento de Transferências entre Contas

### Detecção

```
/transf[eê]r[eê]ncia\s+entre|entre\s+conta|conta\s+pr[oó]pria/i
```
aplicada nos campos `categoria` e `descricao` de cada linha importada.

### Classificação

```js
{ cat: 'TRANSFERÊNCIAS', grp: 'Transferências', tipo: 'Transferência entre Contas', nivel: 'Transferência', mov: 'Transferência' }
```

### Exclusão do DRE

`sumMonth()`/`buildDRE` sempre filtram por `mov = 'Entrada'` ou `'Saída'` — como `'Transferência'` não é nenhum dos dois, essas linhas nunca entram em nenhum cálculo do DRE, KPIs ou gráficos.

### Validação de saldo zero

```
delta = Σ valor[Transferência,Entrada] − Σ valor[Transferência,Saída]
balanced = |delta| < 0.01

Se !balanced: POST /api/import retorna HTTP 422, usuário precisa marcar "Importar mesmo assim"
```

---

## 12. Administração

**Arquivo:** `frontend/src/pages/Admin.jsx`
**Backend:** `backend/src/routes/admin.js`, `backend/src/routes/roles.js`

Acesso restrito a usuários `isSuperAdmin`. Três abas:

### 12.1 Empresas

CRUD de clientes (`admin.clients`). **Excluir uma empresa é soft-delete** (`active = false`) — o registro nunca é apagado do banco, só some da listagem padrão. Um checkbox "Mostrar excluídas" reexibe as empresas inativas quando precisar reverter. Toda exclusão pede confirmação (SweetAlert2).

### 12.2 Usuários

CRUD de usuários e suas associações a clientes (`admin.client_users`). Mesmo padrão de soft-delete e confirmação da aba Empresas. Um usuário não pode desativar a própria conta (botão desabilitado para o usuário logado).

### 12.3 Permissões

Gerencia `admin.roles` e `admin.role_permissions` por cliente — cria roles nomeadas (ex. "somente_leitura") e define, por módulo (`lancamentos`, `plano`, `saldos`, `importar`), o nível de acesso (`read`/`write`). Também configura a visibilidade fina por tela/gráfico/sub-aba usada pelo `usePermissions()` do frontend (ver [Secção 2](#2-autenticação-e-multi-tenant)).

---

## 13. Recursos de Interface

- **Modais de confirmação/alerta** — `frontend/src/utils/alerts.js` envolve SweetAlert2 (`confirmDialog`, `alertError`, `alertSuccess`), usado em toda ação destrutiva do sistema (excluir lançamento, categoria, saldo, empresa, usuário, role) em vez do `confirm()`/`alert()` nativos do navegador. Os modais seguem automaticamente o tema claro/escuro ativo
- **Tema claro/escuro** — alternável, persistido em `localStorage` (`AppContext.jsx`)
- **Ampliar gráfico/demonstrativo** — link "⤢ ampliar" presente em todo painel de gráfico e no demonstrativo, abre o conteúdo em modal de tela cheia (`ChartModal.jsx`) reaproveitando o mesmo componente renderizado no painel
- **Minimizar gráfico** — botão por painel que recolhe o corpo mantendo só o cabeçalho, útil para focar em poucos gráficos por vez; estado local, não persiste entre sessões
- **Preferências por usuário** — colunas visíveis em Lançamentos e outras preferências de UI são salvas via `PUT /api/preferences` e recuperadas no próximo login

---

*Documento gerado a partir do código-fonte. Para atualizar, revisar os ficheiros referenciados em cada secção. Propostas de melhoria ainda não implementadas ficam em [`specs/`](.), não neste documento.*
