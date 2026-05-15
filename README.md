# versa_financeiro

Sistema de gerência financeira multi-cliente com DRE por Caixa e Competência.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Instalação — primeira vez](#instalação--primeira-vez)
- [Execução em desenvolvimento](#execução-em-desenvolvimento)
- [Deploy em servidor — Docker](#deploy-em-servidor--docker)
- [Novo cliente — provisionar base de dados](#novo-cliente--provisionar-base-de-dados)
- [Novo usuário — criar acesso ao sistema](#novo-usuário--criar-acesso-ao-sistema)
- [Controle de acesso por módulo (roles)](#controle-de-acesso-por-módulo-roles)
- [Fluxo completo para onboarding de um novo cliente](#fluxo-completo-para-onboarding-de-um-novo-cliente)
- [Importação de dados](#importação-de-dados)
- [Migrations disponíveis](#migrations-disponíveis)
- [Build de produção](#build-de-produção)
- [Verificação de saúde da API](#verificação-de-saúde-da-api)

---

## Funcionalidades

### DRE — Demonstrativo de Resultado
- Visão por **Caixa** (movimentação realizada) e **Competência** (regime de competência)
- Filtros por ano, mês e grupo de contas
- Gráficos de evolução mensal de receita, custo e resultado
- Drill-down por categoria de despesa
- Métricas de margem bruta, margem operacional e lucro líquido com comparativo vs. orçamento
- Saldo inicial e acumulado de caixa

### Lançamentos
- CRUD completo de transações com campos: data, descrição, categoria, valor, movimento e regime
- Vinculação automática ao plano de contas

### Plano de Contas
- Estrutura hierárquica: **Categoria → Grupo → Tipo**
- CRUD de categorias, grupos e tipos via interface
- Níveis contábeis: Receita, Custo, Despesa Operacional, Despesa Não Operacional, Entrada Não Operacional
- Cores personalizáveis por categoria

### Orçamento
- Planejamento por tipo e mês
- Comparativo realizado vs. orçado no DRE

### Saldos Iniciais
- Saldo de abertura por ano e ajustes mensais para cálculo correto do acumulado de caixa
- Histórico de alterações com auditoria

### Importação de dados
- Upload de planilhas `.xlsx` / `.xls` / `.csv` para as bases Caixa e Competência
- Detecção automática de colunas com aliases configuráveis
- Preview antes de confirmar: mapeamento de colunas, aviso de categorias não encontradas, validação de transferências entre contas
- **Importação do Plano de Contas** direto da planilha — extrai categorias únicas, classifica automaticamente (18 regras baseadas em keywords) e permite revisar/ajustar cada item antes de criar
- Exclusão seletiva por importação — remove apenas os lançamentos daquele lote sem afetar o plano de contas ou outros dados
- Histórico de importações com rastreabilidade por lote

---

## Requisitos

- **Node.js** 18+
- **PostgreSQL** 15+
- **npm** 9+

---

## Instalação — primeira vez

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd Financeiro
```

### 2. Instalar dependências

```bash
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 3. Criar o banco de dados PostgreSQL

Conecte como superusuário e crie o banco:

```sql
CREATE DATABASE financas;
```

### 4. Configurar variáveis de ambiente do backend

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` com os valores reais:

```env
# Conexão com o banco (use superusuário na primeira execução das migrations)
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/financas

PORT=3001

# Gere um segredo forte: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=cole_aqui_o_segredo_gerado
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

CORS_ORIGIN=http://localhost:5173
```

> **Atenção:** a primeira execução das migrations (`migrate.js`) cria roles no PostgreSQL e requer um usuário com privilégio de superusuário. Após as migrations, troque `DATABASE_URL` para a role `financas_app` com sua senha final.

### 5. Executar as migrations

```bash
node backend/scripts/migrate.js
```

Isso aplica, na ordem:
- `001_admin_schema.sql` — schema `admin`, tabelas de clientes, usuários, roles e tokens; cria a role PostgreSQL `financas_app`
- `002_provision_function.sql` — funções `admin.provision_tenant()` e `admin.deprovision_tenant()`

### 6. Definir a senha da role `financas_app`

Ainda como superusuário no psql:

```sql
ALTER ROLE financas_app PASSWORD 'senha_segura_aqui';
```

Atualize `backend/.env` com a connection string final usando `financas_app`:

```env
DATABASE_URL=postgresql://financas_app:senha_segura_aqui@localhost:5432/financas
```

---

## Execução em desenvolvimento

Abra dois terminais:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
API disponível em `http://localhost:3001`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
App disponível em `http://localhost:5173`

O Vite proxy redireciona `/api/*` automaticamente para o backend.

---

## Novo cliente — provisionar base de dados

Cada cliente tem um schema isolado no PostgreSQL (`tenant_<slug>`).

### 1. Criar o tenant

Execute no psql (como superusuário ou dono do schema `admin`):

```sql
SELECT admin.provision_tenant('slug_do_cliente', 'Nome Completo do Cliente');
```

Regras do slug:
- Apenas letras minúsculas, números e `_`
- Deve começar com letra
- Exemplos válidos: `acme`, `empresa_abc`, `cliente01`

O comando retorna o UUID do cliente. Anote-o.

**Exemplo:**
```sql
SELECT admin.provision_tenant('acme', 'Acme Ltda');
--  provision_tenant
-- ──────────────────────────────────────
--  550e8400-e29b-41d4-a716-446655440000
```

Isso cria o schema `tenant_acme` com as tabelas `transactions`, `plano`, `plano_cores`, `saldos_iniciais` e `import_history`, e registra o cliente na tabela `admin.clients`.

### 2. Verificar clientes existentes

```sql
SELECT slug, name, active, created_at FROM admin.clients ORDER BY created_at;
```

### 3. Remover um cliente (irreversível)

```sql
SELECT admin.deprovision_tenant('slug_do_cliente');
```

> Remove o schema inteiro e o registro em `admin.clients`. Use com cautela.

---

## Novo usuário — criar acesso ao sistema

### Criar usuário e associar a um cliente

```bash
node backend/scripts/createUser.js \
  --email usuario@exemplo.com \
  --password "SenhaForte123!" \
  --name "João Silva" \
  --client acme
```

| Flag | Obrigatória | Descrição |
|------|-------------|-----------|
| `--email` | sim | E-mail de login (único no sistema) |
| `--password` | sim | Mínimo 8 caracteres |
| `--name` | não | Nome de exibição |
| `--client` | não | Slug do tenant ao qual associar o usuário |

Se `--client` for omitido, o usuário é criado sem associação a nenhum cliente.

**Um usuário pode ter acesso a múltiplos clientes.** Para adicionar associação extra, insira diretamente:

```sql
INSERT INTO admin.client_users (client_id, user_id)
SELECT c.id, u.id
FROM admin.clients c, admin.users u
WHERE c.slug = 'outro_cliente' AND u.email = 'usuario@exemplo.com';
```

### Verificar usuários e acessos

```sql
-- Todos os usuários
SELECT id, email, display_name, active FROM admin.users;

-- Usuários por cliente
SELECT u.email, u.display_name, c.slug, c.name
FROM admin.client_users cu
JOIN admin.users u ON u.id = cu.user_id
JOIN admin.clients c ON c.id = cu.client_id
ORDER BY c.slug, u.email;
```

---

## Controle de acesso por módulo (roles)

Por padrão, um usuário sem role atribuída tem acesso completo ao cliente. Para restringir:

### Criar uma role com permissões específicas

```sql
-- Cria a role "somente_leitura" para o cliente acme
INSERT INTO admin.roles (client_id, name)
SELECT id, 'somente_leitura' FROM admin.clients WHERE slug = 'acme'
RETURNING id;

-- Adiciona permissão de leitura nos módulos desejados
-- Módulos: lancamentos | plano | saldos | importar
-- Níveis:  read | write
INSERT INTO admin.role_permissions (role_id, module, access)
VALUES
  ('<role_id>', 'lancamentos', 'read'),
  ('<role_id>', 'plano',       'read'),
  ('<role_id>', 'saldos',      'read');
```

### Atribuir a role a um usuário

```sql
INSERT INTO admin.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM admin.users u, admin.roles r
WHERE u.email = 'usuario@exemplo.com' AND r.name = 'somente_leitura';
```

---

## Fluxo completo para onboarding de um novo cliente

```
1. psql → SELECT admin.provision_tenant('slug', 'Nome');
2. node backend/scripts/createUser.js --email ... --password ... --name ... --client slug
3. Login na interface → Importar → aba "Plano de Contas" → enviar planilha → revisar → criar
4. Importar → aba "Upload" → enviar planilha de lançamentos (Caixa ou Competência)
```

O usuário já pode fazer login em `http://localhost:5173` usando e-mail e senha.

---

## Importação de dados

### Formato esperado da planilha

| Coluna | Aliases aceitos | Exemplo |
|--------|-----------------|---------|
| Data | `data`, `date`, `dt`, `vencimento`, `competencia` | `15/03/2025` |
| Descrição | `descrição`, `descricao`, `historico`, `memo`, `obs` | `Pgto fornecedor` |
| Categoria | `categoria`, `category`, `conta`, `plano` | `SALÁRIOS` |
| Valor | `valor`, `value`, `amount`, `montante` | `3.500,00` |
| Movimento/Tipo | `tipo`, `movimento`, `operacao`, `entrada_saida` | `Saída` |
| Regime | `regime`, `tipo_lancamento` | `Caixa` |

A detecção de colunas é case-insensitive e por substring — ex.: uma coluna chamada `"Histórico"` é mapeada para o campo Descrição automaticamente.

### Importar o Plano de Contas

A aba **Plano de Contas** da tela Importar permite criar o plano a partir da mesma planilha de lançamentos:

1. Envie o arquivo → o sistema extrai todas as categorias únicas da coluna `Categoria`
2. Para cada categoria, detecta o movimento predominante (Entrada/Saída) e aplica a classificação automática:

| Keyword na categoria | Classificação sugerida |
|----------------------|------------------------|
| `salário`, `hora extra`, `pró-labore`, `inss`, `fgts`, `férias`, `rescisão`, `benefício`, `uniforme`, `adiantamento`, `exames admissionais`, `alimentação` | DESPESAS FIXAS / Pessoal |
| `aluguel`, `energia elétrica`, `água e esgoto`, `internet`, `telefone`, `limpeza`, `copa e cozinha`, `manutenção e reparos`, `vigilância`, `material de escritório` | DESPESAS FIXAS / Estrutura |
| `software`, `programa de computador`, `informática` | DESPESAS FIXAS / Tecnologia |
| `veículo`, `combustível`, `estacionamento`, `ipva`, `seguros — veículos` | DESPESAS VARIÁVEIS / Veículos |
| `marketing`, `publicidade`, `propaganda`, `eventos`, `comissão`, `doações/brindes` | DESPESAS VARIÁVEIS / Comercial |
| `contabilidade`, `auditoria`, `consultoria`, `honorários`, `viagens`, `serviços de terceiros` | DESPESAS VARIÁVEIS / Administrativo |
| `simples nacional`, `icms`, `iss`, `inss — empresa`, `fgts-empresa` | DESPESAS NÃO OPERACIONAIS / Impostos e Tributos |
| `taxas bancárias`, `tarifas`, `empréstimos`, `consórcio`, `pagamento de empréstimos` | DESPESAS NÃO OPERACIONAIS / Despesas Financeiras |
| `investimentos —` | DESPESAS NÃO OPERACIONAIS / Investimentos |
| `vendas`, `receita`, `faturamento` | RECEITA BRUTA / Receita Operacional |
| `juros recebidos`, `rendimentos de aplicações` | RECEITA BRUTA / Receita Financeira |
| `ajuste de caixa crédito` | ENTRADAS NÃO OPERACIONAIS / Outras Entradas |
| `matéria-prima` | CUSTOS DIRETOS / Custo de Produção |

3. Revise e ajuste categoria, grupo e nível de cada item na tabela
4. Marque os itens desejados (itens já existentes são exibidos mas não podem ser recriados)
5. Clique em **Criar N tipos**

### Excluir uma importação

Cada lançamento importado é vinculado ao seu lote por um `import_id`. No histórico de importações é possível excluir um lote específico:

- Clique no ícone de lixeira ao lado da importação desejada
- Um modal de confirmação exibe quantos lançamentos serão removidos e confirma que **o plano de contas e outros dados não são afetados**
- A exclusão remove apenas os lançamentos daquele lote

> Importações realizadas antes da migration `004_import_id` não possuem `import_id` e não oferecem a opção de exclusão individual — apenas o reset geral.

### Zona de perigo — Apagar todos os dados

O botão **Apagar todos os dados** (aba Histórico → Zona de perigo) remove:
- Todas as transações
- Todos os saldos iniciais
- Todo o histórico de importações
- Redefine o plano de contas para os valores padrão

Um modal de confirmação é exibido antes da ação.

---

## Migrations disponíveis

O `migrate.js` executa **todos os `.sql`** da pasta `migrations/` em ordem alfabética. Migrations marcadas com a tag `REQUIRES: run as postgres superuser` são **puladas automaticamente** quando o runner conecta como `financas_app` (que é o caso no Docker), com um aviso no log — elas devem ser aplicadas manualmente.

| Arquivo | Precisa de superusuário? | O que faz |
|---------|:------------------------:|-----------|
| `001_admin_schema.sql` | não* | Schema `admin`, tabelas de clientes, usuários, roles e tokens |
| `002_provision_function.sql` | não* | Função `admin.provision_tenant()` com todas as tabelas por tenant |
| `003_saldos_audit.sql` | não | Tabela de auditoria de saldos (`saldo_audit_log`) |
| `003_orcamento.sql` | não | Tabela de orçamento (`orcamento`) |
| `004_import_id.sql` | **sim** | Coluna `import_id` em `transactions` para rastreabilidade por lote |

\* Roles e schema `admin` já são criados pelo script `postgres/init/01_roles.sh` antes do runner executar.

### `docker compose up` aplica a 004 automaticamente?

**Não.** O serviço `migrate` conecta como `financas_app`, que não tem permissão de `ALTER TABLE` nas tabelas criadas pelo superusuário via `provision_tenant`. O runner detecta isso e **pula** a migration com aviso no log — o backend sobe normalmente.

Para aplicar a `004`, rode manualmente como `postgres`:

```bash
# Se usar Docker:
docker compose exec db psql -U postgres -d financas \
  -f /dev/stdin < backend/migrations/004_import_id.sql

# Ou copie o arquivo para dentro do container:
docker compose cp backend/migrations/004_import_id.sql db:/tmp/004.sql
docker compose exec db psql -U postgres -d financas -f /tmp/004.sql

# Sem Docker (psql local):
psql -U postgres -d financas -f backend/migrations/004_import_id.sql
```

> A migration é **idempotente** — usa `ADD COLUMN IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`, então pode ser executada mais de uma vez sem problema.

---

## Deploy em servidor — Docker

Esta é a forma recomendada para rodar o projeto em produção. O `docker-compose.yml` sobe quatro serviços: **PostgreSQL**, **migrate** (executa as migrations uma única vez), **backend** (Node.js) e **frontend** (nginx + SPA compilado). Nenhuma dependência precisa ser instalada no servidor além do Docker.

### Pré-requisitos

- **Docker** 24+
- **Docker Compose** v2 (incluso no Docker Desktop; em servidores Linux instale `docker-compose-plugin`)

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd Financeiro
```

### 2. Criar o arquivo `.env` na raiz do projeto

```bash
cp backend/.env.example .env   # ponto de partida; edite os valores abaixo
```

O `.env` para Docker deve conter as seguintes variáveis:

```env
# Senha do superusuário postgres (usada apenas internamente pelo container)
POSTGRES_SUPERUSER_PASSWORD=senha_super_segura

# Senha da role financas_app (usada pela API)
POSTGRES_APP_PASSWORD=senha_app_segura

# Segredo JWT — gere com:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=cole_aqui_o_segredo_gerado

# Expiração do access token (padrão: 15m)
JWT_EXPIRES_IN=15m

# Dias de validade do refresh token (padrão: 7)
REFRESH_TOKEN_EXPIRES_DAYS=7

# Porta HTTP exposta no host (padrão: 80)
HTTP_PORT=80
```

> `CORS_ORIGIN` não é necessário em produção — todo o tráfego passa pelo nginx na mesma origem.

### 3. Subir os containers

```bash
docker compose up -d
```

Na primeira vez o Docker irá:
1. Fazer o build das imagens do backend e do frontend
2. Subir o PostgreSQL e aguardar o healthcheck
3. Executar as migrations automaticamente via o serviço `migrate`
4. Iniciar a API e o nginx

Acompanhe os logs até tudo estar saudável:

```bash
docker compose logs -f
```

A aplicação estará disponível em `http://<ip-do-servidor>` (ou na porta definida em `HTTP_PORT`).

### 4. Verificar saúde dos serviços

```bash
docker compose ps
# Todos os serviços devem aparecer como "healthy" ou "exited 0" (migrate)
```

```bash
curl http://localhost/api/health
# {"status":"ok"}
```

### 5. Provisionar o primeiro cliente

Com os containers rodando, execute os mesmos comandos de gerência via `docker compose exec`:

```bash
# Abrir o psql dentro do container do banco
docker compose exec db psql -U postgres -d financas
```

```sql
SELECT admin.provision_tenant('minha_empresa', 'Minha Empresa Ltda');
```

### 6. Criar o primeiro usuário

```bash
docker compose exec backend node scripts/createUser.js \
  --email admin@minha-empresa.com \
  --password "SenhaForte123!" \
  --name "Admin" \
  --client minha_empresa
```

### Atualizar para uma nova versão

```bash
git pull
docker compose build          # reconstrói as imagens
docker compose up -d          # recria os containers alterados
# O serviço "migrate" roda automaticamente e aplica novas migrations
```

### Parar e remover os containers

```bash
docker compose down           # para e remove os containers (dados preservados em pgdata)
docker compose down -v        # também remove o volume do banco (IRREVERSÍVEL)
```

---

## Build de produção

```bash
cd frontend
npm run build
# Arquivos estáticos em frontend/dist/
```

Configure um servidor web (nginx, Caddy) para:
- Servir `frontend/dist/` como raiz estática
- Fazer proxy de `/api/*` → `http://localhost:3001`
- Garantir que cookies `httpOnly` funcionem com HTTPS (obrigatório para refresh tokens)

No backend em produção, defina `CORS_ORIGIN` com o domínio real.

---

## Verificação de saúde da API

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```
