"""WebSocket manager supporting per-org scoped channels and signaling invalidations (architecture §5.5)."""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket

from crq.core.logging import get_logger

log = get_logger(__name__)


class WebSocketConnectionManager:
    """Manages active WebSocket connections grouped by organization and scopes."""

    def __init__(self) -> None:
        # org_id -> set of active WebSockets
        self.active_connections: dict[str, set[WebSocket]] = {}
        # ws -> set of subscribed scope keys (e.g. "org", "asset:<id>")
        self.subscriptions: dict[WebSocket, set[str]] = {}

    async def connect(self, websocket: WebSocket, org_id: str) -> None:
        """Accept new WebSocket connection and assign to tenant org."""
        await websocket.accept()
        if org_id not in self.active_connections:
            self.active_connections[org_id] = set()
        self.active_connections[org_id].add(websocket)
        self.subscriptions[websocket] = {"org"}  # Default subscription to org-wide events
        log.info(
            "websocket_connected",
            org_id=org_id,
            total_org_clients=len(self.active_connections[org_id]),
        )

    def disconnect(self, websocket: WebSocket, org_id: str) -> None:
        """Handle client disconnect."""
        if org_id in self.active_connections:
            self.active_connections[org_id].discard(websocket)
            if not self.active_connections[org_id]:
                del self.active_connections[org_id]
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        log.info("websocket_disconnected", org_id=org_id)

    def subscribe(self, websocket: WebSocket, scope: str, scope_id: str | None = None) -> None:
        """Register client subscription to specific scope."""
        key = f"{scope}:{scope_id}" if scope_id else scope
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(key)

    def unsubscribe(self, websocket: WebSocket, scope: str, scope_id: str | None = None) -> None:
        """Unsubscribe client from scope."""
        key = f"{scope}:{scope_id}" if scope_id else scope
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(key)

    async def broadcast_to_org(self, org_id: str, message: dict[str, Any]) -> int:
        """Broadcast a lightweight signaling invalidation message to connected clients of an org.

        Message shape per architecture §5.5:
        {"topic": "eal.updated", "scope": "asset", "scope_id": "...", "timestamp": "..."}
        """
        connections = self.active_connections.get(org_id, set()).copy()
        if not connections:
            return 0

        text_message = json.dumps(message)
        dead_connections: list[WebSocket] = []
        sent_count = 0

        for ws in connections:
            try:
                await ws.send_text(text_message)
                sent_count += 1
            except Exception as exc:
                log.warning("websocket_send_failed", error=str(exc))
                dead_connections.append(ws)

        for dead_ws in dead_connections:
            self.disconnect(dead_ws, org_id)

        log.debug("websocket_broadcast_completed", org_id=org_id, sent=sent_count)
        return sent_count


ws_manager = WebSocketConnectionManager()
