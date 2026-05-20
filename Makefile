.PHONY: dev test lint

dev:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	cd backend && pip install -q -r requirements.txt && python -m pytest tests/ -v

lint:
	cd backend && python -m compileall app tests
