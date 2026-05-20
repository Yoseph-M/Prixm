# Prixm — Subscription & Bill Manager

Prixm is a highly polished, responsive **Subscription and Bill Intelligence Platform** designed to track recurring payments, normalize multi-currency transactions into USD, fire proactive renewal alerts, and present a sleek dashboard of spending trends.

Built as a decoupled monorepo, Prixm includes a **FastAPI backend** (with MongoDB Atlas + Redis) and a modern **Angular 18 dark-themed frontend**.

---

## 📂 Repository Structure

```
prixm/
├── backend/            # FastAPI REST API + Renewals Scheduler
│   ├── app/            # Main server, routers, database schemas, and background tasks
│   ├── tests/          # pytest integration and validation suites
│   └── Dockerfile      # Backend service container definition
├── frontend/           # Angular 18 client-side web application
│   ├── src/            # Angular modules, pages, components, and service integrations
│   └── Dockerfile      # Frontend service container definition
├── components/ui/      # Shared React/TSX component designs (Shadcn/Aceternity visual reference)
├── lib/                # Shared utilities and Tailwind class merger reference helpers
├── docker-compose.yml  # Main orchestration stack (Frontend, API, MongoDB, Redis)
└── README.md           # Onboarding developer documentation (This file)
```

---

## ⚡ Quick Start (Recommended — Docker Compose)

The fastest way to spin up the entire local ecosystem (Frontend, API, MongoDB, Redis) with pre-seeded test data is using Docker.

```bash
# 1. Start all containers and build services
docker compose up --build
```

Once initialized, the services will be running on:
* **Frontend Web Application**: [http://localhost:5173](http://localhost:5173)
* **FastAPI Backend REST API**: [http://localhost:8000](http://localhost:8000)
* **FastAPI Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **MongoDB Instance**: `mongodb://localhost:27017`
* **Redis Instance**: `redis://localhost:6379/0`

*On first boot, the backend automatically seeds 8 realistic subscriptions (Netflix, Spotify, AWS, Notion, iCloud+, Figma, ChatGPT, NYT), placing 3-day and 7-day alert windows immediately on your dashboard feeds.*

---

## 🛠️ Manual Local Development (Without Docker)

If you prefer to run the services individually on your system, follow the steps below.

### Prerequisites
* **Python**: 3.10 or higher
* **Node.js**: 20.x or higher
* **MongoDB**: A running local instance or a MongoDB Atlas connection string
* **Redis** (Optional): Fallback to in-memory cache is fully supported if `REDIS_URL` is omitted.

---

### Step 1: Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # On macOS/Linux
   python3 -m venv .venv
   source .venv/bin/activate

   # On Windows
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Install python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure your environment variables:
   ```bash
   cp .env.example .env
   # Open .env and adjust MONGODB_URI and REDIS_URL as needed.
   # Leave REDIS_URL blank to automatically activate the in-memory fallback adapter.
   ```

5. Start the backend development server:
   ```bash
   uvicorn app.main:app --reload
   ```
   *The API will start running at `http://127.0.0.1:8000`.*

---

### Step 2: Frontend Setup (Angular 18)

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install npm packages:
   ```bash
   npm install
   ```

3. Start the Angular local development server:
   ```bash
   npm start
   ```
   *The client web application will start running at `http://localhost:5173`.*

---

## 🧪 Running Tests

A comprehensive unit and integration test suite is located in `/backend/tests` to validate renewal scheduling offsets, alerts, and schema constraints.

To run the backend test suite locally:
```bash
cd backend
source .venv/bin/activate
pytest
```

---

## 🎨 Shared Components & References

The `/components/ui/` and `/lib/` directories at the root are configured as a standalone **TypeScript/React design sandbox**. This is highly beneficial for developers who wish to cross-reference styling guidelines or export premium React assets (like the Framer-motion `AuroraBackground` component) into their local development editors. 

The workspace root is configured with path mapping aliases (`@/*`) and IDE declarations in `tsconfig.json` and `package.json` for diagnostic correctness out of the box.

---

## 🔗 Architecture & Integrations

### 1. MongoDB Document Schema
Subscriptions are stored in a single `subscriptions` collection with payments embedded inline. This improves query performance, allows atomic `$push` updates, and keeps payments logically grouped under their respective billing plans:
```json
{
  "_id": "ObjectId",
  "name": "Netflix",
  "vendor": "Netflix Inc.",
  "category": "Entertainment",
  "tags": ["streaming", "media"],
  "cost": { "amount": 15.99, "currency": "USD" },
  "cost_usd": 15.99,
  "billing_cycle": "monthly",
  "next_renewal": "2026-05-23T17:00:00Z",
  "status": "active",
  "payments": [
    { "date": "2026-04-23T17:00:00Z", "amount": 15.99, "currency": "USD", "amount_usd": 15.99, "method": "Credit Card" }
  ],
  "created_at": "2026-04-23T17:00:00Z",
  "updated_at": "2026-04-23T17:00:00Z"
}
```

### 2. Redis Integration Patterns
* **`renewals:zset`**: A Sorted Set where values are subscription IDs and scores are timestamps of their `next_renewal`. The scheduler polls this once per minute using `ZRANGEBYSCORE` to track upcoming events in $O(\log N)$ time.
* **`alert:sent:{id}:{window}`**: An idempotency string guard with an active TTL to prevent multiple alert notifications from firing inside the same renewal cycle.
* **`fx:rates`**: A cached dictionary of foreign exchange conversion rates with a 12h TTL.
