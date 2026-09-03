"""Hypothesis property-based tests for FAIR math invariants.

These tests define the mathematical properties that MUST hold.
B1.3 implements the full FAIR engine - these run against a simplified
formula until then to validate the invariant structure.
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


@pytest.mark.property
@given(
    tef=st.floats(min_value=0.01, max_value=100.0, allow_nan=False),
    vuln_pct=st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
    lm=st.floats(min_value=0.0, max_value=1_000_000_000.0, allow_nan=False),
)
@settings(max_examples=500)
def test_eal_non_negative(tef: float, vuln_pct: float, lm: float) -> None:
    """EAL = LEF x LM must always be >= 0 for any valid inputs."""
    eal = tef * vuln_pct * lm
    assert eal >= 0.0


@pytest.mark.property
@given(
    tef_lo=st.floats(min_value=0.01, max_value=5.0, allow_nan=False),
    tef_hi=st.floats(min_value=5.01, max_value=100.0, allow_nan=False),
    vuln_pct=st.floats(min_value=0.01, max_value=1.0, allow_nan=False),
    lm=st.floats(min_value=1.0, max_value=1_000_000.0, allow_nan=False),
)
@settings(max_examples=200)
def test_eal_monotone_in_tef(tef_lo: float, tef_hi: float, vuln_pct: float, lm: float) -> None:
    """Higher threat event frequency must produce higher EAL (monotonicity)."""
    assert tef_hi * vuln_pct * lm >= tef_lo * vuln_pct * lm
