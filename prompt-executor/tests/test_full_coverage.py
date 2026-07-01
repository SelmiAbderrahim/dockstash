import os
import signal
import subprocess
import sys
import time
from argparse import Namespace
from pathlib import Path
from unittest.mock import MagicMock, PropertyMock, patch, mock_open

import pytest

from prompt_executor import (
    _load_dotenv,
    _DOTENV_LOADED_COUNT,
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
    PROJECT_ROOT,
    RESULT_SUCCESS,
    RESULT_ERROR,
    RESULT_FATAL,
    RESULT_SKIP,
    RESULT_TIMEOUT,
    PromptResult,
    find_matching_executor_pids,
    assert_no_duplicate_executor,
    resilient_run,
    daemonize,
    setup_signals,
    snapshot_git_state,
    detect_git_changes,
    init_runtime_files,
    _build_opencode_cmd,
    safe_sleep,
    remove_pid,
    _stop_pid_file,
    install_crash_handlers,
    is_dir_fully_complete,
    try_mark_ancestors_done,
    cmd_start,
    cmd_run,
    cmd_stop,
    main,
)


class TestLoadDotenv:
    def test_loads_key_value(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("MY_KEY=my_value\n")
        monkeypatch.delenv("MY_KEY", raising=False)
        count = _load_dotenv(env_file)
        assert count == 1
        assert os.environ["MY_KEY"] == "my_value"

    def test_skips_existing(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("EXISTING_KEY=new_value\n")
        monkeypatch.setenv("EXISTING_KEY", "old_value")
        count = _load_dotenv(env_file)
        assert count == 0
        assert os.environ["EXISTING_KEY"] == "old_value"

    def test_nonexistent_returns_zero(self, tmp_path):
        assert _load_dotenv(tmp_path / "nope") == 0

    def test_comments_skipped(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("# comment\nKEY=val\n")
        monkeypatch.delenv("KEY", raising=False)
        count = _load_dotenv(env_file)
        assert count == 1

    def test_blank_lines_skipped(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("\n\nKEY=val\n")
        monkeypatch.delenv("KEY", raising=False)
        count = _load_dotenv(env_file)
        assert count == 1

    def test_export_prefix_stripped(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("export EXP_KEY=val\n")
        monkeypatch.delenv("EXP_KEY", raising=False)
        count = _load_dotenv(env_file)
        assert count == 1

    def test_no_equals_skipped(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("NO_EQUALS_HERE\n")
        count = _load_dotenv(env_file)
        assert count == 0

    def test_empty_key_skipped(self, tmp_path):
        env_file = tmp_path / ".env"
        env_file.write_text("=value\n")
        count = _load_dotenv(env_file)
        assert count == 0

    def test_quotes_stripped(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text('QUOTED="hello world"\n')
        monkeypatch.delenv("QUOTED", raising=False)
        count = _load_dotenv(env_file)
        assert count == 1
        assert os.environ["QUOTED"] == "hello world"

    def test_single_quotes_stripped(self, tmp_path, monkeypatch):
        env_file = tmp_path / ".env"
        env_file.write_text("SINGLE='hello world'\n")
        monkeypatch.delenv("SINGLE", raising=False)
        count = _load_dotenv(env_file)
        assert count == 1
        assert os.environ["SINGLE"] == "hello world"

    def test_oserror_handled(self, tmp_path, monkeypatch, capsys):
        env_file = tmp_path / ".env"
        env_file.write_text("KEY=val\n")
        with patch.object(Path, "open", side_effect=OSError("nope")):
            count = _load_dotenv(env_file)
        assert count == 0


class TestFindMatchingExecutorPids:
    def test_empty_slug(self, tmp_path):
        p = tmp_path / ""
        assert find_matching_executor_pids(Path("")) == []

    def test_no_proc_dir(self, monkeypatch):
        with patch.object(Path, "is_dir", return_value=False):
            assert find_matching_executor_pids(Path("/some/folder")) == []

    def test_proc_iterdir_oserror(self, monkeypatch):
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", side_effect=OSError("nope")),
        ):
            assert find_matching_executor_pids(Path("/some/folder")) == []

    def test_finds_matching_pid(self, monkeypatch):
        slug = "blog-system"
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(
                Path,
                "read_bytes",
                return_value=b"python3\x00prompt_executor.py\x00blog-system\x00",
            ),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path(f"prompts/{slug}"))
        assert 12345 in result

    def test_skips_self_pid(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch("os.getpid", return_value=12345),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_skips_non_python(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(Path, "read_bytes", return_value=b"bash\x00script.sh\x00"),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_skips_wrong_script(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(
                Path, "read_bytes", return_value=b"python3\x00other_script.py\x00"
            ),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_skips_wrong_slug(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(
                Path,
                "read_bytes",
                return_value=b"python3\x00prompt_executor.py\x00other-folder\x00",
            ),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_read_bytes_error(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(Path, "read_bytes", side_effect=PermissionError("denied")),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_empty_cmdline(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(Path, "read_bytes", return_value=b""),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_non_digit_pid_dir(self, monkeypatch):
        fake_proc = Path("/proc/net")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []


class TestAssertNoDuplicateExecutor:
    def test_no_duplicates(self, monkeypatch):
        with patch("prompt_executor.find_matching_executor_pids", return_value=[]):
            assert_no_duplicate_executor(Path("prompts/test"))

    def test_duplicate_exits(self, monkeypatch):
        with (
            patch("prompt_executor.find_matching_executor_pids", return_value=[12345]),
            pytest.raises(SystemExit),
        ):
            assert_no_duplicate_executor(Path("prompts/test"))


class TestResilientRun:
    def test_normal_completion(self, runtime_files, monkeypatch):
        target = runtime_files["log"].parent / "target"
        target.mkdir()
        with patch("prompt_executor.run_all_prompts"):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_folder_gone(self, runtime_files, monkeypatch):
        target = runtime_files["log"].parent / "gone"
        with patch("prompt_executor.LOG_FILE", runtime_files["log"]):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_keyboard_interrupt(self, runtime_files, monkeypatch):
        target = runtime_files["log"].parent / "target"
        target.mkdir()
        with patch("prompt_executor.run_all_prompts", side_effect=KeyboardInterrupt):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_system_exit_reraises(self, runtime_files, monkeypatch):
        target = runtime_files["log"].parent / "target"
        target.mkdir()
        with (
            patch("prompt_executor.run_all_prompts", side_effect=SystemExit(0)),
            pytest.raises(SystemExit),
        ):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_crash_recovery(self, runtime_files, monkeypatch):
        target = runtime_files["log"].parent / "target"
        target.mkdir()
        call_count = 0

        def crash_once(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("crash")
            return

        with (
            patch("prompt_executor.run_all_prompts", side_effect=crash_once),
            patch("prompt_executor.time.sleep"),
            patch("prompt_executor.LOG_FILE", runtime_files["log"]),
        ):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")
        assert call_count == 2

    def test_max_crashes_gives_up(self, runtime_files, monkeypatch):
        import prompt_executor

        target = runtime_files["log"].parent / "target"
        target.mkdir()
        with (
            patch("prompt_executor.run_all_prompts", side_effect=RuntimeError("boom")),
            patch("prompt_executor.time.sleep"),
            patch("prompt_executor.LOG_FILE", runtime_files["log"]),
            patch("prompt_executor.MAX_CRASHES", 2),
        ):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_max_crashes_reports_pending(self, runtime_files, monkeypatch):
        import prompt_executor

        target = runtime_files["log"].parent / "target"
        target.mkdir()
        (target / "01-pending.md").write_text("still here")
        with (
            patch("prompt_executor.run_all_prompts", side_effect=RuntimeError("boom")),
            patch("prompt_executor.time.sleep"),
            patch("prompt_executor.LOG_FILE", runtime_files["log"]),
            patch("prompt_executor.MAX_CRASHES", 1),
        ):
            resilient_run(target, 0, 1, 1, "glm-5.1", "opencode")


class TestDaemonize:
    def test_first_fork_parent_exits(self):
        with (
            patch("os.fork", return_value=99999),
            pytest.raises(SystemExit) as exc_info,
        ):
            daemonize()
        assert exc_info.value.code == 0

    def test_second_fork_parent_exits(self):
        with (
            patch("os.fork", side_effect=[0, 99999]),
            patch("os.setsid"),
            pytest.raises(SystemExit) as exc_info,
        ):
            daemonize()
        assert exc_info.value.code == 0

    def test_child_continues(self, monkeypatch):
        with (
            patch("os.fork", return_value=0),
            patch("os.setsid"),
            patch("sys.stdout.flush"),
            patch("sys.stderr.flush"),
            patch("os.open", return_value=10),
            patch("os.dup2"),
            patch("os.close"),
        ):
            daemonize()


class TestSetupSignals:
    def test_installs_handlers(self):
        import signal

        with patch("signal.signal") as mock:
            setup_signals()
        assert mock.call_count == 2

    def test_sigterm_handler(self, runtime_files, monkeypatch):
        import prompt_executor

        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])

        setup_signals()
        handler = signal.getsignal(signal.SIGTERM)
        assert callable(handler)
        signal.signal(signal.SIGTERM, signal.SIG_DFL)


class TestSnapshotGitState:
    def test_success(self, tmp_path):
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(returncode=0, stdout="file.txt\n")
            result = snapshot_git_state(tmp_path)
        assert result == {"file.txt"}

    def test_git_failure(self, tmp_path):
        with patch("prompt_executor.subprocess.run") as mock:
            mock.return_value = MagicMock(returncode=128, stdout="")
            result = snapshot_git_state(tmp_path)
        assert result is None

    def test_git_not_found(self, tmp_path):
        with patch("prompt_executor.subprocess.run", side_effect=FileNotFoundError):
            result = snapshot_git_state(tmp_path)
        assert result is None

    def test_timeout(self, tmp_path):
        with patch(
            "prompt_executor.subprocess.run",
            side_effect=subprocess.TimeoutExpired("git", 30),
        ):
            result = snapshot_git_state(tmp_path)
        assert result is None


class TestDetectGitChanges:
    def test_changes_detected(self):
        assert detect_git_changes({"a.txt"}, {"a.txt", "b.txt"}) is True

    def test_no_changes(self):
        assert detect_git_changes({"a.txt"}, {"a.txt"}) is False

    def test_none_before(self):
        assert detect_git_changes(None, {"a.txt"}) is True

    def test_none_after(self):
        assert detect_git_changes({"a.txt"}, None) is True

    def test_both_none(self):
        assert detect_git_changes(None, None) is True


class TestSafeSleep:
    def test_negative_returns(self):
        safe_sleep(-1)

    def test_heartbeat_logged(self):
        with (
            patch("prompt_executor.time.sleep"),
            patch("prompt_executor.LOG_FILE", Path("/tmp/test_heartbeat.log")),
        ):
            safe_sleep(10)


class TestBuildOpenCodeCmdLargePrompt:
    def test_exactly_32k_boundary(self):
        small = "x" * 32768
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_content=small)
        assert stdin is None
        assert small in cmd

    def test_just_over_32k(self):
        big = "x" * 32769
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_content=big)
        assert stdin == big


class TestStopPidFileProcessLookup:
    def test_process_lookup_during_kill(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("12345")
        with (
            patch("prompt_executor._read_pid_from_file", return_value=12345),
            patch("os.kill", side_effect=ProcessLookupError),
        ):
            result = _stop_pid_file(pf)
        assert result is True


class TestCmdStatusAllWithStalePid:
    def test_stale_pid_cleaned(self, tmp_path, monkeypatch, capsys):
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        pf = tmp_path / ".prompt_executor_blog.pid"
        pf.write_text("99999999")
        args = Namespace(folder=None)
        with patch("prompt_executor._read_pid_from_file", return_value=None):
            from prompt_executor import cmd_status

            cmd_status(args)
        assert not pf.exists()


class TestCmdStatusSpecificWithRunningPid:
    def test_running_status(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        (target / "01-a.md").write_text("task")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=1234),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "Running (PID 1234)" in captured.out


class TestCmdStatusSpecificWithStalePid:
    def test_stale_pid_detected(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        pid_file = tmp_path / ".prompt_executor_blog.pid"
        pid_file.write_text("99999999")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", pid_file)
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "stale PID" in captured.out


class TestCmdStatusDoneFolder:
    def test_done_folder_detected(self, tmp_path, monkeypatch, capsys):
        parent = tmp_path / "prompts"
        parent.mkdir()
        done = parent / "blog_done"
        done.mkdir()
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(done))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "blog_done" in captured.out


class TestCmdStatusNotDir:
    def test_not_dir_exits(self, tmp_path, monkeypatch, capsys):
        f = tmp_path / "myfile"
        f.write_text("hi")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(f))
        from prompt_executor import cmd_status

        with pytest.raises(SystemExit):
            cmd_status(args)


class TestCmdStatusWithPending:
    def test_shows_next_prompts(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        (target / "01-a.md").write_text("task a")
        (target / "02-b.md").write_text("task b")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "Next up" in captured.out


class TestCmdStatusPostResolution:
    def test_shows_progress(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        (target / "01-a.md").write_text("task a")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "pending" in captured.out

    def test_folder_done_via_second_path_check(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        done = tmp_path / "blog_done"
        done.mkdir()
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            with patch(
                "prompt_executor.resolve_target_folder",
                side_effect=lambda x: Path(x) if Path(x).exists else None,
            ) as mock_resolve:
                mock_resolve.return_value = target
                with patch("prompt_executor.PROJECT_ROOT", tmp_path):
                    cmd_status(args)
        captured = capsys.readouterr()

    def test_many_pending_shows_more_indicator(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        for i in range(7):
            (target / f"{i:02d}-task.md").write_text(f"task {i}")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "more" in captured.out


class TestCmdStopAllWithInstances:
    def test_stops_multiple(self, tmp_path, monkeypatch, capsys):
        pf1 = tmp_path / ".prompt_executor_blog.pid"
        pf2 = tmp_path / ".prompt_executor_fire.pid"
        pf1.write_text("12345")
        pf2.write_text("67890")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        # `cmd_stop` now prompts for confirmation before mass-stopping. The
        # `yes=True` flag bypasses the prompt; the other *_only flags are
        # required because `cmd_stop` reads them via `getattr(..., False)`
        # but only on a Namespace they need to actually exist for the
        # mutual-exclusivity guard to evaluate cleanly.
        args = Namespace(
            folder=None,
            yes=True,
            running_only=False,
            scheduled_only=False,
            cron_only=False,
        )
        from prompt_executor import cmd_stop

        with patch("prompt_executor._stop_pid_file", return_value=True):
            cmd_stop(args)
        captured = capsys.readouterr()
        assert "Stopping 2" in captured.out


class TestRemainingCoverage:
    def test_atexit_on_exit_logs(self, runtime_files):
        import atexit

        handlers = []
        original_register = atexit.register

        def capture_register(func, *args, **kwargs):
            handlers.append(func)
            return original_register(func, *args, **kwargs)

        with patch.object(atexit, "register", side_effect=capture_register):
            install_crash_handlers()
        assert len(handlers) == 1
        handlers[0]()
        content = runtime_files["log"].read_text()
        assert "Process exiting" in content

    def test_find_matching_executor_value_error_pid(self, monkeypatch):
        fake_proc = Path("/proc/abc")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_find_matching_executor_empty_argv(self, monkeypatch):
        fake_proc = Path("/proc/12345")
        with (
            patch.object(Path, "is_dir", return_value=True),
            patch.object(Path, "iterdir", return_value=[fake_proc]),
            patch.object(Path, "read_bytes", return_value=b"\x00\x00"),
            patch("os.getpid", return_value=99999),
        ):
            result = find_matching_executor_pids(Path("prompts/test"))
        assert result == []

    def test_is_dir_fully_complete_with_hidden(self, tmp_path):
        (tmp_path / ".hidden").mkdir()
        assert is_dir_fully_complete(tmp_path) is True

    def test_try_mark_ancestors_done_oserror(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        f = sub / "task_done.md"
        f.write_text("done")
        with (
            patch("prompt_executor.LOG_FILE", tmp_path / "test.log"),
            patch.object(Path, "rename", side_effect=OSError("nope")),
        ):
            try_mark_ancestors_done(f, tmp_path)

    def test_execute_prompt_large_opencode_stdin_path(self, runtime_files, fake_env):
        from prompt_executor import execute_prompt

        prompt = runtime_files["log"].parent / "big.md"
        prompt.write_text("x" * 50000)
        # execute_prompt now uses subprocess.Popen + proc.communicate(input=...)
        # rather than subprocess.run. The stdin payload lives on the
        # communicate() call, not on Popen() — assert against that.
        fake_proc = MagicMock()
        fake_proc.communicate.return_value = ("ok", "")
        fake_proc.returncode = 0
        fake_proc.pid = 99999
        with patch("prompt_executor.subprocess.Popen", return_value=fake_proc):
            result = execute_prompt(prompt, "glm-5.1", "opencode")
        assert result.result_code == RESULT_SUCCESS
        _, kwargs = fake_proc.communicate.call_args
        assert kwargs["input"] is not None

    def test_run_all_prompts_with_skipped_and_fatal(self, tmp_path, monkeypatch):
        from prompt_executor import run_all_prompts

        target = tmp_path / "t"
        target.mkdir()
        (target / "01-a.md").write_text("a")
        (target / "02-b.md").write_text("b")
        (target / "03-c.md").write_text("c")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        results = [
            (False, False),
            (False, True),
        ]

        def side_effect(*args, **kwargs):
            if not results:
                return (True, False)
            return results.pop(0)

        with patch(
            "prompt_executor.execute_prompt_with_retry", side_effect=side_effect
        ):
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_cmd_start_with_agent(self, runtime_files, fake_env, monkeypatch):
        target = runtime_files["pid"].parent / "agent-folder"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(
            folder=str(target),
            model="glm-5.1",
            agent="builder",
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

    def test_cmd_run_with_agent(self, runtime_files, fake_env, monkeypatch, capsys):
        target = runtime_files["pid"].parent / "agent-folder"
        target.mkdir()
        (target / "01-task.md").write_text("do stuff")
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(
            folder=str(target),
            model="glm-5.1",
            agent="builder",
            period=0,
            max_retries=1,
            retry_wait=1,
            working_dir=None,
        )
        with patch("prompt_executor.resilient_run"):
            cmd_run(args)
        captured = capsys.readouterr()
        assert "builder" in captured.out

    def test_stop_pid_file_successful_kill_and_wait(self, tmp_path):
        """_stop_pid_file returns True after SIGTERM + wait loop + cleanup.

        Mocks _pid_alive directly (instead of os.kill) because the refactored
        _stop_pid_file now performs multi-stage graceful shutdown (SIGTERM,
        20×500ms poll, SIGKILL fallback, final liveness check, /proc sweep)
        and calls _pid_alive many times across those stages.
        """
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("12345")
        # Sequence: alive, alive, then dead for all subsequent polls.
        alive_sequence = [True, True] + [False] * 40
        with (
            patch("prompt_executor._read_pid_from_file", return_value=12345),
            patch("prompt_executor._pid_alive", side_effect=alive_sequence),
            patch("prompt_executor._sweep_descendants", return_value=0),
            patch("os.kill"),
            patch("os.killpg"),
            patch("os.getpgid", return_value=12345),
            patch("time.sleep"),
        ):
            result = _stop_pid_file(pf)
        assert result is True

    def test_stop_pid_file_unlink_not_found(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("12345")
        with (
            patch("prompt_executor._read_pid_from_file", return_value=12345),
            patch("os.kill", side_effect=ProcessLookupError),
        ):
            result = _stop_pid_file(pf)
        assert result is True

    def test_cmd_stop_with_folder_not_running(self, runtime_files, monkeypatch, capsys):
        target = runtime_files["pid"].parent / "stopped-folder"
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
        captured = capsys.readouterr()
        assert "Not running" in captured.out

    def test_cmd_stop_all_no_instances(self, tmp_path, monkeypatch, capsys):
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        args = Namespace(folder=None)
        from prompt_executor import cmd_stop

        cmd_stop(args)
        captured = capsys.readouterr()
        assert "No running instances" in captured.out

    def test_count_files_recursive_with_subdir(self, tmp_path):
        from prompt_executor import _count_files_recursive

        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "01-a.md").write_text("active")
        (sub / "02-b_done.md").write_text("done")
        done, pending = _count_files_recursive(tmp_path)
        assert pending == 1
        assert done == 1

    def test_cmd_status_folder_not_found_second_check(
        self, tmp_path, monkeypatch, capsys
    ):
        target = tmp_path / "blog"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
            patch("prompt_executor.PROJECT_ROOT", tmp_path / "nonexistent"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "blog" in captured.out

    def test_cmd_status_not_dir_second_check(self, tmp_path, monkeypatch, capsys):
        target = tmp_path / "blog"
        target.mkdir()
        f = tmp_path / "blog_file"
        f.write_text("hi")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
            patch("prompt_executor.PROJECT_ROOT", tmp_path / "nonexistent"),
            patch("prompt_executor.resolve_target_folder", return_value=target),
            patch("pathlib.Path.is_absolute", return_value=False),
        ):
            with patch("pathlib.Path.resolve", return_value=f):
                cmd_status(args)
        captured = capsys.readouterr()
        assert "Not a directory" in captured.out

    def test_main_entry_point(self, monkeypatch):
        with patch("sys.argv", ["prompt_executor.py", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_cmd_start_already_running(self, runtime_files, fake_env, monkeypatch):
        target = runtime_files["pid"].parent / "running"
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
        with patch("prompt_executor.read_pid", return_value=1234):
            with pytest.raises(SystemExit) as exc_info:
                cmd_start(args)
        assert exc_info.value.code == 1

    def test_stop_pid_file_stale_cleanup_not_found(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("99999999")
        with patch("prompt_executor._read_pid_from_file", return_value=None):
            result = _stop_pid_file(pf)
        assert result is False
        assert not pf.exists()

    def test_stop_pid_file_stale_cleanup_unlink_not_found(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("99999999")
        with (
            patch("prompt_executor._read_pid_from_file", return_value=None),
            patch.object(Path, "unlink", side_effect=FileNotFoundError),
        ):
            result = _stop_pid_file(pf)
        assert result is False

    def test_stop_pid_file_successful_unlink_not_found(self, tmp_path):
        pf = tmp_path / ".prompt_executor_test.pid"
        pf.write_text("12345")
        with (
            patch("prompt_executor._read_pid_from_file", return_value=12345),
            patch("os.kill", side_effect=ProcessLookupError),
            patch.object(Path, "unlink", side_effect=FileNotFoundError),
        ):
            result = _stop_pid_file(pf)
        assert result is True

    def test_cmd_stop_specific_running(self, runtime_files, monkeypatch, capsys):
        target = runtime_files["pid"].parent / "running"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        monkeypatch.setattr("prompt_executor.LOG_FILE", runtime_files["log"])
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", runtime_files["failures"])
        args = Namespace(folder=str(target))
        with (
            patch("prompt_executor.read_pid", return_value=1234),
            patch("prompt_executor._stop_pid_file") as mock_stop,
        ):
            mock_stop.return_value = True
            cmd_stop(args)
        mock_stop.assert_called_once()

    def test_cmd_status_all_with_running_and_stale(self, tmp_path, monkeypatch, capsys):
        pf1 = tmp_path / ".prompt_executor_blog.pid"
        pf1.write_text("12345")
        pf2 = tmp_path / ".prompt_executor_fire.pid"
        pf2.write_text("99999999")
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        args = Namespace(folder=None)
        from prompt_executor import cmd_status

        with patch("prompt_executor._read_pid_from_file", side_effect=[1234, None]):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "Running" in captured.out
        assert "Stale" in captured.out
        assert not pf2.exists()

    def test_cmd_status_done_folder_via_second_path(
        self, tmp_path, monkeypatch, capsys
    ):
        target = tmp_path / "blog"
        target.mkdir()
        done = tmp_path / "blog_done"
        done.mkdir()
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.PID_FILE", tmp_path / "test.pid")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "test_fail.log")
        args = Namespace(folder=str(target))
        from prompt_executor import cmd_status

        with (
            patch("prompt_executor.read_pid", return_value=None),
            patch("prompt_executor._show_failures_summary"),
            patch("prompt_executor.resolve_target_folder", return_value=target),
            patch("prompt_executor.PROJECT_ROOT", tmp_path / "nonexistent"),
        ):
            cmd_status(args)
        captured = capsys.readouterr()
        assert "blog" in captured.out

    def test_count_files_recursive_skips_hidden(self, tmp_path):
        from prompt_executor import _count_files_recursive

        (tmp_path / ".hidden").mkdir()
        (tmp_path / ".hidden" / "a.md").write_text("a")
        done, pending = _count_files_recursive(tmp_path)
        assert done == 0
        assert pending == 0
