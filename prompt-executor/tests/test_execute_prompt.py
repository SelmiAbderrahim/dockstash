import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from prompt_executor import (
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
    RESULT_SUCCESS,
    RESULT_TIMEOUT,
    RESULT_ERROR,
    RESULT_FATAL,
    RESULT_SKIP,
    PromptResult,
    execute_prompt,
    execute_prompt_with_retry,
    init_runtime_files,
    PROJECT_ROOT,
)


class TestExecutePrompt:
    def test_success_opencode(self, runtime_files, mock_subprocess_success, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("Do stuff")
        result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_success_claude(self, runtime_files, mock_subprocess_success, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("Do stuff")
        result = execute_prompt(prompt, "opus", BACKEND_CLAUDE)
        assert result.result_code == RESULT_SUCCESS

    def test_empty_prompt(self, runtime_files):
        prompt = runtime_files["log"].parent / "empty.md"
        prompt.write_text("   ")
        result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_permission_error(self, runtime_files):
        prompt = runtime_files["log"].parent / "noperm.md"
        prompt.write_text("hi")
        prompt.chmod(0o000)
        try:
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
            assert result.result_code == RESULT_FATAL
        finally:
            prompt.chmod(0o644)

    def test_os_error_reading(self, runtime_files):
        prompt = runtime_files["log"].parent / "missing.md"
        with patch.object(Path, "read_text", side_effect=OSError("disk error")):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_FATAL

    def test_nonzero_exit(self, runtime_files, mock_subprocess_fail, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_timeout(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        # execute_prompt uses Popen + proc.communicate(timeout=...). Make the
        # fake proc's communicate() raise TimeoutExpired on the first call so
        # the executor exercises its kill-process-group cleanup path.
        fake_proc = MagicMock()
        fake_proc.pid = 99999
        fake_proc.communicate.side_effect = [
            subprocess.TimeoutExpired("cmd", 3600),
            ("", ""),  # second call from the cleanup drain
        ]
        with patch("prompt_executor.subprocess.Popen", return_value=fake_proc):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_TIMEOUT

    def test_binary_not_found(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.Popen", side_effect=FileNotFoundError):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_FATAL

    def test_memory_error(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.Popen", side_effect=MemoryError("oom")):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_FATAL

    def test_keyboard_interrupt_reraise(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.Popen", side_effect=KeyboardInterrupt):
            with pytest.raises(KeyboardInterrupt):
                execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)

    def test_generic_exception(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.subprocess.Popen", side_effect=RuntimeError("boom")):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_unrecoverable_autocompact(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with self._mock_popen_returning("Autocompact is thrashing", "", 1):
            result = execute_prompt(prompt, "opus", BACKEND_CLAUDE)
        assert result.result_code == RESULT_SKIP

    def test_unrecoverable_provider_model_not_found(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with self._mock_popen_returning("", "ProviderModelNotFoundError in response", 1):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SKIP

    def test_mcp_error_classification(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with self._mock_popen_returning("", "MCP server 'stripe' failed", 1):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_skill_error_classification(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with self._mock_popen_returning("", "Skill 'fix' not found", 1):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_ERROR

    def test_stdout_logged(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with self._mock_popen_returning("x" * 4000, "", 0):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_stderr_logged(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with self._mock_popen_returning("", "some warning", 0):
            result = execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        assert result.result_code == RESULT_SUCCESS

    def test_no_changes_detected(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        before = {"file1.txt"}
        with (
            self._mock_popen_returning("ok", "", 0),
            patch("prompt_executor.snapshot_git_state", return_value={"file1.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=False),
        ):
            result = execute_prompt(
                prompt, "glm-5.1", BACKEND_OPENCODE, snapshot_before=before
            )
        assert result.result_code == RESULT_ERROR

    def test_changes_detected(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        before = set()
        with (
            self._mock_popen_returning("ok", "", 0),
            patch("prompt_executor.snapshot_git_state", return_value={"new.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=True),
        ):
            result = execute_prompt(
                prompt, "glm-5.1", BACKEND_OPENCODE, snapshot_before=before
            )
        assert result.result_code == RESULT_SUCCESS

    @staticmethod
    def _mock_popen_returning(stdout: str, stderr: str = "", returncode: int = 0):
        """Build a patch context that intercepts subprocess.Popen so the
        executor sees deterministic stdout/stderr/returncode without
        invoking the real claude/opencode binaries.

        execute_prompt calls ``proc.communicate(input=..., timeout=...)``;
        the fake Popen returns those values plus ``returncode`` as an
        attribute.
        """
        from unittest.mock import MagicMock

        fake_proc = MagicMock()
        fake_proc.communicate.return_value = (stdout, stderr)
        fake_proc.returncode = returncode
        fake_proc.pid = 99999
        return patch("prompt_executor.subprocess.Popen", return_value=fake_proc)

    def test_audit_already_done_treated_as_success(
        self, runtime_files, fake_env
    ):
        """Exit 0 + no filesystem changes + an "already implemented" audit
        in stdout MUST be treated as RESULT_SUCCESS so the prompt is renamed
        to ``*_done.md`` and the run advances. The LLM correctly identified
        that the deliverable is already on disk — that's a productive no-op,
        not a conversational failure.

        Regression for the brand-kit-pro-max prompt-6 halt on 2026-04-25:
        Opus emitted a detailed audit report concluding the palette feature
        was already implemented; the executor wrongly mapped that to
        RESULT_SKIP, halting --halt-on-fail runs.
        """
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        audit_stdout = (
            "The Color Palette Intelligence feature is already fully "
            "implemented and matches the spec. Audit result: service, "
            "frontend, tRPC procedures, hooks, i18n (all 5 locales), "
            "backend errors, docs (5 languages) all match the spec. "
            "No files were changed because the implementation already "
            "matched the spec."
        )
        before = {"file1.txt"}
        with (
            self._mock_popen_returning(audit_stdout),
            patch("prompt_executor.snapshot_git_state", return_value={"file1.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=False),
        ):
            result = execute_prompt(
                prompt, "opus-4.7", BACKEND_CLAUDE, snapshot_before=before
            )
        assert result.result_code == RESULT_SUCCESS, (
            f"Audit-pass response should be RESULT_SUCCESS, got "
            f"{result.result_code}. Reasoning: prompt deliverable is "
            f"already on disk; LLM correctly declined to redo it."
        )
        # files_changed=False so the caller knows nothing was modified —
        # but it's still a logical success.
        assert result.files_changed is False

    def test_clarifying_question_still_skips(self, runtime_files, fake_env):
        """Exit 0 + no filesystem changes + a clarifying-question reply
        ("what would you like me to do?") MUST still map to RESULT_SKIP.
        The split must NOT regress the clarifying-question path."""
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        question_stdout = (
            "I'm not sure what to focus on here. What would you like me "
            "to do? Should I scaffold from scratch or build on top of "
            "the existing component?"
        )
        before = {"file1.txt"}
        with (
            self._mock_popen_returning(question_stdout),
            patch("prompt_executor.snapshot_git_state", return_value={"file1.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=False),
        ):
            result = execute_prompt(
                prompt, "opus-4.7", BACKEND_CLAUDE, snapshot_before=before
            )
        assert result.result_code == RESULT_SKIP

    def test_no_markers_is_retryable_error(self, runtime_files, fake_env):
        """Exit 0 + no filesystem changes + neither marker class in stdout
        MUST stay RESULT_ERROR (retryable) — the existing fallback. This
        is the hint-free case where retrying might still help (network
        flake on a tool call, transient issue, etc.)."""
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        plain_stdout = (
            "I attempted the work but did not produce any output. "
            "The tool call appeared to fail silently."
        )
        before = {"file1.txt"}
        with (
            self._mock_popen_returning(plain_stdout),
            patch("prompt_executor.snapshot_git_state", return_value={"file1.txt"}),
            patch("prompt_executor.detect_git_changes", return_value=False),
        ):
            result = execute_prompt(
                prompt, "opus-4.7", BACKEND_CLAUDE, snapshot_before=before
            )
        assert result.result_code == RESULT_ERROR

    def test_openconfig_env_passthrough(self, runtime_files, fake_env, monkeypatch):
        monkeypatch.setenv("OPENCODE_CONFIG", "/custom/config.jsonc")
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        fake_proc = MagicMock()
        fake_proc.communicate.return_value = ("", "")
        fake_proc.returncode = 0
        fake_proc.pid = 99999
        with patch("prompt_executor.subprocess.Popen", return_value=fake_proc) as mock:
            execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE)
        _, kwargs = mock.call_args
        assert kwargs["env"]["OPENCODE_CONFIG"] == "/custom/config.jsonc"

    def test_custom_working_dir(self, runtime_files, fake_env, tmp_path):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        fake_proc = MagicMock()
        fake_proc.communicate.return_value = ("", "")
        fake_proc.returncode = 0
        fake_proc.pid = 99999
        with patch("prompt_executor.subprocess.Popen", return_value=fake_proc) as mock:
            execute_prompt(prompt, "glm-5.1", BACKEND_OPENCODE, working_dir=tmp_path)
        _, kwargs = mock.call_args
        assert kwargs["cwd"] == str(tmp_path)


class TestExecutePromptWithRetry:
    def test_success_first_try(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(RESULT_SUCCESS, "", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is True
        assert fatal is False

    def test_fatal_stops(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(RESULT_FATAL, "dead", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is False
        assert fatal is True

    def test_skip_continues(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(RESULT_SKIP, "unrecoverable", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is False
        assert fatal is False

    def test_retries_then_success(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        calls = [
            PromptResult(RESULT_ERROR, "fail", "", True),
            PromptResult(RESULT_SUCCESS, "", "", True),
        ]
        with (
            patch("prompt_executor.execute_prompt", side_effect=calls),
            patch("prompt_executor.safe_sleep"),
        ):
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is True

    def test_exhausted_retries(self, runtime_files, fake_env):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with (
            patch("prompt_executor.execute_prompt") as mock,
            patch("prompt_executor.safe_sleep"),
        ):
            mock.return_value = PromptResult(RESULT_ERROR, "fail", "", True)
            ok, fatal = execute_prompt_with_retry(
                prompt, 2, 1, "glm-5.1", BACKEND_OPENCODE
            )
        assert ok is False
        assert fatal is False

    def test_fixed_retry_wait(self, runtime_files, fake_env):
        """Retry wait is fixed at retry_wait_min — no doubling, no exponential backoff.

        The docstring on execute_prompt_with_retry is explicit: "The wait
        between attempts is exactly ``retry_wait_min`` minutes every time
        — no exponential backoff, no doubling." This guards against
        accidental regression to the old doubling behavior.
        """
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with (
            patch("prompt_executor.execute_prompt") as mock_exec,
            patch("prompt_executor.safe_sleep") as mock_sleep,
        ):
            mock_exec.return_value = PromptResult(RESULT_ERROR, "fail", "", True)
            execute_prompt_with_retry(prompt, 3, 10, "glm-5.1", BACKEND_OPENCODE)
        assert mock_sleep.call_count == 2
        assert mock_sleep.call_args_list[0][0][0] == 10
        assert mock_sleep.call_args_list[1][0][0] == 10


class TestAutocompactEscalation:
    """Auto-mode must escalate to opus-4.7 (1M context) when a small-context
    model deterministically hits 'Autocompact is thrashing'. Otherwise the
    prompt can never complete."""

    def test_sonnet_autocompact_escalates_to_opus_and_succeeds(
        self, runtime_files, fake_env
    ):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        sticky: dict = {
            "overrides": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
            "reasons": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
        }
        calls = [
            PromptResult(
                RESULT_SKIP,
                "Unrecoverable: Autocompact is thrashing",
                "",
                True,
            ),
            PromptResult(RESULT_SUCCESS, "", "", True),
        ]
        with (
            patch("prompt_executor.execute_prompt", side_effect=calls),
            patch("prompt_executor.safe_sleep"),
        ):
            ok, fatal = execute_prompt_with_retry(
                prompt,
                3,
                1,
                "sonnet-4.6",
                BACKEND_CLAUDE,
                auto_mode=True,
                sticky_state=sticky,
            )
        assert ok is True
        assert fatal is False
        # Sticky state must record the escalation in the Claude family
        # so subsequent Claude prompts in the run also use opus-4.7.
        # OpenCode-family prompts must NOT inherit this swap.
        assert sticky["overrides"][BACKEND_CLAUDE] == "opus-4.7"
        assert sticky["overrides"][BACKEND_OPENCODE] is None
        assert sticky["reasons"][BACKEND_CLAUDE] == "autocompact"

    def test_autocompact_without_auto_mode_still_skips(
        self, runtime_files, fake_env
    ):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(
                RESULT_SKIP, "Unrecoverable: Autocompact is thrashing", "", True
            )
            ok, fatal = execute_prompt_with_retry(
                prompt, 3, 1, "sonnet-4.6", BACKEND_CLAUDE
            )
        assert ok is False
        assert fatal is False
        # No escalation, so only one execute_prompt call.
        assert mock.call_count == 1

    def test_autocompact_already_on_opus_does_not_loop(
        self, runtime_files, fake_env
    ):
        """If opus-4.7 ITSELF thrashes, we can't escalate further — return skip."""
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        sticky: dict = {
            "overrides": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
            "reasons": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
        }
        with patch("prompt_executor.execute_prompt") as mock:
            mock.return_value = PromptResult(
                RESULT_SKIP, "Unrecoverable: Autocompact is thrashing", "", True
            )
            ok, fatal = execute_prompt_with_retry(
                prompt,
                3,
                1,
                "opus-4.7",
                BACKEND_CLAUDE,
                auto_mode=True,
                sticky_state=sticky,
            )
        assert ok is False
        assert fatal is False
        assert mock.call_count == 1
        assert sticky["overrides"][BACKEND_CLAUDE] is None
        assert sticky["overrides"][BACKEND_OPENCODE] is None


class TestTimeoutEscalation:
    """Auto-mode must escalate to opus-4.7 after 2 consecutive timeouts on
    the same model. Otherwise GLM-5.1 timeouts burn 5 × 1h of wall clock."""

    def test_glm_two_timeouts_then_escalate_and_succeed(
        self, runtime_files, fake_env
    ):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        sticky: dict = {
            "overrides": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
            "reasons": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
        }
        calls = [
            PromptResult(RESULT_TIMEOUT, "Timed out after 3600s", "", True),
            PromptResult(RESULT_TIMEOUT, "Timed out after 3600s", "", True),
            PromptResult(RESULT_SUCCESS, "", "", True),
        ]
        with (
            patch("prompt_executor.execute_prompt", side_effect=calls),
            patch("prompt_executor.safe_sleep"),
        ):
            ok, fatal = execute_prompt_with_retry(
                prompt,
                5,
                1,
                "glm-5.1",
                BACKEND_OPENCODE,
                auto_mode=True,
                sticky_state=sticky,
            )
        assert ok is True
        # GLM timeout escalates to opus-4.7, but the override is keyed by
        # the failing source family (OpenCode), not by the swap target's
        # family (Claude). Subsequent Claude prompts must keep their
        # filename model.
        assert sticky["overrides"][BACKEND_OPENCODE] == "opus-4.7"
        assert sticky["overrides"][BACKEND_CLAUDE] is None
        assert sticky["reasons"][BACKEND_OPENCODE] == "timeout"

    def test_single_timeout_does_not_escalate(self, runtime_files, fake_env):
        """One timeout then success — should NOT escalate."""
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        sticky: dict = {
            "overrides": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
            "reasons": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
        }
        calls = [
            PromptResult(RESULT_TIMEOUT, "Timed out after 3600s", "", True),
            PromptResult(RESULT_SUCCESS, "", "", True),
        ]
        with (
            patch("prompt_executor.execute_prompt", side_effect=calls),
            patch("prompt_executor.safe_sleep"),
        ):
            ok, fatal = execute_prompt_with_retry(
                prompt,
                5,
                1,
                "glm-5.1",
                BACKEND_OPENCODE,
                auto_mode=True,
                sticky_state=sticky,
            )
        assert ok is True
        # Single timeout below threshold — no swap.
        assert sticky["overrides"][BACKEND_OPENCODE] is None
        assert sticky["overrides"][BACKEND_CLAUDE] is None

    def test_timeout_escalation_requires_auto_mode(
        self, runtime_files, fake_env
    ):
        prompt = runtime_files["log"].parent / "test.md"
        prompt.write_text("stuff")
        sticky: dict = {
            "overrides": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
            "reasons": {BACKEND_CLAUDE: None, BACKEND_OPENCODE: None},
        }
        with (
            patch("prompt_executor.execute_prompt") as mock,
            patch("prompt_executor.safe_sleep"),
        ):
            mock.return_value = PromptResult(
                RESULT_TIMEOUT, "Timed out after 3600s", "", True
            )
            execute_prompt_with_retry(
                prompt,
                3,
                1,
                "glm-5.1",
                BACKEND_OPENCODE,
                sticky_state=sticky,
            )
        # auto_mode=False (default) → no escalation.
        assert sticky["overrides"][BACKEND_OPENCODE] is None
        assert sticky["overrides"][BACKEND_CLAUDE] is None
