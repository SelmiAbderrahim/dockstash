"""
Prompt Executor — Pure Helpers

Stateless utility functions extracted from `__init__.py`. Everything in this
module:

  * Reads NO module-mutable state (`LOG_FILE`, `PID_FILE`, …).
  * Calls NO logging — pure return values, no side effects beyond the
    arguments / stdlib calls explicitly described in each docstring.
  * Reads constants from `config.py` only.

This makes the module trivially testable in isolation. Callers in
`__init__.py` consume these via the wildcard re-export at the top of
`__init__.py`, so tests that patch `prompt_executor.X` keep working —
the patched binding lives on the package namespace and __init__.py's
internal call sites see it.

Sections:

    1. Dotenv loader              — _load_dotenv
    2. Stderr classifiers         — _classify_stderr, is_credit_error,
                                    is_autocompact_error
    3. Filename helpers           — is_done, _strip_numeric_prefix,
                                    _strip_model_alias_suffix,
                                    _filename_descriptor, is_reference_file,
                                    _no_change_ok_kind, _is_reference_prompt
    4. Backend / model routing    — detect_backend,
                                    extract_model_from_filename
    5. Process inspection         — _pid_alive, _sweep_descendants,
                                    find_matching_executor_pids
    6. Cron parser                — _parse_cron_field, parse_cron_expr,
                                    next_fire_after
    7. Duration parser            — parse_duration
"""

from __future__ import annotations

import os
import re
import signal
import sys
from datetime import datetime, timedelta
from pathlib import Path

from .config import (
    ANTHROPIC_MODELS,
    BACKEND_CLAUDE,
    BACKEND_CODEX,
    BACKEND_OPENCODE,
    CREDIT_ERROR_PATTERNS,
    MCP_ERROR_PATTERNS,
    MODEL_ALIASES,
    REFERENCE_CONTENT_MARKERS,
    REFERENCE_FILENAME_SUBSTRINGS,
    SKILL_ERROR_PATTERNS,
    VALIDATION_FILENAME_SUBSTRINGS,
    _SORTED_ALIAS_KEYS,
)


# ─── 1. Dotenv loader ───────────────────────────────────────────────────────


def _load_dotenv(env_path: Path) -> int:
    """Load KEY=VALUE pairs from env_path into os.environ.

    Returns the number of variables loaded. Existing environment variables
    are NOT overwritten, matching python-dotenv default behavior. Failures
    to read the file are non-fatal (logged to stderr, execution continues).
    """
    if not env_path.exists():
        return 0

    loaded = 0
    try:
        with env_path.open("r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[len("export ") :].lstrip()
                if "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                if not key:
                    continue
                value = value.strip()
                # Strip matching surrounding quotes
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                    value = value[1:-1]
                # Respect pre-existing environment values (shell overrides win)
                if key not in os.environ:
                    os.environ[key] = value
                    loaded += 1
    except OSError as e:
        print(
            f"[prompt_executor] WARNING: failed to read {env_path}: {e}",
            file=sys.stderr,
        )
    return loaded


# ─── 2. Stderr classifiers ──────────────────────────────────────────────────


def _classify_stderr(stderr: str) -> str | None:
    """
    Scan stderr for known MCP or skill error patterns.
    Returns a one-line classification label, or None if no pattern matches.
    """
    for pat in MCP_ERROR_PATTERNS:
        if re.search(pat, stderr, re.IGNORECASE):
            return "MCP_ERROR"
    for pat in SKILL_ERROR_PATTERNS:
        if re.search(pat, stderr, re.IGNORECASE):
            return "SKILL_ERROR"
    return None


def is_credit_error(stdout: str, stderr: str = "") -> bool:
    """
    True if the combined stdout+stderr contains any CREDIT_ERROR_PATTERNS.
    Used to decide whether to trigger a sticky GLM↔Haiku swap in auto mode.
    """
    blob = (stdout + "\n" + stderr).lower()
    return any(p in blob for p in CREDIT_ERROR_PATTERNS)


def is_autocompact_error(err_msg: str) -> bool:
    """
    True if the prompt's error message is the Claude CLI autocompact-thrash
    signature. Used to decide whether to trigger a sticky small-context →
    opus-4.7 swap in auto mode.
    """
    return "autocompact is thrashing" in (err_msg or "").lower()


# ─── 3. Filename helpers ────────────────────────────────────────────────────


def is_done(name: str) -> bool:
    """Check if a file stem or folder name is marked as done."""
    return name.endswith("_done")


def _strip_numeric_prefix(stem: str) -> str:
    """Strip a leading 'NN-' or 'NN_' (digits followed by dash/underscore)."""
    i = 0
    while i < len(stem) and stem[i].isdigit():
        i += 1
    if i > 0 and i < len(stem) and stem[i] in ("-", "_"):
        return stem[i + 1 :]
    return stem


def _strip_model_alias_suffix(stem: str) -> str:
    """Strip a trailing '-{alias}' from any known MODEL_ALIASES key."""
    for alias in _SORTED_ALIAS_KEYS:
        if stem.endswith(f"-{alias}"):
            return stem[: -(len(alias) + 1)]
    return stem


def _filename_descriptor(stem: str) -> str:
    """Return the meaningful descriptor: lowercased stem with `_done`,
    leading numeric prefix, and trailing model-alias suffix removed.

    Examples:
        `08-update-rules-architecture-and-user-docs-glm-5.1`
            -> `update-rules-architecture-and-user-docs`
        `00-architecture-overview-opus-4.7` -> `architecture-overview`
        `overview_done` -> `overview`
        `README` -> `readme`
    """
    s = stem.lower()
    if s.endswith("_done"):
        s = s[: -len("_done")]
    s = _strip_numeric_prefix(s)
    s = _strip_model_alias_suffix(s)
    return s


def is_reference_file(file_path: Path) -> bool:
    """Return True if this .md file is a non-executable reference/overview doc.

    A reference file has the keyword as the *primary descriptor* (e.g.
    `architecture.md`, `00-architecture-overview.md`, `README.md`), NOT as a
    noun buried inside an action phrase (e.g.
    `08-update-rules-architecture-and-user-docs-glm-5.1.md` — that's an
    *update* prompt, not a reference doc).

    Matching strategy: strip `_done`, leading `NN-` numeric prefix, and any
    trailing `-{model-alias}` suffix to get the descriptor; then accept the
    file as reference iff the descriptor either equals one of
    REFERENCE_FILENAME_SUBSTRINGS or starts with one followed by a delimiter
    (`-`, `_`, `.`). The directory name is NOT considered.
    """
    descriptor = _filename_descriptor(file_path.stem)
    for substr in REFERENCE_FILENAME_SUBSTRINGS:
        if descriptor == substr:
            return True
        if descriptor.startswith(substr) and len(descriptor) > len(substr):
            next_char = descriptor[len(substr)]
            if next_char in ("-", "_", "."):
                return True
    return False


def _no_change_ok_kind(prompt_file: Path) -> str | None:
    """
    If this prompt is one where "exit 0 with no filesystem changes" is a
    legitimate success state, return the kind ("reference" or "validation").
    Otherwise return None.

    - Reference files: architecture overviews, READMEs, TOCs. These are also
      skipped entirely at collection time via ``is_reference_file`` — this
      helper exists as a safety net for content-based detection.
    - Validation files: ``*-validate-*`` / ``*-verify-*`` prompts that run
      checks and emit PASS/FAIL reports without editing anything.
    """
    if is_reference_file(prompt_file):
        return "reference"
    name = prompt_file.name.lower()
    stem = name[:-3] if name.endswith(".md") else name
    if stem.endswith("_done"):
        stem = stem[: -len("_done")]
    if any(s in stem for s in VALIDATION_FILENAME_SUBSTRINGS):
        return "validation"

    try:
        head = prompt_file.read_text(errors="ignore")[:4000].lower()
    except OSError:
        return None
    if any(m in head for m in REFERENCE_CONTENT_MARKERS):
        return "reference"
    return None


def _is_reference_prompt(prompt_file: Path) -> bool:
    """Back-compat wrapper: true if reference or validation prompt."""
    return _no_change_ok_kind(prompt_file) is not None


# ─── 4. Backend / model routing ─────────────────────────────────────────────


def detect_backend(model: str) -> str:
    """
    Determine which CLI backend to use based on the model name.
    - Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code
    - OpenAI Codex models (gpt-*) → Codex CLI (`codex exec --json`)
    - Z.AI GLM models (glm-*, zai/*) → OpenCode
    - Provider-prefixed models (*/*) → OpenCode
    - Everything else defaults to OpenCode
    """
    model_lower = model.lower()

    # Resolve alias first to check what it maps to
    resolved = MODEL_ALIASES.get(model_lower)

    # Check for Anthropic models first (these always use Claude Code backend)
    if model_lower in ANTHROPIC_MODELS or model_lower.startswith("claude"):
        return BACKEND_CLAUDE

    # If the alias resolves to a claude-* model, route to Claude backend
    if resolved and resolved.startswith("claude"):
        return BACKEND_CLAUDE

    # OpenAI Codex models — `gpt-*` aliases (e.g. `gpt-5.5`, `gpt-5.4`).
    # Checked BEFORE GLM and provider-prefix to keep the resolution
    # deterministic: any unprefixed `gpt-*` belongs to Codex.
    if model_lower.startswith("gpt-"):
        return BACKEND_CODEX
    if resolved and resolved.startswith("gpt-"):
        return BACKEND_CODEX

    # Check for Z.AI GLM models (glm-* prefix or zai/* namespace prefix)
    if model_lower.startswith("glm-") or model_lower.startswith("zai/"):
        return BACKEND_OPENCODE

    # Provider-prefixed models (e.g., "openai/gpt-4", "anthropic/claude-3") → OpenCode
    if "/" in model_lower:
        return BACKEND_OPENCODE

    # Default: OpenCode backend for unknown models
    return BACKEND_OPENCODE


def extract_model_from_filename(prompt_file: Path) -> str | None:
    """
    Extract a model alias from a prompt filename like `01-task-opus-4.7.md`.

    Matches against MODEL_ALIASES keys, longest-first, so `opus-4.7` wins
    over `opus`. Strips a trailing `_done` before matching so already-
    completed files still report their original model.

    Returns the alias key (not the resolved model ID), or None if no known
    alias suffix is present.
    """
    stem = prompt_file.stem  # "01-task-opus-4.7" or "01-task-opus-4.7_done"
    if stem.endswith("_done"):
        stem = stem[: -len("_done")]
    for alias in _SORTED_ALIAS_KEYS:
        if stem.endswith(f"-{alias}"):
            return alias
    return None


# ─── 5. Process inspection ──────────────────────────────────────────────────


def _pid_alive(pid: int) -> bool:
    """True if PID is still running."""
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        # Process exists but we cannot signal it — still "alive" for our purposes.
        return True


def _sweep_descendants(root_pids: set[int]) -> int:
    """
    Walk /proc looking for any process whose PPid chain leads back to one of
    ``root_pids`` and SIGKILL it. Returns the number of survivors killed.

    This catches stragglers that escaped killpg — e.g. grandchildren that
    called setsid() themselves, or processes whose parent already died so
    they were reparented to init but still reference our original PPid in
    their own transitive chain.
    """
    killed = 0
    try:
        proc_entries = list(Path("/proc").iterdir())
    except OSError:
        return 0

    # Build ppid map for transitive parentage check.
    ppid_map: dict[int, int] = {}
    for entry in proc_entries:
        if not entry.name.isdigit():
            continue
        try:
            status = (entry / "status").read_text(errors="ignore")
        except OSError:
            continue
        for line in status.splitlines():
            if line.startswith("PPid:"):
                try:
                    ppid_map[int(entry.name)] = int(line.split()[1])
                except (ValueError, IndexError):
                    pass
                break

    def _traces_to_root(pid: int) -> bool:
        seen: set[int] = set()
        cur = pid
        while cur not in seen:
            seen.add(cur)
            parent = ppid_map.get(cur)
            if parent is None or parent == 0 or parent == 1:
                return False
            if parent in root_pids:
                return True
            cur = parent
        return False

    for pid, _ppid in ppid_map.items():
        if pid in root_pids:
            continue
        if _traces_to_root(pid):
            try:
                os.kill(pid, signal.SIGKILL)
                killed += 1
            except (ProcessLookupError, PermissionError):
                pass
    return killed


def find_matching_executor_pids(target_folder: Path) -> list[int]:
    """Scan the process table for running prompt_executor processes on this folder.

    Catches three cases the PID file does not:
    - Foreground `run` invocations (never write a PID file).
    - Daemons whose PID file was deleted out of band.
    - Pre-fix daemons spawned by an older copy of this script.

    Source of truth is /proc/<pid>/cmdline (NUL-separated argv) rather than
    `ps -eo args`, because embedded shells (e.g. Claude Code, some IDEs) invoke
    scripts via `bash -c "<entire script body>"` — the parent bash's cmdline
    contains the script text verbatim, causing grep-style matches to false-
    positive whenever the script text mentions "prompt_executor.py" as a
    literal string.

    A match requires:
      1. The executable (argv[0] basename) to look like a python interpreter.
      2. Some argv element identifies the executor — either the legacy
         ``prompt_executor.py`` script invocation (kept for back-compat
         while old daemons may still be running), or the modern
         ``-m prompt_executor`` package invocation.
      3. Some argv element contains the slug as an **exact path segment**
         (split on "/"), not as a substring. This prevents false positives
         when the slug is a short common word — e.g. slug ``ai`` used to
         match ``--retry-wait`` because the byte substring ``ai`` lives
         inside ``wait``. Requiring a path-segment match means only argv
         like ``prompts/ai`` or ``/home/.../prompts/ai`` is flagged.
      4. The PID is not this process's own PID.

    Returns [] on any /proc access failure — non-fatal, detection degrades
    gracefully to the PID-file check.
    """
    slug = target_folder.name
    if not slug:
        return []

    proc_root = Path("/proc")
    if not proc_root.is_dir():
        return []

    self_pid = os.getpid()
    matches: list[int] = []

    try:
        pid_dirs = [p for p in proc_root.iterdir() if p.name.isdigit()]
    except OSError:
        return []

    for pid_dir in pid_dirs:
        try:
            pid = int(pid_dir.name)
        except ValueError:  # pragma: no cover
            continue
        if pid == self_pid:
            continue
        cmdline_file = pid_dir / "cmdline"
        try:
            raw = cmdline_file.read_bytes()
        except (FileNotFoundError, PermissionError, ProcessLookupError, OSError):
            continue
        if not raw:
            continue
        argv = [a for a in raw.split(b"\x00") if a]
        if not argv:
            continue

        # 1. Executable must be a python interpreter. We check argv[0] basename.
        exe_name = argv[0].rsplit(b"/", 1)[-1].lower()
        if not exe_name.startswith(b"python"):
            continue

        # 2. Some argv element identifies the executor.
        #
        #    Modern invocation: `python -m prompt_executor ...` → argv
        #    contains ["-m", "prompt_executor", ...].
        #
        #    Legacy invocation: `python /path/prompt_executor.py ...` →
        #    some argv element ends with "prompt_executor.py". Kept while
        #    older daemons may still be running on hosts that haven't
        #    rolled the new package layout.
        is_modern = False
        for i, arg in enumerate(argv[1:]):
            if arg == b"-m" and i + 1 < len(argv) - 1 and argv[i + 2] == b"prompt_executor":
                is_modern = True
                break
        is_legacy = any(arg.endswith(b"prompt_executor.py") for arg in argv[1:])
        if not (is_modern or is_legacy):
            continue

        # 3. Some argv element contains the slug as an exact path segment.
        #    Splitting on "/" and doing equality match avoids byte-substring
        #    false positives (e.g. slug "ai" matching "--retry-wait").
        slug_bytes = slug.encode("utf-8")
        matched_slug = False
        for arg in argv[1:]:
            if slug_bytes in arg.split(b"/"):
                matched_slug = True
                break
        if not matched_slug:
            continue

        matches.append(pid)

    return matches


# ─── 6. Cron parser ─────────────────────────────────────────────────────────
#
# A minimal, dependency-free 5-field cron parser supporting:
#   *        — every value
#   N        — single integer
#   N,M,P    — comma-separated list
#   N-M      — inclusive range
#   N-M/S    — range with step
#   */S      — every S values starting from the minimum of the range
#
# Fields (order matches POSIX cron):
#   minute       0-59
#   hour         0-23
#   day-of-month 1-31
#   month        1-12
#   day-of-week  0-6    (0 = Sunday)
#
# No named aliases (@hourly, JAN, MON, ...) — those are out of scope for
# the minimal parser. next_fire_after(dt) returns the next datetime
# strictly greater than dt that matches the expression, in local time.

_CRON_RANGES = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 6)]
_CRON_FIELD_NAMES = ["minute", "hour", "day-of-month", "month", "day-of-week"]


def _parse_cron_field(field: str, lo: int, hi: int, name: str) -> set[int]:
    """Expand a single cron field into the set of matching integers."""
    out: set[int] = set()
    for part in field.split(","):
        part = part.strip()
        if not part:
            raise ValueError(f"empty component in {name} field: {field!r}")
        step = 1
        if "/" in part:
            base, _, step_s = part.partition("/")
            try:
                step = int(step_s)
            except ValueError:
                raise ValueError(f"bad step in {name}: {part!r}")
            if step < 1:
                raise ValueError(f"step must be >= 1 in {name}: {part!r}")
        else:
            base = part
        if base == "*":
            start, end = lo, hi
        elif "-" in base:
            a, _, b = base.partition("-")
            try:
                start, end = int(a), int(b)
            except ValueError:
                raise ValueError(f"bad range in {name}: {base!r}")
        else:
            try:
                start = end = int(base)
            except ValueError:
                raise ValueError(f"bad value in {name}: {base!r}")
        if start < lo or end > hi or start > end:
            raise ValueError(
                f"{name} value out of range [{lo},{hi}]: {base!r}"
            )
        for v in range(start, end + 1, step):
            out.add(v)
    if not out:
        raise ValueError(f"{name} field produced no values: {field!r}")
    return out


def parse_cron_expr(expr: str) -> dict:
    """
    Parse a 5-field cron expression. Returns a dict with per-field sets:
        {"minute": {...}, "hour": {...}, "dom": {...},
         "month": {...}, "dow": {...}}
    Raises ValueError on any malformed field.
    """
    parts = expr.split()
    if len(parts) != 5:
        raise ValueError(
            f"cron expression must have exactly 5 fields "
            f"(minute hour dom month dow), got {len(parts)}: {expr!r}"
        )
    field_sets = [
        _parse_cron_field(parts[i], lo, hi, _CRON_FIELD_NAMES[i])
        for i, (lo, hi) in enumerate(_CRON_RANGES)
    ]
    return {
        "minute": field_sets[0],
        "hour": field_sets[1],
        "dom": field_sets[2],
        "month": field_sets[3],
        "dow": field_sets[4],
    }


def next_fire_after(expr: str | dict, after: datetime) -> datetime:
    """
    Return the earliest datetime strictly > `after` that matches `expr`.

    Standard POSIX cron semantics: when BOTH dom and dow are restricted
    (not "*"), the match is the union — either matching dom OR matching
    dow triggers the job. When only one is restricted, only that one
    applies. This matches crontab(5) on Linux / BSD.

    Search is bounded to 4 * 366 * 24 * 60 minutes (~4 years) to guarantee
    termination for impossible combinations like "0 0 30 2 *".
    """
    fields = expr if isinstance(expr, dict) else parse_cron_expr(expr)
    # Start from the next minute boundary after `after`.
    cand = (after + timedelta(minutes=1)).replace(second=0, microsecond=0)
    # Detect whether dom / dow are restricted (compared to full ranges).
    dom_full = fields["dom"] == set(range(1, 32))
    dow_full = fields["dow"] == set(range(0, 7))
    for _ in range(4 * 366 * 24 * 60):
        if cand.month not in fields["month"]:
            # Jump to first day of next month.
            if cand.month == 12:
                # datetime() rejects year > 9999. For impossible cron
                # expressions (e.g. "0 0 30 2 *"), the year-by-year search
                # would otherwise raise ValueError("year 10000 is out of
                # range") before the 4-year budget is exhausted.
                if cand.year >= 9999:
                    raise ValueError(
                        f"cron expression never fires within bounded date "
                        f"range: {expr!r}"
                    )
                cand = cand.replace(year=cand.year + 1, month=1, day=1, hour=0, minute=0)
            else:
                cand = cand.replace(month=cand.month + 1, day=1, hour=0, minute=0)
            continue
        # Day-of-month / day-of-week matching.
        # crontab(5): when both restricted → union; otherwise intersection.
        python_dow = (cand.weekday() + 1) % 7  # Mon=0..Sun=6 → Sun=0..Sat=6
        dom_ok = cand.day in fields["dom"]
        dow_ok = python_dow in fields["dow"]
        if dom_full and dow_full:
            day_ok = True
        elif dom_full:
            day_ok = dow_ok
        elif dow_full:
            day_ok = dom_ok
        else:
            day_ok = dom_ok or dow_ok
        if not day_ok:
            cand = (cand + timedelta(days=1)).replace(hour=0, minute=0)
            continue
        if cand.hour not in fields["hour"]:
            cand = (cand + timedelta(hours=1)).replace(minute=0)
            continue
        if cand.minute not in fields["minute"]:
            cand = cand + timedelta(minutes=1)
            continue
        return cand
    raise ValueError(f"cron expression never fires within 4 years: {expr!r}")


# ─── 7. Duration parser (for --in / scheduled offsets) ──────────────────────
#
# Accepts "2h30m", "45m", "90s", "1d", "1h5m10s", "1.5h" (floats are
# rounded to the nearest second). At least one unit is required.

_DURATION_RE = re.compile(
    r"^\s*(?:(\d+(?:\.\d+)?)d)?\s*"
    r"(?:(\d+(?:\.\d+)?)h)?\s*"
    r"(?:(\d+(?:\.\d+)?)m)?\s*"
    r"(?:(\d+(?:\.\d+)?)s)?\s*$",
    re.IGNORECASE,
)


def parse_duration(s: str) -> timedelta:
    """Parse '2h30m' style strings into a timedelta. Raises ValueError."""
    if not s or not s.strip():
        raise ValueError("empty duration")
    m = _DURATION_RE.match(s)
    if not m or not any(m.groups()):
        raise ValueError(
            f"bad duration: {s!r} "
            f"(expected combinations of Nd/Nh/Nm/Ns, e.g. '2h30m')"
        )
    days, hours, mins, secs = m.groups()
    total = 0.0
    if days:
        total += float(days) * 86400
    if hours:
        total += float(hours) * 3600
    if mins:
        total += float(mins) * 60
    if secs:
        total += float(secs)
    if total <= 0:
        raise ValueError(f"duration must be positive: {s!r}")
    return timedelta(seconds=round(total))
