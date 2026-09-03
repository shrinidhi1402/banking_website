"""Alembic environment - configured for async SQLAlchemy 2.0.

Run migrations:
    alembic upgrade head

Create new migration:
    alembic revision --autogenerate -m "describe change"

NOTE: Uses DATABASE_URL_DIRECT (bypasses PgBouncer) for migrations.
"""
from __future__ import annotations

"""Alembic migrations.
WARNING: ALEMBIC IS DISABLED IN FAVOR OF MANUAL SQL.
All schema changes are tracked as raw SQL scripts in the `supabase/` directory at the project root.
Do not run `alembic upgrade head`. Execute scripts in the Supabase SQL Editor manually.
"""

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import all models so Alembic can detect schema changes
from crq.models import Base  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """Use direct DB URL (no PgBouncer) for migrations."""
    from crq.core.config import get_settings
    return get_settings().DATABASE_URL_DIRECT


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        version_table_schema="crq",
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
