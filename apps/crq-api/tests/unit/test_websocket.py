"""Unit tests for B2.6 WebSocket layer and live signaling (architecture §5.5)."""

from __future__ import annotations

import uuid

import pytest
from starlette.testclient import TestClient

from crq.main import app
from crq.notifications.ws_manager import ws_manager


@pytest.mark.unit
def test_websocket_connection_and_subscription_flow() -> None:
    """Test client connection, scope subscription, and ping/pong over WebSocket."""
    org_id = uuid.uuid4()
    sync_client = TestClient(app)

    with sync_client.websocket_connect(f"/ws/updates?org_id={org_id}") as websocket:
        # 1. Handshake confirmation
        initial_msg = websocket.receive_json()
        assert initial_msg["type"] == "connected"
        assert initial_msg["org_id"] == str(org_id)

        # 2. Ping / Pong
        websocket.send_json({"action": "ping"})
        pong_msg = websocket.receive_json()
        assert pong_msg["type"] == "pong"

        # 3. Scope Subscription
        websocket.send_json({"action": "subscribe", "scope": "asset", "scope_id": "asset-101"})
        sub_msg = websocket.receive_json()
        assert sub_msg["type"] == "subscribed"
        assert sub_msg["scope"] == "asset"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_websocket_broadcast_signaling() -> None:
    """ws_manager should broadcast invalidation messages to org clients without payload data."""
    org_id = uuid.uuid4()
    # When no clients connected, returns 0 gracefully
    sent = await ws_manager.broadcast_to_org(
        org_id=org_id,
        message={"topic": "eal.updated", "scope": "org", "timestamp": "2026-08-28T20:00:00Z"},
    )
    assert sent == 0
