PYTHON=python3

.PHONY: api-run web-dev db-up docker-up docker-down docker-logs docker-reset docker-build

# ── Local Development ────────────────────────────────
api-run:
	cd apps/api && uvicorn app.main:app --reload --port 8000

web-dev:
	cd frontend && npm run dev -- -p 3001

db-up:
	docker compose -f infra/docker-compose.yml up -d

# ── Docker (full stack) ──────────────────────────────
docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-reset:
	docker compose down -v
	docker compose up --build -d

docker-build:
	docker compose build --no-cache
