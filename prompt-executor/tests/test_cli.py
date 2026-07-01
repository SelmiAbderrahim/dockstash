import os
import signal
import sys
from argparse import Namespace
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

from prompt_executor import (
    cmd_start,
    cmd_run,
    cmd_stop,
    cmd_status,
    add_common_args,
    main,
    _stop_pid_file,
    _count_files_recursive,
    _count_all_md,
    _show_failures_summary,
    init_runtime_files,
    BACKEND_OPENCODE,
)


class TestCmdRun:
    def test_run_success(self, runtime_files, fake_env, monkeypatch):
        target = runtime_files["pid"].parent / "my-folder"
        target.mkdir()
        (target / "01-task.md").write_text("do stuff")
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(
            folder=str(target),
            model="glm-5.1",
            agent=None,
            period=0,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
        )
        with patch("prompt_executor.resilient_run") as mock:
            cmd_run(args)
        mock.assert_called_once()

    def test_run_no_pending(self, runtime_files, fake_env, monkeypatch):
        target = runtime_files["pid"].parent / "empty-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(
            folder=str(target),
            model="glm-5.1",
            agent=None,
            period=0,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
        )
        with patch("prompt_executor.resilient_run"):
            cmd_run(args)

    def test_run_already_running(self, runtime_files, fake_env, monkeypatch):
        target = runtime_files["pid"].parent / "running-folder"
        target.mkdir()
        runtime_files["pid"].write_text(str(os.getpid()))
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(
            folder=str(target),
            model="glm-5.1",
            agent=None,
            period=0,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
        )
        with patch("prompt_executor.read_pid", return_value=os.getpid()):
            with pytest.raises(SystemExit):
                cmd_run(args)


class TestCmdStart:
    def test_start_daemonizes(self, runtime_files, fake_env, monkeypatch):
        target = runtime_files["pid"].parent / "daemon-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(
            folder=str(target),
            model="glm-5.1",
            agent=None,
            period=0,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
        )
        with (
            patch("prompt_executor.daemonize"),
            patch("prompt_executor.install_crash_handlers"),
            patch("prompt_executor.setup_signals"),
            patch("prompt_executor.resilient_run"),
            patch("prompt_executor.remove_pid"),
        ):
            cmd_start(args)


class TestCmdStop:
    def test_stop_specific(self, runtime_files, monkeypatch):
        target = runtime_files["pid"].parent / "my-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder=str(target))
        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor.clean_stale_pid"),
        ):
            cmd_stop(args)

    def test_stop_all(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        args = Namespace(folder=None)
        with patch("prompt_executor.SCRIPT_DIR") as mock_dir:
            mock_dir.glob.return_value = []
            with patch("prompt_executor.init_runtime_files"):
                cmd_stop(args)

    def test_stop_not_running(self, runtime_files, monkeypatch):
        target = runtime_files["pid"].parent / "my-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder=str(target))
        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor.clean_stale_pid"),
        ):
            cmd_stop(args)


class TestStopPidFile:
    def test_stale_pid_file_removed(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("99999999")
        result = _stop_pid_file(pf)
        assert result is False

    def test_stop_live_pid(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text(str(os.getpid()))
        # `_stop_pid_file` now signals the whole process group via os.killpg
        # (and falls back to os.kill on PermissionError). Patch both so the
        # test never fires a real signal at its own group, and patch
        # `_pid_alive` so the post-kill polling loop terminates immediately
        # without burning the 10-s wait wall-clock.
        with (
            patch("prompt_executor._read_pid_from_file", return_value=os.getpid()),
            patch("prompt_executor._pid_alive", return_value=False),
            patch("prompt_executor._sweep_descendants", return_value=0),
            patch("os.killpg") as mock_killpg,
            patch("os.kill") as mock_kill,
            patch("os.getpgid", return_value=os.getpid()),
            patch("time.sleep"),
        ):
            mock_kill.return_value = None
            mock_killpg.return_value = None
            result = _stop_pid_file(pf)
        assert result is True

    def test_stop_sends_sigterm(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text(str(os.getpid()))
        with (
            patch("prompt_executor._read_pid_from_file", return_value=os.getpid()),
            patch("prompt_executor._pid_alive", return_value=False),
            patch("prompt_executor._sweep_descendants", return_value=0),
            patch("os.killpg") as mock_killpg,
            patch("os.kill"),
            patch("os.getpgid", return_value=os.getpid()),
            patch("time.sleep"),
        ):
            result = _stop_pid_file(pf)
        assert result is True
        # Process-group signalling: SIGTERM goes to the group, not the PID.
        mock_killpg.assert_any_call(os.getpid(), signal.SIGTERM)


class TestCmdStatus:
    def test_status_specific_folder(self, runtime_files, monkeypatch):
        target = runtime_files["pid"].parent / "my-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder=str(target))
        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)

    def test_status_all_instances(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder=None)
        with patch("prompt_executor.SCRIPT_DIR") as mock_dir:
            mock_dir.glob.return_value = []
            cmd_status(args)

    def test_status_with_done_folder(self, runtime_files, monkeypatch, capsys):
        parent = runtime_files["pid"].parent
        target = parent / "my-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder=str(target))
        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)

    def test_status_folder_not_found(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder="nonexistent-folder-xyz")
        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            with pytest.raises(SystemExit):
                cmd_status(args)


class TestMain:
    def test_no_command_exits(self):
        with pytest.raises(SystemExit):
            main()

    def test_run_command(self, fake_env):
        with (
            patch("sys.argv", ["pe", "run", "prompts/test", "--model", "glm-5.1"]),
            patch("prompt_executor.cmd_run") as mock,
        ):
            mock.side_effect = SystemExit(0)
            with pytest.raises(SystemExit):
                main()


class TestHelperFunctions:
    def test_count_files_recursive(self, tmp_path):
        (tmp_path / "01-a.md").write_text("a")
        (tmp_path / "02-b_done.md").write_text("b")
        done, pending = _count_files_recursive(tmp_path)
        assert done == 1
        assert pending == 1

    def test_count_files_recursive_with_done_dir(self, tmp_path):
        d = tmp_path / "sub_done"
        d.mkdir()
        (d / "01.md").write_text("done")
        done, pending = _count_files_recursive(tmp_path)
        assert done == 1
        assert pending == 0

    def test_count_all_md(self, tmp_path):
        (tmp_path / "a.md").write_text("a")
        (tmp_path / "b.md").write_text("b")
        count, zero = _count_all_md(tmp_path)
        assert count == 2
        assert zero == 0

    def test_show_failures_summary(self, runtime_files, capsys):
        runtime_files["failures"].write_text("[2025-01-01] SKIPPED: test.md\nstuff\n")
        import prompt_executor

        _show_failures_summary()
        captured = capsys.readouterr()
        assert "skipped" in captured.out

    def test_show_failures_summary_no_file(self, runtime_files):
        _show_failures_summary()

    def test_show_failures_summary_oserror(self, runtime_files, monkeypatch):
        runtime_files["failures"].write_text("[t] SKIPPED: test.md\n")
        with patch.object(Path, "read_text", side_effect=OSError("nope")):
            _show_failures_summary()
