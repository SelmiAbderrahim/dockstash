#!/usr/bin/env python3
"""
OpenCode Skill Validation Script

Validates all skills in .claude/skills/ against the OpenCode skill specification:
- SKILL.md file must exist
- YAML frontmatter must be present with valid structure
- name field must match directory name, be lowercase alphanumeric with hyphens, 1-64 chars
- description field must be 1-1024 chars
- All other fields are optional but recommended

Usage:
  python validate_skills.py [--fix] [--root PATH]

Options:
  --fix       Apply idempotent fixes for violations that can be auto-corrected
  --root PATH Override the root directory (default: .claude/skills relative to git root)
"""

import sys
import os
import re
import argparse
import pathlib
from typing import Dict, List, Tuple, Optional


class SkillValidator:
    """Validates OpenCode skills against the specification."""

    # Skill name regex: lowercase alphanumeric with single hyphens only
    NAME_REGEX = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')

    # YAML frontmatter delimiters
    FRONTMATTER_START = '---'
    FRONTMATTER_END = '---'

    # Constraints
    MIN_NAME_LENGTH = 1
    MAX_NAME_LENGTH = 64
    MIN_DESC_LENGTH = 1
    MAX_DESC_LENGTH = 1024

    def __init__(self, root: Optional[str] = None, apply_fixes: bool = False):
        """Initialize validator.

        Args:
            root: Root directory containing skills. Defaults to .claude/skills
            apply_fixes: Whether to apply idempotent fixes
        """
        if root:
            self.root = pathlib.Path(root).resolve()
        else:
            # Find git root and use .claude/skills
            git_root = self._find_git_root()
            self.root = git_root / '.claude' / 'skills'

        self.apply_fixes = apply_fixes
        self.violations = []
        self.fixed = []
        self.valid_skills = []

    def _find_git_root(self) -> pathlib.Path:
        """Find the git root directory."""
        current = pathlib.Path.cwd()
        while current != current.parent:
            if (current / '.git').exists():
                return current
            current = current.parent
        # Fallback: assume we're in the project
        return pathlib.Path(__file__).parent.parent.parent

    def validate_all(self) -> int:
        """Validate all skills. Returns 0 if all pass, 1 if any fail."""
        if not self.root.exists():
            print(f"ERROR: Root directory does not exist: {self.root}")
            return 1

        # Find all skill directories (only those containing SKILL.md are skills;
        # directories without SKILL.md are organizational containers and are
        # silently skipped, matching OpenCode's discovery behaviour).
        all_dirs = sorted([d for d in self.root.iterdir() if d.is_dir()])
        skill_dirs = [d for d in all_dirs if (d / 'SKILL.md').exists()]
        skipped = len(all_dirs) - len(skill_dirs)

        print(f"Found {len(skill_dirs)} skills in {self.root}"
              + (f" (skipped {skipped} non-skill directories)" if skipped else ""))

        for skill_dir in skill_dirs:
            self._validate_skill(skill_dir)

        # Print summary
        print(f"\n{'='*60}")
        print(f"VALIDATION SUMMARY")
        print(f"{'='*60}")
        print(f"Valid skills:    {len(self.valid_skills)}")
        print(f"Violations:      {len(self.violations)}")
        if self.apply_fixes:
            print(f"Fixed:           {len(self.fixed)}")

        if self.violations:
            print(f"\n{'='*60}")
            print(f"VIOLATIONS FOUND")
            print(f"{'='*60}")
            for violation in self.violations:
                print(f"\n{violation['skill_dir']}")
                for error in violation['errors']:
                    print(f"  ERROR: {error}")
            return 1

        return 0

    def _validate_skill(self, skill_dir: pathlib.Path) -> None:
        """Validate a single skill directory."""
        skill_name = skill_dir.name
        skill_md = skill_dir / 'SKILL.md'

        errors = []

        # Check SKILL.md exists
        if not skill_md.exists():
            errors.append(f"SKILL.md file not found")
            self.violations.append({
                'skill_dir': str(skill_dir),
                'errors': errors
            })
            return

        # Parse frontmatter
        frontmatter, body = self._parse_frontmatter(skill_md)

        if frontmatter is None:
            errors.append("No YAML frontmatter found (must start with ---)")
            self.violations.append({
                'skill_dir': str(skill_dir),
                'errors': errors
            })
            return

        # Validate name field
        if 'name' not in frontmatter:
            errors.append("Missing required field: name")
        else:
            name = frontmatter['name']

            # Check name matches directory
            if name != skill_name:
                errors.append(
                    f"name '{name}' does not match directory name '{skill_name}'"
                )
                if self.apply_fixes:
                    frontmatter['name'] = skill_name
                    self._write_frontmatter(skill_md, frontmatter, body)
                    self.fixed.append(f"{skill_dir.name}: Fixed name mismatch")

            # Check name format
            if not self.NAME_REGEX.match(name):
                errors.append(
                    f"name '{name}' does not match required format "
                    f"(lowercase alphanumeric with single hyphens only)"
                )

            # Check name length
            if len(name) < self.MIN_NAME_LENGTH or len(name) > self.MAX_NAME_LENGTH:
                errors.append(
                    f"name length {len(name)} not in range "
                    f"[{self.MIN_NAME_LENGTH}, {self.MAX_NAME_LENGTH}]"
                )

        # Validate description field
        if 'description' not in frontmatter:
            errors.append("Missing required field: description")
        else:
            description = frontmatter['description']

            # Check description length
            if len(description) < self.MIN_DESC_LENGTH or len(description) > self.MAX_DESC_LENGTH:
                errors.append(
                    f"description length {len(description)} not in range "
                    f"[{self.MIN_DESC_LENGTH}, {self.MAX_DESC_LENGTH}]"
                )

        if errors:
            self.violations.append({
                'skill_dir': str(skill_dir),
                'errors': errors
            })
        else:
            self.valid_skills.append(skill_name)

    def _parse_frontmatter(self, skill_md: pathlib.Path) -> Tuple[Optional[Dict], str]:
        """Parse YAML frontmatter from SKILL.md file.

        Handles simple ``key: value`` pairs as well as YAML block scalar
        syntax (folded ``>`` and literal ``|``).  For block scalars the
        method detects the indentation of the first continuation line and
        collects all subsequent lines at that depth or deeper until a line
        with less indentation (or the ``---`` end marker) is encountered.

        Returns:
            Tuple of (frontmatter_dict, body_text) or (None, full_content)
            if no frontmatter is found.
        """
        with open(skill_md, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')

        if not lines or lines[0] != self.FRONTMATTER_START:
            return None, content

        # Find end of frontmatter
        end_idx = None
        for i in range(1, len(lines)):
            if lines[i] == self.FRONTMATTER_END:
                end_idx = i
                break

        if end_idx is None:
            return None, content

        # Parse YAML frontmatter lines
        frontmatter_lines = lines[1:end_idx]
        body = '\n'.join(lines[end_idx+1:]).lstrip('\n')

        frontmatter: Dict[str, str] = {}
        idx = 0
        while idx < len(frontmatter_lines):
            line = frontmatter_lines[idx]

            # Skip blank lines and lines without a colon at the top level
            if ':' not in line:
                idx += 1
                continue

            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()

            # Detect block scalar indicators: > (folded) or | (literal)
            if value in ('>', '|', '>-', '|-'):
                is_folded = value.startswith('>')
                # Collect continuation lines
                continuation_lines: List[str] = []
                block_indent: Optional[int] = None
                idx += 1
                while idx < len(frontmatter_lines):
                    cont_line = frontmatter_lines[idx]

                    # Blank lines are part of the block (preserved as
                    # empty entries) but only if we have already established
                    # the indentation level.
                    if cont_line.strip() == '':
                        if block_indent is not None:
                            continuation_lines.append('')
                            idx += 1
                            continue
                        else:
                            # Blank before any content means end of block
                            break

                    # Determine indentation of this line
                    stripped = cont_line.lstrip(' ')
                    line_indent = len(cont_line) - len(stripped)

                    if block_indent is None:
                        # First content line sets the reference indent
                        block_indent = line_indent
                        continuation_lines.append(stripped)
                        idx += 1
                    elif line_indent >= block_indent:
                        continuation_lines.append(cont_line[block_indent:])
                        idx += 1
                    else:
                        # Less indentation means end of the block scalar;
                        # do NOT advance idx so this line is re-processed
                        # as a new key.
                        break

                # Strip trailing empty lines from the collected block
                while continuation_lines and continuation_lines[-1] == '':
                    continuation_lines.pop()

                if is_folded:
                    # Folded scalar: collapse newlines into spaces
                    assembled = ' '.join(continuation_lines)
                else:
                    # Literal scalar: preserve newlines
                    assembled = '\n'.join(continuation_lines)

                frontmatter[key] = assembled.rstrip()
                # idx already points to the next unprocessed line
                continue

            # Simple key: value — remove surrounding quotes if present
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            frontmatter[key] = value
            idx += 1

        return frontmatter, body

    def _write_frontmatter(self, skill_md: pathlib.Path, frontmatter: Dict, body: str) -> None:
        """Write frontmatter and body back to SKILL.md file."""
        with open(skill_md, 'w', encoding='utf-8') as f:
            f.write('---\n')
            for key, value in frontmatter.items():
                # Quote values that need it
                if any(c in value for c in [':', '\n', '"']):
                    value = f"'{value}'"
                f.write(f'{key}: {value}\n')
            f.write('---\n')
            if body:
                f.write('\n')
                f.write(body)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Validate OpenCode skills against the specification',
        epilog='Example: python validate_skills.py --fix --root /path/to/skills'
    )
    parser.add_argument(
        '--fix',
        action='store_true',
        help='Apply idempotent fixes for violations that can be auto-corrected'
    )
    parser.add_argument(
        '--root',
        type=str,
        help='Override the root directory (default: .claude/skills relative to git root)'
    )

    args = parser.parse_args()

    validator = SkillValidator(root=args.root, apply_fixes=args.fix)
    return validator.validate_all()


if __name__ == '__main__':
    sys.exit(main())
