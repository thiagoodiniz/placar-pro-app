# Placar Pro API 🚀

Backend robusto construído com Node.js, Express e Prisma para gerenciamento de campeonatos esportivos.

## 🛠️ Tecnologias
- **Node.js** & **TypeScript**
- **Express** (Framework Web)
- **Prisma** (ORM)
- **PostgreSQL** (Banco de Dados)
- **JWT** (Autenticação)
- **Google Auth** (Social Login)
- **Sentry** (Monitoramento de Erros)

## ⚙️ Setup

### 1. Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/placar_pro"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="sua_chave_secreta_jwt"
GOOGLE_CLIENT_ID="seu_google_client_id"
SENTRY_DSN="sua_sentry_dsn"
NODE_ENV="development"
```

### 2. Instalação e Execução
```bash
# Instalar dependências
npm install

# Rodar migrations do Prisma
npx prisma migrate dev

# Popular banco com dados iniciais (opcional)
npm run prisma:seed

# Iniciar em modo desenvolvimento
npm run dev
```

## 🔐 Autenticação e RBAC
O sistema utiliza **Role-Based Access Control**:
- `ADMIN`: Acesso total ao sistema e gestão de usuários.
- `MANAGER`: Gerencia campeonatos e times, mas não gerencia usuários.
- `USER`: Acesso apenas para visualização de resultados e tabelas.

## 📡 Endpoints Principais

### Autenticação
- `POST /auth/register`: Registro de novo usuário.
- `POST /auth/login`: Login tradicional.
- `POST /auth/google`: Login via Google OAuth.
- `GET /auth/users`: (Admin) Lista todos os usuários.
- `PATCH /auth/users/:userId/role`: (Admin) Altera permissão de um usuário.

### Campeonatos
- `GET /championships`: Lista campeonatos.
- `POST /championships`: Cria novo torneio (Manager+).
- `POST /championships/:id/start`: Inicia o torneio.
- `POST /championships/:id/next-phase`: Gera chaves da próxima fase (Mata-mata).
- `POST /championships/:id/fill-random-results`: (Admin) Gera placares automáticos.

### Times e Jogadores
- `GET /teams`: Lista todos os clubes.
- `POST /teams`: Cadastro de time com suporte a logo em Base64.
- `POST /teams/:id/players`: Cadastro de jogador com foto em Base64.

---
Desenvolvido com ❤️ para a comunidade esportiva.
