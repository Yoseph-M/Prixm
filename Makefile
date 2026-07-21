.PHONY: dev backend frontend test lint

backend:
	cd backend && ( [ -f .venv/bin/uvicorn ] && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 || uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 )

frontend:
	npm --prefix frontend start

dev:
	@echo "Starting backend and frontend..."
	$(MAKE) -j2 backend frontend

test:
	cd backend && ( [ -f .venv/bin/pytest ] && .venv/bin/pytest tests/ -v || python -m pytest tests/ -v )

lint:
	cd backend && python -m compileall app tests

