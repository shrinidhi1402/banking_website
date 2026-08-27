"""Models package — exports all ORM models for Alembic autodiscovery."""

from crq.models.base import AuditMixin, Base

__all__ = ["Base", "AuditMixin"]
