"""Tests for parse_duration (used by `schedule --in`)."""
from datetime import timedelta

import pytest

from prompt_executor import parse_duration


class TestParseDuration:
    def test_seconds_only(self):
        assert parse_duration("90s") == timedelta(seconds=90)

    def test_minutes_only(self):
        assert parse_duration("45m") == timedelta(minutes=45)

    def test_hours_only(self):
        assert parse_duration("2h") == timedelta(hours=2)

    def test_days_only(self):
        assert parse_duration("1d") == timedelta(days=1)

    def test_combined(self):
        assert parse_duration("2h30m") == timedelta(hours=2, minutes=30)

    def test_full_combination(self):
        assert parse_duration("1d2h3m4s") == timedelta(
            days=1, hours=2, minutes=3, seconds=4
        )

    def test_float_hours_rounded_to_seconds(self):
        # 1.5h = 5400s exactly.
        assert parse_duration("1.5h") == timedelta(seconds=5400)

    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="empty duration"):
            parse_duration("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValueError, match="empty duration"):
            parse_duration("   ")

    def test_no_units_raises(self):
        with pytest.raises(ValueError, match="bad duration"):
            parse_duration("123")

    def test_bad_unit_raises(self):
        with pytest.raises(ValueError, match="bad duration"):
            parse_duration("5q")

    def test_garbage_raises(self):
        with pytest.raises(ValueError, match="bad duration"):
            parse_duration("abc")

    def test_zero_duration_raises(self):
        with pytest.raises(ValueError, match="must be positive"):
            parse_duration("0s")

    def test_case_insensitive(self):
        assert parse_duration("2H30M") == timedelta(hours=2, minutes=30)
