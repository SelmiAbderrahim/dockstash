"""Tests for schedule/cron/doctor/scheduler-daemon CLI commands and the
extended `stop` semantics (--yes, --running-only, --scheduled-only, --cron-only)."""
import sys
from argparse import Namespace
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import prompt_executor as pe
from prompt_executor import (
    JobStore,
    cmd_cron_add,
    cmd_cron_list,
    cmd_cron_remove,
    cmd_doctor,
    cmd_schedule_add,
    cmd_schedule_list,
    cmd_schedule_remove,
    cmd_scheduler_daemon,
    cmd_status,
    cmd_stop,
    main,
)


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    """Isolate SCRIPT_DIR, JOBS_FILE, SCHEDULER_* paths to tmp_path."""
    monkeypatch.setattr(pe, "SCRIPT_DIR", tmp_path)
    jobs = tmp_path / ".prompt_executor_jobs.json"
    pidf = tmp_path / ".prompt_executor_scheduler.pid"
    logf = tmp_path / ".prompt_executor_scheduler.log"
    monkeypatch.setattr(pe, "JOBS_FILE", jobs)
    monkeypatch.setattr(pe, "SCHEDULER_PID_FILE", pidf)
    monkeypatch.setattr(pe, "SCHEDULER_LOG_FILE", logf)
    # Patch JobStore default-arg so new JobStore() uses tmp path.
    orig_init = JobStore.__init__

    def patched(self, path=jobs):
        orig_init(self, path)

    monkeypatch.setattr(JobStore, "__init__", patched)
    return {"root": tmp_path, "jobs": jobs, "pid": pidf, "log": logf}


def _make_target(sandbox, name: str) -> Path:
    target = sandbox["root"] / name
    target.mkdir(exist_ok=True)
    return target


# ── schedule add / list / remove ───────────────────────────────────────────


class TestCmdScheduleAdd:
    def test_adds_with_in_duration(self, sandbox, monkeypatch):
        target = _make_target(sandbox, "x")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at=None,
            in_="2h",
        )
        with patch(
            "prompt_executor._start_scheduler_daemon_if_needed"
        ) as start_d:
            cmd_schedule_add(args)
        start_d.assert_called_once()
        data = JobStore().read()
        assert len(data["schedules"]) == 1
        assert data["schedules"][0]["model"] == "flash"

    def test_adds_with_absolute_at(self, sandbox, monkeypatch):
        target = _make_target(sandbox, "x")
        future = (datetime.now() + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at=future,
            in_=None,
        )
        with patch("prompt_executor._start_scheduler_daemon_if_needed"):
            cmd_schedule_add(args)
        assert len(JobStore().read()["schedules"]) == 1

    def test_accepts_iso_at(self, sandbox):
        target = _make_target(sandbox, "x")
        iso = (datetime.now() + timedelta(hours=3)).isoformat(timespec="seconds")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at=iso,
            in_=None,
        )
        with patch("prompt_executor._start_scheduler_daemon_if_needed"):
            cmd_schedule_add(args)
        assert len(JobStore().read()["schedules"]) == 1

    def test_missing_when_flag_rejected(self, sandbox, capsys):
        target = _make_target(sandbox, "x")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at=None,
            in_=None,
        )
        cmd_schedule_add(args)
        out = capsys.readouterr().out
        assert "exactly one of --at" in out
        assert JobStore().read()["schedules"] == []

    def test_both_at_and_in_rejected(self, sandbox, capsys):
        target = _make_target(sandbox, "x")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at="2026-04-17 09:00",
            in_="1h",
        )
        cmd_schedule_add(args)
        out = capsys.readouterr().out
        assert "mutually exclusive" in out
        assert JobStore().read()["schedules"] == []

    def test_past_at_rejected(self, sandbox, capsys):
        target = _make_target(sandbox, "x")
        past = (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at=past,
            in_=None,
        )
        cmd_schedule_add(args)
        out = capsys.readouterr().out
        assert "must be in the future" in out

    def test_unparseable_at_rejected(self, sandbox, capsys):
        target = _make_target(sandbox, "x")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            at="not a date",
            in_=None,
        )
        cmd_schedule_add(args)
        out = capsys.readouterr().out
        assert "cannot parse --at" in out


class TestCmdScheduleList:
    def test_empty(self, sandbox, capsys):
        cmd_schedule_list(Namespace())
        assert "No scheduled jobs" in capsys.readouterr().out

    def test_with_jobs(self, sandbox, capsys):
        JobStore().add_schedule(
            {"id": "sch_1", "folder": "/x", "model": "flash", "at_iso": "2026-04-17T09:00:00"}
        )
        cmd_schedule_list(Namespace())
        out = capsys.readouterr().out
        assert "sch_1" in out
        assert "/x" in out


class TestCmdScheduleRemove:
    def test_removes_existing(self, sandbox, capsys):
        JobStore().add_schedule({"id": "sch_1", "folder": "/x"})
        cmd_schedule_remove(Namespace(job_id="sch_1"))
        assert "Removed job sch_1" in capsys.readouterr().out
        assert JobStore().read()["schedules"] == []

    def test_missing_id_reports_not_found(self, sandbox, capsys):
        cmd_schedule_remove(Namespace(job_id="missing"))
        assert "not found" in capsys.readouterr().out


# ── cron add / list / remove ───────────────────────────────────────────────


class TestCmdCronAdd:
    def test_adds_valid_expr(self, sandbox):
        target = _make_target(sandbox, "x")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            expr="0 9 * * 1-5",
        )
        with patch("prompt_executor._start_scheduler_daemon_if_needed"):
            cmd_cron_add(args)
        data = JobStore().read()
        assert len(data["crons"]) == 1
        assert data["crons"][0]["expr"] == "0 9 * * 1-5"
        assert data["crons"][0]["next_run_iso"] is not None

    def test_rejects_bad_expr(self, sandbox, capsys):
        target = _make_target(sandbox, "x")
        args = Namespace(
            folder=str(target),
            model="flash",
            agent=None,
            period=1,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
            expr="not a cron",
        )
        cmd_cron_add(args)
        assert "invalid cron expression" in capsys.readouterr().out
        assert JobStore().read()["crons"] == []


class TestCmdCronList:
    def test_empty(self, sandbox, capsys):
        cmd_cron_list(Namespace())
        assert "No cron jobs" in capsys.readouterr().out

    def test_with_jobs(self, sandbox, capsys):
        JobStore().add_cron(
            {
                "id": "cron_1",
                "folder": "/x",
                "model": "flash",
                "expr": "* * * * *",
                "next_run_iso": "2026-04-17T09:00",
                "last_run_iso": None,
            }
        )
        cmd_cron_list(Namespace())
        out = capsys.readouterr().out
        assert "cron_1" in out
        assert "* * * * *" in out


class TestCmdCronRemove:
    def test_removes(self, sandbox, capsys):
        JobStore().add_cron({"id": "cron_1", "folder": "/x"})
        cmd_cron_remove(Namespace(job_id="cron_1"))
        assert "Removed cron job" in capsys.readouterr().out

    def test_not_found(self, sandbox, capsys):
        cmd_cron_remove(Namespace(job_id="missing"))
        assert "not found" in capsys.readouterr().out


# ── doctor ─────────────────────────────────────────────────────────────────


class TestCmdDoctor:
    def test_no_failures(self, sandbox, capsys):
        cmd_doctor(Namespace(folder=None))
        assert "No failure logs" in capsys.readouterr().out

    def test_writes_plan_for_folder(self, sandbox, capsys):
        target = _make_target(sandbox, "smoke")
        (sandbox["root"] / ".prompt_executor_smoke_failures.log").write_text(
            "[2026-04-16 12:00:00] SKIPPED: /p/a.md  attempts=3  last_error=429 rate limit\n"
        )
        cmd_doctor(Namespace(folder=str(target)))
        out = capsys.readouterr().out
        assert "Fix plan written" in out
        assert "RATE_LIMIT" in out


# ── scheduler-daemon (foreground only — daemonize path is integration) ────


class TestCmdSchedulerDaemonForeground:
    def test_already_running_noop(self, sandbox, capsys, monkeypatch):
        monkeypatch.setattr(pe, "_scheduler_is_running", lambda: True)
        cmd_scheduler_daemon(Namespace(foreground=True))
        assert "already running" in capsys.readouterr().out

    def test_foreground_starts_loop(self, sandbox, monkeypatch):
        monkeypatch.setattr(pe, "_scheduler_is_running", lambda: False)
        monkeypatch.setattr(pe, "install_crash_handlers", lambda: None)
        monkeypatch.setattr(pe, "setup_signals", lambda: None)
        monkeypatch.setattr(pe, "write_pid", lambda pid: None)
        monkeypatch.setattr(pe, "remove_pid", lambda: None)
        called = {"n": 0}

        def fake_loop():
            called["n"] += 1
            raise KeyboardInterrupt

        monkeypatch.setattr(pe, "_scheduler_main_loop", fake_loop)
        with pytest.raises(KeyboardInterrupt):
            cmd_scheduler_daemon(Namespace(foreground=True))
        assert called["n"] == 1


# ── stop with --yes / --*-only flags ──────────────────────────────────────


class TestCmdStopExtended:
    def test_stop_with_yes_no_prompt(self, sandbox, capsys):
        # Add one schedule — no running PIDs.
        JobStore().add_schedule({"id": "sch_1", "folder": "/x", "at_iso": "2026-04-17T09:00"})
        args = Namespace(
            folder=None, yes=True, running_only=False,
            scheduled_only=False, cron_only=False,
        )
        cmd_stop(args)
        out = capsys.readouterr().out
        assert "proceeding without prompt" in out
        # Schedule removed.
        assert JobStore().read()["schedules"] == []

    def test_stop_without_yes_prompt_denied(self, sandbox, monkeypatch, capsys):
        JobStore().add_schedule({"id": "sch_1", "folder": "/x", "at_iso": "2026-04-17T09:00"})
        monkeypatch.setattr("builtins.input", lambda prompt="": "n")
        args = Namespace(
            folder=None, yes=False, running_only=False,
            scheduled_only=False, cron_only=False,
        )
        cmd_stop(args)
        out = capsys.readouterr().out
        assert "Aborted" in out
        # Schedule still in store.
        assert len(JobStore().read()["schedules"]) == 1

    def test_stop_prompt_approved(self, sandbox, monkeypatch, capsys):
        JobStore().add_cron({"id": "cron_1", "folder": "/x", "expr": "* * * * *"})
        monkeypatch.setattr("builtins.input", lambda prompt="": "yes")
        args = Namespace(
            folder=None, yes=False, running_only=False,
            scheduled_only=False, cron_only=False,
        )
        cmd_stop(args)
        assert JobStore().read()["crons"] == []

    def test_scheduled_only_skips_crons(self, sandbox, capsys):
        JobStore().add_schedule({"id": "sch_1", "folder": "/x", "at_iso": "2026-04-17T09:00"})
        JobStore().add_cron({"id": "cron_1", "folder": "/x", "expr": "* * * * *"})
        args = Namespace(
            folder=None, yes=True, running_only=False,
            scheduled_only=True, cron_only=False,
        )
        cmd_stop(args)
        data = JobStore().read()
        assert data["schedules"] == []
        assert len(data["crons"]) == 1  # Untouched

    def test_cron_only_skips_schedules(self, sandbox):
        JobStore().add_schedule({"id": "sch_1", "folder": "/x", "at_iso": "2026-04-17T09:00"})
        JobStore().add_cron({"id": "cron_1", "folder": "/x", "expr": "* * * * *"})
        args = Namespace(
            folder=None, yes=True, running_only=False,
            scheduled_only=False, cron_only=True,
        )
        cmd_stop(args)
        data = JobStore().read()
        assert len(data["schedules"]) == 1
        assert data["crons"] == []

    def test_running_only_keeps_jobs(self, sandbox):
        JobStore().add_schedule({"id": "sch_1", "folder": "/x", "at_iso": "2026-04-17T09:00"})
        JobStore().add_cron({"id": "cron_1", "folder": "/x", "expr": "* * * * *"})
        args = Namespace(
            folder=None, yes=True, running_only=True,
            scheduled_only=False, cron_only=False,
        )
        cmd_stop(args)
        data = JobStore().read()
        assert len(data["schedules"]) == 1
        assert len(data["crons"]) == 1

    def test_nothing_to_stop(self, sandbox, capsys):
        args = Namespace(
            folder=None, yes=True, running_only=False,
            scheduled_only=False, cron_only=False,
        )
        cmd_stop(args)
        out = capsys.readouterr().out
        assert "No running instances" in out or "Nothing to stop" in out

    def test_mutually_exclusive_only_flags(self, sandbox, capsys):
        args = Namespace(
            folder=None, yes=True, running_only=True,
            scheduled_only=True, cron_only=False,
        )
        cmd_stop(args)
        assert "mutually exclusive" in capsys.readouterr().out


# ── status ─────────────────────────────────────────────────────────────────


class TestCmdStatusWithJobs:
    def test_global_status_shows_scheduled_and_cron(self, sandbox, capsys):
        JobStore().add_schedule({"id": "sch_1", "folder": "/x", "model": "flash", "at_iso": "2026-04-17T09:00"})
        JobStore().add_cron(
            {
                "id": "cron_1",
                "folder": "/y",
                "model": "flash",
                "expr": "* * * * *",
                "next_run_iso": "2026-04-17T09:01:00",
                "last_run_iso": None,
            }
        )
        cmd_status(Namespace(folder=None))
        out = capsys.readouterr().out
        assert "sch_1" in out
        assert "cron_1" in out


# ── main() argv rewriting ──────────────────────────────────────────────────


class TestMainArgvRewrite:
    def test_schedule_folder_shortcut_rewrites_to_add(
        self, sandbox, monkeypatch, capsys
    ):
        target = _make_target(sandbox, "x")
        # Simulate: prompt_executor.py schedule <folder> --in 1h -m flash
        monkeypatch.setattr(
            sys, "argv",
            ["prompt_executor.py", "schedule", str(target), "--in", "1h", "-m", "flash"],
        )
        with patch("prompt_executor._start_scheduler_daemon_if_needed"):
            main()
        # Successful add produces "Scheduled job" output.
        assert "Scheduled job" in capsys.readouterr().out
