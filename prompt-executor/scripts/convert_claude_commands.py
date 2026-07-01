#!/usr/bin/env python3
"""Convert Claude .claude/commands/ to OpenCode .opencode/command/ format.

Only migrates commands that:
- Do NOT reference mcp__claude-flow, mcp__ruv-swarm, mcp__flow-nexus
- Do NOT invoke claude-flow CLI or other unavailable tools
- Can achieve their purpose with standard OpenCode tools

Usage:
    python convert_claude_commands.py [--dry-run] [--source DIR] [--target DIR]
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


BLOCKED_PATTERNS = [
    re.compile(r"mcp__claude[-_]flow", re.IGNORECASE),
    re.compile(r"mcp__ruv[-_]swarm", re.IGNORECASE),
    re.compile(r"mcp__flow[-_]nexus", re.IGNORECASE),
    re.compile(r"\bclaude[-_]flow\b", re.IGNORECASE),
    re.compile(r"\bruv[-_]swarm\b", re.IGNORECASE),
    re.compile(r"\bflow[-_]nexus\b", re.IGNORECASE),
    re.compile(r"\bagent_spawn\b"),
    re.compile(r"\bTaskCreate\b"),
    re.compile(r"\bTaskList\b"),
    re.compile(r"\bTaskUpdate\b"),
    re.compile(r"\bmemory_usage\b"),
    re.compile(r"\bneural_network\b"),
    re.compile(r"\bswarm_init\b"),
    re.compile(r"\bswarm_monitor\b"),
]

CLAUDE_ONLY_FM_KEYS = {
    "allowed-tools",
    "argument-hint",
    "tools",
    "handoffs",
}

SKIP_SUBDIRS = {
    "swarm",
    "hive-mind",
    "sparc",
    "coordination",
    "flow-nexus",
    "optimization",
    "training",
    "memory",
    "monitoring",
    "stream-chain",
    "hooks",
    "agents",
    "analysis",
    "automation",
    "github",
    "pair",
    "truth",
    "verify",
    "workflows",
}

MIGRATABLE_ROOT_FILES = {
    "speckit.analyze.md",
    "speckit.checklist.md",
    "speckit.clarify.md",
    "speckit.constitution.md",
    "speckit.implement.md",
    "speckit.plan.md",
    "speckit.specify.md",
    "speckit.tasks.md",
    "speckit.taskstoissues.md",
}

AGENT_MAP = {
    "speckit.constitution": "plan",
    "speckit.specify": "plan",
    "speckit.clarify": "plan",
    "speckit.plan": "plan",
    "speckit.tasks": "plan",
    "speckit.analyze": "plan",
    "speckit.checklist": "plan",
    "speckit.implement": "build",
    "speckit.taskstoissues": "general",
}

FLASH_COMMANDS: set[str] = set()

DEFAULT_MODEL = "zai/glm-5.1"
FLASH_MODEL = "zai/glm-4.7-flash"


@dataclass
class ConversionResult:
    source: str
    target: str | None = None
    migrated: bool = False
    reason: str = ""
    warnings: list[str] = field(default_factory=list)


def parse_frontmatter(content: str) -> tuple[dict[str, object], str, str]:
    """Parse YAML frontmatter from markdown content.

    Returns (metadata_dict, frontmatter_raw, body).
    """
    if not content.startswith("---"):
        return {}, "", content

    end = content.find("---", 3)
    if end == -1:
        return {}, "", content

    fm_raw = content[3:end].strip()
    body = content[end + 3 :]
    if body.startswith("\n"):
        body = body[1:]

    metadata: dict[str, object] = {}
    for line in fm_raw.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        colon = line.find(":")
        if colon == -1:
            continue
        key = line[:colon].strip()
        value = line[colon + 1 :].strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            if inner:
                items = [i.strip().strip("'\"") for i in inner.split(",")]
                metadata[key] = items
            else:
                metadata[key] = []
        elif value.lower() in ("true", "false"):
            metadata[key] = value.lower() == "true"
        else:
            metadata[key] = value.strip("'\"")

    return metadata, fm_raw, body


def build_opencode_frontmatter(
    metadata: dict[str, object],
    command_name: str,
    warnings: list[str],
) -> str:
    """Build OpenCode-format YAML frontmatter."""
    lines = ["---"]

    description = metadata.get("description", "")
    if isinstance(description, str) and description:
        lines.append(f"description: {description}")
    else:
        lines.append(f"description: {command_name} command")
        warnings.append("no description found, using command name as fallback")

    agent = AGENT_MAP.get(command_name, "general")
    lines.append(f"agent: {agent}")

    model = FLASH_MODEL if command_name in FLASH_COMMANDS else DEFAULT_MODEL
    lines.append(f"model: {model}")

    lines.append("subtask: false")
    lines.append("---")

    for key in CLAUDE_ONLY_FM_KEYS:
        if key in metadata:
            warnings.append(f"dropped Claude-only frontmatter key: {key}")

    return "\n".join(lines)


def has_blocked_content(content: str) -> str | None:
    """Check if content references blocked tools/CLI commands."""
    for pat in BLOCKED_PATTERNS:
        if pat.search(content):
            return f"matches blocked pattern: {pat.pattern}"
    return None


def convert_command(
    source: Path,
    target: Path | None = None,
) -> ConversionResult:
    """Convert a single Claude command file to OpenCode format."""
    result = ConversionResult(source=str(source))
    warnings: list[str] = []

    try:
        content = source.read_text(encoding="utf-8")
    except Exception as e:
        result.reason = f"failed to read: {e}"
        return result

    blocked = has_blocked_content(content)
    if blocked:
        result.reason = blocked
        return result

    metadata, _, body = parse_frontmatter(content)

    command_name = source.stem

    fm_out = build_opencode_frontmatter(metadata, command_name, warnings)

    if target is None:
        target = source.parent / "converted" / source.name

    output = f"{fm_out}\n\n{body.rstrip()}\n"

    result.target = str(target)
    result.migrated = True
    result.reason = "migrated successfully"
    result.warnings = warnings

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(output, encoding="utf-8")

    return result


def audit_source_dir(source_dir: Path) -> tuple[list[Path], list[tuple[Path, str]]]:
    """Audit all .md files in source directory.

    Returns (migratable_files, skipped_files_with_reasons).
    """
    migratable: list[Path] = []
    skipped: list[tuple[Path, str]] = []

    for f in sorted(source_dir.rglob("*.md")):
        rel = f.relative_to(source_dir)
        parts = rel.parts

        if f.name == "README.md":
            skipped.append((f, "README index file, not a command"))
            continue

        if len(parts) > 1 and parts[0] in SKIP_SUBDIRS:
            skipped.append((f, f"directory '{parts[0]}' — claude-flow ecosystem"))
            continue

        if f.name in MIGRATABLE_ROOT_FILES:
            blocked = has_blocked_content(f.read_text(encoding="utf-8"))
            if blocked:
                skipped.append((f, blocked))
            else:
                migratable.append(f)
            continue

        if len(parts) == 2 and parts[0] == "speckit" and f.name != "README.md":
            root_equiv = source_dir / f"speckit.{f.name}"
            if root_equiv.exists():
                skipped.append((f, f"duplicate of root-level speckit.{f.name}"))
            else:
                migratable.append(f)
            continue

        try:
            content = f.read_text(encoding="utf-8")
            blocked = has_blocked_content(content)
            if blocked:
                skipped.append((f, blocked))
            else:
                skipped.append((f, "not in migratable set"))
        except Exception as e:
            skipped.append((f, f"read error: {e}"))

    return migratable, skipped


def generate_migration_log(
    results: list[ConversionResult],
    skipped: list[tuple[Path, str]],
    source_dir: Path,
    target_dir: Path,
) -> str:
    """Generate migration log markdown."""
    lines = [
        "# Commands Migration Log",
        "",
        f"**Generated**: {datetime.now().isoformat()}",
        f"**Source**: `{source_dir}`",
        f"**Target**: `{target_dir}`",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Total source commands | {len(results) + len(skipped)} |",
        f"| Migrated | {sum(1 for r in results if r.migrated)} |",
        f"| Skipped | {len(skipped)} |",
        "",
    ]

    migrated = [r for r in results if r.migrated]
    if migrated:
        lines.append("## Migrated Commands")
        lines.append("")
        lines.append("| Source | Target | Agent | Warnings |")
        lines.append("|--------|--------|-------|----------|")
        for r in migrated:
            src_name = Path(r.source).name
            tgt_name = Path(r.target).name if r.target else "N/A"
            cmd_name = Path(r.source).stem
            agent = AGENT_MAP.get(cmd_name, "general")
            warns = "; ".join(r.warnings) if r.warnings else "—"
            lines.append(f"| `{src_name}` | `{tgt_name}` | {agent} | {warns} |")
        lines.append("")

    if skipped:
        lines.append("## Skipped Commands")
        lines.append("")
        lines.append("| Source | Reason |")
        lines.append("|--------|--------|")
        for path, reason in sorted(skipped, key=lambda x: str(x[0])):
            try:
                src_rel = str(path.relative_to(source_dir))
            except ValueError:
                src_rel = path.name
            lines.append(f"| `{src_rel}` | {reason} |")
        lines.append("")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert Claude commands to OpenCode format"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be converted without writing files",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(".claude/commands"),
        help="Source directory containing Claude commands",
    )
    parser.add_argument(
        "--target",
        type=Path,
        default=Path(".opencode/command"),
        help="Target directory for OpenCode commands",
    )
    parser.add_argument(
        "--log",
        type=Path,
        default=Path("docs/internal/commands-migration-log.md"),
        help="Path to write migration log markdown",
    )
    args = parser.parse_args()

    source_dir = args.source.resolve()
    target_dir = args.target.resolve()

    if not source_dir.is_dir():
        print(f"Error: source directory not found: {source_dir}", file=sys.stderr)
        sys.exit(1)

    migratable_files, skipped = audit_source_dir(source_dir)

    print(f"Audit: {len(migratable_files)} migratable, {len(skipped)} skipped")

    results: list[ConversionResult] = []
    for src in migratable_files:
        target_file = target_dir / src.name
        if args.dry_run:
            content = src.read_text(encoding="utf-8")
            metadata, _, body = parse_frontmatter(content)
            warnings: list[str] = []
            command_name = src.stem
            build_opencode_frontmatter(metadata, command_name, warnings)
            result = ConversionResult(
                source=str(src),
                target=str(target_file),
                migrated=True,
                reason="dry-run: would migrate",
                warnings=warnings,
            )
            results.append(result)
            print(f"  [DRY-RUN] {src.name} -> {target_file.name}")
        else:
            result = convert_command(src, target_file)
            results.append(result)
            status = "OK" if result.migrated else "SKIP"
            print(f"  [{status}] {src.name} -> {target_file.name}: {result.reason}")

    total = len(results) + len(skipped)
    migrated_count = sum(1 for r in results if r.migrated)
    print(f"\nTotal: {total}, Migrated: {migrated_count}, Skipped: {len(skipped)}")

    log_content = generate_migration_log(results, skipped, source_dir, target_dir)
    if args.dry_run:
        print(f"\n[DRY-RUN] Would write migration log to: {args.log}")
        print(
            f"  Log would contain {migrated_count} migrated + {len(skipped)} skipped entries"
        )
    else:
        args.log.parent.mkdir(parents=True, exist_ok=True)
        args.log.write_text(log_content, encoding="utf-8")
        print(f"Migration log written to: {args.log}")

    if migrated_count + len(skipped) != total:
        print(
            f"WARNING: count mismatch — migrated({migrated_count}) + skipped({len(skipped)}) "
            f"!= total({total})",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
