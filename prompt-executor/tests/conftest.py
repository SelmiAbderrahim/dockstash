import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def tmp_project(tmp_path, monkeypatch):
    (tmp_path / "prompts" / "test-folder").mkdir(parents=True)
    (tmp_path / ".opencode").mkdir()
    (tmp_path / ".opencode" / "opencode.jsonc").write_text(
        '{"model":"zai-coding/glm-5.1"}'
    )
    (tmp_path / "prompts" / "test-folder" / "01-task.md").write_text(
        "# Task\nDo a thing."
    )
    (tmp_path / "prompts" / "test-folder" / "02-impl.md").write_text(
        "# Impl\nBuild it."
    )
    (tmp_path / "prompts" / "test-folder" / "03-done_done.md").write_text(
        "# Done\nAlready done."
    )
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture(autouse=True)
def isolate_runtime_files(tmp_path, monkeypatch):
    monkeypatch.setattr("prompt_executor.SCRIPT_DIR", tmp_path)
    yield


@pytest.fixture
def runtime_files(tmp_path, monkeypatch):
    import prompt_executor

    slug = "test-folder"
    log_file = tmp_path / f".prompt_executor_{slug}.log"
    pid_file = tmp_path / f".prompt_executor_{slug}.pid"
    failures_file = tmp_path / f".prompt_executor_{slug}_failures.log"
    monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
    monkeypatch.setattr("prompt_executor.PID_FILE", pid_file)
    monkeypatch.setattr("prompt_executor.FAILURES_FILE", failures_file)
    return {"log": log_file, "pid": pid_file, "failures": failures_file}


def _fake_proc(stdout: str, stderr: str, returncode: int) -> MagicMock:
    proc = MagicMock()
    proc.communicate.return_value = (stdout, stderr)
    proc.returncode = returncode
    proc.pid = 99999
    return proc


@pytest.fixture
def mock_subprocess_success():
    """Mock both subprocess.run AND subprocess.Popen as success.

    execute_prompt uses Popen + proc.communicate(); snapshot_git_state
    uses subprocess.run. Mocking both keeps the fixture useful for any
    code path under test.
    """
    with (
        patch("prompt_executor.subprocess.run") as mock_run,
        patch(
            "prompt_executor.subprocess.Popen",
            return_value=_fake_proc("ok", "", 0),
        ) as mock_popen,
    ):
        mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")
        mock_run.popen = mock_popen  # expose for tests that need it
        yield mock_run


@pytest.fixture
def mock_subprocess_fail():
    """Mock both subprocess.run AND subprocess.Popen as failure (returncode=1)."""
    with (
        patch("prompt_executor.subprocess.run") as mock_run,
        patch(
            "prompt_executor.subprocess.Popen",
            return_value=_fake_proc("", "Error occurred", 1),
        ) as mock_popen,
    ):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="Error occurred")
        mock_run.popen = mock_popen
        yield mock_run


@pytest.fixture
def fake_env(monkeypatch):
    monkeypatch.setenv("ZAI_API_KEY", "sk-zai-test-1234")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-1234")
