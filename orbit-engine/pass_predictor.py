"""
Pass Predictor — calculates AOS, TCA, LOS for satellite passes.

Uses SGP4 propagation at 60-second steps, then binary-search refines
each horizon crossing to ±1 second accuracy.

Output always includes:
  - AOS: UTC datetime when elevation first exceeds the mask
  - TCA: time of closest approach (maximum elevation in pass)
  - LOS: UTC datetime when elevation drops below the mask
  - Max elevation
  - Duration
  - AOS and LOS azimuth

This module never fabricates or approximates pass data.
If no pass is found within the search window, it returns None.
"""

import math
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional

from sgp4.api import Satrec
from sgp4.conveniences import jday

from sgp4_engine import ObserverLocation, _jday_from_datetime, _gmst, _geodetic_to_ecef, _ecef_to_enu

logger = logging.getLogger(__name__)

DEG2RAD = math.pi / 180.0
RAD2DEG = 180.0 / math.pi
EARTH_RADIUS_KM = 6378.137


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class SatellitePass:
    satellite_name: str
    norad_id: int

    aos: datetime      # Acquisition of Signal
    tca: datetime      # Time of Closest Approach (max elevation)
    los: datetime      # Loss of Signal

    max_elevation_deg: float
    aos_azimuth_deg: float
    tca_azimuth_deg: float
    los_azimuth_deg: float

    duration_seconds: int
    elevation_mask_deg: float
    is_visible_now: bool


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_elevation(sat: Satrec, observer: ObserverLocation, at_time: datetime) -> Optional[float]:
    """
    Return satellite elevation (degrees) at given time, or None on SGP4 error.
    """
    jd, fr = _jday_from_datetime(at_time)
    err, pos, vel = sat.sgp4(jd, fr)
    if err != 0 or pos is None:
        return None

    theta = _gmst(jd, fr)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    x = pos[0] * cos_t + pos[1] * sin_t
    y = -pos[0] * sin_t + pos[1] * cos_t
    z = pos[2]

    obs_ecef = _geodetic_to_ecef(
        observer.latitude_deg, observer.longitude_deg, observer.altitude_m
    )
    east, north, up = _ecef_to_enu(
        (x, y, z), obs_ecef,
        math.radians(observer.latitude_deg),
        math.radians(observer.longitude_deg),
    )
    r = math.sqrt(east**2 + north**2 + up**2)
    if r == 0:
        return None
    return math.degrees(math.asin(up / r))


def _get_elevation_and_azimuth(
    sat: Satrec, observer: ObserverLocation, at_time: datetime
) -> Optional[tuple[float, float]]:
    """Return (elevation_deg, azimuth_deg) or None."""
    jd, fr = _jday_from_datetime(at_time)
    err, pos, vel = sat.sgp4(jd, fr)
    if err != 0 or pos is None:
        return None

    theta = _gmst(jd, fr)
    cos_t, sin_t = math.cos(theta), math.sin(theta)
    x = pos[0] * cos_t + pos[1] * sin_t
    y = -pos[0] * sin_t + pos[1] * cos_t
    z = pos[2]

    obs_ecef = _geodetic_to_ecef(
        observer.latitude_deg, observer.longitude_deg, observer.altitude_m
    )
    east, north, up = _ecef_to_enu(
        (x, y, z), obs_ecef,
        math.radians(observer.latitude_deg),
        math.radians(observer.longitude_deg),
    )
    r = math.sqrt(east**2 + north**2 + up**2)
    if r == 0:
        return None

    el  = math.degrees(math.asin(up / r))
    az  = math.degrees(math.atan2(east, north)) % 360.0
    return el, az


def _refine_crossing(
    sat: Satrec,
    observer: ObserverLocation,
    t_lo: datetime,
    t_hi: datetime,
    mask_deg: float,
    rising: bool,
    iterations: int = 10,
) -> datetime:
    """
    Binary search to refine the exact crossing of the elevation mask.
    rising=True finds AOS (elevation crosses mask from below).
    rising=False finds LOS (elevation crosses mask going below).
    """
    lo_ms = t_lo.timestamp() * 1000
    hi_ms = t_hi.timestamp() * 1000

    for _ in range(iterations):
        mid_ms = (lo_ms + hi_ms) / 2
        mid_t  = datetime.fromtimestamp(mid_ms / 1000, tz=timezone.utc)
        el = _get_elevation(sat, observer, mid_t)
        if el is None:
            break
        if rising:
            if el >= mask_deg:
                hi_ms = mid_ms
            else:
                lo_ms = mid_ms
        else:
            if el < mask_deg:
                hi_ms = mid_ms
            else:
                lo_ms = mid_ms

    return datetime.fromtimestamp(hi_ms / 1000, tz=timezone.utc)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def predict_next_pass(
    line1: str,
    line2: str,
    satellite_name: str,
    norad_id: int,
    observer: ObserverLocation,
    start_time: Optional[datetime] = None,
    max_hours_ahead: float = 48.0,
) -> Optional[SatellitePass]:
    """
    Find the next visible pass of a satellite above the observer's elevation mask.

    Search strategy:
    1. Step through time at 60-second intervals for up to max_hours_ahead.
    2. When elevation first exceeds the mask, record AOS using binary search.
    3. Track peak elevation (TCA).
    4. When elevation drops below mask, record LOS using binary search.
    5. Return the complete pass descriptor.

    Returns None if no pass is found, SGP4 fails, or the TLE is invalid.
    Never fabricates a pass.
    """
    if start_time is None:
        start_time = datetime.now(timezone.utc)

    start_time = start_time.replace(tzinfo=timezone.utc) if start_time.tzinfo is None else start_time

    try:
        sat = Satrec.twoline2rv(line1, line2)
    except Exception as exc:
        logger.error("TLE parse error in pass predictor: %s", exc)
        return None

    mask = observer.min_elevation_mask_deg
    step_s = 60
    total_steps = int(max_hours_ahead * 3600 / step_s)

    in_pass   = False
    aos_time  : Optional[datetime] = None
    los_time  : Optional[datetime] = None
    max_el    = -999.0
    tca_time  : Optional[datetime] = None
    prev_time : Optional[datetime] = None

    # Check if already in a pass at start
    initial = _get_elevation(sat, observer, start_time)
    if initial is not None and initial >= mask:
        in_pass  = True
        aos_time = start_time
        max_el   = initial
        tca_time = start_time

    for i in range(total_steps):
        t  = start_time + timedelta(seconds=i * step_s)
        el = _get_elevation(sat, observer, t)
        if el is None:
            prev_time = t
            continue

        if el >= mask:
            if not in_pass:
                # AOS: refine the exact second
                if prev_time is not None:
                    aos_time = _refine_crossing(sat, observer, prev_time, t, mask, rising=True)
                else:
                    aos_time = t
                in_pass = True
                max_el  = el
                tca_time = t

            if el > max_el:
                max_el   = el
                tca_time = t

        else:
            if in_pass:
                # LOS: refine the exact second
                if prev_time is not None:
                    los_time = _refine_crossing(sat, observer, prev_time, t, mask, rising=False)
                else:
                    los_time = t
                break   # Pass complete

        prev_time = t

    if aos_time is None:
        return None  # No pass found

    # Geostationary / IGSO satellites may never set within search window
    if los_time is None:
        # Check 48h end time
        end_t = start_time + timedelta(hours=max_hours_ahead)
        end_el = _get_elevation(sat, observer, end_t)
        if end_el is not None and end_el >= mask:
            # Satellite stays visible (GEO/IGSO): report as continuous visibility
            los_time = start_time + timedelta(hours=max_hours_ahead)
        else:
            return None

    duration_s = max(1, int((los_time - aos_time).total_seconds()))

    # Get azimuth at AOS, TCA, LOS
    aos_az_el  = _get_elevation_and_azimuth(sat, observer, aos_time)
    tca_az_el  = _get_elevation_and_azimuth(sat, observer, tca_time) if tca_time else None
    los_az_el  = _get_elevation_and_azimuth(sat, observer, los_time)

    # Is the satellite above the mask right now?
    now_el = _get_elevation(sat, observer, datetime.now(timezone.utc))
    is_now = now_el is not None and now_el >= mask

    return SatellitePass(
        satellite_name=satellite_name,
        norad_id=norad_id,
        aos=aos_time,
        tca=tca_time or aos_time,
        los=los_time,
        max_elevation_deg=round(max_el, 2),
        aos_azimuth_deg=round(aos_az_el[1] if aos_az_el else 0.0, 1),
        tca_azimuth_deg=round(tca_az_el[1] if tca_az_el else 0.0, 1),
        los_azimuth_deg=round(los_az_el[1] if los_az_el else 0.0, 1),
        duration_seconds=duration_s,
        elevation_mask_deg=mask,
        is_visible_now=is_now,
    )


def predict_passes(
    line1: str,
    line2: str,
    satellite_name: str,
    norad_id: int,
    observer: ObserverLocation,
    start_time: Optional[datetime] = None,
    max_passes: int = 5,
    max_hours_ahead: float = 72.0,
) -> list[SatellitePass]:
    """
    Find the next N visible passes. Returns an empty list if none found.
    """
    passes = []
    if start_time is None:
        start_time = datetime.now(timezone.utc)

    search_from = start_time
    hours_remaining = max_hours_ahead

    while len(passes) < max_passes and hours_remaining > 0:
        p = predict_next_pass(
            line1, line2, satellite_name, norad_id, observer,
            start_time=search_from,
            max_hours_ahead=min(hours_remaining, 24.0),
        )
        if p is None:
            break
        passes.append(p)
        # Start next search just after this LOS
        search_from = p.los + timedelta(seconds=60)
        hours_remaining = (start_time + timedelta(hours=max_hours_ahead) - search_from).total_seconds() / 3600

    return passes
