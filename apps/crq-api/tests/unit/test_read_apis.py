"""Unit tests for B2.5 Read APIs and pagination utilities."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_risk_summary(client: AsyncClient) -> None:
    """GET /api/v1/risk/summary should return EAL, VaR, and provenance fields."""
    response = await client.get("/api/v1/risk/summary?scope=org")
    assert response.status_code == 200
    data = response.json()
    assert "eal" in data
    assert "var_95" in data
    assert "var_99" in data
    assert "calculation_version" in data
    assert "inputs_hash" in data
    assert "computed_at" in data
    assert data["eal"] > 0.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_risk_contributors(client: AsyncClient) -> None:
    """GET /api/v1/risk/contributors should return ranked contributors with percentages."""
    response = await client.get("/api/v1/risk/contributors?top=5")
    assert response.status_code == 200
    data = response.json()
    assert "total_eal" in data
    assert "top_contributors" in data
    assert len(data["top_contributors"]) <= 5
    if data["top_contributors"]:
        first = data["top_contributors"][0]
        assert "name" in first
        assert "eal_contribution" in first
        assert "percentage_of_total" in first


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_risk_history(client: AsyncClient) -> None:
    """GET /api/v1/risk/history should return time-series points."""
    response = await client.get("/api/v1/risk/history?scope=org")
    assert response.status_code == 200
    data = response.json()
    assert "points" in data
    assert len(data["points"]) > 0
    assert "timestamp" in data["points"][0]
    assert "eal" in data["points"][0]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_assets_crud_and_pagination(client: AsyncClient) -> None:
    """POST /api/v1/assets and GET /api/v1/assets should support creation and filtering."""
    org_id = str(uuid.uuid4())
    create_payload = {
        "org_id": org_id,
        "name": "SWIFT Node Prod",
        "hostname": "swift-01.bank.local",
        "asset_type": "server",
        "environment": "prod",
        "criticality_score": 9,
        "downtime_cost_per_hour": 50000.0,
    }

    # 1. Create asset
    create_res = await client.post("/api/v1/assets", json=create_payload)
    assert create_res.status_code == 201
    asset_id = create_res.json()["id"]

    # 2. List with criticality filter
    list_res = await client.get(f"/api/v1/assets?org_id={org_id}&criticality_min=8")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(item["id"] == asset_id for item in list_data["items"])

    # 3. Get single asset
    get_res = await client.get(f"/api/v1/assets/{asset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "SWIFT Node Prod"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_list_vulnerabilities(client: AsyncClient) -> None:
    """GET /api/v1/vulnerabilities should return backlog sorted by EAL contribution."""
    response = await client.get("/api/v1/vulnerabilities?sort=eal_contribution&order=desc")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) > 0
    assert "cve_id" in data["items"][0]
    assert "eal_contribution" in data["items"][0]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_control_effectiveness(client: AsyncClient) -> None:
    """GET /api/v1/controls/{id}/effectiveness should return score breakdown."""
    response = await client.get("/api/v1/controls/mfa/effectiveness")
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "mfa"
    assert "average_effectiveness" in data
    assert "average_coverage_pct" in data
    assert "average_config_quality" in data
    assert 0.0 <= data["average_effectiveness"] <= 1.0
