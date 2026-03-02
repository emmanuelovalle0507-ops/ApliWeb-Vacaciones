PYTHON=python3

.PHONY: api-run web-dev db-up

api-run:
	cd apps/api && uvicorn app.main:app --reload --port 8000

web-dev:
	cd apps/web && npm run dev

db-up:
	docker compose -f infra/docker-compose.yml up -d
