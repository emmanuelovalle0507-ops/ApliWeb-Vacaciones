"""WebSocket endpoint for real-time announcement events."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Connection Manager ───────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections keyed by user_id."""

    def __init__(self) -> None:
        # user_id -> list of websocket connections (user may have multiple tabs)
        self.active: dict[str, list[WebSocket]] = {}
        # team_id -> set of user_ids (for team-scoped broadcasts)
        self.user_teams: dict[str, str | None] = {}

    async def connect(self, websocket: WebSocket, user_id: str, team_id: str | None) -> None:
        await websocket.accept()
        self.active.setdefault(user_id, []).append(websocket)
        self.user_teams[user_id] = team_id
        logger.info("WS connected: user=%s team=%s  (total=%d)", user_id, team_id, self._count())

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self.active.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active.pop(user_id, None)
            self.user_teams.pop(user_id, None)
        logger.info("WS disconnected: user=%s  (total=%d)", user_id, self._count())

    async def send_to_user(self, user_id: str, data: dict[str, Any]) -> None:
        for ws in self.active.get(user_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    async def broadcast_to_all(self, data: dict[str, Any]) -> None:
        for user_id in list(self.active.keys()):
            await self.send_to_user(user_id, data)

    async def broadcast_to_team(self, team_id: str, data: dict[str, Any]) -> None:
        for uid, tid in list(self.user_teams.items()):
            if tid == team_id:
                await self.send_to_user(uid, data)

    async def broadcast_to_teams_or_all(
        self, team_ids: list[str], is_broadcast: bool, data: dict[str, Any],
    ) -> None:
        if is_broadcast:
            await self.broadcast_to_all(data)
        else:
            for tid in team_ids:
                await self.broadcast_to_team(tid, data)

    def _count(self) -> int:
        return sum(len(v) for v in self.active.values())


manager = ConnectionManager()


# ── Helper to broadcast from sync code ────────────────────

def broadcast_event(event_type: str, payload: dict[str, Any],
                    team_ids: list[str] | None = None, is_broadcast: bool = True) -> None:
    """Fire-and-forget broadcast. Safe to call from sync FastAPI endpoints."""
    data = {"type": event_type, **payload}
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    if is_broadcast or not team_ids:
        loop.create_task(manager.broadcast_to_all(data))
    else:
        loop.create_task(manager.broadcast_to_teams_or_all(team_ids, False, data))


# ── JWT verification for WS ──────────────────────────────

def _verify_ws_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("sub"):
            return payload
    except JWTError:
        pass
    return None


# ── WebSocket endpoint ────────────────────────────────────

@router.websocket("/ws/announcements")
async def ws_announcements(
    websocket: WebSocket,
    token: str = Query(""),
) -> None:
    payload = _verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id: str = payload["sub"]
    # Resolve team_id from DB (lightweight)
    team_id: str | None = None
    try:
        from app.db.session import SessionLocal
        from app.repositories.user_repo import UserRepository
        db = SessionLocal()
        try:
            user = UserRepository(db).get_by_id(user_id)
            if user and user.team_id:
                team_id = str(user.team_id)
        finally:
            db.close()
    except Exception:
        pass

    await manager.connect(websocket, user_id, team_id)
    try:
        while True:
            # Keep connection alive; client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)
