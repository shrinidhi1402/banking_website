"""Initial migration - no-op. Confirms Alembic pipeline works end to end.

Revision: 0001
Created: B0.2

Real schema migrations start in B1.1 (data model phase).
"""
from __future__ import annotations

from alembic import op

# revision identifiers
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | tuple[str, ...] | None = None
depends_on: str | tuple[str, ...] | None = None


def upgrade() -> None:
    """Create crq schema if not exists (extensions created by init.sql)."""
    op.execute("CREATE SCHEMA IF NOT EXISTS crq")


def downgrade() -> None:
    """Drop crq schema (caution: destroys all data)."""
    op.execute("DROP SCHEMA IF EXISTS crq CASCADE")
