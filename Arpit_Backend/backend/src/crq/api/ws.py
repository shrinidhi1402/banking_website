"""WebSocket endpoint for real-time invalidation updates (architecture §5.5)."""

from __future__ import annotations

import json
from jose import JWTError, jwt

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from crq.core.config import get_settings
from crq.core.logging import get_logger
from crq.notifications.ws_manager import ws_manager

log = get_logger(__name__)

router = APIRouter()


@router.websocket("/ws/updates")
async def websocket_updates_endpoint(
    websocket: WebSocket,
    org_id: str = Query(default="1"),
    token: str | None = Query(default=None),
) -> None:
    """Real-time invalidation signaling WebSocket channel (WS /ws/updates).

    Clients receive lightweight cache-invalidation messages when risk state changes.
    """
    settings = get_settings()

    # 1. Auth check (respecting DISABLE_AUTH dev flag)
    if not settings.DISABLE_AUTH:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing auth token")
            return
        try:
            jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except JWTError as e:
            log.warning("websocket_jwt_validation_failed", error=str(e))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return

    # 2. Connect client to org channel
    await ws_manager.connect(websocket, org_id)

    try:
        # Send initial confirmation message
        await websocket.send_text(
            json.dumps(
                {
                    "type": "connected",
                    "org_id": org_id,
                    "message": "Subscribed to CRQ real-time invalidation stream",
                }
            )
        )

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")

                if action == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif action == "subscribe":
                    scope = msg.get("scope", "org")
                    scope_id = msg.get("scope_id")
                    ws_manager.subscribe(websocket, scope, scope_id)
                    await websocket.send_text(
                        json.dumps({"type": "subscribed", "scope": scope, "scope_id": scope_id})
                    )
                elif action == "unsubscribe":
                    scope = msg.get("scope", "org")
                    scope_id = msg.get("scope_id")
                    ws_manager.unsubscribe(websocket, scope, scope_id)
                    await websocket.send_text(
                        json.dumps({"type": "unsubscribed", "scope": scope, "scope_id": scope_id})
                    )
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON format"}))

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, org_id)
    except Exception as exc:
        log.warning("websocket_error", error=str(exc))
        ws_manager.disconnect(websocket, org_id)
