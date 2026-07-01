"""Tests for the 5-field cron expression parser and next_fire_after()."""
from datetime import datetime

import pytest

from prompt_executor import (
    _parse_cron_field,
    next_fire_after,
    parse_cron_expr,
)


class TestParseCronField:
    def test_star(self):
        assert _parse_cron_field("*", 0, 59, "minute") == set(range(0, 60))

    def test_integer(self):
        assert _parse_cron_field("5", 0, 59, "minute") == {5}

    def test_comma_list(self):
        assert _parse_cron_field("1,3,5", 0, 59, "minute") == {1, 3, 5}

    def test_range(self):
        assert _parse_cron_field("1-5", 0, 59, "minute") == {1, 2, 3, 4, 5}

    def test_step_on_range(self):
        assert _parse_cron_field("0-20/5", 0, 59, "minute") == {0, 5, 10, 15, 20}

    def test_star_step(self):
        assert _parse_cron_field("*/15", 0, 59, "minute") == {0, 15, 30, 45}

    def test_dow_range(self):
        assert _parse_cron_field("1-5", 0, 6, "dow") == {1, 2, 3, 4, 5}

    def test_empty_component_raises(self):
        with pytest.raises(ValueError, match="empty component"):
            _parse_cron_field("1,,3", 0, 59, "minute")

    def test_bad_step_raises(self):
        with pytest.raises(ValueError, match="bad step"):
            _parse_cron_field("*/a", 0, 59, "minute")

    def test_zero_step_raises(self):
        with pytest.raises(ValueError, match="step must be >= 1"):
            _parse_cron_field("*/0", 0, 59, "minute")

    def test_bad_range_raises(self):
        with pytest.raises(ValueError, match="bad range"):
            _parse_cron_field("a-5", 0, 59, "minute")

    def test_bad_value_raises(self):
        with pytest.raises(ValueError, match="bad value"):
            _parse_cron_field("abc", 0, 59, "minute")

    def test_out_of_range_raises(self):
        with pytest.raises(ValueError, match="out of range"):
            _parse_cron_field("99", 0, 59, "minute")

    def test_inverted_range_raises(self):
        with pytest.raises(ValueError, match="out of range"):
            _parse_cron_field("10-5", 0, 59, "minute")


class TestParseCronExpr:
    def test_all_stars(self):
        f = parse_cron_expr("* * * * *")
        assert f["minute"] == set(range(0, 60))
        assert f["hour"] == set(range(0, 24))
        assert f["dom"] == set(range(1, 32))
        assert f["month"] == set(range(1, 13))
        assert f["dow"] == set(range(0, 7))

    def test_weekday_9am(self):
        f = parse_cron_expr("0 9 * * 1-5")
        assert f["minute"] == {0}
        assert f["hour"] == {9}
        assert f["dow"] == {1, 2, 3, 4, 5}

    def test_wrong_field_count(self):
        with pytest.raises(ValueError, match="exactly 5 fields"):
            parse_cron_expr("0 9 *")

    def test_too_many_fields(self):
        with pytest.raises(ValueError, match="exactly 5 fields"):
            parse_cron_expr("0 9 * * * *")


class TestNextFireAfter:
    def test_every_minute(self):
        start = datetime(2026, 4, 16, 12, 30, 15)
        nxt = next_fire_after("* * * * *", start)
        assert nxt == datetime(2026, 4, 16, 12, 31, 0)

    def test_0900_daily(self):
        # At 08:00, next "0 9 * * *" is today at 09:00.
        start = datetime(2026, 4, 16, 8, 0)
        nxt = next_fire_after("0 9 * * *", start)
        assert nxt == datetime(2026, 4, 16, 9, 0)

    def test_0900_daily_rolls_over(self):
        # At 10:00, next "0 9 * * *" is tomorrow at 09:00.
        start = datetime(2026, 4, 16, 10, 0)
        nxt = next_fire_after("0 9 * * *", start)
        assert nxt == datetime(2026, 4, 17, 9, 0)

    def test_weekdays_only(self):
        # 2026-04-18 is Saturday. Next weekday 09:00 is Monday 2026-04-20.
        start = datetime(2026, 4, 18, 10, 0)
        nxt = next_fire_after("0 9 * * 1-5", start)
        assert nxt == datetime(2026, 4, 20, 9, 0)

    def test_specific_day_of_month(self):
        start = datetime(2026, 4, 16, 0, 0)
        nxt = next_fire_after("0 0 1 * *", start)  # 1st of every month
        assert nxt == datetime(2026, 5, 1, 0, 0)

    def test_specific_month(self):
        start = datetime(2026, 4, 16, 0, 0)
        nxt = next_fire_after("0 0 1 12 *", start)  # Dec 1st
        assert nxt == datetime(2026, 12, 1, 0, 0)

    def test_year_rollover(self):
        start = datetime(2026, 12, 16, 0, 0)
        nxt = next_fire_after("0 0 1 1 *", start)  # Jan 1st next year
        assert nxt == datetime(2027, 1, 1, 0, 0)

    def test_dom_dow_union_semantics(self):
        # "Fire on the 1st OR on Sundays" (both restricted → union).
        # 2026-04-16 is a Thursday. The next fire is Sunday 2026-04-19
        # (day-of-week matches), NOT May 1.
        start = datetime(2026, 4, 16, 10, 0)
        nxt = next_fire_after("0 0 1 * 0", start)
        assert nxt == datetime(2026, 4, 19, 0, 0)

    def test_impossible_combination_raises(self):
        # Feb 30 doesn't exist.
        start = datetime(2026, 1, 1, 0, 0)
        with pytest.raises(ValueError, match="never fires"):
            next_fire_after("0 0 30 2 *", start)

    def test_accepts_prebuilt_dict(self):
        fields = parse_cron_expr("* * * * *")
        start = datetime(2026, 4, 16, 12, 30, 15)
        nxt = next_fire_after(fields, start)
        assert nxt == datetime(2026, 4, 16, 12, 31, 0)

    def test_bad_next_run_iso_recomputes(self):
        # next_fire_after must return a datetime strictly > after,
        # even when `after` is exactly on a boundary.
        start = datetime(2026, 4, 16, 9, 0, 0)
        nxt = next_fire_after("0 9 * * *", start)
        assert nxt == datetime(2026, 4, 17, 9, 0)
