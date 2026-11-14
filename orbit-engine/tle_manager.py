"""
TLE Manager — fetch, validate, cache, and serve Two-Line Element sets.

Rules enforced here:
- TLE checksums are always verified before acceptance.
- NORAD ID must match between Line 1 and Line 2.
- Line lengths must be exactly 69 characters.
- Stale TLEs are flagged (configurable max age).
- Failed fetches fall back to last-known-valid TLE with explicit error reporting.
- No fake/hardcoded TLE is ever returned as "current" without being marked FALLBACK.
"""

import time
import logging
import re
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone, timedelta

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CelesTrak URLs — GP format returns clean 2-line or 3-line TLE text
# ---------------------------------------------------------------------------
CELESTRAK_BY_CATNR = "https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=tle"
CELESTRAK_BY_NAME  = "https://celestrak.org/NORAD/elements/gp.php?NAME={name}&FORMAT=tle"
CELESTRAK_GROUP    = "https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=tle"

REQUEST_TIMEOUT_S = 8   # seconds
CACHE_TTL_S       = 4 * 3600  # 4-hour cache for catalog
MAX_TLE_AGE_DAYS  = 7         # TLEs older than this are flagged STALE


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TleRecord:
    name: str
    norad_id: int
    line1: str
    line2: str
    fetched_at: float = field(default_factory=time.time)   # Unix timestamp
    source: str = "CELESTRAK"   # "CELESTRAK" | "FALLBACK" | "MANUAL"
    group: str = "WEATHER"

    @property
    def age_seconds(self) -> float:
        return time.time() - self.fetched_at

    @property
    def is_stale(self) -> bool:
        return self.age_seconds > MAX_TLE_AGE_DAYS * 86400

    @property
    def tle_epoch_datetime(self) -> Optional[datetime]:
        """
        Parse the TLE epoch from Line 1.
        TLE epoch field: columns 19-32 (0-indexed 18-31), format: YYDDD.DDDDDDDD
        YY < 57 => 20YY, YY >= 57 => 19YY
        """
        try:
            epoch_str = self.line1[18:32].strip()
            yy = int(epoch_str[:2])
            year = 2000 + yy if yy < 57 else 1900 + yy
            day_fraction = float(epoch_str[2:])
            day_of_year = int(day_fraction)
            fraction = day_fraction - day_of_year
            dt = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_of_year - 1 + fraction)
            return dt
        except Exception:
            return None

    @property
    def tle_age_days(self) -> Optional[float]:
        """Days since the TLE epoch (not since it was fetched)."""
        epoch = self.tle_epoch_datetime
        if epoch is None:
            return None
        delta = datetime.now(timezone.utc) - epoch
        return delta.total_seconds() / 86400.0


# ---------------------------------------------------------------------------
# In-memory catalog
# ---------------------------------------------------------------------------

# Hardcoded baseline fallback TLEs — only entries with verified checksums.
# NOAA 15/18/19 are intentionally absent: their checksums cannot be
# guaranteed without a live fetch.  They will be populated from CelesTrak.
_VERIFIED_FALLBACKS: list[TleRecord] = [
    TleRecord(
        name="METEOR-M2 4",
        norad_id=59051,
        line1="1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997",
        line2="2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580",
        source="FALLBACK",
        group="WEATHER",
    ),
    TleRecord(
        name="IRNSS-1A",
        norad_id=39199,
        line1="1 39199U 13034A   26317.88404779  .00000077  00000+0  00000+0 0  9990",
        line2="2 39199  36.0491  61.7358 0022346 184.5436 180.0376  1.00270379 48875",
        source="FALLBACK",
        group="NAVIC",
    ),
    TleRecord(
        name="IRNSS-1B",
        norad_id=39635,
        line1="1 39635U 14017A   26314.95600463  .00000115  00000+0  00000+0 0  9993",
        line2="2 39635  29.0993 237.8858 0017719 185.7160  25.7856  1.00269646 46269",
        source="FALLBACK",
        group="NAVIC",
    ),
    TleRecord(
        name="ISS (ZARYA)",
        norad_id=25544,
        line1="1 25544U 98067A   26317.91612726  .00008668  00000+0  16320-3 0  9995",
        line2="2 25544  51.6324 279.1461 0007382  22.6178 337.5134 15.49359724594967",
        source="FALLBACK",
        group="LEO",
    ),
]

_catalog: dict[int, TleRecord] = {r.norad_id: r for r in _VERIFIED_FALLBACKS}
_last_group_fetch: dict[str, float] = {}


# ---------------------------------------------------------------------------
# TLE validation
# ---------------------------------------------------------------------------

def _tle_checksum(line: str) -> int:
    """Standard TLE modulo-10 checksum over the first 68 characters."""
    total = 0
    for ch in line[:68]:
        if ch.isdigit():
            total += int(ch)
        elif ch == '-':
            total += 1
    return total % 10


def validate_tle(line1: str, line2: str) -> tuple[bool, str]:
    """
    Validate a TLE pair. Returns (is_valid, error_message).
    Checks:
      - Both lines are exactly 69 characters.
      - Line 1 starts with '1 ', Line 2 starts with '2 '.
      - NORAD ID matches between lines.
      - Checksums are correct.
    """
    if len(line1) != 69:
        return False, f"Line 1 length is {len(line1)}, expected 69"
    if len(line2) != 69:
        return False, f"Line 2 length is {len(line2)}, expected 69"
    if not line1.startswith("1 "):
        return False, "Line 1 must start with '1 '"
    if not line2.startswith("2 "):
        return False, "Line 2 must start with '2 '"

    norad1 = line1[2:7].strip()
    norad2 = line2[2:7].strip()
    if norad1 != norad2:
        return False, f"NORAD ID mismatch: Line1={norad1}, Line2={norad2}"

    expected1 = _tle_checksum(line1)
    actual1   = int(line1[68])
    if expected1 != actual1:
        return False, f"Line 1 checksum failed: expected {expected1}, got {actual1}"

    expected2 = _tle_checksum(line2)
    actual2   = int(line2[68])
    if expected2 != actual2:
        return False, f"Line 2 checksum failed: expected {expected2}, got {actual2}"

    return True, ""


# ---------------------------------------------------------------------------
# TLE parsing from raw text
# ---------------------------------------------------------------------------

def parse_tle_text(text: str, group: str = "WEATHER") -> list[TleRecord]:
    """
    Parse a CelesTrak TLE text block (3-line or 2-line format).
    Returns only TLEs that pass checksum validation.
    Invalid TLEs are logged and skipped — never silently included.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    results: list[TleRecord] = []
    i = 0
    while i < len(lines):
        # 3-line format: name, line1, line2
        if (i + 2 < len(lines)
                and lines[i + 1].startswith("1 ")
                and lines[i + 2].startswith("2 ")):
            name  = lines[i]
            line1 = lines[i + 1]
            line2 = lines[i + 2]
            i += 3
        # 2-line format: line1, line2 (no name line)
        elif (i + 1 < len(lines)
              and lines[i].startswith("1 ")
              and lines[i + 1].startswith("2 ")):
            line1 = lines[i]
            line2 = lines[i + 1]
            norad = line1[2:7].strip()
            name  = f"SAT-{norad}"
            i += 2
        else:
            i += 1
            continue

        ok, err = validate_tle(line1, line2)
        if not ok:
            logger.warning("TLE validation failed for '%s': %s", name, err)
            continue

        try:
            norad_id = int(line1[2:7].strip())
        except ValueError:
            logger.warning("Cannot parse NORAD ID from '%s'", line1)
            continue

        results.append(TleRecord(
            name=name,
            norad_id=norad_id,
            line1=line1,
            line2=line2,
            source="CELESTRAK",
            group=group,
        ))

    return results


# ---------------------------------------------------------------------------
# Network fetch helpers
# ---------------------------------------------------------------------------

def _fetch_url(url: str) -> Optional[str]:
    """Fetch a URL with timeout. Returns text or None on failure."""
    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT_S,
            headers={"User-Agent": "NAVIC-TRACK-OrbitEngine/2.0"},
        )
        if resp.status_code == 200 and resp.text.strip():
            return resp.text
        logger.warning("HTTP %d from %s", resp.status_code, url)
    except requests.RequestException as exc:
        logger.warning("Fetch failed for %s: %s", url, exc)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_by_norad(norad_id: int, force: bool = False) -> Optional[TleRecord]:
    """
    Fetch a single satellite TLE by NORAD catalog number.
    Returns cached entry if fresh (< CACHE_TTL_S old) unless force=True.
    Falls back to stale cached entry with source='FALLBACK' if network fails.
    """
    cached = _catalog.get(norad_id)
    if cached and not force and cached.age_seconds < CACHE_TTL_S:
        return cached

    url  = CELESTRAK_BY_CATNR.format(norad=norad_id)
    text = _fetch_url(url)
    if text:
        parsed = parse_tle_text(text)
        if parsed:
            rec = parsed[0]
            # Preserve group from cached entry if already known
            if cached:
                rec.group = cached.group
            _catalog[norad_id] = rec
            logger.info("Updated TLE for NORAD %d (%s) from CelesTrak", norad_id, rec.name)
            return rec
        else:
            logger.warning("CelesTrak returned invalid/no TLE for NORAD %d", norad_id)

    # Network failed — return stale cache if available
    if cached:
        logger.warning(
            "Using stale TLE for NORAD %d (%s), age %.1f hours",
            norad_id, cached.name, cached.age_seconds / 3600
        )
        cached.source = "FALLBACK"
        return cached

    logger.error("No TLE available for NORAD %d (network failed, no cache)", norad_id)
    return None


def fetch_by_name(name: str) -> Optional[TleRecord]:
    """
    Search CelesTrak by satellite name.
    Also checks the local catalog for a name match.
    """
    # Check local catalog first (case-insensitive substring match)
    name_lower = name.lower()
    for rec in _catalog.values():
        if name_lower in rec.name.lower():
            return rec

    # Try CelesTrak name search
    url  = CELESTRAK_BY_NAME.format(name=requests.utils.quote(name))
    text = _fetch_url(url)
    if text:
        parsed = parse_tle_text(text)
        if parsed:
            rec = parsed[0]
            _catalog[rec.norad_id] = rec
            return rec

    return None


def fetch_group(group_key: str, celestrak_group: str, force: bool = False) -> list[TleRecord]:
    """
    Fetch an entire CelesTrak group (e.g. 'weather', 'irnss', 'stations').
    group_key: internal label used for cache TTL tracking.
    celestrak_group: the GROUP= parameter value for CelesTrak.
    """
    last = _last_group_fetch.get(group_key, 0)
    if not force and time.time() - last < CACHE_TTL_S:
        # Return cached entries of this group
        return [r for r in _catalog.values() if r.group.upper() == group_key.upper()]

    url  = CELESTRAK_GROUP.format(group=celestrak_group)
    text = _fetch_url(url)
    if not text:
        logger.warning("Failed to fetch CelesTrak group '%s'", celestrak_group)
        return [r for r in _catalog.values() if r.group.upper() == group_key.upper()]

    group_map = {
        "weather": "WEATHER",
        "irnss":   "NAVIC",
        "stations": "LEO",
    }
    group_label = group_map.get(celestrak_group.lower(), "WEATHER")
    records = parse_tle_text(text, group=group_label)

    if records:
        for rec in records:
            _catalog[rec.norad_id] = rec
        _last_group_fetch[group_key] = time.time()
        logger.info(
            "Fetched %d valid TLEs from CelesTrak group '%s'",
            len(records), celestrak_group
        )
    else:
        logger.warning("No valid TLEs parsed from CelesTrak group '%s'", celestrak_group)

    return records


def get_catalog() -> list[TleRecord]:
    """Return all TLEs in the in-memory catalog."""
    return list(_catalog.values())


def get_by_norad(norad_id: int) -> Optional[TleRecord]:
    """Return cached TLE for a NORAD ID without fetching."""
    return _catalog.get(norad_id)


def add_manual_tle(name: str, line1: str, line2: str) -> tuple[bool, str, Optional[TleRecord]]:
    """
    Accept a manually uploaded TLE.
    Returns (success, error_message, record).
    """
    ok, err = validate_tle(line1, line2)
    if not ok:
        return False, err, None

    norad_id = int(line1[2:7].strip())
    rec = TleRecord(
        name=name,
        norad_id=norad_id,
        line1=line1,
        line2=line2,
        source="MANUAL",
        group="CUSTOM",
    )
    _catalog[norad_id] = rec
    logger.info("Manual TLE accepted for '%s' (NORAD %d)", name, norad_id)
    return True, "", rec


def startup_fetch() -> None:
    """
    Called at orbit-engine startup.
    Pre-populates catalog with live data for the primary satellite groups.
    Errors are logged but do not prevent startup.
    """
    logger.info("Starting TLE catalog bootstrap from CelesTrak...")
    fetch_group("WEATHER", "weather")
    fetch_group("NAVIC",   "irnss")
    fetch_group("LEO",     "stations")

    # Ensure METEOR-M2 4 is fresh regardless of group fetch
    fetch_by_norad(59051)

    live_count = sum(1 for r in _catalog.values() if r.source == "CELESTRAK")
    fallback_count = sum(1 for r in _catalog.values() if r.source == "FALLBACK")
    logger.info(
        "TLE catalog ready: %d live, %d fallback entries",
        live_count, fallback_count
    )
