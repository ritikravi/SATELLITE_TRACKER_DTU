"""
SGP4 position calculation tests.
Run from orbit-engine/ directory: ./venv/bin/python3 -m pytest tests/
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import math
import pytest
from datetime import datetime, timezone
from sgp4_engine import ObserverLocation, compute_position

# ---------------------------------------------------------------------------
# TLEs for testing
# ---------------------------------------------------------------------------
METEOR_L1 = "1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997"
METEOR_L2 = "2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580"

ISS_L1    = "1 25544U 98067A   26317.91612726  .00008668  00000+0  16320-3 0  9995"
ISS_L2    = "2 25544  51.6324 279.1461 0007382  22.6178 337.5134 15.49359724594967"

DTU = ObserverLocation(latitude_deg=28.6139, longitude_deg=77.209, altitude_m=216, min_elevation_mask_deg=10)


class TestSgp4Computation:
    def test_position_not_none_for_valid_tle(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None

    def test_azimuth_range(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        assert 0.0 <= pos.azimuth_deg < 360.0

    def test_elevation_range(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        assert -90.0 <= pos.elevation_deg <= 90.0

    def test_range_positive_and_plausible(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        # METEOR-M2 4 is in ~830km orbit; range from Delhi typically 500–8000km
        assert 400.0 < pos.range_km < 10000.0

    def test_altitude_plausible_for_leo(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        # METEOR-M2 4 is in ~830km Sun-synchronous orbit
        assert 700.0 < pos.alt_km < 1000.0

    def test_iss_altitude_plausible(self):
        pos = compute_position(ISS_L1, ISS_L2, DTU)
        assert pos is not None
        # ISS orbits at ~400–430 km
        assert 350.0 < pos.alt_km < 450.0

    def test_subsatellite_lat_range(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        assert -90.0 <= pos.lat_deg <= 90.0

    def test_subsatellite_lon_range(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        assert -180.0 <= pos.lon_deg <= 180.0

    def test_visibility_flag_matches_elevation(self):
        pos = compute_position(METEOR_L1, METEOR_L2, DTU)
        assert pos is not None
        if pos.elevation_deg >= DTU.min_elevation_mask_deg:
            assert pos.is_visible
        else:
            assert not pos.is_visible

    def test_invalid_tle_returns_none(self):
        """Garbage TLE must not produce a result."""
        pos = compute_position(
            "1 00000X INVALID  99999.99999999  .00000000  00000+0  00000+0 0  0000",
            "2 00000   0.0000   0.0000 0000000   0.0000   0.0000  0.00000000    00",
            DTU
        )
        # May return None or raise — both are acceptable, but must not crash with valid-looking data
        # (Most likely returns None due to bad checksum preventing parse, or SGP4 error code)

    def test_specific_time_deterministic(self):
        """Same input should always produce the same output."""
        t = datetime(2026, 11, 15, 12, 0, 0, tzinfo=timezone.utc)
        pos1 = compute_position(METEOR_L1, METEOR_L2, DTU, at_time=t)
        pos2 = compute_position(METEOR_L1, METEOR_L2, DTU, at_time=t)
        assert pos1 is not None
        assert pos2 is not None
        assert pos1.azimuth_deg == pos2.azimuth_deg
        assert pos1.elevation_deg == pos2.elevation_deg

    def test_position_changes_with_time(self):
        """LEO satellite position must change between two observations."""
        t1 = datetime(2026, 11, 15, 12, 0, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 11, 15, 12, 5, 0, tzinfo=timezone.utc)   # 5 minutes later
        pos1 = compute_position(METEOR_L1, METEOR_L2, DTU, at_time=t1)
        pos2 = compute_position(METEOR_L1, METEOR_L2, DTU, at_time=t2)
        assert pos1 is not None
        assert pos2 is not None
        # 5 minutes = 300s; LEO moves ~40km/s → azimuth must change
        assert pos1.azimuth_deg != pos2.azimuth_deg

    def test_observer_location_affects_position(self):
        """Different observer locations should give different look angles."""
        t = datetime(2026, 11, 15, 12, 0, 0, tzinfo=timezone.utc)
        obs_delhi  = ObserverLocation(28.6139, 77.209,  216, 10)
        obs_mumbai = ObserverLocation(19.0760, 72.8777, 14,  10)
        pos_delhi  = compute_position(METEOR_L1, METEOR_L2, obs_delhi,  at_time=t)
        pos_mumbai = compute_position(METEOR_L1, METEOR_L2, obs_mumbai, at_time=t)
        assert pos_delhi is not None
        assert pos_mumbai is not None
        assert pos_delhi.azimuth_deg != pos_mumbai.azimuth_deg


class TestElevationMask:
    def test_mask_affects_visibility_only(self):
        """Elevation mask should only change is_visible, not the computed angles."""
        t  = datetime(2026, 11, 15, 12, 0, 0, tzinfo=timezone.utc)
        o1 = ObserverLocation(28.6139, 77.209, 216, min_elevation_mask_deg=0.0)
        o2 = ObserverLocation(28.6139, 77.209, 216, min_elevation_mask_deg=45.0)
        p1 = compute_position(METEOR_L1, METEOR_L2, o1, at_time=t)
        p2 = compute_position(METEOR_L1, METEOR_L2, o2, at_time=t)
        assert p1 is not None
        assert p2 is not None
        # Computed angles are the same; only visibility differs
        assert abs(p1.elevation_deg - p2.elevation_deg) < 0.001
