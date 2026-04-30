"""
Bill Analyzer - Uses Google Gemini Flash to analyze bill/invoice images
and store results in SQLite.

Usage:
    python analyzer.py
    python analyzer.py --reanalyze   # re-analyze already processed bills

Environment variables:
    GEMINI_API_KEY   required
    IMAGES_DIR       path to image folder
    GEMINI_MODEL     model name (default: gemini-2.0-flash)
    BATCH_SIZE       number of images to analyze in parallel (default: 5)
"""

import os
import sys
import json
import asyncio
import argparse
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image
from database import init_db, db

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
IMAGES_DIR = os.getenv("IMAGES_DIR", "/Users/devkrishna/Downloads/MyBills_Apr30_2026/png_images")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5"))

ANALYSIS_PROMPT = """
Analyze this bill or invoice image carefully and return a JSON object with exactly these fields:

{
  "category": "<one of: food, fuel, parking, others>",
  "description": "<1-2 word description of the bill type, e.g. 'Restaurant Bill', 'Petrol Fill', 'Parking Fee', 'Hotel Stay'>",
  "vendor": "<merchant or vendor name, or null if unclear>",
  "amount": <total amount as a number, or null if unclear>,
  "currency": "<currency code or symbol like INR, USD, $, ₹, or null if unclear>",
  "date": "<date in YYYY-MM-DD format, or null if not found>",
  "image_quality": "<good or poor>",
  "quality_note": "<describe any quality issues like blurry, too dark, partial image, etc., or null if image is clear>"
}

Category rules:
- food: restaurants, cafes, groceries, food delivery, canteen, bakery
- fuel: petrol, diesel, CNG, gas stations, EV charging
- parking: parking lots, valet, toll, parking fees
- others: anything else (hotels, medical, shopping, utilities, etc.)

Return ONLY the raw JSON object, no markdown, no code fences, no explanation.
If the image is completely unreadable or blank, set image_quality to "poor" and explain in quality_note.
"""


# ── Analysis ──────────────────────────────────────────────────────────────────

async def analyze_image_async(image_path: str, model) -> dict:
    """Send a single image to Gemini asynchronously and return parsed analysis."""
    try:
        # PIL Image.open is blocking but fast (just decoding headers initially)
        img = Image.open(image_path)
        response = await model.generate_content_async([ANALYSIS_PROMPT, img])
        raw_text = response.text.strip()

        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

        result = json.loads(raw_text)
        result["raw_analysis"] = raw_text
        result["analysis_status"] = "success"
        return result

    except json.JSONDecodeError as e:
        return {
            "category": "others",
            "description": "Parse Error",
            "vendor": None,
            "amount": None,
            "currency": None,
            "date": None,
            "image_quality": "poor",
            "quality_note": f"Could not parse Gemini response: {str(e)}",
            "raw_analysis": None,
            "analysis_status": "failed",
        }
    except Exception as e:
        return {
            "category": "others",
            "description": "Analysis Error",
            "vendor": None,
            "amount": None,
            "currency": None,
            "date": None,
            "image_quality": "poor",
            "quality_note": f"Analysis error: {str(e)}",
            "raw_analysis": None,
            "analysis_status": "failed",
        }


async def process_item(
    filename: str,
    images_dir: Path,
    model,
    index: int,
    total: int,
    semaphore: asyncio.Semaphore,
) -> tuple[str, dict]:
    """Analyze one image, respecting the concurrency semaphore, and save to DB."""
    async with semaphore:
        img_path = images_dir / filename
        print(f"  → [{index}/{total}] Starting  {filename}", flush=True)
        analysis = await analyze_image_async(str(img_path), model)
        upsert_bill(filename, str(img_path), analysis)

        status = analysis.get("analysis_status", "failed")
        category = analysis.get("category", "?")
        amount = analysis.get("amount")
        currency = analysis.get("currency", "")

        if status == "success":
            amount_str = f"{currency}{amount}" if amount else "no amount"
            print(f"  ✓ [{index}/{total}] Done      {filename} | {category} | {amount_str}", flush=True)
        else:
            note = analysis.get("quality_note", "unknown error")
            print(f"  ✗ [{index}/{total}] Failed    {filename} | {note}", flush=True)

        return filename, analysis


# ── DB helpers ────────────────────────────────────────────────────────────────

def upsert_bill(filename: str, image_path: str, analysis: dict):
    """Insert or update a bill record in the DB."""
    notes = None
    if analysis.get("image_quality") == "poor" and analysis.get("quality_note"):
        notes = f"Image quality issue: {analysis['quality_note']}"

    with db() as conn:
        conn.execute("""
            INSERT INTO bills (filename, image_path, category, description, vendor, amount,
                               currency, bill_date, notes, analysis_status, raw_analysis)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                category = excluded.category,
                description = excluded.description,
                vendor = excluded.vendor,
                amount = excluded.amount,
                currency = excluded.currency,
                bill_date = excluded.bill_date,
                notes = COALESCE(bills.notes, excluded.notes),
                analysis_status = excluded.analysis_status,
                raw_analysis = excluded.raw_analysis,
                updated_at = datetime('now')
        """, (
            filename,
            image_path,
            analysis.get("category", "others"),
            analysis.get("description"),
            analysis.get("vendor"),
            analysis.get("amount"),
            analysis.get("currency"),
            analysis.get("date"),
            notes,
            analysis.get("analysis_status", "failed"),
            analysis.get("raw_analysis"),
        ))


def register_pending(filename: str, image_path: str):
    """Register a bill as pending without analysis yet."""
    with db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO bills (filename, image_path, analysis_status)
            VALUES (?, ?, 'pending')
        """, (filename, image_path))


def get_pending_filenames() -> list[str]:
    with db() as conn:
        rows = conn.execute(
            "SELECT filename FROM bills WHERE analysis_status = 'pending'"
        ).fetchall()
        return [r["filename"] for r in rows]


# ── Main ──────────────────────────────────────────────────────────────────────

async def main_async(reanalyze: bool):
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY is not set. Add it to your .env file.")
        sys.exit(1)

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    images_dir = Path(IMAGES_DIR)
    if not images_dir.exists():
        print(f"ERROR: Images directory not found: {IMAGES_DIR}")
        sys.exit(1)

    init_db()

    image_files = (
        sorted(images_dir.glob("*.png"))
        + sorted(images_dir.glob("*.jpg"))
        + sorted(images_dir.glob("*.jpeg"))
    )
    print(f"Found {len(image_files)} image(s) in {IMAGES_DIR}")

    # Register all images as pending first
    for img_path in image_files:
        register_pending(img_path.name, str(img_path))

    if reanalyze:
        with db() as conn:
            conn.execute("UPDATE bills SET analysis_status = 'pending'")
        print("Marked all bills for re-analysis.")

    to_process = get_pending_filenames()
    total = len(to_process)
    print(f"Bills to analyze: {total}  |  Batch size: {BATCH_SIZE}\n")

    if not to_process:
        print("Nothing to analyze. Use --reanalyze to re-process all bills.")
        return

    # Semaphore caps how many Gemini calls run at the same time
    semaphore = asyncio.Semaphore(BATCH_SIZE)

    # Chunk the list into batches and process each batch fully before the next
    batches = [to_process[i : i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    num_batches = len(batches)
    completed = 0
    failed = 0

    for batch_num, batch in enumerate(batches, 1):
        print(f"── Batch {batch_num}/{num_batches} ({len(batch)} image(s)) ──────────────────────")

        tasks = [
            process_item(
                filename=filename,
                images_dir=images_dir,
                model=model,
                index=completed + local_idx + 1,
                total=total,
                semaphore=semaphore,
            )
            for local_idx, filename in enumerate(batch)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                failed += 1
                print(f"  ✗ Unexpected error: {result}", flush=True)
            else:
                _, analysis = result
                if analysis.get("analysis_status") == "failed":
                    failed += 1

        completed += len(batch)
        print()  # blank line between batches

    print("Analysis complete!")
    with db() as conn:
        stats = conn.execute("""
            SELECT analysis_status, COUNT(*) as count FROM bills GROUP BY analysis_status
        """).fetchall()
        for row in stats:
            print(f"  {row['analysis_status']}: {row['count']}")


def main():
    global BATCH_SIZE

    parser = argparse.ArgumentParser(description="Analyze bill images with Gemini")
    parser.add_argument("--reanalyze", action="store_true", help="Re-analyze already processed bills")
    parser.add_argument(
        "--batch-size",
        type=int,
        default=None,
        help=f"Override BATCH_SIZE env var (current default: {BATCH_SIZE})",
    )
    args = parser.parse_args()

    # Allow CLI override of batch size
    if args.batch_size is not None:
        BATCH_SIZE = args.batch_size

    asyncio.run(main_async(reanalyze=args.reanalyze))


if __name__ == "__main__":
    main()
