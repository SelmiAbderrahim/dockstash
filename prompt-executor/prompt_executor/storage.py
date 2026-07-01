"""
Prompt Executor — Storage / File-System Helpers

Stateless operations on the file system, the git working tree, and the
JSON-backed scheduler/cron job store. Like `utils.py`, every function
here takes its inputs as arguments and reads NO module-mutable state
from `__init__.py` (`LOG_FILE` / `PID_FILE` / `FAILURES_FILE`). Functions
that DO log progress or errors stay in `__init__.py` because they need
the runtime LOG_FILE binding.

Sections:

    1. JobStore                     — _empty_store, _make_job_id,
                                      JobStore class, JOB_STORE_VERSION
    2. Git snapshot helpers         — snapshot_git_state, detect_git_changes
    3. OpenCode config discovery    — _find_opencode_config, _parse_jsonc
    4. Pending-file scanners        — get_pending_files_in_dir,
                                      has_done_files_in_dir,
                                      is_dir_fully_complete
    5. Folder resolution            — resolve_target_folder
"""

from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from .config import (
    GIT_SNAPSHOT_TIMEOUT,
    JOBS_FILE,
    PROJECT_ROOT,
    _JSONC_BLOCK_COMMENT,
    _JSONC_LINE_COMMENT,
    _JSONC_TRAILING_COMMA,
)
from .utils import is_done


# ─── 1. JobStore (one-shot schedules + cron jobs, JSON on disk) ─────────────
#
# Schema version is stamped on every write so a future migration step has
# a hook. Bump only on a backwards-incompatible change to the on-disk
# layout.
JOB_STORE_VERSION = 1


def _empty_store() -> dict:
    return {"version": JOB_STORE_VERSION, "schedules": [], "crons": []}


def _make_job_id(prefix: str) -> str:
    """Time-prefixed, lexicographically-sortable, URL-safe ID."""
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    rand = secrets.token_hex(4)
    return f"{prefix}_{ts}_{rand}"


class JobStore:
    """
    Atomic JSON-backed job persistence. Instances are cheap — always
    construct fresh before read/modify/write cycles (the daemon re-reads
    on every tick so operator adds/removes take effect without a restart).
    """

    def __init__(self, path: Path = JOBS_FILE) -> None:
        self.path = path

    def read(self) -> dict:
        if not self.path.exists():
            return _empty_store()
        try:
            raw = self.path.read_text(encoding="utf-8")
        except OSError as e:
            print(
                f"[prompt_executor] WARNING: failed to read {self.path}: {e}",
                file=sys.stderr,
            )
            return _empty_store()
        if not raw.strip():
            return _empty_store()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            backup = self.path.with_suffix(self.path.suffix + ".corrupt")
            try:
                self.path.rename(backup)
            except OSError:
                pass
            print(
                f"[prompt_executor] WARNING: corrupt job store "
                f"({e}); moved to {backup}. Starting fresh.",
                file=sys.stderr,
            )
            return _empty_store()
        # Be forgiving about minor schema drift.
        if not isinstance(data, dict):
            return _empty_store()
        data.setdefault("version", JOB_STORE_VERSION)
        data.setdefault("schedules", [])
        data.setdefault("crons", [])
        return data

    def write(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        body = json.dumps(data, indent=2, sort_keys=True)
        # Atomic: write tmp → fsync → rename.
        with tmp.open("w", encoding="utf-8") as f:
            f.write(body)
            f.flush()
            try:
                os.fsync(f.fileno())
            except OSError:
                pass
        os.replace(tmp, self.path)

    # ── Convenience mutators (read / modify / write cycles) ──────────────

    def add_schedule(self, job: dict) -> dict:
        data = self.read()
        data["schedules"].append(job)
        self.write(data)
        return job

    def add_cron(self, job: dict) -> dict:
        data = self.read()
        data["crons"].append(job)
        self.write(data)
        return job

    def remove(self, job_id: str) -> bool:
        """Remove a job by ID from either list. Returns True if found."""
        data = self.read()
        before = len(data["schedules"]) + len(data["crons"])
        data["schedules"] = [j for j in data["schedules"] if j.get("id") != job_id]
        data["crons"] = [j for j in data["crons"] if j.get("id") != job_id]
        after = len(data["schedules"]) + len(data["crons"])
        if after != before:
            self.write(data)
            return True
        return False

    def update_cron_run(
        self, job_id: str, last_run_iso: str, next_run_iso: str
    ) -> None:
        data = self.read()
        for j in data["crons"]:
            if j.get("id") == job_id:
                j["last_run_iso"] = last_run_iso
                j["next_run_iso"] = next_run_iso
                break
        self.write(data)

    def remove_schedule(self, job_id: str) -> None:
        data = self.read()
        data["schedules"] = [j for j in data["schedules"] if j.get("id") != job_id]
        self.write(data)


# ─── 2. Git snapshot helpers ────────────────────────────────────────────────


def snapshot_git_state(cwd: Path) -> set[str] | None:
    """
    Snapshot the current git state as a set of changed/untracked file paths.

    Returns None if git is not available (non-fatal — snapshots disabled).
    Runs three git commands and merges their output into a single set.
    """
    try:
        all_lines: set[str] = set()
        for cmd in [
            ["git", "diff", "--name-only"],
            ["git", "diff", "--cached", "--name-only"],
            ["git", "ls-files", "--others", "--exclude-standard"],
        ]:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(cwd),
                timeout=GIT_SNAPSHOT_TIMEOUT,
            )
            if result.returncode != 0:
                return None
            for line in (result.stdout or "").strip().splitlines():
                if line:
                    all_lines.add(line)
        return all_lines
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None


def detect_git_changes(before: set[str] | None, after: set[str] | None) -> bool:
    """
    Return True if git state changed between snapshots.

    Treats None snapshots as 'unknown' — only returns False (no changes)
    when both snapshots are non-None and identical.
    """
    if before is None or after is None:
        return True
    return before != after


# ─── 3. OpenCode config discovery ───────────────────────────────────────────


def _find_opencode_config(start_dir: Path) -> Path | None:
    """
    Walk upward from start_dir looking for .opencode/opencode.jsonc or
    .opencode/opencode.json. Returns the path to the config file, or None.
    """
    current = start_dir.resolve()
    while True:
        for name in ("opencode.jsonc", "opencode.json"):
            candidate = current / ".opencode" / name
            if candidate.exists():
                return candidate
        if current.parent == current:
            return None
        current = current.parent


def _parse_jsonc(text: str) -> dict | None:
    """Best-effort parse of a .jsonc document. Returns None on failure.

    Strips `//` line comments, `/* */` block comments, and trailing commas,
    then delegates to `json.loads`. Sufficient for inspecting top-level keys
    like "permission"; not a full jsonc spec implementation.
    """
    cleaned = _JSONC_BLOCK_COMMENT.sub("", text)
    cleaned = _JSONC_LINE_COMMENT.sub("", cleaned)
    cleaned = _JSONC_TRAILING_COMMA.sub(r"\1", cleaned)
    try:
        result = json.loads(cleaned)
        return result if isinstance(result, dict) else None
    except (ValueError, TypeError):
        return None


# ─── 4. Pending-file scanners ───────────────────────────────────────────────


def get_pending_files_in_dir(directory: Path) -> list[Path]:
    """Return pending .md files in a single directory (non-recursive)."""
    if not directory.exists():
        return []
    return sorted(
        f
        for f in directory.iterdir()
        if f.is_file() and f.suffix == ".md" and not is_done(f.stem)
    )


def has_done_files_in_dir(directory: Path) -> bool:
    """True if the directory contains at least one _done.md file."""
    return any(
        f.is_file() and f.suffix == ".md" and is_done(f.stem)
        for f in directory.iterdir()
    )


def is_dir_fully_complete(directory: Path) -> bool:
    """
    True when a directory has no pending work:
    - No pending .md files
    - No pending sub-directories (all sub-dirs are _done or empty)
    """
    for entry in directory.iterdir():
        if entry.name.startswith("."):
            continue
        if entry.is_dir() and not is_done(entry.name):
            return False
        if entry.is_file() and entry.suffix == ".md" and not is_done(entry.stem):
            return False
    return True


# ─── 5. Folder resolution ───────────────────────────────────────────────────


def resolve_target_folder(folder_arg: str) -> Path:
    """Resolve the target folder relative to PROJECT_ROOT or as absolute path."""
    candidate = Path(folder_arg)
    if candidate.is_absolute():
        target = candidate
    else:
        target = (PROJECT_ROOT / candidate).resolve()

    if not target.exists():
        print(f"Error: folder does not exist: {target}")
        sys.exit(1)
    if not target.is_dir():
        print(f"Error: not a directory: {target}")
        sys.exit(1)

    return target
