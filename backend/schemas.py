# Phase 1A schema design (see phase1.md section 8). Validation-only — no DB
# connections are opened here; Mongo/Firestore setup happens in Phase 1B.
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SensorCategory(str, Enum):
    """Thresholds match the existing UI logic in WaterDataContext.tsx:67-71."""
    CRITICAL = "critical"
    WARNING = "warning"
    NORMAL = "normal"
    GOOD = "good"


def categorize_sensor_reading(water_level: float) -> SensorCategory:
    if water_level < 20:
        return SensorCategory.CRITICAL
    if water_level < 40:
        return SensorCategory.WARNING
    if water_level < 70:
        return SensorCategory.NORMAL
    return SensorCategory.GOOD


def normalize_to_pct(value: float, lo: float, hi: float) -> float:
    """Map a currentlevel (meters below ground level) to a 0-100 'percent
    good' score. lo/hi are a station's historical min/max; lo == best
    (shallowest), hi == worst (deepest) -> inverted so higher output means
    healthier, matching categorize_sensor_reading's higher-is-better scale.
    Shared by backend/import_csv.py (historical) and backend/main.py (live)."""
    if hi == lo:
        return 100.0
    pct_depth = (value - lo) / (hi - lo)
    return max(0.0, min(100.0, (1 - pct_depth) * 100))


class Citizen(BaseModel):
    """Optional metadata only — reports may exist with no Citizen record."""
    uid: Optional[str] = None
    name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class L1AuthorityStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AssignedLocation(BaseModel):
    state: str
    district: str


class L1Authority(BaseModel):
    govt_id: str
    name: str
    password_hash: str
    assigned_location: AssignedLocation
    status: L1AuthorityStatus = L1AuthorityStatus.PENDING
    approved_by: Optional[str] = None  # Admin.admin_id
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Admin(BaseModel):
    """Credential pair itself lives in .env, not here — only non-secret metadata."""
    admin_id: str  # e.g. "WB@2026"
    state: str
    department_assignments: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


# SuperAdmin: no DB record — single credential pair validated against .env directly.


class GeoLocation(BaseModel):
    lat: float
    lng: float


class AIAnalysis(BaseModel):
    summary: str
    hazard_type: Optional[str] = None
    severity: Optional[str] = None
    extracted_location: Optional[GeoLocation] = None
    confidence: Optional[float] = None


class ReportStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    ESCALATED = "escalated"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class IncidentReport(BaseModel):
    report_id: str
    citizen_id: Optional[str] = None
    image_url: str
    location: GeoLocation
    description: str
    ai_analysis: Optional[AIAnalysis] = None
    sensor_reading: float
    sensor_category: SensorCategory
    status: ReportStatus = ReportStatus.PENDING
    assigned_department: Optional[str] = None
    l1_authority_id: Optional[str] = None
    admin_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DwlrState(BaseModel):
    """Firestore `DWLR_state` collection — matches per-state doc shape already
    written by backend/main.py (date, time, water_level_m_bgl)."""
    state_name: str
    water_level: float
    status_color: SensorCategory
    last_updated: datetime = Field(default_factory=datetime.utcnow)


if __name__ == "__main__":
    assert categorize_sensor_reading(10) == SensorCategory.CRITICAL
    assert categorize_sensor_reading(25) == SensorCategory.WARNING
    assert categorize_sensor_reading(50) == SensorCategory.NORMAL
    assert categorize_sensor_reading(80) == SensorCategory.GOOD
    IncidentReport(
        report_id="r1", image_url="http://x/y.jpg",
        location=GeoLocation(lat=1.0, lng=2.0), description="test",
        sensor_reading=15, sensor_category=categorize_sensor_reading(15),
    )
    print("schemas.py self-check passed")
