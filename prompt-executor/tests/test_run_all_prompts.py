from pathlib import Path
from unittest.mock import MagicMock, patch

from prompt_executor import (
    run_all_prompts,
    collect_pending_items,
    is_done,
    is_reference_file,
    mark_file_done,
    try_mark_ancestors_done,
    is_dir_fully_complete,
    get_pending_files_in_dir,
    has_done_files_in_dir,
    resolve_target_folder,
    safe_sleep,
    RESULT_SUCCESS,
    RESULT_ERROR,
    RESULT_FATAL,
    PromptResult,
)


class TestIsDone:
    def test_done(self):
        assert is_done("task_done") is True

    def test_not_done(self):
        assert is_done("task") is False


class TestIsReferenceFile:
    def test_overview(self):
        assert is_reference_file(Path("01-overview.md")) is True

    def test_readme(self):
        assert is_reference_file(Path("README.md")) is True

    def test_toc(self):
        assert is_reference_file(Path("table-of-contents.md")) is True

    def test_normal(self):
        assert is_reference_file(Path("01-task.md")) is False

    def test_done_still_reference(self):
        assert is_reference_file(Path("overview_done.md")) is True

    def test_action_prompt_with_keyword_inside_is_not_reference(self):
        # Regression: this filename was wrongly skipped because the naive
        # substring matcher caught "architecture" inside the action phrase.
        assert (
            is_reference_file(
                Path("08-update-rules-architecture-and-user-docs-glm-5.1.md")
            )
            is False
        )

    def test_numeric_prefix_with_keyword_first_is_reference(self):
        assert (
            is_reference_file(Path("00-architecture-overview-opus-4.7.md")) is True
        )

    def test_descriptor_equals_keyword_is_reference(self):
        assert is_reference_file(Path("00-architecture.md")) is True

    def test_validate_architecture_action_is_not_reference(self):
        assert (
            is_reference_file(Path("05-validate-architecture-glm-5.1.md")) is False
        )

    def test_keyword_with_model_suffix_only_is_reference(self):
        # `architecture-glm-5.1` -> descriptor `architecture` -> reference
        assert is_reference_file(Path("architecture-glm-5.1.md")) is True


class TestCollectPendingItems:
    def test_finds_md_files(self, tmp_path):
        (tmp_path / "01-a.md").write_text("task a")
        (tmp_path / "02-b.md").write_text("task b")
        items = collect_pending_items(tmp_path)
        assert len(items) == 2

    def test_skips_done(self, tmp_path):
        (tmp_path / "01-a.md").write_text("task a")
        (tmp_path / "02-b_done.md").write_text("done")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_skips_hidden(self, tmp_path):
        (tmp_path / ".hidden.md").write_text("hidden")
        (tmp_path / "01-visible.md").write_text("visible")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_skips_reference(self, tmp_path):
        (tmp_path / "01-overview.md").write_text("overview")
        (tmp_path / "02-task.md").write_text("task")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_skips_empty(self, tmp_path):
        (tmp_path / "01-empty.md").write_text("")
        (tmp_path / "02-full.md").write_text("content")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_recursive(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (tmp_path / "01-top.md").write_text("top")
        (sub / "02-nested.md").write_text("nested")
        items = collect_pending_items(tmp_path)
        assert len(items) == 2

    def test_skips_done_folders(self, tmp_path):
        done_dir = tmp_path / "completed_done"
        done_dir.mkdir()
        (done_dir / "01-task.md").write_text("done task")
        (tmp_path / "01-active.md").write_text("active")
        items = collect_pending_items(tmp_path)
        assert len(items) == 1

    def test_nonexistent_dir(self, tmp_path):
        items = collect_pending_items(tmp_path / "nope")
        assert items == []

    def test_unreadable_file_skipped(self, tmp_path):
        f = tmp_path / "01-bad.md"
        f.write_text("content")
        with patch.object(Path, "read_text", side_effect=OSError("nope")):
            items = collect_pending_items(tmp_path)
        assert items == []

    def test_sorted_order(self, tmp_path):
        (tmp_path / "03-c.md").write_text("c")
        (tmp_path / "01-a.md").write_text("a")
        (tmp_path / "02-b.md").write_text("b")
        items = collect_pending_items(tmp_path)
        assert [p.name for p in items] == ["01-a.md", "02-b.md", "03-c.md"]


class TestGetPendingFilesInDir:
    def test_returns_pending(self, tmp_path):
        (tmp_path / "01-a.md").write_text("a")
        (tmp_path / "02-b_done.md").write_text("b")
        result = get_pending_files_in_dir(tmp_path)
        assert len(result) == 1

    def test_nonexistent(self, tmp_path):
        assert get_pending_files_in_dir(tmp_path / "nope") == []


class TestHasDoneFilesInDir:
    def test_has_done(self, tmp_path):
        (tmp_path / "01-a_done.md").write_text("done")
        assert has_done_files_in_dir(tmp_path) is True

    def test_no_done(self, tmp_path):
        (tmp_path / "01-a.md").write_text("active")
        assert has_done_files_in_dir(tmp_path) is False


class TestIsDirFullyComplete:
    def test_complete(self, tmp_path):
        (tmp_path / "01-a_done.md").write_text("done")
        assert is_dir_fully_complete(tmp_path) is True

    def test_incomplete(self, tmp_path):
        (tmp_path / "01-a.md").write_text("active")
        assert is_dir_fully_complete(tmp_path) is False

    def test_subdir_done(self, tmp_path):
        d = tmp_path / "sub_done"
        d.mkdir()
        assert is_dir_fully_complete(tmp_path) is True

    def test_subdir_pending(self, tmp_path):
        d = tmp_path / "sub"
        d.mkdir()
        (d / "01-a.md").write_text("active")
        assert is_dir_fully_complete(tmp_path) is False


class TestMarkFileDone:
    def test_renames(self, tmp_path):
        f = tmp_path / "task.md"
        f.write_text("done")
        new = mark_file_done(f)
        assert new.name == "task_done.md"
        assert not f.exists()


class TestTryMarkAncestorsDone:
    def test_marks_complete_parent(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        f = sub / "task_done.md"
        f.write_text("done")
        with patch("prompt_executor.LOG_FILE", tmp_path / "test.log"):
            try_mark_ancestors_done(f, tmp_path)

    def test_stops_at_incomplete(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        f = sub / "task_done.md"
        f.write_text("done")
        (sub / "other.md").write_text("still pending")
        with patch("prompt_executor.LOG_FILE", tmp_path / "test.log"):
            try_mark_ancestors_done(f, tmp_path)
        assert sub.exists()


class TestResolveTargetFolder:
    def test_absolute(self, tmp_path, monkeypatch):
        d = tmp_path / "my-folder"
        d.mkdir()
        result = resolve_target_folder(str(d))
        assert result == d

    def test_nonexistent_exits(self, tmp_path, monkeypatch):
        import pytest

        with pytest.raises(SystemExit):
            resolve_target_folder(str(tmp_path / "nope"))

    def test_not_dir_exits(self, tmp_path, monkeypatch):
        import pytest

        f = tmp_path / "file.txt"
        f.write_text("hi")
        with pytest.raises(SystemExit):
            resolve_target_folder(str(f))


class TestSafeSleep:
    def test_zero_returns_immediately(self):
        safe_sleep(0)

    def test_sleeps_in_chunks(self):
        with patch("prompt_executor.time.sleep") as mock:
            safe_sleep(1)
            assert mock.call_count > 0


class TestRunAllPrompts:
    def test_no_pending(self, tmp_path, monkeypatch):
        target = tmp_path / "empty"
        target.mkdir()
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with patch("prompt_executor.collect_pending_items", return_value=[]):
            run_all_prompts(target, 1, 1, 1, "glm-5.1", "opencode")

    def test_executes_all(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f2 = target / "02-b.md"
        f1.write_text("a")
        f2.write_text("b")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with patch("prompt_executor.execute_prompt_with_retry") as mock:
            mock.return_value = (True, False)
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")
        assert mock.call_count == 2

    def test_skips_failed(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        f2 = target / "02-b.md"
        f2.write_text("b")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        results = [(False, False), (True, False)]
        with patch("prompt_executor.execute_prompt_with_retry", side_effect=results):
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_fatal_stops(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with patch(
            "prompt_executor.execute_prompt_with_retry", return_value=(False, True)
        ):
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_renames_done_folder(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with (
            patch(
                "prompt_executor.execute_prompt_with_retry", return_value=(True, False)
            ),
            patch("prompt_executor.mark_file_done") as mock_mark,
            patch("prompt_executor.try_mark_ancestors_done"),
            patch("prompt_executor.is_dir_fully_complete", return_value=True),
            patch("prompt_executor.has_done_files_in_dir", return_value=True),
        ):
            mock_mark.return_value = target / "01-a_done.md"
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")

    def test_rename_folder_oserror(self, tmp_path, monkeypatch):
        target = tmp_path / "target"
        target.mkdir()
        f1 = target / "01-a.md"
        f1.write_text("a")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        with (
            patch(
                "prompt_executor.execute_prompt_with_retry", return_value=(True, False)
            ),
            patch("prompt_executor.mark_file_done") as mock_mark,
            patch("prompt_executor.try_mark_ancestors_done"),
            patch("prompt_executor.is_dir_fully_complete", return_value=True),
            patch("prompt_executor.has_done_files_in_dir", return_value=True),
            patch.object(Path, "rename", side_effect=OSError("nope")),
        ):
            mock_mark.return_value = target / "01-a_done.md"
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")


class TestHaltOnFail:
    def test_halt_stops_after_first_failure(self, tmp_path, monkeypatch):
        """--halt-on-fail: run_all_prompts must return on the first (False, False)
        result instead of continuing to the next prompt."""
        target = tmp_path / "target"
        target.mkdir()
        (target / "01-a.md").write_text("a")
        (target / "02-b.md").write_text("b")
        (target / "03-c.md").write_text("c")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "fail.log")
        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=[(False, False), (True, False), (True, False)],
        ) as mock:
            run_all_prompts(
                target, 0, 1, 1, "glm-5.1", "opencode", halt_on_fail=True
            )
        # Only the first prompt should have been attempted; halt short-circuits
        # the rest of the loop.
        assert mock.call_count == 1

    def test_halt_off_continues_after_failure(self, tmp_path, monkeypatch):
        """Default behaviour: skip failures and continue to remaining prompts."""
        target = tmp_path / "target"
        target.mkdir()
        (target / "01-a.md").write_text("a")
        (target / "02-b.md").write_text("b")
        (target / "03-c.md").write_text("c")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr("prompt_executor.FAILURES_FILE", tmp_path / "fail.log")
        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=[(False, False), (True, False), (True, False)],
        ) as mock:
            run_all_prompts(target, 0, 1, 1, "glm-5.1", "opencode")
        assert mock.call_count == 3


class TestAutoModeRetryDefault:
    def test_auto_mode_max_retries_is_five(self):
        """Auto mode must default to 5 retries (was 2; bumped for resilience)."""
        from prompt_executor import AUTO_MODE_MAX_RETRIES

        assert AUTO_MODE_MAX_RETRIES == 5


# ── Sticky-swap cross-family scoping (regression) ─────────────────────────────
#
# Regression coverage for the brand-kit-pro-max incident (2026-04-25): a
# sonnet-4.6 autocompact thrash on prompt 1 sticky-swapped the run to
# opus-4.7 and that override carried into glm-5.1 prompts later in the run,
# silently rerouting OpenCode work to the Claude backend's quota.
#
# The fix scopes overrides per backend family. These tests pin that contract.


class TestStickySwapCrossFamily:
    def _make_target(self, tmp_path):
        target = tmp_path / "target"
        target.mkdir()
        # Filenames carry the per-prompt model annotation that auto mode parses.
        (target / "01-task-sonnet-4.6.md").write_text("first")
        (target / "02-task-opus-4.7.md").write_text("second")
        (target / "03-task-glm-5.1.md").write_text("third")
        return target

    def test_claude_swap_does_not_reroute_glm_prompt(
        self, tmp_path, monkeypatch
    ):
        """A Claude-family sticky-swap (sonnet → opus) MUST NOT pin the
        next OpenCode-family prompt (glm-5.1) to opus.

        This is the exact regression from the brand-kit-pro-max run: once
        sonnet thrashed on autocompact, every subsequent prompt — including
        glm-5.1-targeted ones running on a different backend / different
        quota — was forced onto opus-4.7. After the per-family fix, the
        OpenCode prompt must keep routing to glm-5.1 per its filename.
        """
        from prompt_executor import BACKEND_CLAUDE

        target = self._make_target(tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        # Disable the preflight env var so this test exercises the
        # baseline reactive-swap behavior, not the preflight path.
        monkeypatch.delenv("CLAUDE_SONNET_1M_AVAILABLE", raising=False)

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            chosen_model = args[3]
            sticky_state = kwargs.get("sticky_state")
            called_with.append(chosen_model)
            # Simulate the autocompact escalation on the FIRST call only:
            # the failing sonnet swaps to opus-4.7 within the Claude family.
            # Subsequent calls do nothing — the per-prompt selector logic
            # in run_all_prompts decides what to use.
            if len(called_with) == 1 and sticky_state is not None:
                sticky_state["overrides"][BACKEND_CLAUDE] = "opus-4.7"
                sticky_state["reasons"][BACKEND_CLAUDE] = "autocompact"
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ) as mock:
            run_all_prompts(
                target, 0, 1, 1, "", "", mode="auto", fallback_model=None
            )

        assert mock.call_count == 3
        # Prompt 1: filename was sonnet-4.6, but the swap fires inside
        # execute_prompt_with_retry (we simulate that). The selector in
        # run_all_prompts gave us "sonnet-4.6" because the override didn't
        # exist yet at selection time.
        assert called_with[0] == "sonnet-4.6"
        # Prompt 2 (Claude family): override is now set on BACKEND_CLAUDE,
        # so the selector swaps the filename's opus-4.7 to the override —
        # which happens to also be opus-4.7. Same model, but reached via
        # the override path. Important: this is the "Claude family stays
        # swapped" branch.
        assert called_with[1] == "opus-4.7"
        # Prompt 3 (OpenCode family): the override was written ONLY to
        # BACKEND_CLAUDE. The OpenCode override slot is still None, so
        # the selector falls through to the filename annotation.
        # THIS is the regression assertion.
        assert called_with[2] == "glm-5.1", (
            f"Cross-family override leak: glm-5.1 prompt was rerouted to "
            f"{called_with[2]!r}. The Claude swap must not affect OpenCode."
        )

    def test_opencode_swap_does_not_reroute_claude_prompt(
        self, tmp_path, monkeypatch
    ):
        """Symmetric guarantee in the other direction: a glm credit swap
        to haiku-4.5 stays inside the OpenCode family (the swap target
        haiku-4.5 is technically Claude-family, but the override is
        keyed by the SOURCE family — OpenCode — so the next Claude
        prompt keeps its filename model)."""
        from prompt_executor import BACKEND_OPENCODE

        target = tmp_path / "target"
        target.mkdir()
        (target / "01-task-glm-5.1.md").write_text("first")
        (target / "02-task-sonnet-4.6.md").write_text("second")
        (target / "03-task-opus-4.7.md").write_text("third")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        # Baseline behavior — no preflight Claude swap.
        monkeypatch.delenv("CLAUDE_SONNET_1M_AVAILABLE", raising=False)

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            chosen_model = args[3]
            sticky_state = kwargs.get("sticky_state")
            called_with.append(chosen_model)
            if len(called_with) == 1 and sticky_state is not None:
                # Simulate a credit-error swap: glm-5.1 → haiku-4.5,
                # keyed by the OpenCode family (the failing source).
                sticky_state["overrides"][BACKEND_OPENCODE] = "haiku-4.5"
                sticky_state["reasons"][BACKEND_OPENCODE] = "credit"
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ) as mock:
            run_all_prompts(
                target, 0, 1, 1, "", "", mode="auto", fallback_model=None
            )

        assert mock.call_count == 3
        assert called_with[0] == "glm-5.1"
        # Prompt 2: Claude family. OpenCode override is set, but Claude
        # override is None — keep the filename model.
        assert called_with[1] == "sonnet-4.6", (
            f"Claude prompt was rerouted by an OpenCode swap: got "
            f"{called_with[1]!r}, expected sonnet-4.6"
        )
        assert called_with[2] == "opus-4.7", (
            f"Claude prompt was rerouted by an OpenCode swap: got "
            f"{called_with[2]!r}, expected opus-4.7"
        )

    def test_no_sticky_swap_propagates_to_retry(self, tmp_path, monkeypatch):
        """When --no-sticky-swap is set, the flag MUST reach
        execute_prompt_with_retry so trigger sites skip the sticky write."""
        target = self._make_target(tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            return_value=(True, False),
        ) as mock:
            run_all_prompts(
                target,
                0,
                1,
                1,
                "",
                "",
                mode="auto",
                fallback_model=None,
                no_sticky_swap=True,
            )

        assert mock.call_count == 3
        for i, call in enumerate(mock.call_args_list, 1):
            assert call.kwargs.get("no_sticky_swap") is True, (
                f"call {i} did not receive no_sticky_swap=True; "
                f"got kwargs={call.kwargs}"
            )

    def test_claude_swap_persists_within_claude_family(
        self, tmp_path, monkeypatch
    ):
        """Positive control: a Claude swap MUST keep applying to subsequent
        Claude-family prompts that target a model OTHER than the swap
        target. e.g. after sonnet→opus, a sonnet-4.6 file later in the run
        should also use opus-4.7."""
        from prompt_executor import BACKEND_CLAUDE

        target = tmp_path / "target"
        target.mkdir()
        (target / "01-task-sonnet-4.6.md").write_text("first")
        (target / "02-task-sonnet-4.6.md").write_text("second")
        (target / "03-task-glm-5.1.md").write_text("third")
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        # Baseline — exercise the reactive autocompact-swap, not preflight.
        monkeypatch.delenv("CLAUDE_SONNET_1M_AVAILABLE", raising=False)

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            chosen_model = args[3]
            sticky_state = kwargs.get("sticky_state")
            called_with.append(chosen_model)
            if len(called_with) == 1 and sticky_state is not None:
                sticky_state["overrides"][BACKEND_CLAUDE] = "opus-4.7"
                sticky_state["reasons"][BACKEND_CLAUDE] = "autocompact"
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ):
            run_all_prompts(
                target, 0, 1, 1, "", "", mode="auto", fallback_model=None
            )

        # Prompt 1 sees sonnet-4.6 (override not set yet at selection time).
        assert called_with[0] == "sonnet-4.6"
        # Prompt 2: same Claude family, override now set → opus-4.7.
        assert called_with[1] == "opus-4.7"
        # Prompt 3: OpenCode family → unaffected by the Claude override.
        assert called_with[2] == "glm-5.1"


class TestPreflightClaudeSwap:
    """When the user's Claude CLI account lacks Sonnet 1M, sonnet-4.6 prompts
    deterministically autocompact-thrash for ~8 minutes before the in-flight
    swap fires. The CLAUDE_SONNET_1M_AVAILABLE=false env var triggers a
    preflight Claude-family swap so sonnet prompts route to opus-4.7 from
    attempt 1, eliminating that wasted wall-clock time.

    Regression coverage for the brand-kit-pro-max run on this account.
    """

    def _make_target(self, tmp_path):
        target = tmp_path / "target"
        target.mkdir()
        (target / "01-task-sonnet-4.6.md").write_text("first")
        (target / "02-task-glm-5.1.md").write_text("second")
        return target

    def test_preflight_swap_fires_when_sonnet_1m_unavailable(
        self, tmp_path, monkeypatch
    ):
        target = self._make_target(tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        monkeypatch.setenv("CLAUDE_SONNET_1M_AVAILABLE", "false")

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            called_with.append(args[3])
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ):
            run_all_prompts(
                target, 0, 1, 1, "", "", mode="auto", fallback_model=None
            )

        # Prompt 1 (sonnet-4.6 by filename) MUST be preflight-routed to opus-4.7.
        assert called_with[0] == "opus-4.7", (
            f"Preflight swap did not fire: prompt 1 called with "
            f"{called_with[0]!r}, expected 'opus-4.7'"
        )
        # Prompt 2 (glm-5.1, OpenCode family) MUST be unaffected.
        assert called_with[1] == "glm-5.1"

    def test_preflight_no_op_when_unset(self, tmp_path, monkeypatch):
        """Default (env var unset): sonnet runs on attempt 1 as before."""
        target = self._make_target(tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        monkeypatch.delenv("CLAUDE_SONNET_1M_AVAILABLE", raising=False)

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            called_with.append(args[3])
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ):
            run_all_prompts(
                target, 0, 1, 1, "", "", mode="auto", fallback_model=None
            )

        assert called_with[0] == "sonnet-4.6"
        assert called_with[1] == "glm-5.1"

    def test_preflight_no_op_when_true(self, tmp_path, monkeypatch):
        """Explicit CLAUDE_SONNET_1M_AVAILABLE=true behaves like unset."""
        target = self._make_target(tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        monkeypatch.setenv("CLAUDE_SONNET_1M_AVAILABLE", "true")

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            called_with.append(args[3])
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ):
            run_all_prompts(
                target, 0, 1, 1, "", "", mode="auto", fallback_model=None
            )

        assert called_with[0] == "sonnet-4.6"

    def test_preflight_disabled_by_no_sticky_swap_flag(
        self, tmp_path, monkeypatch
    ):
        """--no-sticky-swap must override the preflight env var: when the user
        explicitly opts into strict per-file model adherence, no auto swaps
        should fire — including preflight ones."""
        target = self._make_target(tmp_path)
        monkeypatch.setattr("prompt_executor.LOG_FILE", tmp_path / "test.log")
        monkeypatch.setattr(
            "prompt_executor.FAILURES_FILE", tmp_path / "fail.log"
        )
        monkeypatch.setenv("CLAUDE_SONNET_1M_AVAILABLE", "false")

        called_with: list[str] = []

        def side_effect(*args, **kwargs):
            called_with.append(args[3])
            return (True, False)

        with patch(
            "prompt_executor.execute_prompt_with_retry",
            side_effect=side_effect,
        ):
            run_all_prompts(
                target,
                0,
                1,
                1,
                "",
                "",
                mode="auto",
                fallback_model=None,
                no_sticky_swap=True,
            )

        # --no-sticky-swap wins: sonnet runs on its filename model despite
        # the preflight env var.
        assert called_with[0] == "sonnet-4.6"


class TestNoStickySwapFlag:
    def test_flag_present_in_argparse(self):
        """The --no-sticky-swap flag must be wired into add_common_args
        so both `start` and `run` subcommands accept it."""
        import argparse
        from prompt_executor import add_common_args

        parser = argparse.ArgumentParser()
        # add_common_args adds its own `folder` positional.
        add_common_args(parser)

        ns = parser.parse_args(
            ["dummy", "--mode", "auto", "--no-sticky-swap"]
        )
        assert ns.no_sticky_swap is True

        ns2 = parser.parse_args(["dummy", "--mode", "auto"])
        assert ns2.no_sticky_swap is False

    def test_spawn_run_appends_flag(self):
        """_spawn_run must append --no-sticky-swap to the child process
        command so scheduler/cron-launched runs honor the setting."""
        from unittest.mock import patch
        from prompt_executor import _spawn_run

        captured: list[list[str]] = []

        class FakeProc:
            pid = 12345

        def fake_popen(cmd, **kwargs):
            captured.append(list(cmd))
            return FakeProc()

        with patch("prompt_executor.subprocess.Popen", side_effect=fake_popen):
            _spawn_run(
                "/tmp/folder",
                "glm-5.1",
                None,
                5,
                3,
                1,
                None,
                halt_on_fail=False,
                no_sticky_swap=True,
            )

        assert len(captured) == 1
        assert "--no-sticky-swap" in captured[0]
        # And NOT present when off.
        captured.clear()
        with patch("prompt_executor.subprocess.Popen", side_effect=fake_popen):
            _spawn_run(
                "/tmp/folder",
                "glm-5.1",
                None,
                5,
                3,
                1,
                None,
                halt_on_fail=False,
                no_sticky_swap=False,
            )
        assert "--no-sticky-swap" not in captured[0]
