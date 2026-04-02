# versa_financeiro

Sistema de gerência financeira multi-cliente com DRE por Caixa e Competência.

## Sumário

- [Requisitos](#requisitos)
- [Instalação — primeira vez](#instalação--primeira-vez)
- [Execução em desenvolvimento](#execução-em-desenvolvimento)
- [Deploy em servidor — Docker](#deploy-em-servidor--docker)
- [Novo cliente — provisionar base de dados](#novo-cliente--provisionar-base-de-dados)
- [Novo usuário — criar acesso ao sistema](#novo-usuário--criar-acesso-ao-sistema)
- [Controle de acesso por módulo (roles)](#controle-de-acesso-por-módulo-roles)
- [Fluxo completo para onboarding de um novo cliente](#fluxo-completo-para-onboarding-de-um-novo-cliente)
- [Build de produção](#build-de-produção)
- [Verificação de saúde da API](#verificação-de-saúde-da-api)

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
3. (opcional) Carregar plano de contas padrão via interface → Importar → "Carregar Dados de Exemplo"
```

O usuário já pode fazer login em `http://localhost:5173` usando e-mail e senha.

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
