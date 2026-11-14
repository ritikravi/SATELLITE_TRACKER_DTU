"""
SGP4 Engine — real orbital position calculations.

Uses the `sgp4` Python library (Vallado's implementation, widely used in
professional orbit determination). All calculations are in UTC.

Outputs:
  - Topocentric azimuth and elevation from observer location
  - Range (km) and range-rate (km/s)
  - Sub-satellite geodetic latitude, longitude, altitude
  - Visibility flag (above elevation mask)

IMPORTANT:
  This module never invents positions. If SGP4 fails (decayed orbit, bad TLE,
  numerical divergence) it returns None. The caller must handle None gracefully.
"""

import math
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sgp4.api import Satrec, WGS84
from sgp4.conveniences import jday

logger = logging.getLogger(__name__)

DEG2RAD = math.pi / 180.0
RAD2DEG = 180.0 / math.pi

# Earth equatorial radius (km) — WGS84
EARTH_RADIUS_KM = 6378.137


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ObserverLocation:
    latitude_deg: float    # -90 to +90
    longitude_deg: float   # -180 to +180
    altitude_m: float      # metres above WGS84 ellipsoid
    min_elevation_mask_deg: float = 10.0


@dataclass
class SatellitePosition:
    """Full position result for one satellite at one UTC instant."""
    utc_time: datetime

    # Topocentric look angles from observer
    azimuth_deg: float       # 0–360
    elevation_deg: float     # -90 to +90 (negative = below horizon)
    range_km: float
    range_rate_km_s: float   # positive = moving away

    # Sub-satellite geodetic point
    lat_deg: float
    lon_deg: float
    alt_km: float

    # Derived
    is_visible: bool         # elevation >= observer.min_elevation_mask_deg


# ---------------------------------------------------------------------------
# Internal geometry helpers
# ---------------------------------------------------------------------------

def _jday_from_datetime(dt: datetime) -> tuple[float, float]:
    """Convert a UTC datetime to Julian day number (jd, fr)."""
    dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    return jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)


def _ecef_to_geodetic(x_km: float, y_km: float, z_km: float) -> tuple[float, float, float]:
    """
    Convert ECEF (km) to geodetic (lat_deg, lon_deg, alt_km).
    Uses iterative Bowring algorithm for accuracy.
    """
    a  = EARTH_RADIUS_KM
    f  = 1.0 / 298.257223563          # WGS84 flattening
    b  = a * (1.0 - f)
    e2 = 1.0 - (b / a) ** 2           # first eccentricity squared
    ep2 = (a / b) ** 2 - 1.0

    lon = math.atan2(y_km, x_km)
    p   = math.sqrt(x_km**2 + y_km**2)

    # Initial estimate
    lat = math.atan2(z_km, p * (1 - e2))

    for _ in range(10):
        sin_lat = math.sin(lat)
        N = a / math.sqrt(1 - e2 * sin_lat**2)
        lat_new = math.atan2(z_km + e2 * N * sin_lat, p)
        if abs(lat_new - lat) < 1e-12:
            lat = lat_new
            break
        lat = lat_new

    sin_lat = math.sin(lat)
    N   = a / math.sqrt(1 - e2 * sin_lat**2)
    alt = p / math.cos(lat) - N if abs(math.cos(lat)) > 1e-10 else abs(z_km) / abs(sin_lat) - N * (1 - e2)

    return math.degrees(lat), math.degrees(lon), alt


def _ecef_to_enu(
    sat_ecef: tuple[float, float, float],
    obs_ecef: tuple[float, float, float],
    obs_lat_rad: float,
    obs_lon_rad: float,
) -> tuple[float, float, float]:
    """
    Convert satellite ECEF position to ENU (East-North-Up) relative to observer.
    Returns (east_km, north_km, up_km).
    """
    dx = sat_ecef[0] - obs_ecef[0]
    dy = sat_ecef[1] - obs_ecef[1]
    dz = sat_ecef[2] - obs_ecef[2]

    sin_lat = math.sin(obs_lat_rad)
    cos_lat = math.cos(obs_lat_rad)
    sin_lon = math.sin(obs_lon_rad)
    cos_lon = math.cos(obs_lon_rad)

    east  = -sin_lon * dx + cos_lon * dy
    north = -sin_lat * cos_lon * dx - sin_lat * sin_lon * dy + cos_lat * dz
    up    =  cos_lat * cos_lon * dx + cos_lat * sin_lon * dy + sin_lat * dz

    return east, north, up


def _geodetic_to_ecef(lat_deg: float, lon_deg: float, alt_m: float) -> tuple[float, float, float]:
    """Convert geodetic coordinates to ECEF (km)."""
    a  = EARTH_RADIUS_KM
    f  = 1.0 / 298.257223563
    e2 = 2 * f - f ** 2

    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    alt_km = alt_m / 1000.0

    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    N = a / math.sqrt(1 - e2 * sin_lat**2)

    x = (N + alt_km) * cos_lat * math.cos(lon)
    y = (N + alt_km) * cos_lat * math.sin(lon)
    z = (N * (1 - e2) + alt_km) * sin_lat

    return x, y, z


# ---------------------------------------------------------------------------
# Greenwich Sidereal Time (needed to convert ECI → ECEF)
# ---------------------------------------------------------------------------

def _gmst(jd: float, fr: float) -> float:
    """Compute Greenwich Mean Sidereal Time in radians from Julian date."""
    # IAU 1982 GMST formula (seconds of arc per second of UT1)
    tut1 = (jd + fr - 2451545.0) / 36525.0
    gmst_sec = (
        67310.54841
        + (876600.0 * 3600.0 + 8640184.812866) * tut1
        + 0.093104 * tut1 ** 2
        - 6.2e-6 * tut1 ** 3
    )
    return math.radians(gmst_sec / 240.0 % 360.0)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_position(
    line1: str,
    line2: str,
    observer: ObserverLocation,
    at_time: Optional[datetime] = None,
) -> Optional[SatellitePosition]:
    """
    Compute satellite position relative to observer at given UTC time.

    Returns None if:
    - TLE is invalid
    - SGP4 propagation fails (numerical divergence, decayed orbit)
    - Computed position is physically implausible

    Never returns fabricated data.
    """
    if at_time is None:
        at_time = datetime.now(timezone.utc)

    at_time = at_time.replace(tzinfo=timezone.utc) if at_time.tzinfo is None else at_time.astimezone(timezone.utc)

    try:
        sat = Satrec.twoline2rv(line1, line2)
    except Exception as exc:
        logger.error("Failed to parse TLE: %s", exc)
        return None

    jd, fr = _jday_from_datetime(at_time)

    # SGP4 propagation — returns position/velocity in km and km/s (ECI frame)
    err_code, pos_eci, vel_eci = sat.sgp4(jd, fr)

    if err_code != 0:
        # SGP4 error codes: 1=mean motion, 2=mean eccentricity, 3=pert eccentricity,
        # 4=semi-latus rectum, 5=epoch elements sub-orbital, 6=satellite decayed
        logger.warning("SGP4 error code %d for NORAD %s", err_code, line1[2:7].strip())
        return None

    if pos_eci is None or any(math.isnan(v) for v in pos_eci):
        return None

    # Sanity check: satellite altitude should be 100 km < alt < 100000 km
    r_km = math.sqrt(sum(v**2 for v in pos_eci))
    alt_km_check = r_km - EARTH_RADIUS_KM
    if alt_km_check < 100.0 or alt_km_check > 100000.0:
        logger.warning("Implausible satellite altitude %.1f km — TLE may be for a decayed object", alt_km_check)
        return None

    # Convert ECI → ECEF using GMST rotation
    theta = _gmst(jd, fr)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    # ECI → ECEF position (km)
    x_ecef = pos_eci[0] * cos_t + pos_eci[1] * sin_t
    y_ecef = -pos_eci[0] * sin_t + pos_eci[1] * cos_t
    z_ecef = pos_eci[2]

    # ECI → ECEF velocity (km/s), accounting for Earth rotation
    earth_omega = 7.2921150e-5   # rad/s
    vx_ecef = vel_eci[0] * cos_t + vel_eci[1] * sin_t + earth_omega * y_ecef
    vy_ecef = -vel_eci[0] * sin_t + vel_eci[1] * cos_t - earth_omega * x_ecef
    vz_ecef = vel_eci[2]

    # Sub-satellite point
    sat_lat, sat_lon, sat_alt = _ecef_to_geodetic(x_ecef, y_ecef, z_ecef)

    # Observer ECEF position
    obs_ecef = _geodetic_to_ecef(
        observer.latitude_deg, observer.longitude_deg, observer.altitude_m
    )

    # Topocentric ENU vector
    obs_lat_rad = math.radians(observer.latitude_deg)
    obs_lon_rad = math.radians(observer.longitude_deg)
    east, north, up = _ecef_to_enu(
        (x_ecef, y_ecef, z_ecef), obs_ecef, obs_lat_rad, obs_lon_rad
    )

    # Topocentric range, azimuth, elevation
    range_km = math.sqrt(east**2 + north**2 + up**2)
    elevation_deg = math.degrees(math.asin(up / range_km)) if range_km > 0 else 0.0

    az_rad = math.atan2(east, north)
    azimuth_deg = math.degrees(az_rad) % 360.0

    # Range rate (dot product of relative position and velocity vectors)
    dx = x_ecef - obs_ecef[0]
    dy = y_ecef - obs_ecef[1]
    dz = z_ecef - obs_ecef[2]
    range_rate_km_s = (dx * vx_ecef + dy * vy_ecef + dz * vz_ecef) / range_km if range_km > 0 else 0.0

    return SatellitePosition(
        utc_time=at_time,
        azimuth_deg=round(azimuth_deg, 3),
        elevation_deg=round(elevation_deg, 3),
        range_km=round(range_km, 2),
        range_rate_km_s=round(range_rate_km_s, 4),
        lat_deg=round(sat_lat, 4),
        lon_deg=round(sat_lon, 4),
        alt_km=round(sat_alt, 2),
        is_visible=(elevation_deg >= observer.min_elevation_mask_deg),
    )
