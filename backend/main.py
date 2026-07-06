# main.py
import os
import json
import logging
import threading
from datetime import date, datetime
from contextlib import asynccontextmanager
import math
import time
import random
import asyncio
import pandas as pd
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from dotenv import load_dotenv
load_dotenv()

# Firebase
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth as firebase_auth

from google.api_core.exceptions import ResourceExhausted, DeadlineExceeded, ServiceUnavailable
from groq import Groq
import base64
import uuid

# MongoDB
from pymongo import MongoClient, UpdateOne

from PIL import Image, ExifTags
import io

from schemas import L1AuthorityStatus, SMEAuthorityStatus, categorize_sensor_reading, normalize_to_pct

# ---------- Config ----------
CSV_FILE = "data/sensor_data.csv"
STATE_COLUMN = "state_name"
COLLECTION_NAME = "DWLR_state"   # Firestore collection (per state sub-collections)
API_KEY = os.getenv("API_KEY")    # self-issued secret gating this backend's own routes — not a CGWB/DWLR credential, the DWLR data itself is the static CSV in data/

# MongoDB config (Data Warehouse)
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "aquawatch")
MONGO_COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME", "states")   # one document per state, with data array
MONGO_STATE_FIELD_LIMIT = None     # we don't delete anything in MongoDB

FIREBASE_STATE_LIMIT = 200         # keep only latest 200 records per state in Firestore

# Admin/Super Admin credentials — .env-sourced per phase1.2.md section 6, never hardcoded.
ADMIN_CREDENTIALS = json.loads(os.getenv("ADMIN_CREDENTIALS", "{}"))   # {"WB@2026": "password", ...}
SUPER_ADMIN_ID = os.getenv("SUPER_ADMIN_ID")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD")

# state name -> admin_id prefix code, mirrors frontend/src/components/IndiaMap.tsx
STATE_CODES = {
    "Jammu and Kashmir": "JK", "Ladakh": "LA", "Himachal Pradesh": "HP", "Punjab": "PB",
    "Uttarakhand": "UK", "Haryana": "HR", "Delhi": "DL", "Uttar Pradesh": "UP",
    "Bihar": "BR", "Sikkim": "SK", "Arunachal Pradesh": "AR", "Nagaland": "NL",
    "Manipur": "MN", "Mizoram": "MZ", "Tripura": "TR", "Meghalaya": "ML",
    "Assam": "AS", "West Bengal": "WB", "Jharkhand": "JH", "Odisha": "OD",
    "Chhattisgarh": "CT", "Madhya Pradesh": "MP", "Rajasthan": "RJ", "Gujarat": "GJ",
    "Maharashtra": "MH", "Telangana": "TS", "Andhra Pradesh": "AP", "Karnataka": "KA",
    "Goa": "GA", "Kerala": "KL", "Tamil Nadu": "TN",
}


def _state_for_admin(admin_id: str) -> str | None:
    code = admin_id.split("@")[0].upper()
    return next((name for name, c in STATE_CODES.items() if c == code), None)


# ---------- Firebase Setup ----------
firebase_cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
firebase_cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

if firebase_cred_json:
    cred_dict = json.loads(firebase_cred_json)
    cred = credentials.Certificate(cred_dict)
elif firebase_cred_path:
    cred = credentials.Certificate(firebase_cred_path)
else:
    raise ValueError("Must set either FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ---------- Groq Setup ----------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# Short timeout + no retries: this call sits in the citizen's report-submission
# request path. Default SDK behavior (60s timeout x 2 retries) can hold the
# connection open long enough for the browser/proxy to drop it — which then
# surfaces to the user as a misleading "blocked by CORS policy" error, since
# CORS headers never get a chance to be read from an aborted response.
groq_client = Groq(api_key=GROQ_API_KEY, timeout=12.0, max_retries=0) if GROQ_API_KEY else None

# ---------- MongoDB Setup ----------
try:
    if not MONGO_URI:
        raise ValueError("MONGO_URI not set")
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    mongo_db = mongo_client[MONGO_DB_NAME]
    mongo_states_col = mongo_db[MONGO_COLLECTION_NAME]
    # Test connection
    mongo_client.admin.command('ping')
    print("✅ MongoDB connected successfully")
except Exception as e:
    print(f"⚠️ MongoDB connection failed: {e}")
    mongo_client = None
    mongo_states_col = None

l1_authority_col = mongo_db["L1Authority"] if mongo_client else None
incident_images_col = mongo_db["incident_images"] if mongo_client else None   # citizen report photos (Binary), avoids Firebase Storage billing
station_ranges_col = mongo_db["station_ranges"] if mongo_client else None   # populated by import_csv.py
sme_authority_col = mongo_db["SMEAuthority"] if mongo_client else None


# ---------- Helpers ----------
def load_csv():
    df = pd.read_csv(CSV_FILE)
    return df.to_dict(orient="records"), STATE_COLUMN


def is_valid_row(row: dict) -> bool:
    """Only ensure required essential fields exist: state_name, date."""
    for key in [STATE_COLUMN, "date"]:
        v = str(row.get(key, "")).strip()
        if v in ["", "nan", "None"]:
            return False
    return True


def normalize_row(row: dict) -> dict:
    """Convert NaN/'nan'/None/empty-string to actual Python None."""
    clean = {}
    for k, v in row.items():
        if isinstance(v, float) and math.isnan(v):
            clean[k] = None
        elif str(v).strip() in ["", "nan", "None"]:
            clean[k] = None
        else:
            clean[k] = v
    return clean


# ---------- API Key Verification ----------
def verify_api_key(api_key: str):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return True


# ---------- Filter to keep only latest 200 records per state ----------
def filter_latest_per_state(valid_records, limit=FIREBASE_STATE_LIMIT):
    """
    Keep only latest `limit` records per state BEFORE Firestore upload.
    This prevents quota exhaustion.
    """
    by_state = {}

    for row in valid_records:
        state = str(row.get(STATE_COLUMN, "Unknown")).strip() or "Unknown"
        by_state.setdefault(state, []).append(row)

    final_records = []
    for state, rows in by_state.items():
        # assume CSV is append-only → last rows are latest
        final_records.extend(rows[-limit:])

    return final_records



def enforce_firestore_state_limit(states_touched, limit=FIREBASE_STATE_LIMIT):
    if limit is None:
        return

    for state_id in states_touched:
        state_data_col = db.collection(COLLECTION_NAME).document(state_id).collection("data")
        docs = list(state_data_col.stream())

        # Prefer csv_index field when present; fallback to numeric document id.
        def _sort_key(d):
            data = d.to_dict() or {}
            if "csv_index" in data and data["csv_index"] is not None:
                return int(data["csv_index"])
            try:
                return int(d.id)
            except ValueError:
                return 0

        sorted_docs = sorted(docs, key=_sort_key)

        extra = len(sorted_docs) - limit
        if extra <= 0:
            continue

        batch = db.batch()
        count = 0
        for d in sorted_docs[:extra]:  # delete oldest extras
            batch.delete(d.reference)
            count += 1
            if count % 400 == 0:
                _firestore_commit_with_retry(batch)
                batch = db.batch()
        if count % 400 != 0:
            _firestore_commit_with_retry(batch)

        print(f"🧹 Deleted {count} old records for {state_id}; capped at {limit}.")


# ---------- Sync Logic ----------
def _firestore_commit_with_retry(batch, *, max_retries: int = 6, base_delay_s: float = 1.0, max_delay_s: float = 30.0):
    """
    Retry Firestore batch.commit() on transient/quota errors with exponential backoff + jitter.
    """
    for attempt in range(max_retries + 1):
        try:
            return batch.commit()
        except (ResourceExhausted, DeadlineExceeded, ServiceUnavailable) as e:
            if attempt >= max_retries:
                raise
            delay = min(max_delay_s, base_delay_s * (2 ** attempt))
            delay = delay * (0.5 + random.random())  # jitter
            print(f"⚠️ Firestore commit failed ({e.__class__.__name__}). Retrying in {delay:.1f}s ({attempt+1}/{max_retries})")
            time.sleep(delay)


def update_dwlr_aggregates(valid_records: list, state_column: str):
    """Keep DWLR_state/{state}'s flat waterLevel/statusColor fields current as
    new readings arrive — the same fields import_csv.py seeds historically,
    and the ones WaterDataContext.tsx:138 reads in preference to the raw
    per-reading subcollection. Without this, live-synced rows land in
    Firestore but never move the dashboard's current value."""
    if station_ranges_col is None:
        print("⚠️ station_ranges not available (MongoDB not connected); skipping dashboard aggregate update.")
        return

    deltas = {}   # state_id -> {"pct_sum": float, "pct_count": int}
    for row in valid_records:
        state_name = str(row.get(state_column, "")).strip()
        station_name = str(row.get("station_name", "")).strip()
        value = row.get("currentlevel")
        if not state_name or not station_name or value is None:
            continue

        range_doc = station_ranges_col.find_one({"_id": f"{state_name}||{station_name}"})
        if range_doc is None:
            continue   # new station never seen in the historical import — no range to normalize against yet

        pct = normalize_to_pct(float(value), range_doc["lo"], range_doc["hi"])
        state_id = state_name.replace(".", "_") or "Unknown"
        bucket = deltas.setdefault(state_id, {"pct_sum": 0.0, "pct_count": 0})
        bucket["pct_sum"] += pct
        bucket["pct_count"] += 1

    if not deltas:
        return

    batch = db.batch()
    for state_id, delta in deltas.items():
        ref = db.collection(COLLECTION_NAME).document(state_id)
        existing = ref.get().to_dict() or {}
        pct_sum = existing.get("_pctSum", 0.0) + delta["pct_sum"]
        pct_count = existing.get("_pctCount", 0) + delta["pct_count"]
        avg = pct_sum / pct_count if pct_count else 0.0
        batch.set(ref, {
            "waterLevel": avg,
            "statusColor": categorize_sensor_reading(avg).value,
            "_pctSum": pct_sum,
            "_pctCount": pct_count,
            "lastUpdated": datetime.utcnow(),
        }, merge=True)
    _firestore_commit_with_retry(batch)
    print(f"📊 DWLR_state aggregates updated for {len(deltas)} state(s).")


def sync_new_data():
    # Load CSV with small retry to avoid EmptyDataError during writes
    attempts = 3
    for attempt in range(attempts):
        try:
            records, state_column = load_csv()
            break
        except pd.errors.EmptyDataError:
            if attempt == attempts - 1:
                print("⚠️ CSV is empty right now; skipping sync.")
                return {"message": "⚠️ CSV empty, skipped sync."}
            time.sleep(0.2)

    total_rows = len(records)

    meta_ref = db.collection("metadata").document("upload_info")
    meta = meta_ref.get().to_dict() or {}
    last_index = meta.get("last_index", -1)
    old_last_index = meta.get("old_last_index", -1)

    if total_rows - 1 > last_index:
        new_records = records[last_index + 1:]
        valid_records = [normalize_row(r) for r in new_records if is_valid_row(r)]

        # 🔐 HARD LIMIT for Firestore (per state)
        valid_records = filter_latest_per_state(valid_records, FIREBASE_STATE_LIMIT)


        if not valid_records:
            meta_ref.set({"old_last_index": last_index, "last_index": total_rows - 1})
            print("⚡ No valid new data to upload.")
            return {"message": "⚡ No valid new data to upload."}

        batch_size = 500
        states_touched = set()
        total_uploaded = 0

        # Firebase: upload only the new rows
        for batch_start in range(0, len(valid_records), batch_size):
            batch = db.batch()
            batch_end = min(batch_start + batch_size, len(valid_records))
            for i, row in enumerate(valid_records[batch_start:batch_end],
                                    start=last_index + 1 + batch_start):
                original_state = str(row[state_column]).strip()
                state_id = original_state.replace(".", "_") or "Unknown"
                states_touched.add(state_id)

                # Add an explicit sortable index so we can keep "latest 200" reliably
                row_to_write = dict(row)
                row_to_write["csv_index"] = i

                doc_ref = (db.collection(COLLECTION_NAME)
                           .document(state_id)
                           .collection("data")
                           .document(str(i)))
                batch.set(doc_ref, row_to_write)

            _firestore_commit_with_retry(
                batch,
                max_retries=int(os.getenv("FIRESTORE_COMMIT_MAX_RETRIES", "6")),
                base_delay_s=float(os.getenv("FIRESTORE_COMMIT_BASE_DELAY_S", "1.0")),
                max_delay_s=float(os.getenv("FIRESTORE_COMMIT_MAX_DELAY_S", "30.0")),
            )
            total_uploaded += (batch_end - batch_start)

        # MongoDB: same new rows (if connected)
        if mongo_states_col is not None:
            mongo_batch_size = 1000
            total_mongo_written = 0

            for batch_start in range(0, len(valid_records), mongo_batch_size):
                batch_end = min(batch_start + mongo_batch_size, len(valid_records))
                state_buffer = {}

                # Group docs by state
                for i, row in enumerate(valid_records[batch_start:batch_end],
                                        start=last_index + 1 + batch_start):
                    state_id = str(row[state_column]).strip().replace(".", "_") or "Unknown"
                    mongo_doc = {
                        "date": row.get("date"),
                        "station_name": row.get("station_name"),
                        "district_name": row.get("district_name"),
                        "latitude": row.get("latitude"),
                        "longitude": row.get("longitude"),
                        "currentlevel": row.get("currentlevel"),
                        "level_diff": row.get("level_diff"),
                        "csv_index": i
                    }
                    state_buffer.setdefault(state_id, []).append(mongo_doc)

                # Prepare bulk operations: push arrays per state with upsert
                ops = []
                for state_id, docs in state_buffer.items():
                    MAX_PER_STATE = int(os.getenv("MONGO_STATE_LIMIT", "50000"))

                    ops.append(UpdateOne(
                        {"_id": state_id},
                        {
                            "$push": {
                                "data": {
                                    "$each": docs,
                                    "$slice": -MAX_PER_STATE
                                }
                            }
                        },
                        upsert=True
                    ))

                if ops:
                    try:
                        result = mongo_states_col.bulk_write(ops, ordered=False)
                        total_mongo_written += (result.modified_count + result.upserted_count)
                        print(f"📦 MongoDB bulk write: modified={result.modified_count}, upserts={len(result.upserted_ids or {})}")
                    except Exception as e:
                        print(f"❌ MongoDB bulk_write error: {e}")
        else:
            print("⚠️ MongoDB not connected. Skipping MongoDB uploads.")

        update_dwlr_aggregates(valid_records, state_column)

        # Update metadata to the new end of file
        meta_ref.set({
            "old_last_index": last_index,
            "last_index": last_index + len(valid_records)
        })

        # Enforce 200-per-state in Firebase after inserts
        if os.getenv("FIRESTORE_HARD_TRIM", "0") == "1":
            enforce_firestore_state_limit(states_touched, FIREBASE_STATE_LIMIT)

        print(f"✅ Firebase: {total_uploaded} new rows; trimmed to 200/state.")
        return {"message": f"✅ Firebase: {total_uploaded} new rows; trimmed to 200/state."}

    elif total_rows - 1 < last_index:
        print("⚠️ Rollback detected. Fixing metadata...")
        meta_ref.set({"old_last_index": last_index - 1, "last_index": old_last_index})
        return {"message": "♻️ Rollback handled."}
    else:
        print("⚡ No new changes detected.")
        return {"message": "⚡ No new changes detected."}


# ---------- Watchdog Event ----------
class CSVHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith(os.path.basename(CSV_FILE)):
            print("📌 CSV modified, syncing new data...")
            sync_new_data()


# ---------- Lifespan Context Manager (Modern FastAPI) ----------
async def _run_initial_sync_safely():
    try:
        await asyncio.to_thread(sync_new_data)
    except Exception as e:
        print(f"⚠️ Initial sync failed; continuing without it. Error: {type(e).__name__}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    meta_ref = db.collection("metadata").document("upload_info")
    meta = meta_ref.get().to_dict() or {}
    last_index = meta.get("last_index", None)

    if last_index is not None and last_index >= 0:
        print(f"⚡ Existing data detected (last_index={last_index}). Skipping initial sync.")
    else:
        print("🚀 No existing data. Running initial sync...")
        if os.getenv("RUN_INITIAL_SYNC", "1") == "1":
            if os.getenv("INITIAL_SYNC_BACKGROUND", "1") == "1":
                asyncio.create_task(_run_initial_sync_safely())
            else:
                await _run_initial_sync_safely()

    watch_dir = os.path.dirname(CSV_FILE) or "."
    if os.path.isdir(watch_dir):
        event_handler = CSVHandler()
        observer = Observer()
        observer.schedule(event_handler, path=watch_dir, recursive=False)
        threading.Thread(target=observer.start, daemon=True).start()
        print("👀 Watching CSV file for changes...")
    else:
        print(f"⚠️ {watch_dir}/ not found, skipping CSV watcher (no local CSV on this host).")

    yield

    # Shutdown
    if mongo_client:
        mongo_client.close()
        print("🔌 MongoDB connection closed.")


from fastapi.middleware.cors import CORSMiddleware

# ---------- FastAPI App ----------
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/today-data")
def get_today_data(api_key: str, valid: bool = Depends(verify_api_key)):
    today = str(date.today())
    results = {}

    for state_doc in db.collection(COLLECTION_NAME).stream():
        state_name = state_doc.id
        docs = (db.collection(COLLECTION_NAME)
                .document(state_name)
                .collection("data")
                .where("date", "==", today)
                .stream())
        results[state_name] = {doc.id: doc.to_dict() for doc in docs}

    return {"date": today, "records_by_state": results}


@app.get("/state-data")
def get_state_data(state: str, api_key: str, valid: bool = Depends(verify_api_key)):
    state_id = state.replace(".", "_")
    docs = db.collection(COLLECTION_NAME).document(state_id).collection("data").stream()
    results = {doc.id: doc.to_dict() for doc in docs}
    return {"state": state, "records": results}


@app.post("/sync")
def manual_sync(api_key: str, valid: bool = Depends(verify_api_key)):
    return sync_new_data()


@app.get("/mongo-state")
def mongo_state(state: str, api_key: str, valid: bool = Depends(verify_api_key)):
    if mongo_states_col is None:
        return {"error": "MongoDB not connected"}
    state_id = state.replace(".", "_")
    doc = mongo_states_col.find_one({"_id": state_id}, {"data": {"$slice": -5}})
    return {"state": state, "last5": doc.get("data", []) if doc else []}


# ---------- Incident Reports (citizen submission + AI analysis) ----------
def _exif_gps(image_bytes: bytes) -> tuple[float, float] | None:
    """Best-effort GPS extraction from image EXIF. Most phone photos re-encoded
    for upload strip this — returning None is the expected common case, not an error."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif = img.getexif()
        gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
        if not gps_ifd:
            return None

        def _to_deg(dms, ref):
            deg, minutes, seconds = (float(v) for v in dms)
            value = deg + minutes / 60 + seconds / 3600
            return -value if ref in ("S", "W") else value

        lat = _to_deg(gps_ifd[2], gps_ifd[1])
        lng = _to_deg(gps_ifd[4], gps_ifd[3])
        return (lat, lng)
    except Exception:
        return None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _avg_pct_for_rows(state: str, rows: list[dict]) -> tuple[float, int] | None:
    dates = sorted({r.get("date") for r in rows if r.get("date")}, reverse=True)[:5]
    pct_values = []
    for row in rows:
        if row.get("date") not in dates:
            continue
        value = row.get("currentlevel")
        station_name = str(row.get("station_name", "")).strip()
        if value is None or not station_name or station_ranges_col is None:
            continue
        range_doc = station_ranges_col.find_one({"_id": f"{state}||{station_name}"})
        if range_doc is None:
            continue
        pct_values.append(normalize_to_pct(float(value), range_doc["lo"], range_doc["hi"]))

    if not pct_values:
        return None
    return (sum(pct_values) / len(pct_values), len(dates))


def _district_sensor_avg(
    state: str, district: str, lat: float | None = None, lng: float | None = None,
) -> tuple[float, int, str] | None:
    """Average of the latest (up to 5) distinct days' normalized readings.
    Falls back, in order, from an exact district match to the nearest station
    in the state (by report coordinates) to a state-wide average — only
    returns None if the state itself has no data at all. The returned
    'source' tag lets the caller be honest with the citizen about how local
    the reading actually is."""
    if mongo_states_col is None:
        return None
    state_id = state.replace(".", "_")
    doc = mongo_states_col.find_one({"_id": state_id})
    if not doc:
        return None
    all_rows = doc.get("data", [])
    if not all_rows:
        return None

    district_rows = [r for r in all_rows if str(r.get("district_name", "")).strip().lower() == district.strip().lower()]
    if district_rows:
        result = _avg_pct_for_rows(state, district_rows)
        if result:
            return (result[0], result[1], "district")

    if lat is not None and lng is not None:
        stations = {}
        for r in all_rows:
            station_name = r.get("station_name")
            station_lat, station_lng = r.get("latitude"), r.get("longitude")
            if station_name and station_lat is not None and station_lng is not None:
                stations.setdefault(station_name, (station_lat, station_lng))
        if stations:
            nearest = min(stations, key=lambda s: _haversine_km(lat, lng, stations[s][0], stations[s][1]))
            nearest_rows = [r for r in all_rows if r.get("station_name") == nearest]
            result = _avg_pct_for_rows(state, nearest_rows)
            if result:
                return (result[0], result[1], "nearest_station")

    result = _avg_pct_for_rows(state, all_rows)
    if result:
        return (result[0], result[1], "state_average")
    return None


def _analyze_image(image_bytes: bytes, description: str, state: str, district: str) -> dict | None:
    """Groq vision analysis. Returns None on any failure — the report still
    gets submitted with the rest of its fields either way."""
    if groq_client is None:
        return None
    try:
        encoded = base64.b64encode(image_bytes).decode('utf-8')
        prompt = (
            "You are analyzing a citizen-submitted water-incident photo from "
            f"{district}, {state}, India. Citizen's description: "
            f"\"{description or 'none provided'}\". "
            "Respond with ONLY a JSON object (no markdown fences) with keys: "
            "summary (1-2 sentence factual description of what the image shows), "
            "hazard_type (short label, e.g. 'flooding', 'contamination', 'pipe leak', 'drought/dry well', 'other'), "
            "severity ('low', 'medium', or 'high'), "
            "confidence (0.0-1.0 float, your confidence the image genuinely shows a water-related incident)."
        )
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            reasoning_effort="none",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{encoded}",
                            },
                        },
                    ],
                }
            ],
        )
        text = response.choices[0].message.content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(text)
        return {
            "summary": parsed.get("summary", ""),
            "hazardType": parsed.get("hazard_type"),
            "severity": parsed.get("severity"),
            "confidence": parsed.get("confidence"),
        }
    except Exception as e:
        logging.exception(f"Groq analysis failed: {e}")
        return None


@app.get("/incident-reports/image/{image_id}")
def get_incident_image(image_id: str):
    if incident_images_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    from bson import ObjectId
    from fastapi.responses import Response
    doc = incident_images_col.find_one({"_id": ObjectId(image_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=bytes(doc["data"]), media_type=doc.get("content_type", "image/jpeg"))


@app.post("/incident-reports")
async def create_incident_report(
    request: Request,
    image: UploadFile = File(...),
    description: str = Form(""),
    state: str = Form(...),
    district: str = Form(...),
    city: str = Form(""),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    citizen_session_id: str = Form(...),
):
    if incident_images_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    image_bytes = await image.read()

    if lat is None or lng is None:
        exif_coords = _exif_gps(image_bytes)
        if exif_coords:
            lat, lng = exif_coords

    from bson import Binary
    image_doc = incident_images_col.insert_one({
        "data": Binary(image_bytes),
        "content_type": image.content_type or "image/jpeg",
        "created_at": datetime.utcnow(),
    })
    image_url = f"{str(request.base_url).rstrip('/')}/incident-reports/image/{image_doc.inserted_id}"

    sensor_avg = _district_sensor_avg(state, district, lat, lng)
    sensor_reading = round(sensor_avg[0], 1) if sensor_avg else 0
    sensor_based_on_days = sensor_avg[1] if sensor_avg else 0
    sensor_source = sensor_avg[2] if sensor_avg else "unavailable"
    sensor_category = categorize_sensor_reading(sensor_reading).value

    ai_analysis = _analyze_image(image_bytes, description, state, district)

    doc_data = {
        "imageUrl": image_url,
        "location": {"lat": lat, "lng": lng, "state": state, "district": district, "city": city},
        "description": description,
        "aiAnalysis": ai_analysis,
        "sensorReading": sensor_reading,
        "sensorCategory": sensor_category,
        "sensorBasedOnDays": sensor_based_on_days,
        "sensorSource": sensor_source,
        "status": "pending",
        "citizenSessionId": citizen_session_id,
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    _, doc_ref = db.collection("IncidentReports").add(doc_data)
    created = doc_ref.get().to_dict()
    created["id"] = doc_ref.id
    return created


# ---------- Incident report status workflow ----------
# Single source of truth for legal transitions.
VALID_REPORT_TRANSITIONS = {
    "pending":     {"verified", "rejected", "escalated"},   # L1 actions
    "verified":    {"assigned"},                              # admin actions
    "escalated":   {"assigned"},
    "assigned":    {"in_progress", "resolved"},               # SME → in_progress, admin → resolved
    "in_progress": {"resolved"},                             # SME → resolved
}


def _append_report_history(report_ref, status: str, actor_role: str, actor_id: str, note: str | None = None):
    entry = {"status": status, "actor_role": actor_role, "actor_id": actor_id, "at": datetime.utcnow()}
    if note:
        entry["note"] = note
    report_ref.update({
        "status": status,
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "history": firestore.ArrayUnion([entry]),
    })


class L1ReportStatusUpdate(BaseModel):
    id_token: str
    status: str
    note: str | None = None


@app.post("/l1/{govt_id}/reports/{report_id}/status")
def l1_update_report_status(govt_id: str, report_id: str, req: L1ReportStatusUpdate):
    if req.status not in {"verified", "rejected", "escalated"}:
        raise HTTPException(status_code=400, detail="Invalid status for an L1 action")

    try:
        decoded = firebase_auth.verify_id_token(req.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    l1 = l1_authority_col.find_one({"govt_id": govt_id})
    if not l1 or l1.get("status") != L1AuthorityStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Not an approved L1 authority")
    if decoded.get("email") != _l1_synthetic_email(govt_id):
        raise HTTPException(status_code=403, detail="Session does not belong to this authority")

    report_ref = db.collection("IncidentReports").document(report_id)
    snap = report_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Report not found")
    report = snap.to_dict()

    assigned_loc = l1.get("assigned_location", {})
    report_loc = report.get("location", {})
    if assigned_loc.get("district") and report_loc.get("district") != assigned_loc["district"]:
        raise HTTPException(status_code=403, detail="Report is outside your assigned district")

    current = report.get("status")
    if req.status not in VALID_REPORT_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move report from {current} to {req.status}")

    _append_report_history(report_ref, req.status, "l1", govt_id, req.note)
    return {"message": f"Report {req.status}", "status": req.status}


class AdminReportStatusUpdate(BaseModel):
    admin_password: str
    status: str
    departments: list[str] | None = None
    note: str | None = None


@app.post("/admin/{admin_id}/reports/{report_id}/status")
def admin_update_report_status(admin_id: str, report_id: str, req: AdminReportStatusUpdate):
    if ADMIN_CREDENTIALS.get(admin_id) != req.admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if req.status not in {"assigned", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid status for an admin action")

    report_ref = db.collection("IncidentReports").document(report_id)
    snap = report_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Report not found")
    report = snap.to_dict()

    admin_state = _state_for_admin(admin_id)
    if admin_state and report.get("location", {}).get("state") != admin_state:
        raise HTTPException(status_code=403, detail="Report belongs to a different state")

    current = report.get("status")
    if req.status not in VALID_REPORT_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move report from {current} to {req.status}")

    extra = {}
    if req.status == "assigned":
        if not req.departments:
            raise HTTPException(status_code=400, detail="At least one department is required")
        extra["assignedDepartments"] = req.departments
    if extra:
        report_ref.update(extra)

    _append_report_history(report_ref, req.status, "admin", admin_id, req.note)
    return {"message": f"Report {req.status}", "status": req.status}


# ---------- Auth: L1 Authority / Admin / Super Admin ----------
# L1 Authority credentials live in Firebase Auth itself (synthetic email,
# account created `disabled` until Admin approval) rather than a second
# hand-rolled password store. Admin/Super Admin have no self-registration —
# checked directly against ADMIN_CREDENTIALS / SUPER_ADMIN_* env vars.
#
# curl -X POST localhost:8000/l1-authority/register -H 'Content-Type: application/json' \
#   -d '{"govt_id":"GOVT1","name":"Officer","password":"secret123","state":"WB","district":"Kolkata"}'
# curl -X POST 'localhost:8000/l1-authority/GOVT1/approve?admin_id=WB@2026&admin_password=...'
# curl -X POST localhost:8000/admin/login -H 'Content-Type: application/json' -d '{"id":"WB@2026","password":"..."}'

class L1RegisterRequest(BaseModel):
    govt_id: str
    name: str
    password: str
    state: str
    district: str


class LoginRequest(BaseModel):
    id: str
    password: str


def _l1_synthetic_email(govt_id: str) -> str:
    return f"{govt_id}@l1.aquawatch.internal"


@app.post("/l1-authority/register")
def register_l1_authority(req: L1RegisterRequest):
    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    if l1_authority_col.find_one({"govt_id": req.govt_id}):
        raise HTTPException(status_code=409, detail="govt_id already registered")

    try:
        firebase_auth.create_user(
            email=_l1_synthetic_email(req.govt_id),
            password=req.password,
            disabled=True,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="govt_id already registered")

    l1_authority_col.insert_one({
        "govt_id": req.govt_id,
        "name": req.name,
        "assigned_location": {"state": req.state, "district": req.district},
        "status": L1AuthorityStatus.PENDING.value,
        "approved_by": None,
        "created_at": datetime.utcnow(),
    })
    return {"message": "Registered. Awaiting admin approval.", "status": "pending"}


@app.get("/l1-authority/{govt_id}")
def get_l1_authority(govt_id: str):
    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = l1_authority_col.find_one({"govt_id": govt_id})
    if not record:
        raise HTTPException(status_code=404, detail="L1 authority not found")
    record["_id"] = str(record["_id"])
    return record


@app.post("/l1-authority/{govt_id}/approve")
def approve_l1_authority(govt_id: str, admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")

    record = l1_authority_col.find_one({"govt_id": govt_id})
    if not record:
        raise HTTPException(status_code=404, detail="L1 authority not found")

    admin_state = _state_for_admin(admin_id)
    if admin_state and record.get("assigned_location", {}).get("state") != admin_state:
        raise HTTPException(status_code=403, detail="This authority belongs to a different state")

    user = firebase_auth.get_user_by_email(_l1_synthetic_email(govt_id))
    firebase_auth.update_user(user.uid, disabled=False)

    l1_authority_col.update_one(
        {"govt_id": govt_id},
        {"$set": {"status": L1AuthorityStatus.APPROVED.value, "approved_by": admin_id}},
    )
    return {"message": "Approved", "status": "approved"}


@app.get("/admin/{admin_id}/pending-l1")
def get_pending_l1_authorities(admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    
    query = {"status": L1AuthorityStatus.PENDING.value}
    admin_state = _state_for_admin(admin_id)
    if admin_state:
        query["assigned_location.state"] = admin_state
    cursor = l1_authority_col.find(query)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"pending": results}

@app.get("/admin/{admin_id}/all-l1")
def get_all_l1_authorities(admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    
    query = {}
    admin_state = _state_for_admin(admin_id)
    if admin_state:
        query["assigned_location.state"] = admin_state
        
    cursor = l1_authority_col.find(query)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"authorities": results}

class UpdateStatusRequest(BaseModel):
    status: str

@app.post("/admin/{admin_id}/l1-status/{govt_id}")
def update_l1_status(admin_id: str, govt_id: str, admin_password: str, req: UpdateStatusRequest):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if l1_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
        
    record = l1_authority_col.find_one({"govt_id": govt_id})
    if not record:
        raise HTTPException(status_code=404, detail="L1 authority not found")
        
    admin_state = _state_for_admin(admin_id)
    if admin_state and record.get("assigned_location", {}).get("state") != admin_state:
        raise HTTPException(status_code=403, detail="This authority belongs to a different state")
        
    l1_authority_col.update_one(
        {"govt_id": govt_id},
        {"$set": {"status": req.status}}
    )
    return {"message": f"Status updated to {req.status}", "status": req.status}


@app.post("/admin/login")
def admin_login(req: LoginRequest):
    if req.id in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[req.id] == req.password:
        return {"ok": True, "role": "admin", "id": req.id}
    raise HTTPException(status_code=401, detail="Invalid admin credentials")


@app.post("/superadmin/login")
def superadmin_login(req: LoginRequest):
    if SUPER_ADMIN_ID and req.id == SUPER_ADMIN_ID and req.password == SUPER_ADMIN_PASSWORD:
        return {"ok": True, "role": "superadmin", "id": req.id}
    raise HTTPException(status_code=401, detail="Invalid super admin credentials")


@app.post("/admin/{admin_id}/upload-csv")
async def admin_upload_csv(admin_id: str, admin_password: str = Form(...), file: UploadFile = File(...)):
    """Lets a state admin manually push sensor readings (e.g. dummy demo data)
    through the same Firestore/Mongo pipeline sync_new_data() uses, without
    needing the live CGWB feed. Scoped to the admin's own state."""
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")

    admin_state = _state_for_admin(admin_id)
    if not admin_state:
        raise HTTPException(status_code=400, detail="Could not determine state for this admin")

    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    required_cols = {"state_name", "date", "station_name", "currentlevel"}
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"CSV missing required columns: {sorted(missing)}")

    records = df.to_dict(orient="records")
    valid_records = [normalize_row(r) for r in records if is_valid_row(r)]

    skipped_other_state = sum(
        1 for r in valid_records if str(r.get("state_name", "")).strip().lower() != admin_state.lower()
    )
    valid_records = [
        r for r in valid_records if str(r.get("state_name", "")).strip().lower() == admin_state.lower()
    ]
    for r in valid_records:
        r["state_name"] = admin_state  # normalize casing/spacing to the canonical name

    if not valid_records:
        return {"message": "No rows matched your state.", "rows_written": 0, "skipped_other_state": skipped_other_state}

    state_id = admin_state.replace(".", "_")

    # Firestore: same per-state subcollection shape sync_new_data() writes, with
    # unique upload-scoped doc ids so they can't collide with the CSV-index-based ids
    batch = db.batch()
    for row in valid_records:
        row_to_write = dict(row)
        row_to_write["csv_index"] = None
        row_to_write["source"] = row_to_write.get("source") or "manual_upload"
        doc_ref = (db.collection(COLLECTION_NAME)
                   .document(state_id)
                   .collection("data")
                   .document(f"upload_{uuid.uuid4().hex}"))
        batch.set(doc_ref, row_to_write)
    _firestore_commit_with_retry(batch)

    # MongoDB: same $push-with-slice shape as sync_new_data()
    if mongo_states_col is not None:
        docs = [{
            "date": r.get("date"),
            "station_name": r.get("station_name"),
            "district_name": r.get("district_name"),
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
            "currentlevel": r.get("currentlevel"),
            "level_diff": r.get("level_diff"),
            "csv_index": None,
        } for r in valid_records]
        MAX_PER_STATE = int(os.getenv("MONGO_STATE_LIMIT", "50000"))
        mongo_states_col.update_one(
            {"_id": state_id},
            {"$push": {"data": {"$each": docs, "$slice": -MAX_PER_STATE}}},
            upsert=True,
        )

    # New stations have no historical station_ranges doc (import_csv.py, which
    # populated it, no longer runs) — self-compute a 0-100 range for them so
    # update_dwlr_aggregates() can still bucket their readings into a category.
    if station_ranges_col is not None:
        for r in valid_records:
            station = str(r.get("station_name", "")).strip()
            if not station:
                continue
            range_id = f"{admin_state}||{station}"
            if station_ranges_col.find_one({"_id": range_id}) is None:
                station_ranges_col.insert_one({"_id": range_id, "lo": 0.0, "hi": 100.0})

    update_dwlr_aggregates(valid_records, STATE_COLUMN)

    return {
        "message": f"Uploaded {len(valid_records)} row(s) for {admin_state}.",
        "rows_written": len(valid_records),
        "skipped_other_state": skipped_other_state,
    }


# =====================================================================
# SME / Authority endpoints
# =====================================================================

def _sme_synthetic_email(sme_id: str) -> str:
    return f"{sme_id}@sme.aquawatch.internal"


class SMERegisterRequest(BaseModel):
    sme_id: str
    name: str
    password: str
    state: str
    department: str


@app.post("/sme-authority/register")
def register_sme_authority(req: SMERegisterRequest):
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    if sme_authority_col.find_one({"sme_id": req.sme_id}):
        raise HTTPException(status_code=409, detail="sme_id already registered")

    try:
        firebase_auth.create_user(
            email=_sme_synthetic_email(req.sme_id),
            password=req.password,
            disabled=True,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="sme_id already registered")

    sme_authority_col.insert_one({
        "sme_id": req.sme_id,
        "name": req.name,
        "state": req.state,
        "department": req.department,
        "status": SMEAuthorityStatus.PENDING.value,
        "approved_by": None,
        "created_at": datetime.utcnow(),
    })
    return {"message": "Registered. Awaiting admin approval.", "status": "pending"}


@app.get("/sme-authority/{sme_id}")
def get_sme_authority(sme_id: str):
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = sme_authority_col.find_one({"sme_id": sme_id})
    if not record:
        raise HTTPException(status_code=404, detail="SME authority not found")
    record["_id"] = str(record["_id"])
    return record


@app.post("/sme-authority/{sme_id}/approve")
def approve_sme_authority(sme_id: str, admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")

    record = sme_authority_col.find_one({"sme_id": sme_id})
    if not record:
        raise HTTPException(status_code=404, detail="SME authority not found")

    admin_state = _state_for_admin(admin_id)
    if admin_state and record.get("state") != admin_state:
        raise HTTPException(status_code=403, detail="This authority belongs to a different state")

    user = firebase_auth.get_user_by_email(_sme_synthetic_email(sme_id))
    firebase_auth.update_user(user.uid, disabled=False)

    sme_authority_col.update_one(
        {"sme_id": sme_id},
        {"$set": {"status": SMEAuthorityStatus.APPROVED.value, "approved_by": admin_id}},
    )
    return {"message": "Approved", "status": "approved"}


@app.get("/admin/{admin_id}/pending-sme")
def get_pending_sme_authorities(admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    query = {"status": SMEAuthorityStatus.PENDING.value}
    admin_state = _state_for_admin(admin_id)
    if admin_state:
        query["state"] = admin_state
    cursor = sme_authority_col.find(query)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"pending": results}


@app.get("/admin/{admin_id}/all-sme")
def get_all_sme_authorities(admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    query = {}
    admin_state = _state_for_admin(admin_id)
    if admin_state:
        query["state"] = admin_state
    cursor = sme_authority_col.find(query)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"authorities": results}


@app.post("/admin/{admin_id}/sme-status/{sme_id}")
def update_sme_status(admin_id: str, sme_id: str, admin_password: str, req: UpdateStatusRequest):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = sme_authority_col.find_one({"sme_id": sme_id})
    if not record:
        raise HTTPException(status_code=404, detail="SME authority not found")
    admin_state = _state_for_admin(admin_id)
    if admin_state and record.get("state") != admin_state:
        raise HTTPException(status_code=403, detail="This authority belongs to a different state")
    sme_authority_col.update_one(
        {"sme_id": sme_id},
        {"$set": {"status": req.status}}
    )
    return {"message": f"Status updated to {req.status}", "status": req.status}


class SMELoginRequest(BaseModel):
    sme_id: str
    password: str


@app.post("/sme/login")
def sme_login(req: SMELoginRequest):
    """Validates SME credentials via Firebase and returns the SME profile."""
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = sme_authority_col.find_one({"sme_id": req.sme_id})
    if not record or record.get("status") != SMEAuthorityStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Not an approved SME authority")
    record["_id"] = str(record["_id"])
    return {"ok": True, "role": "sme", "sme_id": req.sme_id,
            "name": record.get("name"), "state": record.get("state"),
            "department": record.get("department")}


class SMEReportStatusUpdate(BaseModel):
    id_token: str
    status: str
    note: str | None = None


@app.post("/sme/{sme_id}/reports/{report_id}/status")
def sme_update_report_status(sme_id: str, report_id: str, req: SMEReportStatusUpdate):
    """SME can move a report from `assigned` → `in_progress` or
    `in_progress` → `resolved`. The report must be assigned to the SME's
    department to be actionable."""
    if req.status not in {"in_progress", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid status for an SME action")

    try:
        decoded = firebase_auth.verify_id_token(req.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    sme = sme_authority_col.find_one({"sme_id": sme_id})
    if not sme or sme.get("status") != SMEAuthorityStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Not an approved SME authority")
    if decoded.get("email") != _sme_synthetic_email(sme_id):
        raise HTTPException(status_code=403, detail="Session does not belong to this SME")

    report_ref = db.collection("IncidentReports").document(report_id)
    snap = report_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Report not found")
    report = snap.to_dict()

    # Confirm the report is assigned to this SME's department
    assigned_depts = report.get("assignedDepartments", [])
    if sme["department"] not in assigned_depts:
        raise HTTPException(status_code=403, detail="This report is not assigned to your department")

    # Confirm the report is in the SME's state
    if report.get("location", {}).get("state") != sme["state"]:
        raise HTTPException(status_code=403, detail="Report belongs to a different state")

    current = report.get("status")
    if req.status not in VALID_REPORT_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move report from {current} to {req.status}")

    _append_report_history(report_ref, req.status, "sme", sme_id, req.note)
    return {"message": f"Report {req.status}", "status": req.status}

# ---------- Run ----------

# =====================================================================
# SME / Authority endpoints
# =====================================================================

def _sme_synthetic_email(sme_id: str) -> str:
    return f"{sme_id}@sme.aquawatch.internal"


class SMERegisterRequest(BaseModel):
    sme_id: str
    name: str
    password: str
    state: str
    department: str


@app.post("/sme-authority/register")
def register_sme_authority(req: SMERegisterRequest):
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    if sme_authority_col.find_one({"sme_id": req.sme_id}):
        raise HTTPException(status_code=409, detail="sme_id already registered")

    try:
        firebase_auth.create_user(
            email=_sme_synthetic_email(req.sme_id),
            password=req.password,
            disabled=True,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="sme_id already registered")

    sme_authority_col.insert_one({
        "sme_id": req.sme_id,
        "name": req.name,
        "state": req.state,
        "department": req.department,
        "status": SMEAuthorityStatus.PENDING.value,
        "approved_by": None,
        "created_at": datetime.utcnow(),
    })
    return {"message": "Registered. Awaiting admin approval.", "status": "pending"}


@app.get("/sme-authority/{sme_id}")
def get_sme_authority(sme_id: str):
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = sme_authority_col.find_one({"sme_id": sme_id})
    if not record:
        raise HTTPException(status_code=404, detail="SME authority not found")
    record["_id"] = str(record["_id"])
    return record


@app.post("/sme-authority/{sme_id}/approve")
def approve_sme_authority(sme_id: str, admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")

    record = sme_authority_col.find_one({"sme_id": sme_id})
    if not record:
        raise HTTPException(status_code=404, detail="SME authority not found")

    admin_state = _state_for_admin(admin_id)
    if admin_state and record.get("state") != admin_state:
        raise HTTPException(status_code=403, detail="This authority belongs to a different state")

    user = firebase_auth.get_user_by_email(_sme_synthetic_email(sme_id))
    firebase_auth.update_user(user.uid, disabled=False)

    sme_authority_col.update_one(
        {"sme_id": sme_id},
        {"$set": {"status": SMEAuthorityStatus.APPROVED.value, "approved_by": admin_id}},
    )
    return {"message": "Approved", "status": "approved"}


@app.get("/admin/{admin_id}/pending-sme")
def get_pending_sme_authorities(admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    query = {"status": SMEAuthorityStatus.PENDING.value}
    admin_state = _state_for_admin(admin_id)
    if admin_state:
        query["state"] = admin_state
    cursor = sme_authority_col.find(query)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"pending": results}


@app.get("/admin/{admin_id}/all-sme")
def get_all_sme_authorities(admin_id: str, admin_password: str):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    query = {}
    admin_state = _state_for_admin(admin_id)
    if admin_state:
        query["state"] = admin_state
    cursor = sme_authority_col.find(query)
    results = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)
    return {"authorities": results}


@app.post("/admin/{admin_id}/sme-status/{sme_id}")
def update_sme_status(admin_id: str, sme_id: str, admin_password: str, req: UpdateStatusRequest):
    if ADMIN_CREDENTIALS.get(admin_id) != admin_password:
        raise HTTPException(status_code=403, detail="Invalid admin credentials")
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = sme_authority_col.find_one({"sme_id": sme_id})
    if not record:
        raise HTTPException(status_code=404, detail="SME authority not found")
    admin_state = _state_for_admin(admin_id)
    if admin_state and record.get("state") != admin_state:
        raise HTTPException(status_code=403, detail="This authority belongs to a different state")
    sme_authority_col.update_one(
        {"sme_id": sme_id},
        {"$set": {"status": req.status}}
    )
    return {"message": f"Status updated to {req.status}", "status": req.status}


class SMELoginRequest(BaseModel):
    sme_id: str
    password: str


@app.post("/sme/login")
def sme_login(req: SMELoginRequest):
    """Validates SME credentials via Firebase and returns the SME profile."""
    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    record = sme_authority_col.find_one({"sme_id": req.sme_id})
    if not record or record.get("status") != SMEAuthorityStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Not an approved SME authority")
    record["_id"] = str(record["_id"])
    return {"ok": True, "role": "sme", "sme_id": req.sme_id,
            "name": record.get("name"), "state": record.get("state"),
            "department": record.get("department")}


class SMEReportStatusUpdate(BaseModel):
    id_token: str
    status: str
    note: str | None = None


@app.post("/sme/{sme_id}/reports/{report_id}/status")
def sme_update_report_status(sme_id: str, report_id: str, req: SMEReportStatusUpdate):
    """SME can move a report from `assigned` → `in_progress` or
    `in_progress` → `resolved`. The report must be assigned to the SME's
    department to be actionable."""
    if req.status not in {"in_progress", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid status for an SME action")

    try:
        decoded = firebase_auth.verify_id_token(req.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    if sme_authority_col is None:
        raise HTTPException(status_code=503, detail="MongoDB not connected")
    sme = sme_authority_col.find_one({"sme_id": sme_id})
    if not sme or sme.get("status") != SMEAuthorityStatus.APPROVED.value:
        raise HTTPException(status_code=403, detail="Not an approved SME authority")
    if decoded.get("email") != _sme_synthetic_email(sme_id):
        raise HTTPException(status_code=403, detail="Session does not belong to this SME")

    report_ref = db.collection("IncidentReports").document(report_id)
    snap = report_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Report not found")
    report = snap.to_dict()

    # Confirm the report is assigned to this SME's department
    assigned_depts = report.get("assignedDepartments", [])
    if sme["department"] not in assigned_depts:
        raise HTTPException(status_code=403, detail="This report is not assigned to your department")

    # Confirm the report is in the SME's state
    if report.get("location", {}).get("state") != sme["state"]:
        raise HTTPException(status_code=403, detail="Report belongs to a different state")

    current = report.get("status")
    if req.status not in VALID_REPORT_TRANSITIONS.get(current, set()):
        raise HTTPException(status_code=409, detail=f"Cannot move report from {current} to {req.status}")

    _append_report_history(report_ref, req.status, "sme", sme_id, req.note)
    return {"message": f"Report {req.status}", "status": req.status}


# ---------- Run ----------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
