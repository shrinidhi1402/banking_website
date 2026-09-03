"""Unit tests for Settings configuration."""

from __future__ import annotations

import pytest

from crq.core.config import get_settings


@pytest.mark.unit
def test_settings_loads() -> None:
    settings = get_settings()
    assert settings.APP_NAME == "CRQ API"


@pytest.mark.unit
def test_disable_auth_default_true() -> None:
    """DISABLE_AUTH must default True - teammates must never be blocked."""
    assert get_settings().DISABLE_AUTH is True


@pytest.mark.unit
def test_keycloak_jwks_url_derived() -> None:
    s = get_settings()
    assert s.KEYCLOAK_REALM in s.KEYCLOAK_JWKS_URL
    assert "openid-connect/certs" in s.KEYCLOAK_JWKS_URL
