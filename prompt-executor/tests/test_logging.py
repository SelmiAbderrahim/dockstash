from unittest.mock import patch

from prompt_executor import log, log_failure


class TestLog:
    def test_writes_to_log_file(self, runtime_files):
        log("test message")
        content = runtime_files["log"].read_text()
        assert "test message" in content

    def test_includes_timestamp(self, runtime_files):
        log("hello")
        content = runtime_files["log"].read_text()
        assert "[202" in content or "[20" in content

    def test_appends(self, runtime_files):
        log("first")
        log("second")
        content = runtime_files["log"].read_text()
        assert "first" in content
        assert "second" in content

    def test_no_crash_on_write_failure(self, tmp_path, monkeypatch):
        monkeypatch.setattr("prompt_executor.LOG_FILE", None)
        log("should not crash")

    def test_multiple_lines(self, runtime_files):
        for i in range(5):
            log(f"line {i}")
        lines = runtime_files["log"].read_text().strip().split("\n")
        assert len(lines) == 5


class TestLogFailure:
    def test_writes_failure(self, runtime_files):
        log_failure("/path/to/prompt.md", 3, "error msg")
        content = runtime_files["failures"].read_text()
        assert "SKIPPED" in content
        assert "/path/to/prompt.md" in content
        assert "3" in content
        assert "error msg" in content

    def test_appends_multiple(self, runtime_files):
        log_failure("a.md", 1, "err1")
        log_failure("b.md", 2, "err2")
        content = runtime_files["failures"].read_text()
        assert "a.md" in content
        assert "b.md" in content

    def test_no_crash_on_write_failure(self, tmp_path, monkeypatch):
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", None)
        log_failure("a.md", 1, "err")
