import os
from unittest.mock import patch

from prompt_executor import (
    read_pid,
    write_pid,
    remove_pid,
    clean_stale_pid,
    init_runtime_files,
    _read_pid_from_file,
)


class TestInitRuntimeFiles:
    def test_sets_paths(self, tmp_path, monkeypatch):
        monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
        target = tmp_path / "my-folder"
        target.mkdir()
        slug = init_runtime_files(target)
        assert slug == "my-folder"
        import prompt_executor

        assert prompt_executor.PID_FILE == tmp_path / ".prompt_executor_my-folder.pid"
        assert prompt_executor.LOG_FILE == tmp_path / ".prompt_executor_my-folder.log"
        assert (
            prompt_executor.FAILURES_FILE
            == tmp_path / ".prompt_executor_my-folder_failures.log"
        )


class TestReadPid:
    def test_reads_existing_pid(self, runtime_files, monkeypatch):
        import prompt_executor

        runtime_files["pid"].write_text(str(os.getpid()))
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        assert read_pid() == os.getpid()

    def test_returns_none_missing_file(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        assert read_pid() is None

    def test_returns_none_invalid_content(self, runtime_files, monkeypatch):
        runtime_files["pid"].write_text("not-a-number")
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        assert read_pid() is None

    def test_returns_none_dead_process(self, runtime_files, monkeypatch):
        runtime_files["pid"].write_text("99999999")
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        assert read_pid() is None


class TestWritePid:
    def test_writes_pid(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        write_pid(12345)
        assert runtime_files["pid"].read_text() == "12345"


class TestRemovePid:
    def test_removes_file(self, runtime_files, monkeypatch):
        runtime_files["pid"].write_text("123")
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        remove_pid()
        assert not runtime_files["pid"].exists()

    def test_no_error_if_missing(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        remove_pid()


class TestCleanStalePid:
    def test_cleans_stale(self, runtime_files, monkeypatch):
        runtime_files["pid"].write_text("99999999")
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        clean_stale_pid()
        assert not runtime_files["pid"].exists()

    def test_no_op_if_no_file(self, runtime_files, monkeypatch):
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        clean_stale_pid()

    def test_keeps_live_pid(self, runtime_files, monkeypatch):
        runtime_files["pid"].write_text(str(os.getpid()))
        monkeypatch.setattr("prompt_executor.PID_FILE", runtime_files["pid"])
        clean_stale_pid()
        assert runtime_files["pid"].exists()


class TestReadPidFromFile:
    def test_reads_from_arbitrary_path(self, tmp_path):
        pf = tmp_path / "other.pid"
        pf.write_text(str(os.getpid()))
        assert _read_pid_from_file(pf) == os.getpid()

    def test_returns_none_missing(self, tmp_path):
        pf = tmp_path / "missing.pid"
        assert _read_pid_from_file(pf) is None

    def test_returns_none_dead(self, tmp_path):
        pf = tmp_path / "dead.pid"
        pf.write_text("99999999")
        assert _read_pid_from_file(pf) is None
