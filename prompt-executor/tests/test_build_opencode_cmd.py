"""Tests for _build_opencode_cmd, _build_claude_cmd, detect_backend, and MODEL_ALIASES.

Verifies:
- OpenCode CLI command construction (flags, model resolution, large prompt handling)
- Claude CLI command construction (unchanged / regression test)
- Backend detection routing
- MODEL_ALIASES resolution
"""

import pytest
from pathlib import Path
from prompt_executor import (
    _build_opencode_cmd,
    _build_claude_cmd,
    detect_backend,
    MODEL_ALIASES,
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
)


class TestDetectBackend:
    def test_opus_routes_to_claude(self):
        assert detect_backend("opus") == BACKEND_CLAUDE

    def test_sonnet_routes_to_claude(self):
        assert detect_backend("sonnet") == BACKEND_CLAUDE

    def test_haiku_routes_to_claude(self):
        assert detect_backend("haiku") == BACKEND_CLAUDE

    def test_full_claude_id_routes_to_claude(self):
        assert detect_backend("claude-opus-4-7") == BACKEND_CLAUDE

    def test_glm_short_name_routes_to_opencode(self):
        assert detect_backend("glm-5.1") == BACKEND_OPENCODE

    def test_glm_5_routes_to_opencode(self):
        assert detect_backend("glm-5") == BACKEND_OPENCODE

    def test_glm_turbo_routes_to_opencode(self):
        assert detect_backend("glm-5-turbo") == BACKEND_OPENCODE

    def test_glm_47_routes_to_opencode(self):
        assert detect_backend("glm-4.7") == BACKEND_OPENCODE

    def test_glm_flash_routes_to_opencode(self):
        assert detect_backend("glm-4.7-flash") == BACKEND_OPENCODE

    def test_flash_shorthand_routes_to_opencode(self):
        assert detect_backend("flash") == BACKEND_OPENCODE

    def test_glm_shorthand_routes_to_opencode(self):
        assert detect_backend("glm") == BACKEND_OPENCODE

    def test_zai_prefix_routes_to_opencode(self):
        assert detect_backend("zai-coding/glm-5.1") == BACKEND_OPENCODE

    def test_provider_slash_model_routes_to_opencode(self):
        assert detect_backend("openai/gpt-4") == BACKEND_OPENCODE

    def test_case_insensitive_opus(self):
        assert detect_backend("OPUS") == BACKEND_CLAUDE

    def test_case_insensitive_glm(self):
        assert detect_backend("GLM-5.1") == BACKEND_OPENCODE

    def test_unknown_model_defaults_to_opencode(self):
        assert detect_backend("unknown-model") == BACKEND_OPENCODE

    def test_opus_200k_routes_to_claude(self):
        assert detect_backend("opus-200k") == BACKEND_CLAUDE

    def test_sonnet_200k_routes_to_claude(self):
        assert detect_backend("sonnet-200k") == BACKEND_CLAUDE


class TestModelAliases:
    def test_glm_51_resolves(self):
        assert MODEL_ALIASES["glm-5.1"] == "zai-coding/glm-5.1"

    def test_glm_5_resolves(self):
        assert MODEL_ALIASES["glm-5"] == "zai-coding/glm-5"

    def test_glm_5_turbo_resolves(self):
        assert MODEL_ALIASES["glm-5-turbo"] == "zai-coding/glm-5-turbo"

    def test_glm_47_resolves(self):
        assert MODEL_ALIASES["glm-4.7"] == "zai-coding/glm-4.7"

    def test_glm_47_flash_resolves(self):
        assert MODEL_ALIASES["glm-4.7-flash"] == "zai-coding/glm-4.7-flash"

    def test_flash_alias_resolves(self):
        assert MODEL_ALIASES["flash"] == "zai-coding/glm-4.7-flash"

    def test_glm_alias_resolves(self):
        assert MODEL_ALIASES["glm"] == "zai-coding/glm-5.1"

    def test_opus_resolves_with_1m(self):
        assert MODEL_ALIASES["opus"] == "claude-opus-4-7[1m]"

    def test_sonnet_resolves_with_200k(self):
        # Sonnet defaults to 200k because Anthropic gates Sonnet 1M separately
        # from Opus 1M on subscriptions. Use `sonnet-1m` to opt in.
        assert MODEL_ALIASES["sonnet"] == "claude-sonnet-4-6"

    def test_sonnet_1m_opt_in_alias(self):
        assert MODEL_ALIASES["sonnet-1m"] == "claude-sonnet-4-6[1m]"

    def test_haiku_resolves(self):
        assert MODEL_ALIASES["haiku"] == "claude-haiku-4-5-20251001"


class TestBuildOpenCodeCmd:
    def test_basic_cmd_has_model_and_prompt(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", "hello")
        assert cmd[0] == "opencode"
        assert "run" in cmd
        assert "--model" in cmd
        assert "zai-coding/glm-5.1" in cmd
        assert "hello" in cmd
        assert stdin is None

    def test_no_format_default_flag(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--format" not in cmd

    def test_never_passes_dangerously_skip_permissions(self):
        """Opencode >= 1.0.x removed this flag; it now comes from opencode.jsonc."""
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--dangerously-skip-permissions" not in cmd

    def test_build_opencode_cmd_rejects_unknown_kwargs(self):
        """The legacy `skip_permissions` kwarg must not exist."""
        import pytest as _pytest
        with _pytest.raises(TypeError):
            _build_opencode_cmd("glm-5.1", "hi", skip_permissions=False)  # type: ignore[call-arg]

    def test_agent_flag_passthrough(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", agent="coder")
        assert "--agent" in cmd
        idx = cmd.index("--agent")
        assert cmd[idx + 1] == "coder"

    def test_no_agent_when_none(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", agent=None)
        assert "--agent" not in cmd

    def test_continue_flag_passthrough(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi", continue_session=True)
        assert "--continue" in cmd

    def test_no_continue_by_default(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", "hi")
        assert "--continue" not in cmd

    def test_large_prompt_uses_stdin(self):
        large = "x" * 50000
        cmd, stdin = _build_opencode_cmd("glm-5.1", large)
        assert stdin is not None
        assert stdin == large
        assert large not in cmd

    def test_small_prompt_in_cmd_not_stdin(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", "small prompt")
        assert stdin is None
        assert "small prompt" in cmd

    def test_already_prefixed_model_not_double_prefixed(self):
        cmd, _ = _build_opencode_cmd("zai-coding/glm-5.1", "hi")
        assert "zai-coding/zai-coding/glm-5.1" not in cmd
        assert "zai-coding/glm-5.1" in cmd

    def test_unknown_model_passed_through(self):
        cmd, _ = _build_opencode_cmd("custom/model", "hi")
        assert "custom/model" in cmd

    def test_prompt_file_path_uses_file_flag(self):
        p = Path("/tmp/test_prompt.md")
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_file_path=p)
        assert "--file" in cmd
        assert "/tmp/test_prompt.md" in cmd
        assert stdin is None

    def test_prompt_file_takes_precedence_over_content(self):
        p = Path("/tmp/test.md")
        cmd, stdin = _build_opencode_cmd(
            "glm-5.1", prompt_content="hello", prompt_file_path=p
        )
        assert "--file" in cmd
        assert "hello" not in cmd
        assert stdin is None

    def test_raises_when_no_prompt(self):
        with pytest.raises(
            ValueError, match="Either prompt_content or prompt_file_path"
        ):
            _build_opencode_cmd("glm-5.1")

    def test_flash_alias_resolved(self):
        cmd, _ = _build_opencode_cmd("flash", "hi")
        assert "zai-coding/glm-4.7-flash" in cmd

    def test_glm_alias_resolved(self):
        cmd, _ = _build_opencode_cmd("glm", "hi")
        assert "zai-coding/glm-5.1" in cmd

    def test_all_flags_together(self):
        cmd, stdin = _build_opencode_cmd(
            "glm-5.1",
            "test prompt",
            agent="builder",
            continue_session=True,
        )
        assert "--model" in cmd
        assert "zai-coding/glm-5.1" in cmd
        assert "--agent" in cmd
        assert "builder" in cmd
        assert "--continue" in cmd
        assert "--dangerously-skip-permissions" not in cmd
        assert "test prompt" in cmd
        assert stdin is None


class TestClaudeBackendUnchanged:
    def test_claude_cmd_has_allowed_tools(self):
        cmd = _build_claude_cmd("opus")
        assert "--allowedTools" in cmd

    def test_claude_cmd_has_permission_mode(self):
        cmd = _build_claude_cmd("opus")
        assert "--permission-mode" in cmd
        assert "bypassPermissions" in cmd

    def test_claude_cmd_has_output_format(self):
        cmd = _build_claude_cmd("opus")
        assert "--output-format" in cmd
        assert "text" in cmd

    def test_claude_cmd_has_effort(self):
        cmd = _build_claude_cmd("opus")
        assert "--effort" in cmd

    def test_claude_cmd_resolves_alias(self):
        cmd = _build_claude_cmd("opus")
        assert "claude-opus-4-7[1m]" in cmd

    def test_claude_cmd_no_opencode_flags(self):
        cmd = _build_claude_cmd("opus")
        assert "--agent" not in cmd
        assert "--continue" not in cmd
        assert "--dangerously-skip-permissions" not in cmd
        assert "--format" not in cmd

    def test_claude_cmd_format(self):
        cmd = _build_claude_cmd("sonnet")
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "--model" in cmd
        assert "claude-sonnet-4-6" in cmd
        assert "claude-sonnet-4-6[1m]" not in cmd

    def test_claude_cmd_sonnet_1m_opt_in(self):
        cmd = _build_claude_cmd("sonnet-1m")
        assert "claude-sonnet-4-6[1m]" in cmd
