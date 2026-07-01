from pathlib import Path
from unittest.mock import patch

import pytest

from prompt_executor import (
    detect_backend,
    _build_claude_cmd,
    _build_codex_cmd,
    _build_opencode_cmd,
    BACKEND_CLAUDE,
    BACKEND_CODEX,
    BACKEND_OPENCODE,
    MODEL_ALIASES,
    SWAP_PAIRS,
    extract_model_from_filename,
)


class TestDetectBackend:
    def test_opus(self):
        assert detect_backend("opus") == BACKEND_CLAUDE

    def test_sonnet(self):
        assert detect_backend("sonnet") == BACKEND_CLAUDE

    def test_haiku(self):
        assert detect_backend("haiku") == BACKEND_CLAUDE

    def test_full_claude_id(self):
        assert detect_backend("claude-opus-4-7") == BACKEND_CLAUDE

    def test_glm51(self):
        assert detect_backend("glm-5.1") == BACKEND_OPENCODE

    def test_glm5(self):
        assert detect_backend("glm-5") == BACKEND_OPENCODE

    def test_glm_turbo(self):
        assert detect_backend("glm-5-turbo") == BACKEND_OPENCODE

    def test_glm47(self):
        assert detect_backend("glm-4.7") == BACKEND_OPENCODE

    def test_glm_flash(self):
        assert detect_backend("glm-4.7-flash") == BACKEND_OPENCODE

    def test_flash_shorthand(self):
        assert detect_backend("flash") == BACKEND_OPENCODE

    def test_glm_shorthand(self):
        assert detect_backend("glm") == BACKEND_OPENCODE

    def test_zai_prefix(self):
        assert detect_backend("zai-coding/glm-5.1") == BACKEND_OPENCODE

    def test_provider_slash(self):
        assert detect_backend("openai/gpt-4") == BACKEND_OPENCODE

    def test_opus_200k(self):
        assert detect_backend("opus-200k") == BACKEND_CLAUDE

    def test_sonnet_200k(self):
        assert detect_backend("sonnet-200k") == BACKEND_CLAUDE

    def test_case_insensitive(self):
        assert detect_backend("OPUS") == BACKEND_CLAUDE

    def test_unknown_defaults_opencode(self):
        assert detect_backend("unknown") == BACKEND_OPENCODE

    # ── Codex backend routing (added with gpt-5.5 support) ──────────────────

    def test_gpt55_routes_to_codex(self):
        assert detect_backend("gpt-5.5") == BACKEND_CODEX

    def test_gpt55_resolved_via_alias(self):
        """Pre-resolved alias should still route to Codex."""
        assert detect_backend(MODEL_ALIASES["gpt-5.5"]) == BACKEND_CODEX

    def test_gpt_prefix_routes_to_codex(self):
        """Any unprefixed `gpt-*` is treated as a Codex model."""
        assert detect_backend("gpt-5.4") == BACKEND_CODEX
        assert detect_backend("gpt-5") == BACKEND_CODEX

    def test_provider_prefixed_gpt_stays_opencode(self):
        """`openai/gpt-4` keeps its OpenCode routing — only unprefixed gpt-* goes to Codex."""
        assert detect_backend("openai/gpt-4") == BACKEND_OPENCODE

    def test_opus47_still_claude_after_codex_added(self):
        """Regression guard: adding the Codex branch must not steal opus-4.7."""
        assert detect_backend("opus-4.7") == BACKEND_CLAUDE


class TestModelAliases:
    def test_opus(self):
        assert MODEL_ALIASES["opus"] == "claude-opus-4-7[1m]"

    def test_sonnet(self):
        # Sonnet defaults to 200k because Anthropic gates Sonnet 1M separately
        # from Opus 1M on subscriptions. Use `sonnet-1m` to opt in.
        assert MODEL_ALIASES["sonnet"] == "claude-sonnet-4-6"

    def test_sonnet_1m_opt_in(self):
        assert MODEL_ALIASES["sonnet-1m"] == "claude-sonnet-4-6[1m]"

    def test_haiku(self):
        assert MODEL_ALIASES["haiku"] == "claude-haiku-4-5-20251001"

    def test_glm51(self):
        assert MODEL_ALIASES["glm-5.1"] == "zai-coding/glm-5.1"

    def test_flash(self):
        assert MODEL_ALIASES["flash"] == "zai-coding/glm-4.7-flash"

    def test_glm(self):
        assert MODEL_ALIASES["glm"] == "zai-coding/glm-5.1"

    def test_gpt55(self):
        assert MODEL_ALIASES["gpt-5.5"] == "gpt-5.5"


class TestSwapPairs:
    """Sticky-swap targets for credit/quota errors."""

    def test_glm_haiku_bidirectional(self):
        assert SWAP_PAIRS["glm-5.1"] == "haiku-4.5"
        assert SWAP_PAIRS["haiku-4.5"] == "glm-5.1"

    def test_gpt55_opus47_bidirectional(self):
        """Peer-tier swap across providers for the Hardest tier."""
        assert SWAP_PAIRS["gpt-5.5"] == "opus-4.7"
        assert SWAP_PAIRS["opus-4.7"] == "gpt-5.5"


class TestExtractModelGpt55:
    """Filename suffix parser must recognise -gpt-5.5.md."""

    def test_extract_gpt55(self):
        assert extract_model_from_filename(Path("01-task-gpt-5.5.md")) == "gpt-5.5"

    def test_extract_gpt55_done(self):
        assert (
            extract_model_from_filename(Path("01-task-gpt-5.5_done.md")) == "gpt-5.5"
        )


class TestBuildCodexCmd:
    """Argv shape for the Codex CLI invocation pinned by _build_codex_cmd."""

    def test_argv_pins_safe_flags(self):
        cmd, stdin = _build_codex_cmd(
            "gpt-5.5",
            prompt_content="hello",
            working_dir=Path("/tmp/work"),
        )
        # `--ask-for-approval` is intentionally omitted: in codex-cli 0.130.x
        # the flag lives on the interactive `codex` command, not on `exec`,
        # and `exec` is non-interactive by construction.
        assert cmd == [
            "codex",
            "exec",
            "--model",
            "gpt-5.5",
            "--sandbox",
            "workspace-write",
            "--skip-git-repo-check",
            "--cd",
            "/tmp/work",
            "--json",
            "hello",
        ]
        assert stdin is None

    def test_no_ask_for_approval_flag(self):
        """Regression guard: codex-cli 0.130.x rejects --ask-for-approval on `exec`."""
        cmd, _ = _build_codex_cmd(
            "gpt-5.5", prompt_content="hi", working_dir=Path("/tmp/work")
        )
        assert "--ask-for-approval" not in cmd

    def test_large_prompt_uses_stdin(self):
        big = "x" * 40000
        cmd, stdin = _build_codex_cmd(
            "gpt-5.5", prompt_content=big, working_dir=Path("/tmp/work")
        )
        # Last arg should be the stdin sentinel "-".
        assert cmd[-1] == "-"
        assert stdin == big

    def test_resolves_alias(self):
        """A short alias resolves through MODEL_ALIASES before going into argv."""
        cmd, _ = _build_codex_cmd(
            "gpt-5.5", prompt_content="hi", working_dir=Path("/tmp/work")
        )
        assert "gpt-5.5" in cmd  # alias equals full ID for this entry

    def test_no_prompt_raises(self):
        with pytest.raises(ValueError):
            _build_codex_cmd("gpt-5.5", prompt_content=None)


class TestBuildOpenCodeCmd:
    def test_basic(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", "hello")
        assert "zai-coding/glm-5.1" in cmd
        assert stdin is None

    def test_large_prompt_stdin(self):
        big = "x" * 50000
        cmd, stdin = _build_opencode_cmd("glm-5.1", big)
        assert stdin == big

    def test_agent(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", agent="coder")
        assert "--agent" in cmd

    def test_continue(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", continue_session=True)
        assert "--continue" in cmd

    def test_no_continue_default(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--continue" not in cmd

    def test_no_dangerously_skip_permissions(self):
        """Opencode >= 1.0.x no longer supports this flag."""
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--dangerously-skip-permissions" not in cmd

    def test_prompt_file(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_file_path=Path("/t.md"))
        assert "--file" in cmd
        assert stdin is None

    def test_no_prompt_raises(self):
        import pytest

        with pytest.raises(ValueError):
            _build_opencode_cmd("glm-5.1")

    def test_flash_resolved(self):
        cmd, _ = _build_opencode_cmd("flash", "hi")
        assert "zai-coding/glm-4.7-flash" in cmd


class TestBuildClaudeCmd:
    def test_basic(self):
        cmd = _build_claude_cmd("opus")
        assert "claude" in cmd
        assert "-p" in cmd
        assert "claude-opus-4-7[1m]" in cmd

    def test_has_all_flags(self):
        cmd = _build_claude_cmd("sonnet")
        assert "--permission-mode" in cmd
        assert "--allowedTools" in cmd
        assert "--output-format" in cmd
        assert "--effort" in cmd


# ── OpenCode provider <-> MODEL_ALIASES <-> .env consistency (regression) ────
#
# The brand-kit-pro-max GLM prompts failed silently because three independent
# places held overlapping copies of the same identifier and one of them drifted:
#
#   1. prompt_executor.MODEL_ALIASES → "zai-coding/glm-5.1"  (already migrated)
#   2. .opencode/opencode.jsonc      → provider key "zai"     (NOT migrated)
#   3. opencode.jsonc apiKey         → "{env:ZAI_API_KEY}"    (wrong env name)
#
# These tests pin the contract so future edits can't silently break GLM
# routing without a test failing first.


class TestOpencodeProviderConsistency:
    """Lock the prompt-executor ↔ opencode.jsonc ↔ .env triangle."""

    @staticmethod
    def _project_root():
        # tests/ → prompt-executor/ → repo root
        return Path(__file__).resolve().parents[2]

    @staticmethod
    def _parse(text: str) -> dict:
        # Reuse the same parser opencode itself uses; matches prompt_executor.
        from prompt_executor import _parse_jsonc

        parsed = _parse_jsonc(text)
        assert parsed is not None, "opencode.jsonc failed to parse"
        return parsed

    def test_opencode_provider_key_matches_model_aliases(self):
        """If MODEL_ALIASES routes glm-5.1 to ``zai-coding/glm-5.1`` then
        ``.opencode/opencode.jsonc`` MUST register a provider with that exact
        key — otherwise opencode rejects the model with provider-not-found."""
        cfg_path = self._project_root() / ".opencode" / "opencode.jsonc"
        if not cfg_path.exists():
            pytest.skip("project opencode.jsonc not present (test runs in repo)")
        cfg = self._parse(cfg_path.read_text(encoding="utf-8"))
        providers = cfg.get("provider") or {}

        # Every MODEL_ALIASES value with a "/" prefix must point at a
        # provider that opencode.jsonc actually registers.
        for alias, full in MODEL_ALIASES.items():
            if "/" not in full:
                continue  # claude-* models — handled by the Claude CLI directly
            provider_key = full.split("/", 1)[0]
            # Built-in opencode providers (anthropic, openai, ...) don't need
            # to be in opencode.jsonc; only custom ones the project defines do.
            # We restrict the check to project-custom providers (zai-coding):
            if provider_key.startswith("zai"):
                assert provider_key in providers, (
                    f"MODEL_ALIASES[{alias!r}] points to provider "
                    f"{provider_key!r}, but opencode.jsonc does not register "
                    f"it. Registered providers: {sorted(providers)}"
                )

    def test_opencode_zai_provider_uses_coding_plan_env_var(self):
        """The zai-coding provider URL is the *coding plan* PaaS endpoint
        (``api.z.ai/api/coding/paas/v4``). It MUST authenticate with
        ``ZAI_CODING_PLAN_API_KEY``, not the regular ``ZAI_API_KEY`` —
        these are two different Z.AI subscriptions and swapping them
        produces a runtime auth failure."""
        cfg_path = self._project_root() / ".opencode" / "opencode.jsonc"
        if not cfg_path.exists():
            pytest.skip("project opencode.jsonc not present (test runs in repo)")
        cfg = self._parse(cfg_path.read_text(encoding="utf-8"))
        providers = cfg.get("provider") or {}
        zai_coding = providers.get("zai-coding")
        assert zai_coding is not None, (
            "Expected provider 'zai-coding' in .opencode/opencode.jsonc "
            "(matches MODEL_ALIASES['glm-5.1'] prefix). Found: "
            f"{sorted(providers)}"
        )
        api_key = zai_coding.get("options", {}).get("apiKey", "")
        assert "ZAI_CODING_PLAN_API_KEY" in api_key, (
            f"zai-coding provider must reference ZAI_CODING_PLAN_API_KEY, "
            f"got {api_key!r}. The endpoint is the coding-plan PaaS URL "
            f"and the regular ZAI_API_KEY will fail auth there."
        )
