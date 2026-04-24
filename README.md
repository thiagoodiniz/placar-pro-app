# Placar Pro API

Backend Node.js + Express + Prisma para o Placar Pro.

## Setup

### 1. Banco de dados
Configure o PostgreSQL e atualize o `.env`:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/placar_pro?schema=public"
PORT=3001
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="development"
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Migration e Seed
```bash
npm run prisma:migrate   # cria as tabelas
npm run prisma:seed      # popula dados iniciais (times + jogadores)
```

### 4. Rodar em desenvolvimento
```bash
npm run dev
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | /health | Health check |
| **Championships** | | |
| GET    | /championships | Lista todos |
| POST   | /championships | Cria novo |
| PATCH  | /championships/:id | Atualiza |
| DELETE | /championships/:id | Remove |
| POST   | /championships/:id/start | Inicia (mode: RANDOM\|MANUALLY) |
| POST   | /championships/:id/finalize-start | Finaliza início |
| POST   | /championships/:id/finish | Finaliza campeonato |
| POST   | /championships/:id/reset-matches | Reseta partidas |
| PUT    | /championships/:id/teams | Define times |
| GET    | /championships/:id/standings | Classificação |
| GET    | /championships/:id/top-scorers | Artilheiros |
| POST   | /championships/:id/fill-random-results | Preenche resultados aleatórios |
| GET    | /championships/:id/next-phase-preview | Preview próxima fase |
| POST   | /championships/:id/next-phase | Gera próxima fase |
| **Teams** | | |
| GET    | /teams | Lista todos |
| POST   | /teams | Cria time |
| PATCH  | /teams/:id | Atualiza time |
| DELETE | /teams/:id | Remove time |
| POST   | /teams/:id/players | Adiciona jogador |
| PATCH  | /teams/:id/players/:playerId | Atualiza jogador |
| DELETE | /teams/:id/players/:playerId | Remove jogador |
| **Groups** | | |
| GET    | /groups?championshipId=... | Lista grupos |
| POST   | /groups | Cria grupo |
| PATCH  | /groups/:id | Atualiza grupo |
| POST   | /groups/:id/generate-matches | Gera partidas do grupo |
| POST   | /groups/championship/:id/reset | Reseta grupos |
| POST   | /groups/championship/:id/auto-distribute | Distribui times automaticamente |
| POST   | /groups/championship/:id/generate-all-matches | Gera todas partidas dos grupos |
| **Matches** | | |
| GET    | /matches?championshipId=... | Lista partidas |
| POST   | /matches | Cria partida |
| PATCH  | /matches/:id | Atualiza partida (score + gols) |
