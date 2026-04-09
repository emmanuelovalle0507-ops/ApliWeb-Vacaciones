#!/bin/bash
set -e

# ── SEEKOP Vacaciones — Backend Entrypoint ───────────
# 1. Wait for PostgreSQL to be ready
# 2. Run Alembic migrations
# 3. Run seed (idempotent)
# 4. Start Gunicorn
# ─────────────────────────────────────────────────────

echo "⏳ Waiting for PostgreSQL..."

# Extract host and port from DATABASE_URL
# Format: postgresql+psycopg://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

# Default fallback
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

MAX_RETRIES=30
RETRY=0

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
    RETRY=$((RETRY + 1))
    if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        echo "❌ PostgreSQL not available after $MAX_RETRIES attempts. Exiting."
        exit 1
    fi
    echo "   Attempt $RETRY/$MAX_RETRIES — waiting 2s..."
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# ── Run migrations ───────────────────────────────────
echo "🔄 Running Alembic migrations..."
alembic upgrade head
echo "✅ Migrations complete!"

# ── Run seed (idempotent) ────────────────────────────
echo "🌱 Running seed data..."
python -m scripts.seed_mvp || echo "⚠️  Seed script finished with warnings (may already be seeded)"
echo "✅ Seed complete!"

# ── Start Gunicorn ───────────────────────────────────
echo "🚀 Starting Gunicorn on port ${PORT:-8000}..."
exec gunicorn app.main:app -c gunicorn.conf.py
