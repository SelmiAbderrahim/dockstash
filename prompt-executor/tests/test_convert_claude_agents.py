"""
Tests for convert_claude_agents.py — Claude Code → OpenCode agent conversion.

Covers: FrontmatterParser, AgentConverter, inventory loading, target naming,
log generation, serialization, and end-to-end conversion scenarios.
"""

import csv
import os
import sys
import textwrap
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure the scripts directory is importable
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from convert_claude_agents import (
    AgentConverter,
    COLOR_NAME_MAP,
    FrontmatterParser,
    HEX_COLOR_RE,
    TOOL_NAME_MAP,
    TYPE_TO_MODE,
    VALID_THEME_COLORS,
    build_target_map,
    derive_target_name,
    generate_log,
    load_bucket_a_agents,
)


# ═══════════════════════════════════════════════════════════════════════════
# FrontmatterParser
# ═══════════════════════════════════════════════════════════════════════════


class TestFrontmatterParser:
    """Tests for the stdlib YAML frontmatter parser."""

    def test_simple_key_value(self):
        content = textwrap.dedent("""\
            ---
            name: my-agent
            description: A simple agent
            color: blue
            ---

            # Body content
        """)
        fm, body = FrontmatterParser.parse(content)
        assert fm["name"] == "my-agent"
        assert fm["description"] == "A simple agent"
        assert fm["color"] == "blue"
        assert "# Body content" in body

    def test_no_frontmatter(self):
        content = "# Just a heading\n\nSome body text."
        fm, body = FrontmatterParser.parse(content)
        assert fm == {}
        assert body == content

    def test_empty_frontmatter(self):
        content = "---\n---\n\nBody"
        fm, body = FrontmatterParser.parse(content)
        assert fm == {}
        assert "Body" in body

    def test_multiline_pipe(self):
        content = textwrap.dedent("""\
            ---
            name: test
            description: |
              Line one of description.
              Line two of description.
            color: green
            ---

            # Heading
        """)
        fm, body = FrontmatterParser.parse(content)
        assert fm["name"] == "test"
        assert "Line one" in fm["description"]
        assert "Line two" in fm["description"]
        assert fm["color"] == "green"

    def test_boolean_values(self):
        content = "---\nhidden: true\nenabled: false\n---\n"
        fm, _ = FrontmatterParser.parse(content)
        assert fm["hidden"] is True
        assert fm["enabled"] is False

    def test_numeric_values(self):
        content = "---\npriority: 5\ntemperature: 0.7\n---\n"
        fm, _ = FrontmatterParser.parse(content)
        assert fm["priority"] == 5
        assert fm["temperature"] == 0.7

    def test_null_values(self):
        content = "---\nvalue: null\nempty:\n---\n"
        fm, _ = FrontmatterParser.parse(content)
        assert fm["value"] is None
        assert fm["empty"] is None

    def test_quoted_values(self):
        content = '---\nname: "my-agent"\ncolor: \'blue\'\n---\n'
        fm, _ = FrontmatterParser.parse(content)
        assert fm["name"] == "my-agent"
        assert fm["color"] == "blue"

    def test_comma_separated_tools_string(self):
        content = "---\ntools: Read, Write, Edit, Bash, Glob, Grep\n---\n"
        fm, _ = FrontmatterParser.parse(content)
        assert fm["tools"] == "Read, Write, Edit, Bash, Glob, Grep"

    def test_body_preserved_verbatim(self):
        body_text = "\n# Agent Title\n\nSome **bold** and _italic_ text.\n\n- List item\n"
        content = f"---\nname: test\n---\n{body_text}"
        _, body = FrontmatterParser.parse(content)
        assert body_text.strip() in body.strip()

    def test_unclosed_frontmatter(self):
        content = "---\nname: test\nno closing delimiter"
        fm, body = FrontmatterParser.parse(content)
        assert fm == {}
        assert body == content

    def test_colon_in_value(self):
        content = "---\ndescription: Agent for http://example.com deployment\n---\n"
        fm, _ = FrontmatterParser.parse(content)
        assert "http://example.com" in fm["description"]


# ═══════════════════════════════════════════════════════════════════════════
# AgentConverter._parse_tools
# ═══════════════════════════════════════════════════════════════════════════


class TestParseTools:
    """Tests for tool string parsing."""

    def setup_method(self):
        self.converter = AgentConverter()

    def test_comma_separated_string(self):
        result = self.converter._parse_tools("Read, Write, Edit, Bash, Glob, Grep")
        assert result == {
            "read": True, "write": True, "edit": True,
            "bash": True, "glob": True, "grep": True,
        }

    def test_all_tools_keyword(self):
        result = self.converter._parse_tools("All tools")
        # "all" and "tools" are not in TOOL_NAME_MAP so falls back to defaults
        assert "read" in result
        assert "bash" in result

    def test_mcp_tools_skipped(self):
        result = self.converter._parse_tools(
            "mcp__sentry__get_issues, Read, mcp__serena__search, Bash"
        )
        assert "read" in result
        assert "bash" in result
        assert len(result) == 2

    def test_chrome_devtools_skipped(self):
        result = self.converter._parse_tools("chrome-devtools-mcp, Read, Grep")
        assert "read" in result
        assert "grep" in result
        assert "chrome-devtools-mcp" not in result

    def test_empty_string(self):
        result = self.converter._parse_tools("")
        assert result == {
            "bash": True, "read": True, "edit": True,
            "write": True, "grep": True, "glob": True,
        }

    def test_none_value(self):
        result = self.converter._parse_tools(None)
        assert result == {
            "bash": True, "read": True, "edit": True,
            "write": True, "grep": True, "glob": True,
        }

    def test_list_input(self):
        result = self.converter._parse_tools(["Read", "Bash", "Grep"])
        assert result == {"read": True, "bash": True, "grep": True}

    def test_only_mcp_tools_returns_defaults(self):
        result = self.converter._parse_tools("mcp__sentry__one, mcp__sentry__two")
        # All tools were MCP, so empty result triggers default
        assert result == {
            "bash": True, "read": True, "edit": True,
            "write": True, "grep": True, "glob": True,
        }

    def test_webfetch_mapped(self):
        result = self.converter._parse_tools("Read, WebFetch")
        assert result == {"read": True, "webfetch": True}


# ═══════════════════════════════════════════════════════════════════════════
# AgentConverter._normalize_color
# ═══════════════════════════════════════════════════════════════════════════


class TestNormalizeColor:
    """Tests for color validation and mapping."""

    def setup_method(self):
        self.converter = AgentConverter()

    def test_hex_passthrough(self):
        assert self.converter._normalize_color("#F59E0B") == "#F59E0B"
        assert self.converter._normalize_color("#8b5cf6") == "#8b5cf6"

    def test_theme_color_passthrough(self):
        for color in VALID_THEME_COLORS:
            assert self.converter._normalize_color(color) == color

    def test_named_color_mapping(self):
        assert self.converter._normalize_color("blue") == "info"
        assert self.converter._normalize_color("red") == "error"
        assert self.converter._normalize_color("green") == "success"
        assert self.converter._normalize_color("orange") == "warning"
        assert self.converter._normalize_color("purple") == "accent"
        assert self.converter._normalize_color("teal") == "info"
        assert self.converter._normalize_color("gray") == "secondary"

    def test_exotic_color_dropped(self):
        result = self.converter._normalize_color("neon-green")
        assert result is None
        assert any("neon-green" in w for w in self.converter.warnings)

    def test_case_insensitive(self):
        assert self.converter._normalize_color("Blue") == "info"
        assert self.converter._normalize_color("PRIMARY") == "primary"

    def test_invalid_hex(self):
        # Only #RRGGBB is valid, not #RGB
        result = self.converter._normalize_color("#F00")
        assert result is None  # not a valid hex, not a named color


# ═══════════════════════════════════════════════════════════════════════════
# AgentConverter._transform
# ═══════════════════════════════════════════════════════════════════════════


class TestTransform:
    """Tests for full frontmatter transformation."""

    def setup_method(self):
        self.converter = AgentConverter()
        self.source = Path("/fake/path/agent.md")

    def test_minimal_agent(self):
        """Agent with only name and description."""
        fm = {"name": "my-agent", "description": "A simple agent"}
        result = self.converter._transform(fm, self.source)
        assert result["mode"] == "subagent"
        assert result["description"] == "A simple agent"
        assert result["model"] == "zai/glm-5.1"
        assert result["temperature"] == 0.2
        assert result["permission"] == {"edit": "allow", "bash": "allow"}
        assert "name" not in result

    def test_type_to_mode_mapping(self):
        for type_val, expected_mode in TYPE_TO_MODE.items():
            fm = {"type": type_val, "description": "test"}
            result = self.converter._transform(fm, self.source)
            assert result["mode"] == expected_mode, f"type={type_val}"

    def test_unknown_type_defaults_subagent(self):
        fm = {"type": "unknown_type", "description": "test"}
        result = self.converter._transform(fm, self.source)
        assert result["mode"] == "subagent"

    def test_existing_model_preserved(self):
        fm = {"model": "sonnet", "description": "test"}
        result = self.converter._transform(fm, self.source)
        assert result["model"] == "sonnet"

    def test_tools_from_tools_field(self):
        fm = {"description": "test", "tools": "Read, Write, Bash"}
        result = self.converter._transform(fm, self.source)
        assert result["tools"] == {"read": True, "write": True, "bash": True}

    def test_tools_from_capabilities_field(self):
        fm = {"description": "test", "capabilities": "Read, Edit, Grep"}
        result = self.converter._transform(fm, self.source)
        assert result["tools"] == {"read": True, "edit": True, "grep": True}

    def test_color_included_when_valid(self):
        fm = {"description": "test", "color": "blue"}
        result = self.converter._transform(fm, self.source)
        assert result["color"] == "info"

    def test_color_excluded_when_exotic(self):
        fm = {"description": "test", "color": "metallic-blue"}
        result = self.converter._transform(fm, self.source)
        assert "color" not in result

    def test_hidden_preserved(self):
        fm = {"description": "test", "hidden": True}
        result = self.converter._transform(fm, self.source)
        assert result["hidden"] is True

    def test_dropped_fields_logged(self):
        fm = {"description": "test", "name": "x", "priority": 3, "hooks": "y"}
        self.converter._transform(fm, self.source)
        warnings = " ".join(self.converter.warnings)
        assert "name" in warnings
        assert "priority" in warnings
        assert "hooks" in warnings


# ═══════════════════════════════════════════════════════════════════════════
# AgentConverter._ensure_bridged_note
# ═══════════════════════════════════════════════════════════════════════════


class TestEnsureBridgedNote:
    """Tests for inserting the 'Bridged From' note."""

    def setup_method(self):
        self.converter = AgentConverter()

    def test_note_inserted(self):
        body = "\n# My Agent\n\nSome content.\n"
        source = Path("/fake/.claude/agents/my-agent.md")
        result = self.converter._ensure_bridged_note(body, source)
        assert "## Bridged From" in result
        assert "Claude → OpenCode migration" in result

    def test_idempotent(self):
        body = "\n# Agent\n\n## Bridged From\n\nAlready has note.\n"
        source = Path("/fake/agents/test.md")
        result = self.converter._ensure_bridged_note(body, source)
        assert result.count("Bridged From") == 1

    def test_note_after_first_heading(self):
        body = "\n# My Agent\n\nFirst paragraph.\n\n## Details\n\nMore content.\n"
        source = Path("/fake/agents/test.md")
        result = self.converter._ensure_bridged_note(body, source)
        lines = result.split("\n")
        heading_idx = next(i for i, l in enumerate(lines) if l.startswith("# My Agent"))
        bridged_idx = next(i for i, l in enumerate(lines) if "## Bridged From" in l)
        details_idx = next(i for i, l in enumerate(lines) if l.startswith("## Details"))
        assert heading_idx < bridged_idx < details_idx

    def test_note_appended_when_no_heading(self):
        body = "No heading here, just text.\n"
        source = Path("/fake/agents/test.md")
        result = self.converter._ensure_bridged_note(body, source)
        assert result.endswith("migration.\n")
        assert "## Bridged From" in result


# ═══════════════════════════════════════════════════════════════════════════
# AgentConverter._serialize
# ═══════════════════════════════════════════════════════════════════════════


class TestSerialize:
    """Tests for frontmatter serialization."""

    def setup_method(self):
        self.converter = AgentConverter()

    def test_output_has_delimiters(self):
        fm = {"mode": "subagent", "description": "test", "model": "zai/glm-5.1",
              "temperature": 0.2, "tools": {"bash": True, "read": True},
              "permission": {"bash": "allow", "edit": "allow"}}
        result = self.converter._serialize(fm)
        assert result.startswith("---\n")
        assert result.endswith("\n---")

    def test_field_order(self):
        fm = {"permission": {"edit": "allow"}, "mode": "subagent",
              "model": "zai/glm-5.1", "description": "test",
              "temperature": 0.2, "tools": {"read": True}}
        result = self.converter._serialize(fm)
        lines = result.split("\n")
        # mode should come before description which comes before model
        mode_idx = next(i for i, l in enumerate(lines) if l.startswith("mode:"))
        desc_idx = next(i for i, l in enumerate(lines) if l.startswith("description:"))
        model_idx = next(i for i, l in enumerate(lines) if l.startswith("model:"))
        assert mode_idx < desc_idx < model_idx

    def test_tools_serialized_as_map(self):
        fm = {"mode": "subagent", "tools": {"bash": True, "read": True},
              "permission": {"edit": "allow"}, "temperature": 0.2}
        result = self.converter._serialize(fm)
        assert "tools:" in result
        assert "  bash: true" in result
        assert "  read: true" in result

    def test_permission_serialized_as_map(self):
        fm = {"mode": "subagent", "tools": {"bash": True},
              "permission": {"bash": "allow", "edit": "allow"}, "temperature": 0.2}
        result = self.converter._serialize(fm)
        assert "permission:" in result
        assert "  bash: allow" in result
        assert "  edit: allow" in result

    def test_multiline_description(self):
        fm = {"mode": "subagent", "description": "Line one\nLine two",
              "tools": {"read": True}, "permission": {"edit": "allow"},
              "temperature": 0.2}
        result = self.converter._serialize(fm)
        assert "description: |" in result
        assert "  Line one" in result
        assert "  Line two" in result

    def test_boolean_lowercase(self):
        fm = {"mode": "subagent", "hidden": True, "tools": {"read": True},
              "permission": {"edit": "allow"}, "temperature": 0.2}
        result = self.converter._serialize(fm)
        assert "hidden: true" in result

    def test_color_included(self):
        fm = {"mode": "subagent", "color": "info", "tools": {"read": True},
              "permission": {"edit": "allow"}, "temperature": 0.2}
        result = self.converter._serialize(fm)
        assert "color: info" in result


# ═══════════════════════════════════════════════════════════════════════════
# load_bucket_a_agents
# ═══════════════════════════════════════════════════════════════════════════


class TestLoadBucketAAgents:
    """Tests for CSV inventory loading."""

    def test_filters_bucket_a(self, tmp_path):
        csv_path = tmp_path / "inventory.csv"
        csv_path.write_text(
            "path,category,bucket,target_name,rationale\n"
            ".claude/agents/a.md,core,A,,Standard agent\n"
            ".claude/agents/b.md,core,B,,Has MCP tools\n"
            ".claude/agents/c.md,design,A,,Designer agent\n"
        )
        result = load_bucket_a_agents(str(csv_path))
        assert len(result) == 2
        assert ".claude/agents/a.md" in result
        assert ".claude/agents/c.md" in result

    def test_missing_file_returns_empty(self):
        result = load_bucket_a_agents("/nonexistent/path.csv")
        assert result == []

    def test_empty_csv(self, tmp_path):
        csv_path = tmp_path / "empty.csv"
        csv_path.write_text("path,category,bucket,target_name,rationale\n")
        result = load_bucket_a_agents(str(csv_path))
        assert result == []

    def test_skips_blank_paths(self, tmp_path):
        csv_path = tmp_path / "inventory.csv"
        csv_path.write_text(
            "path,category,bucket,target_name,rationale\n"
            ",core,A,,No path\n"
            ".claude/agents/valid.md,core,A,,Has path\n"
        )
        result = load_bucket_a_agents(str(csv_path))
        assert len(result) == 1
        assert ".claude/agents/valid.md" in result


# ═══════════════════════════════════════════════════════════════════════════
# derive_target_name
# ═══════════════════════════════════════════════════════════════════════════


class TestDeriveTargetName:
    """Tests for source path → target filename derivation."""

    def test_root_agent(self):
        assert derive_target_name(".claude/agents/coder.md") == "coder.md"

    def test_subdirectory_agent(self):
        assert derive_target_name(".claude/agents/design/ui-designer.md") == "ui-designer.md"

    def test_deep_subdirectory(self):
        assert derive_target_name(
            ".claude/agents/analysis/code-review/analyze-quality.md"
        ) == "analyze-quality.md"


# ═══════════════════════════════════════════════════════════════════════════
# build_target_map  (collision detection)
# ═══════════════════════════════════════════════════════════════════════════


class TestBuildTargetMap:
    """Tests for collision-safe target name mapping."""

    def test_no_collisions(self):
        paths = [
            ".claude/agents/coder.md",
            ".claude/agents/tester.md",
            ".claude/agents/design/ui-designer.md",
        ]
        result = build_target_map(paths)
        assert result[".claude/agents/coder.md"] == "coder.md"
        assert result[".claude/agents/tester.md"] == "tester.md"
        assert result[".claude/agents/design/ui-designer.md"] == "ui-designer.md"
        assert len(set(result.values())) == 3

    def test_collision_prefixes_parent_dir(self):
        paths = [
            ".claude/agents/app-studio/builder-specialist.md",
            ".claude/agents/websmith/builder-specialist.md",
        ]
        result = build_target_map(paths)
        assert result[".claude/agents/app-studio/builder-specialist.md"] == "appstudio-builder-specialist.md"
        assert result[".claude/agents/websmith/builder-specialist.md"] == "websmith-builder-specialist.md"

    def test_collision_strips_hyphens_from_parent(self):
        paths = [
            ".claude/agents/fire-forget/ralph-iteration-specialist.md",
            ".claude/agents/app-studio/ralph-iteration-specialist.md",
        ]
        result = build_target_map(paths)
        assert result[".claude/agents/fire-forget/ralph-iteration-specialist.md"] == "fireforget-ralph-iteration-specialist.md"
        assert result[".claude/agents/app-studio/ralph-iteration-specialist.md"] == "appstudio-ralph-iteration-specialist.md"

    def test_root_level_collision_uses_agents_prefix(self):
        """Root-level agent colliding with subdirectory agent uses 'agents' as parent."""
        paths = [
            ".claude/agents/prompt-engineer.md",
            ".claude/agents/meta/prompt-engineer.md",
        ]
        result = build_target_map(paths)
        # Root agent's parent is "agents", subdir agent's parent is "meta"
        assert result[".claude/agents/prompt-engineer.md"] == "agents-prompt-engineer.md"
        assert result[".claude/agents/meta/prompt-engineer.md"] == "meta-prompt-engineer.md"

    def test_all_targets_unique(self):
        """Even with multiple collisions, all target names must be unique."""
        paths = [
            ".claude/agents/app-studio/builder-specialist.md",
            ".claude/agents/websmith/builder-specialist.md",
            ".claude/agents/app-studio/sandbox-specialist.md",
            ".claude/agents/websmith/sandbox-specialist.md",
            ".claude/agents/fire-forget/ralph-iteration-specialist.md",
            ".claude/agents/app-studio/ralph-iteration-specialist.md",
            ".claude/agents/prompt-engineer.md",
            ".claude/agents/meta/prompt-engineer.md",
            ".claude/agents/coder.md",  # no collision
        ]
        result = build_target_map(paths)
        targets = list(result.values())
        assert len(targets) == len(set(targets)), f"Duplicate targets: {targets}"
        assert len(targets) == 9

    def test_returns_all_inputs(self):
        """Every input path must appear as a key in the result."""
        paths = [
            ".claude/agents/a/foo.md",
            ".claude/agents/b/foo.md",
            ".claude/agents/bar.md",
        ]
        result = build_target_map(paths)
        assert set(result.keys()) == set(paths)


# ═══════════════════════════════════════════════════════════════════════════
# generate_log
# ═══════════════════════════════════════════════════════════════════════════


class TestGenerateLog:
    """Tests for conversion log markdown generation."""

    def test_basic_log(self):
        records = [
            {"source": "a.md", "target": "a.md", "warnings": []},
            {"source": "b.md", "target": "b.md", "warnings": ["Dropped 'name'"]},
        ]
        log = generate_log(records, failed=[], skipped_missing=[], dry_run=False)
        assert "# Agent Conversion Log" in log
        assert "Total converted: 2" in log
        assert "Failed: 0" in log
        assert "Mode: LIVE" in log
        assert "| `a.md`" in log

    def test_dry_run_mode(self):
        log = generate_log([], [], [], dry_run=True)
        assert "Mode: DRY-RUN" in log

    def test_failed_section(self):
        failed = [{"source": "bad.md", "error": "Parse error"}]
        log = generate_log([], failed=failed, skipped_missing=[], dry_run=False)
        assert "## Failed Conversions" in log
        assert "bad.md" in log
        assert "Parse error" in log

    def test_missing_section(self):
        log = generate_log([], [], skipped_missing=["missing.md"], dry_run=False)
        assert "## Missing Source Files" in log
        assert "missing.md" in log

    def test_warnings_in_table(self):
        records = [{"source": "x.md", "target": "x.md",
                     "warnings": ["Dropped color", "Dropped name"]}]
        log = generate_log(records, [], [], dry_run=False)
        assert "Dropped color; Dropped name" in log


# ═══════════════════════════════════════════════════════════════════════════
# End-to-end conversion
# ═══════════════════════════════════════════════════════════════════════════


class TestEndToEnd:
    """End-to-end conversion from source to output."""

    def test_simple_agent(self, tmp_path):
        """Minimal agent with name, description, color."""
        source = tmp_path / "simple.md"
        source.write_text(textwrap.dedent("""\
            ---
            name: backend-i18n-developer
            description: Expert backend internationalization developer
            color: blue
            ---

            # Backend i18n Developer Agent

            Expert in backend internationalization.
        """))
        converter = AgentConverter()
        result = converter.convert(source)
        assert result is not None

        output = result["frontmatter_str"] + "\n" + result["body"]

        # Verify frontmatter
        assert "mode: subagent" in output
        assert "description: Expert backend internationalization developer" in output
        assert "model: zai/glm-5.1" in output
        assert "temperature: 0.2" in output
        assert "color: info" in output  # blue -> info
        assert "  bash: true" in output
        assert "  read: true" in output
        assert "permission:" in output
        assert "  edit: allow" in output

        # name should NOT appear in frontmatter
        fm_section = output.split("---")[1]
        assert "name:" not in fm_section

        # Body should have bridged note
        assert "## Bridged From" in output
        assert "Claude → OpenCode migration" in output

    def test_complex_agent_with_tools_and_model(self, tmp_path):
        """Agent with tools string, existing model, multiline description."""
        source = tmp_path / "complex.md"
        source.write_text(textwrap.dedent("""\
            ---
            name: sentry-investigator
            description: |
              Expert in production error investigation using Sentry MCP,
              Chrome DevTools, and Serena for debugging workflows.
            tools: mcp__sentry__get_issues, chrome-devtools-mcp, mcp__serena__search, Read, Grep, Glob, Bash
            model: sonnet
            color: orange
            ---

            # Sentry Investigator

            Investigates production errors.

            ## Capabilities

            - Issue querying
            - Stack trace analysis
        """))

        converter = AgentConverter()
        result = converter.convert(source)
        assert result is not None

        output = result["frontmatter_str"] + "\n" + result["body"]

        # Model preserved
        assert "model: sonnet" in output

        # Tools: only non-MCP tools
        assert "  bash: true" in output
        assert "  glob: true" in output
        assert "  grep: true" in output
        assert "  read: true" in output
        assert "mcp__sentry" not in output
        assert "chrome-devtools" not in output

        # Color mapped
        assert "color: warning" in output  # orange -> warning

        # Multiline description preserved
        assert "description: |" in output

        # Body preserved
        assert "# Sentry Investigator" in output
        assert "## Capabilities" in output
        assert "- Issue querying" in output
        assert "## Bridged From" in output

    def test_agent_with_type_coordinator(self, tmp_path):
        """Agent with type=coordinator maps to mode=primary."""
        source = tmp_path / "coord.md"
        source.write_text(textwrap.dedent("""\
            ---
            name: orchestrator
            type: coordinator
            description: Orchestrates multi-agent workflows
            ---

            # Orchestrator
        """))
        converter = AgentConverter()
        result = converter.convert(source)
        assert result is not None
        assert "mode: primary" in result["frontmatter_str"]

    def test_idempotent_bridged_note(self, tmp_path):
        """Running convert twice doesn't duplicate the bridged note."""
        source = tmp_path / "agent.md"
        source.write_text(textwrap.dedent("""\
            ---
            name: test
            description: Test agent
            ---

            # Test Agent

            Content here.
        """))

        converter = AgentConverter()
        result1 = converter.convert(source)
        assert result1 is not None

        # Write result back as if it were a second source
        source2 = tmp_path / "agent2.md"
        source2.write_text(result1["frontmatter_str"] + "\n" + result1["body"])

        converter2 = AgentConverter()
        result2 = converter2.convert(source2)
        assert result2 is not None
        assert result2["body"].count("Bridged From") == 1

    def test_nonexistent_source(self, tmp_path):
        """Convert returns None for missing source file."""
        source = tmp_path / "does_not_exist.md"
        converter = AgentConverter()
        result = converter.convert(source)
        assert result is None
        assert any("not found" in w for w in converter.warnings)

    def test_output_is_valid_markdown(self, tmp_path):
        """Output starts with --- and has proper structure."""
        source = tmp_path / "valid.md"
        source.write_text("---\nname: test\ndescription: A test\n---\n\n# Test\n")
        converter = AgentConverter()
        result = converter.convert(source)
        assert result is not None
        output = result["frontmatter_str"] + "\n" + result["body"]
        assert output.startswith("---\n")
        parts = output.split("---")
        assert len(parts) >= 3  # before, frontmatter, after


# ═══════════════════════════════════════════════════════════════════════════
# Full pipeline integration test
# ═══════════════════════════════════════════════════════════════════════════


class TestFullPipeline:
    """Integration test: inventory CSV -> conversion -> output files -> log."""

    def test_pipeline(self, tmp_path):
        """Simulate the full conversion pipeline with a small inventory."""
        # Set up project structure
        agents_dir = tmp_path / ".claude" / "agents"
        agents_dir.mkdir(parents=True)
        sub_dir = agents_dir / "design"
        sub_dir.mkdir()

        # Create source agents
        (agents_dir / "coder.md").write_text(textwrap.dedent("""\
            ---
            name: coder
            description: Implementation specialist
            color: green
            ---

            # Coder

            Writes clean code.
        """))

        (sub_dir / "ui-designer.md").write_text(textwrap.dedent("""\
            ---
            name: ui-designer
            description: Expert visual designer
            color: purple
            tools: Read, Write, Edit, Bash, Glob, Grep
            ---

            # UI Designer

            Creates beautiful interfaces.
        """))

        (agents_dir / "missing-ref.md")  # referenced but doesn't exist

        # Create inventory CSV
        inventory = tmp_path / "inventory.csv"
        inventory.write_text(
            "path,category,bucket,target_name,rationale\n"
            ".claude/agents/coder.md,core,A,,Standard\n"
            ".claude/agents/design/ui-designer.md,design,A,,Standard\n"
            ".claude/agents/not-here.md,core,A,,Will be missing\n"
            ".claude/agents/skipped.md,core,B,,Not Bucket A\n"
        )

        # Create target directory
        target_dir = tmp_path / ".opencode" / "agent"
        target_dir.mkdir(parents=True)

        # Run conversions
        agent_paths = load_bucket_a_agents(str(inventory))
        assert len(agent_paths) == 3  # 3 Bucket A entries

        converter = AgentConverter()
        records = []
        failed = []
        skipped_missing = []

        for rel_path in agent_paths:
            source_path = tmp_path / rel_path
            target_name = derive_target_name(rel_path)
            target_path = target_dir / target_name

            if not source_path.exists():
                skipped_missing.append(rel_path)
                continue

            converter.warnings = []
            result = converter.convert(source_path)
            if result:
                output = result["frontmatter_str"] + "\n" + result["body"]
                target_path.write_text(output, encoding="utf-8")
                records.append({
                    "source": rel_path,
                    "target": f".opencode/agent/{target_name}",
                    "warnings": list(converter.warnings),
                })

        # Verify counts
        assert len(records) == 2
        assert len(skipped_missing) == 1
        assert ".claude/agents/not-here.md" in skipped_missing

        # Verify output files exist
        assert (target_dir / "coder.md").exists()
        assert (target_dir / "ui-designer.md").exists()

        # Verify coder output
        coder_output = (target_dir / "coder.md").read_text()
        assert "mode: subagent" in coder_output
        assert "model: zai/glm-5.1" in coder_output
        assert "color: success" in coder_output  # green -> success
        assert "## Bridged From" in coder_output

        # Verify ui-designer output
        designer_output = (target_dir / "ui-designer.md").read_text()
        assert "mode: subagent" in designer_output
        assert "color: accent" in designer_output  # purple -> accent
        assert "  bash: true" in designer_output
        assert "  edit: true" in designer_output
        assert "  glob: true" in designer_output
        assert "  grep: true" in designer_output
        assert "  read: true" in designer_output
        assert "  write: true" in designer_output

        # Verify log generation
        log = generate_log(records, failed, skipped_missing, dry_run=False)
        assert "Total converted: 2" in log
        assert "Missing source files: 1" in log


# ═══════════════════════════════════════════════════════════════════════════
# Constants sanity checks
# ═══════════════════════════════════════════════════════════════════════════


class TestConstants:
    """Sanity checks for mapping constants."""

    def test_color_map_values_are_valid_themes(self):
        for name, theme in COLOR_NAME_MAP.items():
            assert theme in VALID_THEME_COLORS, f"{name} maps to invalid theme {theme}"

    def test_tool_map_keys_lowercase(self):
        for key in TOOL_NAME_MAP:
            assert key == key.lower(), f"Tool key {key} should be lowercase"

    def test_type_map_keys_lowercase(self):
        for key in TYPE_TO_MODE:
            assert key == key.lower(), f"Type key {key} should be lowercase"

    def test_hex_regex(self):
        assert HEX_COLOR_RE.match("#FF0000")
        assert HEX_COLOR_RE.match("#aabbcc")
        assert not HEX_COLOR_RE.match("#FFF")
        assert not HEX_COLOR_RE.match("FF0000")
        assert not HEX_COLOR_RE.match("#GGHHII")
