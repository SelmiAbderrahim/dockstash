#!/usr/bin/env python3
"""
Convert Claude Code agents (.claude/agents/*.md) to OpenCode agent format (.opencode/agent/*.md).

Reads the agent inventory CSV, filters Bucket A agents, transforms YAML frontmatter
to OpenCode schema, and writes output files. Body markdown is preserved verbatim.

Usage:
  python convert_claude_agents.py [--dry-run] [--verbose] [--inventory PATH]
"""

import argparse
import csv
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Valid OpenCode theme color names
VALID_THEME_COLORS: Set[str] = {
    "primary", "secondary", "accent", "success", "warning", "error", "info",
}

# Hex color regex (#RRGGBB)
HEX_COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')

# Named color -> closest theme color mapping
COLOR_NAME_MAP: Dict[str, str] = {
    "red": "error",
    "green": "success",
    "blue": "info",
    "yellow": "warning",
    "orange": "warning",
    "amber": "warning",
    "purple": "accent",
    "violet": "accent",
    "indigo": "accent",
    "fuchsia": "accent",
    "pink": "accent",
    "rose": "accent",
    "teal": "info",
    "cyan": "info",
    "lime": "success",
    "gold": "warning",
    "gray": "secondary",
    "grey": "secondary",
}

# OpenCode tool names (lowercase) that map from Claude tool names
TOOL_NAME_MAP: Dict[str, str] = {
    "read": "read",
    "write": "write",
    "edit": "edit",
    "bash": "bash",
    "glob": "glob",
    "grep": "grep",
    "webfetch": "webfetch",
    "websearch": "websearch",
    "agent": "agent",
    "todowrite": "todowrite",
    "notebookedit": "notebookedit",
}

# Type -> mode mapping
TYPE_TO_MODE: Dict[str, str] = {
    "specialist": "subagent",
    "specialized": "subagent",
    "coordinator": "primary",
    "general": "all",
    "developer": "subagent",
    "development": "subagent",
    "tester": "subagent",
    "validator": "subagent",
    "devops": "subagent",
    "architecture": "subagent",
    "analysis": "subagent",
    "data": "subagent",
    "documentation": "subagent",
    "structure_note": "subagent",
}


# ---------------------------------------------------------------------------
# Minimal YAML frontmatter parser (stdlib-only)
# ---------------------------------------------------------------------------

class FrontmatterParser:
    """Parse YAML frontmatter from markdown files without PyYAML."""

    @staticmethod
    def parse(content: str) -> Tuple[Dict[str, Any], str]:
        """
        Extract YAML frontmatter and body from markdown content.

        Returns (frontmatter_dict, body_content).
        """
        if not content.startswith('---'):
            return {}, content

        lines = content.split('\n')
        end_idx = None

        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                end_idx = i
                break

        if end_idx is None:
            return {}, content

        fm_lines = lines[1:end_idx]
        body = '\n'.join(lines[end_idx + 1:])

        frontmatter: Dict[str, Any] = {}
        current_key: Optional[str] = None
        current_lines: List[str] = []

        for line in fm_lines:
            # New key: value pair (not indented, contains colon)
            if ':' in line and not line.startswith((' ', '\t')):
                # Flush previous
                if current_key is not None:
                    frontmatter[current_key] = FrontmatterParser._process_value(
                        '\n'.join(current_lines)
                    )
                key, _, value = line.partition(':')
                current_key = key.strip()
                current_lines = [value.strip()]
            elif current_key is not None:
                # Continuation line
                current_lines.append(line)

        # Flush last
        if current_key is not None:
            frontmatter[current_key] = FrontmatterParser._process_value(
                '\n'.join(current_lines)
            )

        return frontmatter, body

    @staticmethod
    def _process_value(raw: str) -> Any:
        """Convert raw YAML value to Python type."""
        # Check for multiline (pipe or folded)
        lines = raw.split('\n')
        first = lines[0].strip()

        if first in ('|', '>'):
            # Multiline block - join continuation lines
            continuation = '\n'.join(
                line.lstrip() if line.strip() else ''
                for line in lines[1:]
            )
            return continuation.strip()

        # Single-line value
        val = raw.strip()

        # Strip quotes
        if (val.startswith('"') and val.endswith('"')) or \
           (val.startswith("'") and val.endswith("'")):
            return val[1:-1]

        # Boolean
        if val.lower() in ('true', 'yes'):
            return True
        if val.lower() in ('false', 'no'):
            return False

        # Null
        if val.lower() in ('null', '~', ''):
            return None

        # Number
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except ValueError:
            pass

        return val


# ---------------------------------------------------------------------------
# Agent Converter
# ---------------------------------------------------------------------------

class AgentConverter:
    """Convert a Claude Code agent file to OpenCode format."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.warnings: List[str] = []

    def convert(self, source_path: Path) -> Optional[Dict[str, Any]]:
        """
        Convert a single agent file.

        Returns dict with 'frontmatter_str' and 'body' keys, or None on error.
        """
        if not source_path.exists():
            self.warnings.append(f"Source not found: {source_path}")
            return None

        try:
            content = source_path.read_text(encoding='utf-8')
        except Exception as e:
            self.warnings.append(f"Read error {source_path}: {e}")
            return None

        frontmatter, body = FrontmatterParser.parse(content)

        if self.verbose:
            print(f"  Parsed keys: {list(frontmatter.keys())}")

        new_fm = self._transform(frontmatter, source_path)
        body = self._ensure_bridged_note(body, source_path)
        fm_str = self._serialize(new_fm)

        return {'frontmatter_str': fm_str, 'body': body}

    def _transform(self, fm: Dict[str, Any], source_path: Path) -> Dict[str, Any]:
        """Transform Claude frontmatter to OpenCode format."""
        result: Dict[str, Any] = {}

        # mode (from type field, default subagent)
        if 'type' in fm and fm['type']:
            type_val = str(fm['type']).strip().strip('"\'').lower()
            result['mode'] = TYPE_TO_MODE.get(type_val, 'subagent')
        else:
            result['mode'] = 'subagent'

        # description
        if 'description' in fm and fm['description']:
            result['description'] = str(fm['description']).strip()

        # model (preserve existing or default)
        if 'model' in fm and fm['model']:
            result['model'] = str(fm['model']).strip()
        else:
            result['model'] = 'zai/glm-5.1'

        # temperature
        result['temperature'] = 0.2

        # color (validate: hex or theme name)
        if 'color' in fm and fm['color']:
            color = self._normalize_color(str(fm['color']).strip().strip('"\''))
            if color:
                result['color'] = color

        # tools (parse capabilities or tools string)
        tools_source = fm.get('capabilities') or fm.get('tools')
        tools_map = self._parse_tools(tools_source)
        result['tools'] = tools_map

        # permission
        result['permission'] = {'edit': 'allow', 'bash': 'allow'}

        # hidden
        if 'hidden' in fm:
            result['hidden'] = bool(fm['hidden'])

        # Log dropped fields
        for field in ('name', 'priority', 'hooks', 'handoffs'):
            if field in fm and fm[field] is not None:
                self.warnings.append(f"  Dropped '{field}' from {source_path.name}")

        return result

    def _normalize_color(self, color: str) -> Optional[str]:
        """Validate and normalize color to OpenCode format."""
        # Already a valid hex
        if HEX_COLOR_RE.match(color):
            return color

        # Already a valid theme name
        if color.lower() in VALID_THEME_COLORS:
            return color.lower()

        # Map named color to theme color
        mapped = COLOR_NAME_MAP.get(color.lower())
        if mapped:
            return mapped

        # Exotic names (neon-green, metallic-blue, etc.) - drop
        self.warnings.append(f"  Dropped unsupported color '{color}'")
        return None

    def _parse_tools(self, tools_value: Any) -> Dict[str, bool]:
        """Parse tools from various source formats into bool map."""
        if not tools_value:
            return {'bash': True, 'read': True, 'edit': True, 'write': True,
                    'grep': True, 'glob': True}

        if isinstance(tools_value, str):
            # Check for "All tools" or "*" meaning all defaults
            if tools_value.strip().lower() in ('all tools', 'all', '*'):
                return {'bash': True, 'read': True, 'edit': True, 'write': True,
                        'grep': True, 'glob': True}
            # Comma-separated string like "Read, Write, Edit, Bash, Glob, Grep"
            parts = [t.strip() for t in tools_value.split(',') if t.strip()]
        elif isinstance(tools_value, list):
            parts = [str(t).strip() for t in tools_value if t]
        else:
            return {'bash': True, 'read': True, 'edit': True, 'write': True,
                    'grep': True, 'glob': True}

        result: Dict[str, bool] = {}
        for part in parts:
            lower = part.lower()
            # Map known tools
            mapped = TOOL_NAME_MAP.get(lower)
            if mapped:
                result[mapped] = True
            elif lower.startswith('mcp__') or lower.startswith('mcp_'):
                # MCP tools - skip (not available in OpenCode)
                pass
            elif lower in ('chrome-devtools-mcp', 'chrome-devtools'):
                # Skip browser MCP tools
                pass
            else:
                # Unknown tool, include as-is lowercased
                result[lower] = True

        # Ensure at least read is available
        if not result:
            return {'bash': True, 'read': True, 'edit': True, 'write': True,
                    'grep': True, 'glob': True}

        return result

    def _ensure_bridged_note(self, body: str, source_path: Path) -> str:
        """Add 'Bridged From' note to body if not already present."""
        if 'Bridged From' in body or 'bridged from' in body.lower():
            return body

        relative_path = source_path
        # Try to make path relative to project root
        try:
            project_root = Path(__file__).parent.parent.parent
            relative_path = source_path.relative_to(project_root)
        except (ValueError, RuntimeError):
            pass

        note = (
            f"\n\n## Bridged From\n\n"
            f"This agent was bridged from `{relative_path}` during the "
            f"Claude \u2192 OpenCode migration.\n"
        )

        # Insert after first heading if possible
        lines = body.split('\n')
        insert_idx = None
        for i, line in enumerate(lines):
            if line.startswith('# '):
                # Find the end of the heading block (next empty line or next heading)
                for j in range(i + 1, len(lines)):
                    if lines[j].strip() == '' or lines[j].startswith('#'):
                        insert_idx = j
                        break
                else:
                    insert_idx = len(lines)
                break

        if insert_idx is not None:
            lines.insert(insert_idx, note)
            return '\n'.join(lines)
        else:
            return body + note

    def _serialize(self, fm: Dict[str, Any]) -> str:
        """Serialize frontmatter dict to YAML string (with delimiters)."""
        lines = ['---']

        # Ordered fields
        field_order = ['mode', 'description', 'model', 'temperature', 'color',
                       'hidden', 'tools', 'permission']

        for field in field_order:
            if field not in fm:
                continue
            value = fm[field]

            if field == 'tools':
                lines.append('tools:')
                for tool_name, enabled in sorted(value.items()):
                    lines.append(f'  {tool_name}: {str(enabled).lower()}')
            elif field == 'permission':
                lines.append('permission:')
                for perm_name, perm_val in sorted(value.items()):
                    lines.append(f'  {perm_name}: {perm_val}')
            elif field == 'description':
                desc = str(value)
                if '\n' in desc:
                    lines.append('description: |')
                    for dline in desc.split('\n'):
                        lines.append(f'  {dline}')
                else:
                    lines.append(f'description: {desc}')
            elif isinstance(value, bool):
                lines.append(f'{field}: {str(value).lower()}')
            elif isinstance(value, (int, float)):
                lines.append(f'{field}: {value}')
            else:
                lines.append(f'{field}: {value}')

        lines.append('---')
        return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Inventory loader
# ---------------------------------------------------------------------------

def load_bucket_a_agents(inventory_path: str) -> List[str]:
    """
    Load Bucket A agent paths from the inventory CSV.

    CSV columns: path,category,bucket,target_name,rationale
    Returns list of paths (relative to project root) for bucket='A'.
    """
    agents: List[str] = []

    if not os.path.exists(inventory_path):
        print(f"Error: Inventory file not found: {inventory_path}")
        return agents

    with open(inventory_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            bucket = (row.get('bucket') or '').strip()
            path = (row.get('path') or '').strip()
            if bucket == 'A' and path:
                agents.append(path)

    return agents


def derive_target_name(source_path: str) -> str:
    """
    Derive target filename from source path.

    .claude/agents/design/ui-designer.md -> ui-designer.md
    .claude/agents/backend-i18n-developer.md -> backend-i18n-developer.md
    .claude/agents/analysis/code-review/analyze-code-quality.md -> analyze-code-quality.md
    """
    return Path(source_path).name


def _group_by_basename(agent_paths: List[str]) -> Dict[str, List[str]]:
    """Group agent paths by their base filename."""
    groups: Dict[str, List[str]] = {}
    for src in agent_paths:
        base = Path(src).name
        groups.setdefault(base, []).append(src)
    return groups


def build_target_map(agent_paths: List[str]) -> Dict[str, str]:
    """
    Build a mapping from source path to unique target filename.

    When multiple sources produce the same filename, prefix with the
    parent directory name to disambiguate.

    Example collision:
        .claude/agents/app-studio/builder-specialist.md -> appstudio-builder-specialist.md
        .claude/agents/websmith/builder-specialist.md   -> websmith-builder-specialist.md
    """
    groups = _group_by_basename(agent_paths)

    # Assign unique names
    target_map: Dict[str, str] = {}
    for base, sources in groups.items():
        if len(sources) == 1:
            target_map[sources[0]] = base
        else:
            # Collision: prefix with parent directory (sanitized)
            for src in sources:
                parts = Path(src).parts
                # Find the directory component right above the filename
                # .claude/agents/app-studio/builder-specialist.md -> "app-studio"
                # .claude/agents/prompt-engineer.md -> "agents" (root-level)
                if len(parts) >= 2:
                    parent = parts[-2]
                else:
                    parent = 'root'
                # Sanitize: remove hyphens for prefix, then re-add hyphen
                prefix = parent.replace('-', '')
                stem = Path(base).stem
                suffix = Path(base).suffix
                prefixed = f"{prefix}-{stem}{suffix}"
                target_map[src] = prefixed

    return target_map


# ---------------------------------------------------------------------------
# Conversion log
# ---------------------------------------------------------------------------

def generate_log(
    records: List[Dict[str, Any]],
    failed: List[Dict[str, str]],
    skipped_missing: List[str],
    dry_run: bool,
) -> str:
    """Generate markdown conversion log content."""
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    mode = 'DRY-RUN' if dry_run else 'LIVE'

    lines = [
        '# Agent Conversion Log',
        '',
        f'Generated: {now}',
        f'Mode: {mode}',
        f'Total converted: {len(records)}',
        f'Failed: {len(failed)}',
        f'Missing source files: {len(skipped_missing)}',
        '',
        '## Converted Agents',
        '',
        '| Source | Target | Warnings |',
        '|--------|--------|----------|',
    ]

    for rec in records:
        warnings = '; '.join(rec.get('warnings', [])) or 'none'
        lines.append(f"| `{rec['source']}` | `{rec['target']}` | {warnings} |")

    if failed:
        lines.append('')
        lines.append('## Failed Conversions')
        lines.append('')
        for item in failed:
            lines.append(f"- `{item['source']}`: {item['error']}")

    if skipped_missing:
        lines.append('')
        lines.append('## Missing Source Files')
        lines.append('')
        for path in skipped_missing:
            lines.append(f'- `{path}`')

    lines.append('')
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description='Convert Claude Code agents to OpenCode format'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview conversions without writing files')
    parser.add_argument('--verbose', action='store_true',
                        help='Verbose output')
    parser.add_argument('--inventory',
                        help='Path to agent inventory CSV file')

    args = parser.parse_args()

    # Resolve paths
    project_root = Path(__file__).resolve().parent.parent.parent
    inventory_path = args.inventory or str(project_root / 'docs' / 'internal' / 'agent-inventory.csv')
    target_dir = project_root / '.opencode' / 'agent'
    log_path = project_root / 'docs' / 'internal' / 'agent-conversion-log.md'

    if args.verbose:
        print(f"Project root: {project_root}")
        print(f"Inventory: {inventory_path}")
        print(f"Target dir: {target_dir}")
        print()

    # Load Bucket A agents
    agent_paths = load_bucket_a_agents(inventory_path)
    if not agent_paths:
        print("No Bucket A agents found in inventory.")
        return 1

    if args.verbose:
        print(f"Found {len(agent_paths)} Bucket A agents in inventory")
        print()

    # Ensure target directory
    if not args.dry_run:
        target_dir.mkdir(parents=True, exist_ok=True)

    # Build collision-safe target name map
    target_map = build_target_map(agent_paths)

    converter = AgentConverter(verbose=args.verbose)

    records: List[Dict[str, Any]] = []
    failed: List[Dict[str, str]] = []
    skipped_missing: List[str] = []

    for rel_path in agent_paths:
        source_path = project_root / rel_path
        target_name = target_map.get(rel_path, derive_target_name(rel_path))
        target_path = target_dir / target_name

        if args.verbose:
            print(f"Converting: {rel_path} -> {target_name}")

        if not source_path.exists():
            skipped_missing.append(rel_path)
            if args.verbose:
                print(f"  SKIP: source not found")
            continue

        # Reset warnings per agent
        converter.warnings = []

        result = converter.convert(source_path)
        if result is None:
            failed.append({
                'source': rel_path,
                'error': '; '.join(converter.warnings) or 'Unknown error',
            })
            if args.verbose:
                print(f"  FAILED")
            continue

        output = result['frontmatter_str'] + '\n' + result['body']

        records.append({
            'source': rel_path,
            'target': f'.opencode/agent/{target_name}',
            'warnings': list(converter.warnings),
        })

        if args.verbose:
            if converter.warnings:
                for w in converter.warnings:
                    print(f"  WARN: {w}")
            print(f"  OK -> {target_path.name}")

        if not args.dry_run:
            try:
                target_path.write_text(output, encoding='utf-8')
            except Exception as e:
                failed.append({'source': rel_path, 'error': str(e)})

    # Generate log
    log_content = generate_log(records, failed, skipped_missing, args.dry_run)
    if not args.dry_run:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(log_content, encoding='utf-8')

    # Count collisions resolved
    collisions = sum(1 for base, srcs in _group_by_basename(agent_paths).items() if len(srcs) > 1)
    unique_targets = len(set(target_map.values()))

    # Summary
    print()
    print('=' * 60)
    print(f'Conversion Summary')
    print(f'  Bucket A agents in inventory: {len(agent_paths)}')
    print(f'  Converted: {len(records)}')
    print(f'  Unique output files: {unique_targets}')
    if collisions:
        print(f'  Name collisions resolved: {collisions}')
    print(f'  Failed: {len(failed)}')
    print(f'  Missing source: {len(skipped_missing)}')
    print(f'  Mode: {"DRY-RUN" if args.dry_run else "LIVE"}')
    if not args.dry_run:
        print(f'  Log: {log_path}')
    print('=' * 60)

    if failed:
        print(f"\nFailed:")
        for item in failed:
            print(f"  - {item['source']}: {item['error']}")

    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
