"""Tests for the OpenCode skill validation script.

Covers: valid skill, missing SKILL.md, missing name, missing description,
name mismatch, invalid name regex, name too long, description too long,
block scalar > (folded), block scalar | (literal), --fix flag, --root option.
"""
import pathlib
import textwrap

import pytest

# Import the validator class from the scripts directory
import sys
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "scripts"))
from validate_skills import SkillValidator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_skill(root: pathlib.Path, name: str, frontmatter: str) -> pathlib.Path:
    """Create a skill directory with a SKILL.md containing *frontmatter*."""
    skill_dir = root / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(frontmatter, encoding="utf-8")
    return skill_dir


VALID_SKILL = textwrap.dedent("""\
    ---
    name: my-skill
    description: A valid skill for testing purposes.
    ---

    # My Skill

    Body content here.
""")


# ---------------------------------------------------------------------------
# 1. Valid skill passes all checks
# ---------------------------------------------------------------------------

class TestValidSkill:
    def test_valid_skill_passes(self, tmp_path):
        _make_skill(tmp_path, "my-skill", VALID_SKILL)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 0
        assert len(v.violations) == 0
        assert "my-skill" in v.valid_skills


# ---------------------------------------------------------------------------
# 2. Missing SKILL.md
# ---------------------------------------------------------------------------

class TestMissingSkillMd:
    def test_directory_without_skill_md_is_skipped(self, tmp_path):
        """Directories without SKILL.md are organisational containers and
        are silently skipped — matching OpenCode's discovery behaviour."""
        (tmp_path / "no-md").mkdir()
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 0
        assert len(v.violations) == 0
        assert len(v.valid_skills) == 0


# ---------------------------------------------------------------------------
# 3. Missing required fields
# ---------------------------------------------------------------------------

class TestMissingFields:
    def test_missing_name(self, tmp_path):
        fm = "---\ndescription: Has description only.\n---\n"
        _make_skill(tmp_path, "no-name", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert any("Missing required field: name" in e for e in v.violations[0]["errors"])

    def test_missing_description(self, tmp_path):
        fm = "---\nname: no-desc\n---\n"
        _make_skill(tmp_path, "no-desc", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert any("Missing required field: description" in e for e in v.violations[0]["errors"])


# ---------------------------------------------------------------------------
# 4. Name mismatch
# ---------------------------------------------------------------------------

class TestNameMismatch:
    def test_name_does_not_match_directory(self, tmp_path):
        fm = "---\nname: wrong-name\ndescription: Mismatch test.\n---\n"
        _make_skill(tmp_path, "actual-dir", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert any("does not match directory" in e for e in v.violations[0]["errors"])


# ---------------------------------------------------------------------------
# 5. Invalid name regex
# ---------------------------------------------------------------------------

class TestInvalidNameRegex:
    @pytest.mark.parametrize("bad_name", [
        "HasUpperCase",
        "has spaces",
        "has_underscore",
        "double--dash",
        "-leading-dash",
        "trailing-dash-",
        "special!char",
    ])
    def test_invalid_name_format(self, tmp_path, bad_name):
        # Use directory name that matches the bad name so we only test regex
        safe_dir = "test-dir"
        fm = f"---\nname: {bad_name}\ndescription: Regex test.\n---\n"
        _make_skill(tmp_path, safe_dir, fm)
        v = SkillValidator(root=str(tmp_path))
        v.validate_all()
        errors = [e for viol in v.violations for e in viol["errors"]]
        assert any("does not match required format" in e or "does not match directory" in e for e in errors)


# ---------------------------------------------------------------------------
# 6. Name too long
# ---------------------------------------------------------------------------

class TestNameTooLong:
    def test_name_exceeds_64_chars(self, tmp_path):
        long_name = "a" * 65
        fm = f"---\nname: {long_name}\ndescription: Length test.\n---\n"
        _make_skill(tmp_path, long_name, fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert any("not in range" in e for e in v.violations[0]["errors"])


# ---------------------------------------------------------------------------
# 7. Description too long
# ---------------------------------------------------------------------------

class TestDescriptionTooLong:
    def test_description_exceeds_1024_chars(self, tmp_path):
        long_desc = "x" * 1025
        fm = f"---\nname: long-desc\ndescription: {long_desc}\n---\n"
        _make_skill(tmp_path, "long-desc", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert any("description length" in e for e in v.violations[0]["errors"])


# ---------------------------------------------------------------------------
# 8. Block scalar > (folded) parsing
# ---------------------------------------------------------------------------

class TestBlockScalarFolded:
    def test_folded_scalar_parsed(self, tmp_path):
        fm = textwrap.dedent("""\
            ---
            name: folded-skill
            description: >
              This is a folded
              block scalar description
              spanning multiple lines.
            ---

            # Body
        """)
        _make_skill(tmp_path, "folded-skill", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 0
        assert "folded-skill" in v.valid_skills

    def test_folded_scalar_content_joined(self, tmp_path):
        fm = textwrap.dedent("""\
            ---
            name: folded-join
            description: >
              Line one
              line two
              line three.
            ---
        """)
        _make_skill(tmp_path, "folded-join", fm)
        v = SkillValidator(root=str(tmp_path))
        skill_md = tmp_path / "folded-join" / "SKILL.md"
        frontmatter, _ = v._parse_frontmatter(skill_md)
        # Folded scalar joins lines with spaces
        assert "Line one" in frontmatter["description"]
        assert "line two" in frontmatter["description"]
        assert "\n" not in frontmatter["description"]


# ---------------------------------------------------------------------------
# 9. Block scalar | (literal) parsing
# ---------------------------------------------------------------------------

class TestBlockScalarLiteral:
    def test_literal_scalar_parsed(self, tmp_path):
        fm = textwrap.dedent("""\
            ---
            name: literal-skill
            description: |
              Line one.
              Line two.
              Line three.
            ---

            # Body
        """)
        _make_skill(tmp_path, "literal-skill", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 0
        assert "literal-skill" in v.valid_skills

    def test_literal_scalar_preserves_newlines(self, tmp_path):
        fm = textwrap.dedent("""\
            ---
            name: literal-nl
            description: |
              Alpha.
              Beta.
            ---
        """)
        _make_skill(tmp_path, "literal-nl", fm)
        v = SkillValidator(root=str(tmp_path))
        skill_md = tmp_path / "literal-nl" / "SKILL.md"
        frontmatter, _ = v._parse_frontmatter(skill_md)
        # Literal scalar preserves newlines
        assert "\n" in frontmatter["description"]


# ---------------------------------------------------------------------------
# 10. --fix flag (name mismatch auto-correction)
# ---------------------------------------------------------------------------

class TestFixFlag:
    def test_fix_corrects_name_mismatch(self, tmp_path):
        fm = "---\nname: old-name\ndescription: Fix test.\n---\n\n# Body\n"
        _make_skill(tmp_path, "correct-name", fm)
        v = SkillValidator(root=str(tmp_path), apply_fixes=True)
        v.validate_all()
        assert len(v.fixed) > 0
        # Re-validate — should now pass (name was fixed to match dir)
        v2 = SkillValidator(root=str(tmp_path))
        assert v2.validate_all() == 0
        assert "correct-name" in v2.valid_skills


# ---------------------------------------------------------------------------
# 11. --root option
# ---------------------------------------------------------------------------

class TestRootOption:
    def test_custom_root(self, tmp_path):
        custom = tmp_path / "custom-skills"
        custom.mkdir()
        _make_skill(custom, "root-test", "---\nname: root-test\ndescription: Root opt test.\n---\n")
        v = SkillValidator(root=str(custom))
        assert v.validate_all() == 0
        assert "root-test" in v.valid_skills

    def test_nonexistent_root(self, tmp_path):
        v = SkillValidator(root=str(tmp_path / "nope"))
        assert v.validate_all() == 1


# ---------------------------------------------------------------------------
# 12. No frontmatter at all
# ---------------------------------------------------------------------------

class TestNoFrontmatter:
    def test_no_frontmatter_delimiters(self, tmp_path):
        _make_skill(tmp_path, "bare", "# Just a heading\nNo frontmatter.\n")
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert any("No YAML frontmatter" in e for e in v.violations[0]["errors"])


# ---------------------------------------------------------------------------
# 13. Quoted values
# ---------------------------------------------------------------------------

class TestQuotedValues:
    def test_double_quoted_value(self, tmp_path):
        fm = '---\nname: "quoted-skill"\ndescription: "A quoted description."\n---\n'
        _make_skill(tmp_path, "quoted-skill", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 0
        assert "quoted-skill" in v.valid_skills

    def test_single_quoted_value(self, tmp_path):
        fm = "---\nname: 'sq-skill'\ndescription: 'Single quoted.'\n---\n"
        _make_skill(tmp_path, "sq-skill", fm)
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 0
        assert "sq-skill" in v.valid_skills


# ---------------------------------------------------------------------------
# 14. Multiple skills — mixed pass/fail
# ---------------------------------------------------------------------------

class TestMultipleSkills:
    def test_mixed_pass_fail(self, tmp_path):
        _make_skill(tmp_path, "good", "---\nname: good\ndescription: OK.\n---\n")
        _make_skill(tmp_path, "bad", "---\nname: bad\n---\n")  # missing description
        v = SkillValidator(root=str(tmp_path))
        assert v.validate_all() == 1
        assert "good" in v.valid_skills
        assert len(v.violations) == 1


# ---------------------------------------------------------------------------
# 15. Body content preserved after frontmatter
# ---------------------------------------------------------------------------

class TestBodyPreservation:
    def test_body_returned_correctly(self, tmp_path):
        fm = "---\nname: body-test\ndescription: Body test.\n---\n\n# Heading\n\nParagraph.\n"
        skill_dir = _make_skill(tmp_path, "body-test", fm)
        v = SkillValidator(root=str(tmp_path))
        _, body = v._parse_frontmatter(skill_dir / "SKILL.md")
        assert "# Heading" in body
        assert "Paragraph." in body
