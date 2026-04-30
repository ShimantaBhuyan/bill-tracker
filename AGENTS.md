# Agent Notes: Bill Tracker

Full-stack bill/receipt tracker. FastAPI + SQLite backend, React + Vite + Tailwind frontend.

## Project Layout

- `backend/` — FastAPI app (`main.py`), SQLite DB (`database.py`), Gemini analyzer (`analyzer.py`)
- `frontend/` — React 19 + TypeScript + Vite + TailwindCSS
- `docs/images/` — README screenshots only

## Backend

### Setup & Run

```bash
cd backend
cp .env.example .env      # edit before running
./start.sh                # creates .venv if missing, then uvicorn --reload on port 8000
```

Or manually:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Gotcha:** `start.sh` only creates `.venv` and installs requirements **once**. If `requirements.txt` changes later, delete `.venv` and rerun `./start.sh`, or activate the venv and `pip install -r requirements.txt` manually.

### Environment (`backend/.env`)

| Variable | Notes |
|----------|-------|
| `GEMINI_API_KEY` | Required for AI extraction. If missing, uploads still work but analysis is skipped. |
| `IMAGES_DIR` | **Must be an absolute path** where receipt images are stored. The app reads from and writes to this directory. |
| `DB_PATH` | SQLite file path. **Does NOT read from `.env` reliably** (see Gotchas below). Always use the default `./bills.db` or pre-export `DB_PATH` in the shell. |
| `GEMINI_MODEL` | Default in code is `gemini-2.0-flash`; `.env.example` uses `gemini-2.5-flash`. |
| `BATCH_SIZE` | Gemini concurrency limit for batch analyzer (default: 5). |

### Key Architecture

- `main.py` exposes REST API on port 8000. Auto-initializes SQLite schema on startup via `database.py`.
- DB uses WAL mode (`PRAGMA journal_mode=WAL`).
- `analyzer.py` can be run standalone for batch processing:
  - `python analyzer.py`
  - `python analyzer.py --reanalyze` (re-process all)
  - `python analyzer.py --batch-size 10` (override concurrency)
- Upload endpoint (`POST /api/upload`) saves images to `IMAGES_DIR` and queues background Gemini analysis via `BackgroundTasks`.
- Optional line-items extraction: pass `extract_line_items=true` during upload, or trigger later via `POST /api/bills/{id}/extract-line-items`.
- Valid `category` values: `food`, `fuel`, `parking`, `others`. API validates this on `PUT /api/bills/{id}`.
- CORS allows `http://localhost:5173` and `http://localhost:3000`.

### No Tests

Backend has no test suite, no pytest config, no CI.

## Frontend

### Setup & Run

```bash
cd frontend
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

### Build

```bash
npm run build        # runs `tsc -b && vite build`
npm run lint         # eslint only; no tests configured
```

### Key Architecture

- `frontend/src/api.ts` hardcodes API base URL to `http://localhost:8000`. The Vite dev proxy config (`vite.config.ts`) proxies `/api` to `:8000`, but the frontend code uses the absolute base URL, so the proxy is **bypassed** in current code.
- TypeScript project references: `tsconfig.json` delegates to `tsconfig.app.json` and `tsconfig.node.json`.
- Tailwind content paths: `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`.

### No Tests

No test runner or test scripts in `package.json`.

## Common Gotchas

- `IMAGES_DIR` must be an absolute path. Relative paths will likely break file I/O.
- If backend `.env` is missing, the app falls back to a hardcoded macOS path in `main.py` (`/Users/devkrishna/Downloads/MyBills_Apr30_2026/png_images`). Always configure `.env`.
- **`DB_PATH` is read at module import time in `database.py`, but `main.py` and `analyzer.py` both import `database` before calling `load_dotenv()`. This means `DB_PATH` in `.env` is ignored. The database always goes to `./bills.db` unless you explicitly export `DB_PATH` in your shell before running Python.**
- Uploads deduplicate by filename with an auto-increment suffix (`_1`, `_2`, etc.) if a file already exists in `IMAGES_DIR`.
- Database schema is auto-created on first startup; no migrations needed.
