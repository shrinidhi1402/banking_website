# syntax=docker/dockerfile:1
# ============================================================
# Stage 1: builder — install deps into a venv
# ============================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv==0.4.10

COPY pyproject.toml .
COPY src/ src/

# Create venv and install prod deps only
RUN uv venv /opt/venv && \
    . /opt/venv/bin/activate && \
    uv pip install --no-cache -e ".[dev]"

# ============================================================
# Stage 2: final — minimal runtime image
# ============================================================
FROM python:3.12-slim AS final

# Security: run as non-root (architecture ss10.2 least-privilege)
RUN groupadd --gid 1001 crq && \
    useradd --uid 1001 --gid crq --no-create-home --shell /bin/false crq

WORKDIR /app

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv

# Copy source
COPY --chown=crq:crq src/ src/

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app/src"

USER crq

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "crq.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
