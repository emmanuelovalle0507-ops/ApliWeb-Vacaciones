"""
Gunicorn configuration for production.

Usage:
  gunicorn app.main:app -c gunicorn.conf.py

In dev, keep using: uvicorn app.main:app --reload --port 8000
"""

import multiprocessing
import os

# Bind
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# Workers: (2 × CPU cores) + 1 is the recommended formula
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout = 120
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Restart workers periodically to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50
