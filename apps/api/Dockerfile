# ── SEEKOP Vacaciones — Backend API ──────────────────
# Python 3.12 slim + FastAPI + Gunicorn
# ─────────────────────────────────────────────────────

FROM python:3.12-slim AS base

# Prevent Python from writing .pyc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (pg_isready for health checks, gcc for some pip packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-client \
        gcc \
        libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy application code
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY gunicorn.conf.py ./

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy and prepare entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
