from fastapi import APIRouter

from app.api.v1.admin import router as admin_router
from app.api.v1.ai_chat import router as ai_chat_router
from app.api.v1.auth import router as auth_router
from app.api.v1.health import router as health_router
from app.api.v1.manager import router as manager_router
from app.api.v1.team_policies import router as team_policies_router
from app.api.v1.vacation_requests import router as vacation_requests_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(health_router, tags=["health"])
api_router.include_router(ai_chat_router)
api_router.include_router(vacation_requests_router)
api_router.include_router(manager_router)
api_router.include_router(team_policies_router)
api_router.include_router(admin_router)
