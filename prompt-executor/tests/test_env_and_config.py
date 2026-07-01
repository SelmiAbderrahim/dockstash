"""Tests for dotenv loading, config discovery, and stderr classification.

Provider authentication is delegated to each CLI's own credential store
(`claude login` and `opencode auth login`). The executor no longer reads
or forwards ANTHROPIC_API_KEY / ZAI_API_KEY, so there is nothing to
validate at the env-var layer.
"""

from pathlib import Path

import prompt_executor
from prompt_executor import (
    _classify_stderr,
    _ensure_opencode_config,
    _find_opencode_config,
    init_runtime_files,
)


class TestNoApiKeyDependency:
    """The executor must not depend on ANTHROPIC_API_KEY / ZAI_API_KEY."""

    def test_validate_env_vars_removed(self):
        """The legacy env-validation helper must not exist."""
        assert not hasattr(prompt_executor, "_validate_env_vars")

    def test_check_env_and_warn_removed(self):
        """The legacy env-warning helper must not exist."""
        assert not hasattr(prompt_executor, "_check_env_and_warn")

    def test_env_warned_removed(self):
        """The legacy dedup set must not exist."""
        assert not hasattr(prompt_executor, "_env_warned")

    def test_module_source_has_no_api_key_forwarding(self):
        """No code path should inject ZAI_API_KEY / ANTHROPIC_API_KEY into
        a child env. Docstring mentions are OK (they document the absence),
        but there must be no `child_env["ZAI_API_KEY"] = ...` or similar."""
        source = Path(prompt_executor.__file__).read_text(encoding="utf-8")
        assert 'child_env["ZAI_API_KEY"]' not in source
        assert 'child_env["ANTHROPIC_API_KEY"]' not in source
        assert "os.environ.get(\"ZAI_API_KEY\")" not in source
        assert "os.environ.get(\"ANTHROPIC_API_KEY\")" not in source


class TestFindOpencodeConfig:
    def test_finds_jsonc_in_current_dir(self, tmp_path):
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        config.write_text("{}")
        assert _find_opencode_config(tmp_path) == config

    def test_finds_json_variant(self, tmp_path):
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.json"
        config.write_text("{}")
        assert _find_opencode_config(tmp_path) == config

    def test_walks_upward(self, tmp_path):
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        config.write_text("{}")
        subdir = tmp_path / "sub" / "deeper"
        subdir.mkdir(parents=True)
        assert _find_opencode_config(subdir) == config

    def test_returns_none_when_missing(self, tmp_path):
        assert _find_opencode_config(tmp_path) is None

    def test_stops_at_filesystem_root(self, tmp_path):
        result = _find_opencode_config(Path("/"))
        assert result is None or result.exists()


class TestClassifyStderr:
    def test_mcp_server_failed(self):
        assert _classify_stderr("MCP server 'stripe' failed") == "MCP_ERROR"

    def test_mcp_timeout(self):
        assert _classify_stderr("MCP timeout after 5000ms") == "MCP_ERROR"

    def test_mcp_case_insensitive(self):
        assert _classify_stderr("mcp server 'ctx' failed") == "MCP_ERROR"

    def test_skill_not_found(self):
        assert _classify_stderr("Skill 'fix-issue' not found") == "SKILL_ERROR"

    def test_skill_validation(self):
        assert _classify_stderr("skill validation failed") == "SKILL_ERROR"

    def test_unrelated_error_returns_none(self):
        assert _classify_stderr("Unrelated error: exit 1") is None

    def test_empty_string_returns_none(self):
        assert _classify_stderr("") is None


class TestEnsureOpencodeConfig:
    def test_warns_when_no_config(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _ensure_opencode_config(tmp_path)
        content = log_file.read_text()
        assert "WARNING" in content
        assert "No .opencode/opencode.jsonc found" in content

    def test_logs_config_path_when_found(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        # Include a permission block so the secondary check is quiet.
        config.write_text('{"permission": {"bash": "allow"}}')
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _ensure_opencode_config(tmp_path)
        content = log_file.read_text()
        assert "Using OpenCode config:" in content
        assert str(config) in content
        assert "no `permission` block" not in content

    def test_warns_when_permission_block_missing(self, tmp_path, monkeypatch):
        """Opencode >= 1.0.x needs `permission` in the config for non-TTY runs."""
        init_runtime_files(tmp_path)
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        # Valid JSONC with a comment and trailing comma, but no permission block.
        config.write_text(
            '// main config\n'
            '{\n'
            '  "$schema": "https://opencode.ai/config.json",\n'
            '  "model": "zai-coding/glm-5.1",\n'
            '}\n'
        )
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _ensure_opencode_config(tmp_path)
        content = log_file.read_text()
        assert "no `permission` block" in content
        assert "hang" in content  # warning mentions the hang risk

    def test_quiet_when_permission_block_present(self, tmp_path, monkeypatch):
        init_runtime_files(tmp_path)
        (tmp_path / ".opencode").mkdir()
        config = tmp_path / ".opencode" / "opencode.jsonc"
        config.write_text(
            '{\n'
            '  "permission": {\n'
            '    "bash": "allow",\n'
            '    "edit": "allow",\n'
            '    "webfetch": "allow",\n'
            '    "websearch": "allow"\n'
            '  }\n'
            '}\n'
        )
        log_file = tmp_path / ".prompt_executor_test.log"
        monkeypatch.setattr("prompt_executor.LOG_FILE", log_file)
        _ensure_opencode_config(tmp_path)
        content = log_file.read_text()
        assert "WARNING" not in content


class TestParseJsonc:
    def test_strips_line_comments(self):
        from prompt_executor import _parse_jsonc

        assert _parse_jsonc('// hi\n{"a": 1}') == {"a": 1}

    def test_strips_block_comments(self):
        from prompt_executor import _parse_jsonc

        assert _parse_jsonc('{"a": 1 /* note */}') == {"a": 1}

    def test_strips_trailing_commas(self):
        from prompt_executor import _parse_jsonc

        assert _parse_jsonc('{"a": 1,}') == {"a": 1}

    def test_returns_none_on_garbage(self):
        from prompt_executor import _parse_jsonc

        assert _parse_jsonc("not json at all") is None

    def test_returns_none_for_non_object(self):
        from prompt_executor import _parse_jsonc

        assert _parse_jsonc("[1, 2, 3]") is None


class TestDoctorAuthRecommendation:
    """The AUTH category now points at CLI login, not .env keys."""

    def test_auth_recommendation_mentions_cli_login(self):
        from prompt_executor import (
            DOCTOR_CATEGORY_AUTH,
            _DOCTOR_RECOMMENDATIONS,
        )

        rec = _DOCTOR_RECOMMENDATIONS[DOCTOR_CATEGORY_AUTH]
        assert "claude login" in rec
        assert "opencode auth login" in rec
        # Must not push users back toward keys in .env
        assert "ZAI_API_KEY" not in rec
        assert "ANTHROPIC_API_KEY" not in rec
