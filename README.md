# Prixm — Subscription & Bill Manager

Prixm is a highly polished, responsive **Subscription and Bill Intelligence Platform** designed to track recurring payments, normalize multi-currency transactions into USD, fire proactive renewal alerts, and present a sleek dashboard of spending trends.

Built as a decoupled monorepo, Prixm includes a **FastAPI backend** (with MongoDB Atlas + Redis) and a modern **React/Vite dark-themed frontend**.

---

## 📂 Repository Structure

```
prixm/
├── backend/            # FastAPI REST API + Renewals Scheduler
│   ├── app/            # Main server, routers, database schemas, and background tasks
│   └── tests/          # pytest integration and validation suites
├── frontend/           # React/Vite client-side web application
│   └── src/            # React pages, components, context, and service integrations
├── components/ui/      # Shared React/TSX component designs (Shadcn/Aceternity visual reference)
├── lib/                # Shared utilities and Tailwind class merger reference helpers
└── README.md           # Onboarding developer documentation (This file)
```

---

## 🛠️ Local Development

Follow the steps below to run the backend and frontend services individually on your system.

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

### Step 2: Frontend Setup (React/Vite)

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install npm packages:
   ```bash
   npm install
   ```

3. Start the Vite local development server:
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
