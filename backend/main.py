"""
Bill Tracker API - FastAPI backend
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
import asyncio
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import init_db, db, row_to_dict
from analyzer import analyze_image_async, upsert_bill

load_dotenv()

IMAGES_DIR = os.getenv("IMAGES_DIR", "/Users/devkrishna/Downloads/MyBills_Apr30_2026/png_images")

app = FastAPI(title="Bill Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ── Models ────────────────────────────────────────────────────────────────────

VALID_CATEGORIES = {"food", "fuel", "parking", "others"}


class BillUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    bill_date: Optional[str] = None
    notes: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/bills")
def list_bills(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("date_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List all bills with optional filters and sorting."""
    with db() as conn:
        conditions = []
        params = []

        if category and category != "all":
            conditions.append("category = ?")
            params.append(category)

        if status:
            conditions.append("analysis_status = ?")
            params.append(status)

        if search:
            conditions.append("(vendor LIKE ? OR description LIKE ? OR notes LIKE ?)")
            like = f"%{search}%"
            params.extend([like, like, like])

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        offset = (page - 1) * page_size

        # Sort mapping
        order_clause = {
            "date_desc": "bill_date IS NOT NULL DESC, bill_date DESC, id DESC",
            "date_asc":  "bill_date IS NULL, bill_date ASC, id ASC",
            "amount_desc": "amount IS NOT NULL DESC, amount DESC, id DESC",
            "amount_asc":  "amount IS NULL, amount ASC, id ASC",
        }.get(sort, "bill_date IS NOT NULL DESC, bill_date DESC, id DESC")

        total = conn.execute(
            f"SELECT COUNT(*) as cnt FROM bills {where}", params
        ).fetchone()["cnt"]

        rows = conn.execute(
            f"""
            SELECT * FROM bills {where}
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
            """,
            params + [page_size, offset],
        ).fetchall()

        bills = [row_to_dict(r) for r in rows]

        # Get category summary counts
        category_counts = conn.execute("""
            SELECT category, COUNT(*) as count FROM bills GROUP BY category
        """).fetchall()
        summary = {r["category"]: r["count"] for r in category_counts}

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "bills": bills,
            "category_summary": summary,
        }


@app.get("/api/bills/{bill_id}")
def get_bill(bill_id: int):
    """Get a single bill by ID."""
    with db() as conn:
        row = conn.execute("SELECT * FROM bills WHERE id = ?", (bill_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bill not found")
        return row_to_dict(row)


@app.put("/api/bills/{bill_id}")
def update_bill(bill_id: int, update: BillUpdate):
    """Update category, notes, or other fields for a bill."""
    if update.category and update.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(VALID_CATEGORIES)}",
        )

    with db() as conn:
        row = conn.execute("SELECT id FROM bills WHERE id = ?", (bill_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bill not found")

        fields = {k: v for k, v in update.model_dump().items() if v is not None}
        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [bill_id]

        conn.execute(
            f"UPDATE bills SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values,
        )

        updated = conn.execute("SELECT * FROM bills WHERE id = ?", (bill_id,)).fetchone()
        return row_to_dict(updated)


@app.get("/api/images/{filename}")
def serve_image(filename: str):
    """Serve a bill image file."""
    # Security: prevent path traversal
    safe_name = Path(filename).name
    image_path = Path(IMAGES_DIR) / safe_name

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    suffix = image_path.suffix.lower()
    media_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
    media_type = media_types.get(suffix, "image/png")

    return FileResponse(str(image_path), media_type=media_type)


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def background_analyze(filenames: list[str]):
    """Run Gemini analysis on uploaded files in a background thread."""
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY not set. Skipping background analysis.")
        return

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    images_dir = Path(IMAGES_DIR)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        for filename in filenames:
            img_path = images_dir / filename
            if not img_path.exists():
                continue
            try:
                analysis = loop.run_until_complete(
                    analyze_image_async(str(img_path), model)
                )
            except Exception as e:
                analysis = {
                    "category": "others",
                    "description": "Analysis Error",
                    "vendor": None,
                    "amount": None,
                    "currency": None,
                    "date": None,
                    "image_quality": "poor",
                    "quality_note": str(e),
                    "raw_analysis": None,
                    "analysis_status": "failed",
                }
            upsert_bill(filename, str(img_path), analysis)
    finally:
        loop.close()


@app.post("/api/upload")
async def upload_receipts(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    """Upload receipt images and queue them for async analysis."""
    images_dir = Path(IMAGES_DIR)
    images_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    for file in files:
        safe_name = Path(file.filename).name
        dest = images_dir / safe_name

        # avoid overwriting existing files
        counter = 1
        original_dest = dest
        while dest.exists():
            stem = original_dest.stem
            suffix = original_dest.suffix
            dest = images_dir / f"{stem}_{counter}{suffix}"
            counter += 1
        safe_name = dest.name

        content = await file.read()
        with open(dest, "wb") as f:
            f.write(content)

        with db() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO bills (filename, image_path, analysis_status)
                VALUES (?, ?, 'pending')
                """,
                (safe_name, str(dest)),
            )
        saved.append(safe_name)

    if saved:
        background_tasks.add_task(background_analyze, saved)

    return {"uploaded": len(saved), "files": saved}


@app.get("/api/stats")
def get_stats():
    """Get aggregate statistics for the dashboard."""
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) as cnt FROM bills").fetchone()["cnt"]
        analyzed = conn.execute(
            "SELECT COUNT(*) as cnt FROM bills WHERE analysis_status = 'success'"
        ).fetchone()["cnt"]

        by_category = conn.execute("""
            SELECT category,
                   COUNT(*) as count,
                   SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_amount,
                   MIN(currency) as currency
            FROM bills
            WHERE analysis_status = 'success'
            GROUP BY category
        """).fetchall()

        total_spend = conn.execute(
            "SELECT SUM(amount) as total FROM bills WHERE amount IS NOT NULL"
        ).fetchone()["total"]

        return {
            "total_bills": total,
            "analyzed": analyzed,
            "pending": total - analyzed,
            "total_spend": total_spend,
            "by_category": [row_to_dict(r) for r in by_category],
        }


@app.get("/api/monthly")
def get_monthly():
    """Get monthly aggregated spend data for charting."""
    with db() as conn:
        rows = conn.execute("""
            SELECT
                substr(bill_date, 1, 7) as month,
                COUNT(*) as count,
                SUM(CASE WHEN amount IS NOT NULL THEN amount ELSE 0 END) as total_amount,
                MIN(currency) as currency
            FROM bills
            WHERE bill_date IS NOT NULL AND analysis_status = 'success'
            GROUP BY month
            ORDER BY month ASC
        """).fetchall()

        return {
            "data": [
                {
                    "month": r["month"],
                    "count": r["count"],
                    "total_amount": r["total_amount"],
                    "currency": r["currency"],
                }
                for r in rows
            ]
        }
