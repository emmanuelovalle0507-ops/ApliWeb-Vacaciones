from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    """Health check with DB connectivity — used by AWS ALB / Docker healthcheck."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    status = "healthy" if db_ok else "degraded"
    return {
        "status": status,
        "env": settings.app_env,
        "database": "connected" if db_ok else "unreachable",
    }
