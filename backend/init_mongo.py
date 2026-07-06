# Idempotent Mongo collection/index setup for the Phase 1A schemas
# (see phase1.2.md section 4.1). Safe to re-run — create_index no-ops if the
# index already exists with the same spec.
import os
from pymongo import MongoClient, ASCENDING
from dotenv import load_dotenv

from schemas import Citizen, L1Authority, Admin, IncidentReport, AssignedLocation, GeoLocation

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "aquawatch")

# Collection names taken verbatim from phase1.2.md section 4.1.
COLLECTIONS_AND_INDEXES = {
    "L1Authority": [("govt_id", ASCENDING, True)],
    "Admin": [("admin_id", ASCENDING, True)],
    "IncidentReport": [("report_id", ASCENDING, True), ("status", ASCENDING, False)],
    "Citizen": [("uid", ASCENDING, False)],
}


def schema_smoke_test():
    """Construct one instance of each Phase 1A model — fails fast if
    schemas.py and this script's assumptions have drifted apart."""
    Citizen(uid="u1", name="Test", state="WB", district="Kolkata")
    L1Authority(
        govt_id="GOVT1", name="Test Officer", password_hash="x",
        assigned_location=AssignedLocation(state="WB", district="Kolkata"),
    )
    Admin(admin_id="WB@2026", state="WB")
    IncidentReport(
        report_id="r1", image_url="http://x/y.jpg",
        location=GeoLocation(lat=1.0, lng=2.0), description="test",
        sensor_reading=15, sensor_category="critical",
    )


def setup_collections(db):
    created = {}
    for collection_name, indexes in COLLECTIONS_AND_INDEXES.items():
        col = db[collection_name]
        for field, direction, unique in indexes:
            col.create_index([(field, direction)], unique=unique)
        created[collection_name] = col.index_information()
    return created


if __name__ == "__main__":
    schema_smoke_test()
    print("✅ Schema smoke test passed")

    if not MONGO_URI:
        raise SystemExit("MONGO_URI not set — copy backend/.env.example to backend/.env first")

    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    db = client[MONGO_DB_NAME]

    indexes_by_collection = setup_collections(db)
    for name, indexes in indexes_by_collection.items():
        assert len(indexes) >= 2, f"{name} is missing its expected index"
        print(f"✅ {name}: {list(indexes.keys())}")

    client.close()
