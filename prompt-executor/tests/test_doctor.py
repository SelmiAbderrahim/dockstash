"""Tests for the doctor: _classify_failure_reason, _parse_failure_log, run_doctor."""
from pathlib import Path

import pytest

import prompt_executor as pe
from prompt_executor import (
    DOCTOR_CATEGORY_AUTH,
    DOCTOR_CATEGORY_EXTERNAL,
    DOCTOR_CATEGORY_MCP,
    DOCTOR_CATEGORY_QUOTA,
    DOCTOR_CATEGORY_RATE_LIMIT,
    DOCTOR_CATEGORY_SKILL,
    DOCTOR_CATEGORY_TIMEOUT,
    DOCTOR_CATEGORY_TRANSIENT,
    DOCTOR_CATEGORY_UNRECOVERABLE,
    _classify_failure_reason,
    _generate_fix_plan,
    _parse_failure_log,
    run_doctor,
)


class TestClassifyFailureReason:
    def test_mcp_error_pattern(self):
        s = "MCP server 'memory' failed to start"
        assert _classify_failure_reason(s) == DOCTOR_CATEGORY_MCP

    def test_skill_error_pattern(self):
        s = "Skill 'unknown-skill' not found in registry"
        assert _classify_failure_reason(s) == DOCTOR_CATEGORY_SKILL

    def test_timeout_from_stderr(self):
        s = "subprocess.TimeoutExpired after 3600s"
        assert _classify_failure_reason(s) == DOCTOR_CATEGORY_TIMEOUT

    def test_timed_out_phrase(self):
        s = "Request timed out after 30 seconds"
        assert _classify_failure_reason(s) == DOCTOR_CATEGORY_TIMEOUT

    def test_timeout_from_elapsed_argument(self):
        assert (
            _classify_failure_reason("", elapsed_s=pe.TIMEOUT_SECONDS + 1)
            == DOCTOR_CATEGORY_TIMEOUT
        )

    def test_rate_limit(self):
        assert (
            _classify_failure_reason("429 Too Many Requests — rate limit exceeded")
            == DOCTOR_CATEGORY_RATE_LIMIT
        )

    def test_rate_limit_dashed(self):
        assert _classify_failure_reason("rate-limit hit") == DOCTOR_CATEGORY_RATE_LIMIT

    def test_quota(self):
        assert (
            _classify_failure_reason("insufficient_quota for this API key")
            == DOCTOR_CATEGORY_QUOTA
        )

    def test_auth_401(self):
        assert (
            _classify_failure_reason("HTTP 401 Unauthorized")
            == DOCTOR_CATEGORY_AUTH
        )

    def test_auth_403(self):
        assert _classify_failure_reason("HTTP 403 Forbidden") == DOCTOR_CATEGORY_AUTH

    def test_auth_invalid_api_key(self):
        assert (
            _classify_failure_reason("Invalid API key provided")
            == DOCTOR_CATEGORY_AUTH
        )

    def test_unrecoverable_autocompact(self):
        assert (
            _classify_failure_reason("Autocompact is thrashing on large context")
            == DOCTOR_CATEGORY_UNRECOVERABLE
        )

    def test_unrecoverable_model_not_found(self):
        assert (
            _classify_failure_reason("ProviderModelNotFoundError: no such model")
            == DOCTOR_CATEGORY_UNRECOVERABLE
        )

    def test_external_dns(self):
        assert (
            _classify_failure_reason(
                "temporary failure in name resolution for api.anthropic.com"
            )
            == DOCTOR_CATEGORY_EXTERNAL
        )

    def test_external_5xx(self):
        assert (
            _classify_failure_reason("502 Bad Gateway") == DOCTOR_CATEGORY_EXTERNAL
        )

    def test_external_connection_refused(self):
        assert (
            _classify_failure_reason("Connection refused by api")
            == DOCTOR_CATEGORY_EXTERNAL
        )

    def test_default_transient(self):
        assert (
            _classify_failure_reason("something weird happened")
            == DOCTOR_CATEGORY_TRANSIENT
        )

    def test_empty_stderr_is_transient(self):
        assert _classify_failure_reason("") == DOCTOR_CATEGORY_TRANSIENT
        assert _classify_failure_reason(None) == DOCTOR_CATEGORY_TRANSIENT


class TestParseFailureLog:
    def test_missing_file(self, tmp_path):
        assert _parse_failure_log(tmp_path / "nope.log") == []

    def test_parses_standard_entries(self, tmp_path):
        log = tmp_path / "failures.log"
        log.write_text(
            "[2026-04-16 12:00:00] SKIPPED: /p/a.md  attempts=3  last_error=timeout\n"
            "[2026-04-16 12:01:00] SKIPPED: /p/b.md  attempts=1  last_error=429 rate limit\n"
        )
        entries = _parse_failure_log(log)
        assert len(entries) == 2
        assert entries[0]["path"] == "/p/a.md"
        assert entries[0]["attempts"] == 3
        assert "timeout" in entries[0]["last_error"]

    def test_ignores_malformed_lines(self, tmp_path):
        log = tmp_path / "failures.log"
        log.write_text(
            "not a skipped line\n"
            "[2026-04-16 12:00:00] SKIPPED: /p/a.md  attempts=3  last_error=timeout\n"
            "\n"
            "some other garbage\n"
        )
        assert len(_parse_failure_log(log)) == 1

    def test_read_error_returns_empty(self, tmp_path, monkeypatch):
        log = tmp_path / "failures.log"
        log.write_text("anything")

        def bad_read(self, *a, **kw):
            raise OSError("simulated")

        monkeypatch.setattr("pathlib.Path.read_text", bad_read)
        assert _parse_failure_log(log) == []


class TestGenerateFixPlan:
    def test_empty_failures(self):
        plan = _generate_fix_plan("smoke", [])
        assert "No skipped prompts" in plan
        assert "advisory only" in plan

    def test_failures_rendered(self):
        failures = [
            {
                "ts": "2026-04-16 12:00:00",
                "path": "/p/a.md",
                "attempts": 3,
                "last_error": "429 rate limit exceeded",
            },
            {
                "ts": "2026-04-16 12:01:00",
                "path": "/p/b.md",
                "attempts": 1,
                "last_error": "MCP server 'memory' failed",
            },
        ]
        plan = _generate_fix_plan("smoke", failures)
        assert "RATE_LIMIT" in plan
        assert "MCP_ERROR" in plan
        assert "/p/a.md" in plan
        assert "/p/b.md" in plan
        assert "Category summary" in plan
        assert "Per-prompt detail" in plan


class TestRunDoctor:
    def test_no_logs_returns_none(self, tmp_path, monkeypatch):
        monkeypatch.setattr(pe, "SCRIPT_DIR", tmp_path)
        assert run_doctor(None) is None

    def test_writes_fix_plan_for_slug(self, tmp_path, monkeypatch):
        monkeypatch.setattr(pe, "SCRIPT_DIR", tmp_path)
        # Create a failures log for slug "smoke".
        fail_log = tmp_path / ".prompt_executor_smoke_failures.log"
        fail_log.write_text(
            "[2026-04-16 12:00:00] SKIPPED: /p/a.md  attempts=3  last_error=429 rate limit\n"
        )
        # resolve_target_folder needs the folder on disk.
        target = tmp_path / "smoke"
        target.mkdir()
        result = run_doctor(target)
        assert result is not None
        assert result.exists()
        plan_text = result.read_text()
        assert "RATE_LIMIT" in plan_text

    def test_no_target_scans_all_logs(self, tmp_path, monkeypatch):
        monkeypatch.setattr(pe, "SCRIPT_DIR", tmp_path)
        (tmp_path / ".prompt_executor_aaa_failures.log").write_text(
            "[2026-04-16 12:00:00] SKIPPED: /p/a.md  attempts=3  last_error=timeout\n"
        )
        (tmp_path / ".prompt_executor_bbb_failures.log").write_text(
            "[2026-04-16 12:00:00] SKIPPED: /p/b.md  attempts=1  last_error=quota exceeded\n"
        )
        run_doctor(None)
        assert (tmp_path / ".prompt_executor_aaa_fixplan.md").exists()
        assert (tmp_path / ".prompt_executor_bbb_fixplan.md").exists()

    def test_missing_failure_file_skipped(self, tmp_path, monkeypatch):
        monkeypatch.setattr(pe, "SCRIPT_DIR", tmp_path)
        target = tmp_path / "smoke"
        target.mkdir()
        # No failures log at all.
        assert run_doctor(target) is None
