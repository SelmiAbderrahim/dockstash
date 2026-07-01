"""Tests for convert_claude_commands.py"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from convert_claude_commands import (
    parse_frontmatter,
    build_opencode_frontmatter,
    has_blocked_content,
    convert_command,
    audit_source_dir,
    MIGRATABLE_ROOT_FILES,
    CLAUDE_ONLY_FM_KEYS,
    DEFAULT_MODEL,
    FLASH_MODEL,
)


class TestParseFrontmatter:
    def test_simple_frontmatter(self):
        content = "---\ndescription: Do a thing\n---\nRun $ARGUMENTS"
        meta, fm_raw, body = parse_frontmatter(content)
        assert meta["description"] == "Do a thing"
        assert "Run $ARGUMENTS" in body

    def test_no_frontmatter(self):
        content = "# Just a title\nSome body text"
        meta, fm_raw, body = parse_frontmatter(content)
        assert meta == {}
        assert "Just a title" in body

    def test_frontmatter_with_boolean(self):
        content = "---\ndescription: Test\nsubtask: true\n---\nBody"
        meta, _, body = parse_frontmatter(content)
        assert meta["subtask"] is True

    def test_frontmatter_with_list(self):
        content = "---\ndescription: Test\ntools: ['bash', 'read']\n---\nBody"
        meta, _, _ = parse_frontmatter(content)
        assert meta["tools"] == ["bash", "read"]

    def test_frontmatter_with_handoffs(self):
        content = "---\ndescription: Test\nhandoffs:\n  - label: Build\n---\nBody"
        meta, _, _ = parse_frontmatter(content)
        assert "handoffs" in meta

    def test_empty_frontmatter(self):
        content = "---\n---\nBody text"
        meta, _, body = parse_frontmatter(content)
        assert meta == {}
        assert "Body text" in body


class TestBuildOpencodeFrontmatter:
    def test_basic_frontmatter(self):
        meta = {"description": "Do a thing"}
        warnings: list[str] = []
        fm = build_opencode_frontmatter(meta, "test-cmd", warnings)
        assert "description: Do a thing" in fm
        assert "agent: general" in fm
        assert f"model: {DEFAULT_MODEL}" in fm
        assert "subtask: false" in fm
        assert not warnings

    def test_no_description_uses_command_name(self):
        meta: dict = {}
        warnings: list[str] = []
        fm = build_opencode_frontmatter(meta, "my-cmd", warnings)
        assert "description: my-cmd command" in fm
        assert any("no description" in w for w in warnings)

    def test_speckit_agent_mapping(self):
        meta = {"description": "Test"}
        warnings: list[str] = []
        fm = build_opencode_frontmatter(meta, "speckit.constitution", warnings)
        assert "agent: plan" in fm

    def test_claude_only_keys_dropped_with_warning(self):
        meta = {
            "description": "Test",
            "allowed-tools": ["Bash", "Read"],
            "argument-hint": "something",
        }
        warnings: list[str] = []
        fm = build_opencode_frontmatter(meta, "test", warnings)
        assert "allowed-tools" not in fm
        assert "argument-hint" not in fm
        assert len(warnings) == 2

    def test_handoffs_dropped_with_warning(self):
        meta = {
            "description": "Test",
            "handoffs": "some handoff",
        }
        warnings: list[str] = []
        fm = build_opencode_frontmatter(meta, "test", warnings)
        assert "handoffs" not in fm
        assert any("handoffs" in w for w in warnings)


class TestHasBlockedContent:
    def test_clean_content(self):
        assert has_blocked_content("Just some normal text") is None

    def test_claude_flow_mcp(self):
        assert has_blocked_content("Use mcp__claude-flow__agent_spawn") is not None

    def test_claude_flow_cli(self):
        assert has_blocked_content("Run claude-flow swarm init") is not None

    def test_ruv_swarm(self):
        assert has_blocked_content("mcp__ruv-swarm__agent_create") is not None

    def test_flow_nexus(self):
        assert has_blocked_content("mcp__flow-nexus__payment") is not None

    def test_TaskCreate(self):
        assert has_blocked_content("Use TaskCreate to create") is not None

    def test_case_insensitive(self):
        assert has_blocked_content("Use Claude-Flow here") is not None


class TestConvertCommand:
    def test_simple_command_converts(self, tmp_path: Path):
        src = tmp_path / "src.md"
        src.write_text("---\ndescription: Do a thing\n---\nRun $ARGUMENTS")
        out = tmp_path / "out.md"
        result = convert_command(src, out)

        assert result.migrated
        content = out.read_text()
        assert "description: Do a thing" in content
        assert f"model: {DEFAULT_MODEL}" in content
        assert "Run $ARGUMENTS" in content
        assert "agent:" in content
        assert "subtask: false" in content

    def test_claude_flow_command_is_skipped(self, tmp_path: Path):
        src = tmp_path / "blocked.md"
        src.write_text("Use mcp__claude-flow__agent_spawn to do stuff")
        out = tmp_path / "out.md"
        result = convert_command(src, out)

        assert not result.migrated
        assert "blocked" in result.reason.lower()
        assert not out.exists()

    def test_body_preserved(self, tmp_path: Path):
        src = tmp_path / "src.md"
        body = "## Step 1\nDo something\n\n## Step 2\n$ARGUMENTS\n"
        src.write_text(f"---\ndescription: Test\n---\n{body}")
        out = tmp_path / "out.md"
        convert_command(src, out)

        content = out.read_text()
        assert "## Step 1" in content
        assert "Do something" in content
        assert "$ARGUMENTS" in content

    def test_allowed_tools_stripped(self, tmp_path: Path):
        src = tmp_path / "src.md"
        src.write_text(
            "---\ndescription: Test\nallowed-tools: ['Bash', 'Read']\n---\nBody"
        )
        out = tmp_path / "out.md"
        result = convert_command(src, out)

        content = out.read_text()
        assert "allowed-tools" not in content
        assert any("allowed-tools" in w for w in result.warnings)

    def test_subtask_default_false(self, tmp_path: Path):
        src = tmp_path / "src.md"
        src.write_text("---\ndescription: Test\n---\nBody")
        out = tmp_path / "out.md"
        convert_command(src, out)

        content = out.read_text()
        assert "subtask: false" in content

    def test_idempotent(self, tmp_path: Path):
        src = tmp_path / "src.md"
        src.write_text("---\ndescription: Test\n---\nBody text here")
        out = tmp_path / "out.md"

        r1 = convert_command(src, out)
        content1 = out.read_text()

        r2 = convert_command(src, out)
        content2 = out.read_text()

        assert r1.migrated
        assert r2.migrated
        assert content1 == content2

    def test_handoffs_stripped(self, tmp_path: Path):
        src = tmp_path / "src.md"
        src.write_text(
            "---\ndescription: Test\nhandoffs:\n  - label: Build\n    agent: test\n---\nBody"
        )
        out = tmp_path / "out.md"
        result = convert_command(src, out)

        content = out.read_text()
        assert "handoffs" not in content
        assert any("handoffs" in w for w in result.warnings)


class TestDryRun:
    def test_dry_run_no_files_written(self, tmp_path: Path):
        import subprocess
        import sys

        src_dir = tmp_path / "commands"
        src_dir.mkdir()
        (src_dir / "speckit.test.md").write_text(
            "---\ndescription: A test command\n---\nBody $ARGUMENTS"
        )

        target_dir = tmp_path / "output"
        target_dir.mkdir()

        result = subprocess.run(
            [
                sys.executable,
                "scripts/convert_claude_commands.py",
                "--dry-run",
                "--source",
                str(src_dir),
                "--target",
                str(target_dir),
                "--log",
                str(tmp_path / "log.md"),
            ],
            capture_output=True,
            text=True,
            cwd=str(Path(__file__).parent.parent),
        )

        assert result.returncode == 0
        assert not list(target_dir.glob("*.md"))


class TestAuditSourceDir:
    def test_all_speckit_root_files_migratable(self, tmp_path: Path):
        cmd_dir = tmp_path / "commands"
        cmd_dir.mkdir()
        for name in MIGRATABLE_ROOT_FILES:
            (cmd_dir / name).write_text(f"---\ndescription: {name} command\n---\nBody")

        migratable, skipped = audit_source_dir(cmd_dir)
        assert len(migratable) == len(MIGRATABLE_ROOT_FILES)

    def test_skip_swarm_dir(self, tmp_path: Path):
        cmd_dir = tmp_path / "commands"
        swarm_dir = cmd_dir / "swarm"
        swarm_dir.mkdir(parents=True)
        (swarm_dir / "init.md").write_text("Some swarm command")

        migratable, skipped = audit_source_dir(cmd_dir)
        assert len(migratable) == 0
        assert any("swarm" in str(p) for p, _ in skipped)

    def test_skip_readme(self, tmp_path: Path):
        cmd_dir = tmp_path / "commands"
        cmd_dir.mkdir()
        (cmd_dir / "README.md").write_text("# Commands")

        migratable, skipped = audit_source_dir(cmd_dir)
        assert len(migratable) == 0
        assert any("README" in str(p) for p, _ in skipped)

    def test_skip_duplicate_speckit(self, tmp_path: Path):
        cmd_dir = tmp_path / "commands"
        speckit_dir = cmd_dir / "speckit"
        speckit_dir.mkdir(parents=True)
        (cmd_dir / "speckit.analyze.md").write_text(
            "---\ndescription: Analyze\n---\nBody"
        )
        (speckit_dir / "analyze.md").write_text("Old analyze command")

        migratable, skipped = audit_source_dir(cmd_dir)
        assert len(migratable) == 1
        assert migratable[0].name == "speckit.analyze.md"
        assert any("duplicate" in r for _, r in skipped)
