from prompt_executor import (
    detect_backend,
    _build_claude_cmd,
    _build_opencode_cmd,
    BACKEND_CLAUDE,
    BACKEND_OPENCODE,
    MODEL_ALIASES,
)


class TestDetectBackend:
    def test_opus(self):
        assert detect_backend("opus") == BACKEND_CLAUDE

    def test_sonnet(self):
        assert detect_backend("sonnet") == BACKEND_CLAUDE

    def test_haiku(self):
        assert detect_backend("haiku") == BACKEND_CLAUDE

    def test_claude_prefix(self):
        assert detect_backend("claude-opus-4-7") == BACKEND_CLAUDE

    def test_opus_200k_alias_routes_claude(self):
        assert detect_backend("opus-200k") == BACKEND_CLAUDE

    def test_sonnet_200k_alias_routes_claude(self):
        assert detect_backend("sonnet-200k") == BACKEND_CLAUDE

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
        assert detect_backend("zai/glm-5.1") == BACKEND_OPENCODE

    def test_provider_slash_model(self):
        assert detect_backend("openai/gpt-4") == BACKEND_OPENCODE

    def test_case_insensitive(self):
        assert detect_backend("OPUS") == BACKEND_CLAUDE
        assert detect_backend("GLM-5.1") == BACKEND_OPENCODE

    def test_unknown_defaults_opencode(self):
        assert detect_backend("unknown-model") == BACKEND_OPENCODE


class TestBuildClaudeCmd:
    def test_resolves_alias(self):
        cmd = _build_claude_cmd("opus")
        assert "claude-opus-4-7[1m]" in cmd

    def test_passes_through_unknown(self):
        cmd = _build_claude_cmd("claude-sonnet-4-6")
        assert "claude-sonnet-4-6" in cmd

    def test_has_required_flags(self):
        cmd = _build_claude_cmd("haiku")
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "--model" in cmd
        assert "--effort" in cmd
        assert "--permission-mode" in cmd
        assert "bypassPermissions" in cmd
        assert "--allowedTools" in cmd
        assert "--output-format" in cmd
        assert "text" in cmd


class TestBuildOpenCodeCmd:
    def test_basic_with_prompt(self):
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_content="hi")
        assert cmd[0] == "opencode"
        assert "run" in cmd
        assert "--model" in cmd
        # MODEL_ALIASES maps short Z.AI names to the `zai-coding/` namespace
        # used by OpenCode's provider config (see prompt_executor.MODEL_ALIASES).
        assert "zai-coding/glm-5.1" in cmd
        assert stdin is None
        assert "hi" in cmd

    def test_large_prompt_uses_stdin(self):
        big = "x" * 50000
        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_content=big)
        assert stdin == big
        assert big not in cmd

    def test_prompt_file_path(self):
        from pathlib import Path

        cmd, stdin = _build_opencode_cmd("glm-5.1", prompt_file_path=Path("/t.md"))
        assert "--file" in cmd
        assert stdin is None

    def test_file_overrides_content(self):
        from pathlib import Path

        cmd, stdin = _build_opencode_cmd(
            "glm-5.1", prompt_content="hi", prompt_file_path=Path("/t.md")
        )
        assert "--file" in cmd
        assert stdin is None

    def test_agent_flag(self):
        cmd, _ = _build_opencode_cmd("glm-5.1", prompt_content="hi", agent="coder")
        assert "--agent" in cmd
        assert "coder" in cmd

    def test_continue_flag(self):
        cmd, _ = _build_opencode_cmd(
            "glm-5.1", prompt_content="hi", continue_session=True
        )
        assert "--continue" in cmd

    def test_no_dangerously_skip_permissions(self):
        """Flag was removed in opencode >= 1.0.x; permissions now live in opencode.jsonc."""
        cmd, _ = _build_opencode_cmd("glm-5.1", prompt_content="hi")
        assert "--dangerously-skip-permissions" not in cmd

    def test_skip_permissions_kwarg_removed(self):
        import pytest
        with pytest.raises(TypeError):
            _build_opencode_cmd(  # type: ignore[call-arg]
                "glm-5.1", prompt_content="hi", skip_permissions=False
            )

    def test_no_prompt_raises(self):
        import pytest

        with pytest.raises(
            ValueError, match="Either prompt_content or prompt_file_path"
        ):
            _build_opencode_cmd("glm-5.1")

    def test_flash_alias_resolved(self):
        cmd, _ = _build_opencode_cmd("flash", prompt_content="hi")
        assert "zai-coding/glm-4.7-flash" in cmd

    def test_all_flags(self):
        cmd, stdin = _build_opencode_cmd(
            "glm-5.1",
            prompt_content="test",
            agent="builder",
            continue_session=True,
        )
        assert "--agent" in cmd
        assert "--continue" in cmd
        assert "--dangerously-skip-permissions" not in cmd
