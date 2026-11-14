"""
NAVIC-TRACK Orbit Engine — FastAPI service
Port: 8200 (configurable via PORT env var)

This service is the authoritative orbital calculation backend.
All SGP4 math, TLE management, and pass prediction run here.
The Node.js mock server and eventual hardware backend proxy calculations
through this service.

Endpoints:
  GET  /health                       — service health and TLE catalog summary
  GET  /position/{norad_id}          — current position for one satellite
  POST /position                     — position for arbitrary TLE + observer
  GET  /pass/{norad_id}              — next pass prediction
  POST /pass                         — pass prediction for arbitrary TLE
  GET  /passes/{norad_id}            — upcoming N passes
  GET  /catalog                      — full TLE catalog
  GET  /tle/{norad_id}               — TLE for one satellite
  POST /tle/{norad_id}/refresh       — force fresh TLE fetch from CelesTrak
  POST /tle/manual                   — accept manually uploaded TLE
  GET  /satellites/search            — search catalog by name or NORAD ID

Observer location is passed as query parameters on most endpoints.
Default observer is DTU New Delhi (28.6139°N, 77.2090°E, 216 m) —
this MUST be overridden by the user's actual location before physical tracking.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import tle_manager
from sgp4_engine import ObserverLocation, compute_position
from pass_predictor import predict_next_pass, predict_passes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("orbit-engine")


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Orbit engine starting — bootstrapping TLE catalog from CelesTrak...")
    tle_manager.startup_fetch()
    yield
    logger.info("Orbit engine shutdown.")


app = FastAPI(
    title="NAVIC-TRACK Orbit Engine",
    version="2.0.0",
    description=(
        "Real SGP4 orbital calculations, TLE management, and pass prediction. "
        "All positions are computed from verified TLEs. "
        "No position data is ever fabricated."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Default observer — DTU New Delhi.
# Users MUST set their own coordinates via the Settings page.
DEFAULT_OBSERVER = ObserverLocation(
    latitude_deg=28.6139,
    longitude_deg=77.2090,
    altitude_m=216.0,
    min_elevation_mask_deg=10.0,
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ObserverParams(BaseModel):
    lat: float = Field(28.6139, ge=-90.0, le=90.0, description="Observer latitude (degrees)")
    lon: float = Field(77.2090, ge=-180.0, le=180.0, description="Observer longitude (degrees)")
    alt: float = Field(216.0, ge=0.0, description="Observer altitude above sea level (metres)")
    mask: float = Field(10.0, ge=0.0, le=90.0, description="Minimum elevation mask (degrees)")


class PositionRequest(BaseModel):
    line1: str
    line2: str
    name: str = "UNKNOWN"
    observer: ObserverParams = ObserverParams()
    at_time: Optional[str] = Field(None, description="UTC ISO 8601 timestamp; defaults to now")


class PassRequest(BaseModel):
    line1: str
    line2: str
    name: str = "UNKNOWN"
    norad_id: int = 0
    observer: ObserverParams = ObserverParams()
    max_hours_ahead: float = Field(48.0, gt=0, le=168.0)
    max_passes: int = Field(5, gt=0, le=20)


class ManualTleRequest(BaseModel):
    name: str
    line1: str
    line2: str


# ---------------------------------------------------------------------------
# Helper: observer from query params
# ---------------------------------------------------------------------------

def _observer_from_query(
    lat: float, lon: float, alt: float, mask: float
) -> ObserverLocation:
    return ObserverLocation(
        latitude_deg=lat,
        longitude_deg=lon,
        altitude_m=alt,
        min_elevation_mask_deg=mask,
    )


def _position_to_dict(pos) -> dict:
    return {
        "utc_time": pos.utc_time.isoformat(),
        "azimuth_deg": pos.azimuth_deg,
        "elevation_deg": pos.elevation_deg,
        "range_km": pos.range_km,
        "range_rate_km_s": pos.range_rate_km_s,
        "lat_deg": pos.lat_deg,
        "lon_deg": pos.lon_deg,
        "alt_km": pos.alt_km,
        "is_visible": pos.is_visible,
    }


def _pass_to_dict(p) -> dict:
    return {
        "satellite_name": p.satellite_name,
        "norad_id": p.norad_id,
        "aos": p.aos.isoformat(),
        "tca": p.tca.isoformat(),
        "los": p.los.isoformat(),
        "max_elevation_deg": p.max_elevation_deg,
        "aos_azimuth_deg": p.aos_azimuth_deg,
        "tca_azimuth_deg": p.tca_azimuth_deg,
        "los_azimuth_deg": p.los_azimuth_deg,
        "duration_seconds": p.duration_seconds,
        "elevation_mask_deg": p.elevation_mask_deg,
        "is_visible_now": p.is_visible_now,
    }


def _tle_to_dict(rec: tle_manager.TleRecord) -> dict:
    return {
        "name": rec.name,
        "norad_id": rec.norad_id,
        "line1": rec.line1,
        "line2": rec.line2,
        "source": rec.source,
        "group": rec.group,
        "fetched_at": datetime.fromtimestamp(rec.fetched_at, tz=timezone.utc).isoformat(),
        "age_hours": round(rec.age_seconds / 3600, 2),
        "is_stale": rec.is_stale,
        "tle_epoch": rec.tle_epoch_datetime.isoformat() if rec.tle_epoch_datetime else None,
        "tle_age_days": round(rec.tle_age_days, 2) if rec.tle_age_days is not None else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    catalog = tle_manager.get_catalog()
    live    = sum(1 for r in catalog if r.source == "CELESTRAK")
    stale   = sum(1 for r in catalog if r.is_stale)
    return {
        "status": "ok",
        "service": "NAVIC-TRACK Orbit Engine",
        "version": "2.0.0",
        "catalog_total": len(catalog),
        "catalog_live": live,
        "catalog_stale": stale,
        "default_observer": {
            "lat": DEFAULT_OBSERVER.latitude_deg,
            "lon": DEFAULT_OBSERVER.longitude_deg,
            "alt_m": DEFAULT_OBSERVER.altitude_m,
            "mask_deg": DEFAULT_OBSERVER.min_elevation_mask_deg,
        },
        "note": (
            "Default observer is DTU New Delhi. "
            "Override with lat/lon/alt query params for accurate predictions."
        ),
    }


@app.get("/position/{norad_id}")
def get_position(
    norad_id: int,
    lat:  float = Query(DEFAULT_OBSERVER.latitude_deg),
    lon:  float = Query(DEFAULT_OBSERVER.longitude_deg),
    alt:  float = Query(DEFAULT_OBSERVER.altitude_m),
    mask: float = Query(DEFAULT_OBSERVER.min_elevation_mask_deg),
    at:   Optional[str] = Query(None, description="UTC ISO 8601 timestamp; defaults to now"),
):
    """
    Compute current Az/El/Range for a satellite identified by NORAD catalog number.
    TLE is fetched from CelesTrak if not in cache (or if stale).
    """
    rec = tle_manager.fetch_by_norad(norad_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No TLE available for NORAD {norad_id}")

    if rec.is_stale:
        logger.warning("Position computed with stale TLE for NORAD %d (%.1f hours old)", norad_id, rec.age_seconds/3600)

    at_time = None
    if at:
        try:
            at_time = datetime.fromisoformat(at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid timestamp format: {at}")

    observer = _observer_from_query(lat, lon, alt, mask)
    pos = compute_position(rec.line1, rec.line2, observer, at_time=at_time)
    if pos is None:
        raise HTTPException(
            status_code=422,
            detail=(
                f"SGP4 propagation failed for NORAD {norad_id}. "
                "The satellite may be decayed or the TLE epoch too old."
            )
        )

    return {
        "success": True,
        "satellite": {"name": rec.name, "norad_id": rec.norad_id, "source": rec.source},
        "observer": {"lat": lat, "lon": lon, "alt_m": alt, "mask_deg": mask},
        "position": _position_to_dict(pos),
        "tle_age_days": round(rec.tle_age_days, 2) if rec.tle_age_days is not None else None,
        "tle_is_stale": rec.is_stale,
    }


@app.post("/position")
def post_position(req: PositionRequest):
    """Compute position from an arbitrary TLE (e.g. manually uploaded)."""
    ok, err = tle_manager.validate_tle(req.line1, req.line2)
    if not ok:
        raise HTTPException(status_code=400, detail=f"TLE validation failed: {err}")

    at_time = None
    if req.at_time:
        try:
            at_time = datetime.fromisoformat(req.at_time.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid timestamp: {req.at_time}")

    observer = ObserverLocation(
        latitude_deg=req.observer.lat,
        longitude_deg=req.observer.lon,
        altitude_m=req.observer.alt,
        min_elevation_mask_deg=req.observer.mask,
    )
    pos = compute_position(req.line1, req.line2, observer, at_time=at_time)
    if pos is None:
        raise HTTPException(status_code=422, detail="SGP4 propagation failed for the provided TLE.")

    return {"success": True, "position": _position_to_dict(pos)}


@app.get("/pass/{norad_id}")
def get_next_pass(
    norad_id: int,
    lat:  float = Query(DEFAULT_OBSERVER.latitude_deg),
    lon:  float = Query(DEFAULT_OBSERVER.longitude_deg),
    alt:  float = Query(DEFAULT_OBSERVER.altitude_m),
    mask: float = Query(DEFAULT_OBSERVER.min_elevation_mask_deg),
    max_hours: float = Query(48.0, gt=0, le=168.0),
):
    """Predict the next visible pass of a satellite."""
    rec = tle_manager.fetch_by_norad(norad_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No TLE available for NORAD {norad_id}")

    observer = _observer_from_query(lat, lon, alt, mask)
    p = predict_next_pass(
        rec.line1, rec.line2, rec.name, rec.norad_id,
        observer, max_hours_ahead=max_hours,
    )
    if p is None:
        return {
            "success": True,
            "pass": None,
            "message": f"No pass found above {mask}° within the next {max_hours} hours.",
        }

    return {
        "success": True,
        "satellite": {"name": rec.name, "norad_id": rec.norad_id},
        "observer": {"lat": lat, "lon": lon, "alt_m": alt, "mask_deg": mask},
        "pass": _pass_to_dict(p),
        "tle_age_days": round(rec.tle_age_days, 2) if rec.tle_age_days is not None else None,
    }


@app.get("/passes/{norad_id}")
def get_passes(
    norad_id: int,
    lat:  float = Query(DEFAULT_OBSERVER.latitude_deg),
    lon:  float = Query(DEFAULT_OBSERVER.longitude_deg),
    alt:  float = Query(DEFAULT_OBSERVER.altitude_m),
    mask: float = Query(DEFAULT_OBSERVER.min_elevation_mask_deg),
    max_passes: int = Query(5, gt=0, le=20),
    max_hours:  float = Query(72.0, gt=0, le=168.0),
):
    """Predict the next N visible passes of a satellite."""
    rec = tle_manager.fetch_by_norad(norad_id)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No TLE available for NORAD {norad_id}")

    observer = _observer_from_query(lat, lon, alt, mask)
    passes = predict_passes(
        rec.line1, rec.line2, rec.name, rec.norad_id,
        observer, max_passes=max_passes, max_hours_ahead=max_hours,
    )
    return {
        "success": True,
        "satellite": {"name": rec.name, "norad_id": rec.norad_id},
        "observer": {"lat": lat, "lon": lon, "alt_m": alt, "mask_deg": mask},
        "passes": [_pass_to_dict(p) for p in passes],
        "count": len(passes),
    }


@app.post("/pass")
def post_next_pass(req: PassRequest):
    """Predict next pass for an arbitrary TLE."""
    ok, err = tle_manager.validate_tle(req.line1, req.line2)
    if not ok:
        raise HTTPException(status_code=400, detail=f"TLE validation failed: {err}")

    observer = ObserverLocation(
        latitude_deg=req.observer.lat,
        longitude_deg=req.observer.lon,
        altitude_m=req.observer.alt,
        min_elevation_mask_deg=req.observer.mask,
    )
    p = predict_next_pass(
        req.line1, req.line2, req.name, req.norad_id,
        observer, max_hours_ahead=req.max_hours_ahead,
    )
    if p is None:
        return {"success": True, "pass": None, "message": "No pass found in search window."}
    return {"success": True, "pass": _pass_to_dict(p)}


@app.get("/catalog")
def get_catalog():
    """Return all TLEs in the in-memory catalog with metadata."""
    return {
        "success": True,
        "count": len(tle_manager.get_catalog()),
        "satellites": [_tle_to_dict(r) for r in tle_manager.get_catalog()],
    }


@app.get("/tle/{norad_id}")
def get_tle(norad_id: int, force_refresh: bool = Query(False)):
    """Get TLE for a specific NORAD catalog number, optionally forcing a CelesTrak refresh."""
    rec = tle_manager.fetch_by_norad(norad_id, force=force_refresh)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"No TLE available for NORAD {norad_id}")
    return {"success": True, "tle": _tle_to_dict(rec)}


@app.post("/tle/{norad_id}/refresh")
def refresh_tle(norad_id: int):
    """Force a fresh TLE fetch from CelesTrak for a specific satellite."""
    rec = tle_manager.fetch_by_norad(norad_id, force=True)
    if rec is None:
        raise HTTPException(
            status_code=502,
            detail=f"CelesTrak fetch failed for NORAD {norad_id} and no cached TLE exists."
        )
    return {"success": True, "tle": _tle_to_dict(rec), "message": f"TLE refreshed for {rec.name}"}


@app.post("/tle/manual")
def upload_manual_tle(req: ManualTleRequest):
    """Accept a manually uploaded TLE. Validates checksum before accepting."""
    ok, err, rec = tle_manager.add_manual_tle(req.name, req.line1, req.line2)
    if not ok:
        raise HTTPException(status_code=400, detail=f"TLE validation failed: {err}")
    return {"success": True, "tle": _tle_to_dict(rec), "message": "Manual TLE accepted and stored."}


@app.get("/satellites/search")
def search_satellites(
    q: str = Query(..., min_length=1, description="Satellite name or NORAD catalog number"),
):
    """Search catalog by name substring or exact NORAD ID. Falls back to live CelesTrak search."""
    # Try NORAD number first
    try:
        norad = int(q.strip())
        rec = tle_manager.fetch_by_norad(norad)
        if rec:
            return {"success": True, "results": [_tle_to_dict(rec)]}
    except ValueError:
        pass

    # Name search in local catalog
    q_lower = q.lower()
    results = [r for r in tle_manager.get_catalog() if q_lower in r.name.lower()]

    if not results:
        # Try live CelesTrak name search
        rec = tle_manager.fetch_by_name(q)
        if rec:
            results = [rec]

    return {"success": True, "count": len(results), "results": [_tle_to_dict(r) for r in results]}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8200"))
    logger.info("Starting NAVIC-TRACK Orbit Engine on http://127.0.0.1:%d", port)
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False, log_level="info")
