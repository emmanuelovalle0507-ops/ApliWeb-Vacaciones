# Local Setup (MVP)

## 1) Levantar PostgreSQL

Desde la raíz del monorepo:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## 2) Backend API (FastAPI)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs:
- http://localhost:8000/docs

## 3) Frontend (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Web:
- http://localhost:3000

## 4) Ejecutar tests API

```bash
cd apps/api
python -m pytest tests -q
```
