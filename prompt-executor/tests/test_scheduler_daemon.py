"""Tests for the scheduler daemon: _scheduler_tick, _spawn_run, _start_scheduler_daemon_if_needed."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

import prompt_executor as pe
from prompt_executor import (
    JobStore,
    _scheduler_is_running,
    _scheduler_log,
    _scheduler_tick,
    _spawn_run,
    _start_scheduler_daemon_if_needed,
)


@pytest.fixture
def tmp_jobs(tmp_path, monkeypatch):
    jobs_path = tmp_path / ".prompt_executor_jobs.json"
    pid_path = tmp_path / ".prompt_executor_scheduler.pid"
    log_path = tmp_path / ".prompt_executor_scheduler.log"
    monkeypatch.setattr(pe, "JOBS_FILE", jobs_path)
    monkeypatch.setattr(pe, "SCHEDULER_PID_FILE", pid_path)
    monkeypatch.setattr(pe, "SCHEDULER_LOG_FILE", log_path)
    # JobStore default arg was captured at import; patch it too so new
    # JobStore() instances hit the tmp path.
    original_init = JobStore.__init__

    def patched_init(self, path=jobs_path):
        original_init(self, path)

    monkeypatch.setattr(JobStore, "__init__", patched_init)
    return {"jobs": jobs_path, "pid": pid_path, "log": log_path}


class TestSchedulerLog:
    def test_writes_timestamped_line(self, tmp_jobs):
        _scheduler_log("hello world")
        text = tmp_jobs["log"].read_text()
        assert "hello world" in text
        assert text.count("\n") == 1


class TestSpawnRun:
    def test_builds_run_command(self, tmp_jobs):
        with patch("prompt_executor.subprocess.Popen") as popen:
            popen.return_value.pid = 4242
            pid = _spawn_run(
                "/some/folder",
                "flash",
                agent=None,
                period=5,
                max_retries=3,
                retry_wait=10,
                working_dir=None,
            )
        assert pid == 4242
        args, kwargs = popen.call_args
        cmd = args[0]
        assert "run" in cmd
        assert "/some/folder" in cmd
        assert "flash" in cmd
        assert kwargs["start_new_session"] is True

    def test_includes_optional_flags(self, tmp_jobs):
        with patch("prompt_executor.subprocess.Popen") as popen:
            popen.return_value.pid = 1
            _spawn_run(
                "/f",
                "opus",
                agent="coder",
                period=1,
                max_retries=2,
                retry_wait=3,
                working_dir="/proj",
            )
        cmd = popen.call_args[0][0]
        assert "--agent" in cmd
        assert "coder" in cmd
        assert "--working-dir" in cmd
        assert "/proj" in cmd

    def test_halt_on_fail_forwarded(self, tmp_jobs):
        with patch("prompt_executor.subprocess.Popen") as popen:
            popen.return_value.pid = 7
            _spawn_run(
                "/f",
                "flash",
                agent=None,
                period=1,
                max_retries=5,
                retry_wait=1,
                working_dir=None,
                halt_on_fail=True,
            )
        cmd = popen.call_args[0][0]
        assert "--halt-on-fail" in cmd

    def test_halt_on_fail_default_off(self, tmp_jobs):
        with patch("prompt_executor.subprocess.Popen") as popen:
            popen.return_value.pid = 8
            _spawn_run(
                "/f",
                "flash",
                agent=None,
                period=1,
                max_retries=5,
                retry_wait=1,
                working_dir=None,
            )
        cmd = popen.call_args[0][0]
        assert "--halt-on-fail" not in cmd


class TestSchedulerTick:
    def test_empty_store_fires_nothing(self, tmp_jobs):
        assert _scheduler_tick() == 0

    def test_due_schedule_fires_and_is_removed(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        past = (now - timedelta(minutes=1)).isoformat()
        store = JobStore()
        store.add_schedule(
            {
                "id": "sch_1",
                "folder": "/x",
                "model": "flash",
                "agent": None,
                "period": 0,
                "max_retries": 1,
                "retry_wait": 1,
                "working_dir": None,
                "at_iso": past,
            }
        )
        with patch("prompt_executor._spawn_run", return_value=999) as spawn:
            fired = _scheduler_tick(now=now)
        assert fired == 1
        spawn.assert_called_once()
        # Schedule removed.
        assert store.read()["schedules"] == []

    def test_future_schedule_is_not_fired(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        future = (now + timedelta(hours=1)).isoformat()
        store = JobStore()
        store.add_schedule(
            {
                "id": "sch_1",
                "folder": "/x",
                "model": "flash",
                "at_iso": future,
            }
        )
        with patch("prompt_executor._spawn_run") as spawn:
            fired = _scheduler_tick(now=now)
        assert fired == 0
        spawn.assert_not_called()
        # Still in the store.
        assert len(store.read()["schedules"]) == 1

    def test_bad_at_iso_drops_schedule(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        store = JobStore()
        store.add_schedule(
            {
                "id": "sch_bad",
                "folder": "/x",
                "model": "flash",
                "at_iso": "not-a-date",
            }
        )
        _scheduler_tick(now=now)
        # Silently dropped.
        assert store.read()["schedules"] == []

    def test_due_cron_fires_and_advances(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 30)
        due = (now - timedelta(seconds=30)).isoformat()
        store = JobStore()
        store.add_cron(
            {
                "id": "cron_1",
                "folder": "/x",
                "model": "flash",
                "agent": None,
                "period": 0,
                "max_retries": 1,
                "retry_wait": 1,
                "working_dir": None,
                "expr": "* * * * *",
                "last_run_iso": None,
                "next_run_iso": due,
            }
        )
        with patch("prompt_executor._spawn_run", return_value=100):
            fired = _scheduler_tick(now=now)
        assert fired == 1
        data = store.read()
        assert len(data["crons"]) == 1  # cron stays registered
        assert data["crons"][0]["last_run_iso"] == now.isoformat()

    def test_cron_with_missing_next_run_computes_it(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        store = JobStore()
        store.add_cron(
            {
                "id": "cron_1",
                "folder": "/x",
                "model": "flash",
                "expr": "0 9 * * *",
                "last_run_iso": None,
                "next_run_iso": None,
            }
        )
        _scheduler_tick(now=now)
        nxt = store.read()["crons"][0]["next_run_iso"]
        assert nxt is not None
        # Should be tomorrow at 09:00.
        assert datetime.fromisoformat(nxt) > now

    def test_cron_with_bad_next_run_iso_recomputes(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        store = JobStore()
        store.add_cron(
            {
                "id": "cron_1",
                "folder": "/x",
                "model": "flash",
                "expr": "0 9 * * *",
                "last_run_iso": None,
                "next_run_iso": "bogus",
            }
        )
        _scheduler_tick(now=now)
        nxt = store.read()["crons"][0]["next_run_iso"]
        assert datetime.fromisoformat(nxt) > now

    def test_cron_without_expr_is_skipped(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        store = JobStore()
        store.add_cron(
            {"id": "cron_bad", "folder": "/x", "model": "flash"}
        )
        fired = _scheduler_tick(now=now)
        assert fired == 0

    def test_future_cron_is_not_fired(self, tmp_jobs):
        now = datetime(2026, 4, 16, 12, 0, 0)
        future = (now + timedelta(hours=1)).isoformat()
        store = JobStore()
        store.add_cron(
            {
                "id": "cron_1",
                "folder": "/x",
                "model": "flash",
                "expr": "* * * * *",
                "last_run_iso": None,
                "next_run_iso": future,
            }
        )
        with patch("prompt_executor._spawn_run") as spawn:
            fired = _scheduler_tick(now=now)
        assert fired == 0
        spawn.assert_not_called()


class TestSchedulerIsRunning:
    def test_no_pid_file(self, tmp_jobs):
        assert _scheduler_is_running() is False

    def test_dead_pid(self, tmp_jobs):
        tmp_jobs["pid"].write_text("99999999")
        assert _scheduler_is_running() is False

    def test_alive_pid(self, tmp_jobs):
        import os as _os

        tmp_jobs["pid"].write_text(str(_os.getpid()))
        assert _scheduler_is_running() is True


class TestStartSchedulerDaemonIfNeeded:
    def test_noop_when_running(self, tmp_jobs):
        import os as _os

        tmp_jobs["pid"].write_text(str(_os.getpid()))
        with patch("prompt_executor.subprocess.Popen") as popen:
            _start_scheduler_daemon_if_needed()
        popen.assert_not_called()

    def test_spawns_when_not_running(self, tmp_jobs, monkeypatch):
        # Leave the pid file absent so _scheduler_is_running == False.
        popen_mock = MagicMock()
        popen_mock.return_value.pid = 1
        monkeypatch.setattr("prompt_executor.subprocess.Popen", popen_mock)
        # Prevent the post-spawn wait loop from hanging by marking running
        # immediately via monkeypatch.
        calls = {"n": 0}

        def fake_running():
            calls["n"] += 1
            return calls["n"] > 1  # first check = not running; spawn; then running

        monkeypatch.setattr("prompt_executor._scheduler_is_running", fake_running)
        _start_scheduler_daemon_if_needed()
        popen_mock.assert_called_once()
        cmd = popen_mock.call_args[0][0]
        assert "scheduler-daemon" in cmd

    def test_cleans_stale_pid_file(self, tmp_jobs, monkeypatch):
        tmp_jobs["pid"].write_text("99999999")
        popen_mock = MagicMock()
        monkeypatch.setattr("prompt_executor.subprocess.Popen", popen_mock)
        calls = {"n": 0}

        def fake_running():
            calls["n"] += 1
            return calls["n"] > 1

        monkeypatch.setattr("prompt_executor._scheduler_is_running", fake_running)
        _start_scheduler_daemon_if_needed()
        # Stale pid file was cleared before spawning.
        popen_mock.assert_called_once()
