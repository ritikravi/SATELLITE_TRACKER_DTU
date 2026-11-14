"""
TLE validation and parsing tests.
Run from orbit-engine/ directory: ./venv/bin/python3 -m pytest tests/
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from tle_manager import validate_tle, parse_tle_text, add_manual_tle, _VERIFIED_FALLBACKS


# ---------------------------------------------------------------------------
# Known-good TLEs (verified checksums and NORAD IDs)
# ---------------------------------------------------------------------------
METEOR_L1 = "1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997"
METEOR_L2 = "2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580"

ISS_L1    = "1 25544U 98067A   26317.91612726  .00008668  00000+0  16320-3 0  9995"
ISS_L2    = "2 25544  51.6324 279.1461 0007382  22.6178 337.5134 15.49359724594967"


class TestValidation:
    def test_valid_tle_passes(self):
        ok, err = validate_tle(METEOR_L1, METEOR_L2)
        assert ok, f"Should pass but got: {err}"

    def test_iss_tle_passes(self):
        ok, err = validate_tle(ISS_L1, ISS_L2)
        assert ok, f"ISS TLE should pass: {err}"

    def test_wrong_line1_checksum(self):
        # Corrupt last character (checksum digit) of line 1
        bad_l1 = METEOR_L1[:-1] + str((int(METEOR_L1[-1]) + 1) % 10)
        ok, err = validate_tle(bad_l1, METEOR_L2)
        assert not ok
        assert "checksum" in err.lower()

    def test_wrong_line2_checksum(self):
        bad_l2 = METEOR_L2[:-1] + str((int(METEOR_L2[-1]) + 1) % 10)
        ok, err = validate_tle(METEOR_L1, bad_l2)
        assert not ok
        assert "checksum" in err.lower()

    def test_norad_mismatch(self):
        # Change NORAD ID in line 1 to differ from line 2
        bad_l1 = "1 99999U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9990"
        ok, err = validate_tle(bad_l1, METEOR_L2)
        assert not ok
        assert "NORAD" in err

    def test_line1_too_short(self):
        ok, err = validate_tle(METEOR_L1[:60], METEOR_L2)
        assert not ok
        assert "length" in err.lower()

    def test_line1_too_long(self):
        ok, err = validate_tle(METEOR_L1 + " ", METEOR_L2)
        assert not ok
        assert "length" in err.lower()

    def test_line1_wrong_start(self):
        bad_l1 = "2 " + METEOR_L1[2:]
        ok, err = validate_tle(bad_l1, METEOR_L2)
        assert not ok

    def test_line2_wrong_start(self):
        bad_l2 = "1 " + METEOR_L2[2:]
        ok, err = validate_tle(METEOR_L1, bad_l2)
        assert not ok

    def test_empty_lines_rejected(self):
        ok, err = validate_tle("", "")
        assert not ok


class TestFallbackTles:
    """Every hardcoded fallback TLE must have valid checksums."""

    @pytest.mark.parametrize("rec", _VERIFIED_FALLBACKS, ids=[r.name for r in _VERIFIED_FALLBACKS])
    def test_fallback_checksum(self, rec):
        ok, err = validate_tle(rec.line1, rec.line2)
        assert ok, f"Fallback TLE for '{rec.name}' failed: {err}"


class TestParsing:
    THREE_LINE_TEXT = (
        "METEOR-M2 4\n"
        "1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997\n"
        "2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580\n"
    )

    TWO_LINE_TEXT = (
        "1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997\n"
        "2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580\n"
    )

    def test_3line_format(self):
        result = parse_tle_text(self.THREE_LINE_TEXT)
        assert len(result) == 1
        assert result[0].name == "METEOR-M2 4"
        assert result[0].norad_id == 59051

    def test_2line_format(self):
        result = parse_tle_text(self.TWO_LINE_TEXT)
        assert len(result) == 1
        assert result[0].norad_id == 59051
        assert "59051" in result[0].name

    def test_invalid_tle_in_block_is_skipped(self):
        """A block with one good and one bad TLE should return only the good one."""
        mixed = (
            "GOOD SAT\n"
            "1 59051U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  9997\n"
            "2 59051  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176140580\n"
            "BAD SAT\n"
            "1 99999U 24039A   26318.15183601  .00000012  00000+0  25164-4 0  0000\n"  # bad checksum
            "2 99999  98.7245 275.7123 0008138  94.8816 265.3291 14.22443176999999\n"
        )
        result = parse_tle_text(mixed)
        assert len(result) == 1
        assert result[0].norad_id == 59051

    def test_empty_text_returns_empty(self):
        result = parse_tle_text("")
        assert result == []


class TestManualUpload:
    def test_valid_manual_tle(self):
        ok, err, rec = add_manual_tle("METEOR-M2 4", METEOR_L1, METEOR_L2)
        assert ok
        assert rec is not None
        assert rec.source == "MANUAL"
        assert rec.norad_id == 59051

    def test_invalid_manual_tle_rejected(self):
        bad_l1 = METEOR_L1[:-1] + "9"
        ok, err, rec = add_manual_tle("BAD SAT", bad_l1, METEOR_L2)
        assert not ok
        assert rec is None
        assert "checksum" in err.lower()
