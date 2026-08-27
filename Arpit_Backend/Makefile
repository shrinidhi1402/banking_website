.PHONY: up down logs ps migrate test lint clean

# Start full dev stack
up:
	docker compose -f docker-compose.dev.yml up -d --build

# Stop all services
down:
	docker compose -f docker-compose.dev.yml down

# View logs (all services or specific: make logs s=crq-api)
logs:
	docker compose -f docker-compose.dev.yml logs -f $(s)

# Show running services
ps:
	docker compose -f docker-compose.dev.yml ps

# Run Alembic migrations
migrate:
	docker compose -f docker-compose.dev.yml exec crq-api alembic upgrade head

# Run tests inside container
test:
	docker compose -f docker-compose.dev.yml exec crq-api pytest tests/ -v

# Run tests locally (requires: pip install -e ".[dev]")
test-local:
	cd backend && pytest tests/ -v -m "unit or property"

# Lint + format check
lint:
	cd backend && ruff check src/ tests/ && ruff format --check src/ tests/

# Remove all docker volumes (DESTROYS ALL DATA)
clean:
	docker compose -f docker-compose.dev.yml down -v --remove-orphans

# Confirm pgvector + timescaledb extensions installed
check-extensions:
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d crq -c "\dx"
