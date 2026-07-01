#!/usr/bin/env python3
"""
Prompt Executor
Sequentially executes all .md prompts in a target folder using either
Claude Code CLI (claude -p) or OpenCode CLI (opencode run), auto-detected
from the --model argument.

Execution modes (four top-level CLI verbs + doctor):

    run        — foreground, one-shot. Exits when the folder is done.
    start      — background daemon, one-shot. Same as run but daemonized.
    schedule   — one-shot fire at a future wall-clock time (--at) or
                 relative offset (--in 2h30m). Jobs persist across reboots
                 in the shared job store and are owned by the
                 scheduler-daemon process.
    cron       — recurring fire on a standard 5-field cron expression
                 ("m h dom mon dow", e.g. "0 9 * * 1-5"). Also persisted
                 in the job store and driven by the scheduler-daemon.
    doctor     — non-destructive log analyzer. Parses the existing .log
                 and _failures.log files, classifies each failure into a
                 category (MCP_ERROR / SKILL_ERROR / RATE_LIMIT / QUOTA /
                 TIMEOUT / EXTERNAL / UNRECOVERABLE / TRANSIENT), and
                 writes a markdown fix-plan next to the logs with a
                 per-prompt recommendation. Never edits prompts or this
                 script — it is advisory only.

How schedule / cron work:

    `schedule` and `cron add` write a job record into
    prompt-executor/.prompt_executor_jobs.json and, if the
    scheduler-daemon is not already running, auto-spawn it (same double
    fork + PID file + fsync log pattern as `start`). The scheduler-daemon
    wakes every minute, computes the next-fire time for every job, and
    when a job is due it `subprocess.Popen`s
    `python3 -m prompt_executor run <folder> ...` — reusing every existing retry,
    logging, and _done-tracking code path. One-shot schedules are removed
    from the store after firing; cron jobs update last_run_iso /
    next_run_iso in place and stay scheduled forever.

    The scheduler itself has its own PID/log pair keyed as "scheduler":
    .prompt_executor_scheduler.pid and .prompt_executor_scheduler.log.
    It survives crashes via resilient_run-style restart (MAX_CRASHES=5).
    `stop` with no args and no --*-only flag kills the scheduler too.

How the stop argument works:

    `stop <folder>`                 — legacy behaviour, stops exactly one
                                      running instance by folder slug.
                                      Prompts for confirmation if that
                                      folder is also in schedule/cron.
    `stop` (no folder)              — prints a plan of every running
                                      instance + every scheduled job +
                                      every cron job, then prompts
                                      "Stop N running + disable M
                                      scheduled + disable K cron? [y/N]".
                                      Only proceeds on "y".
    `stop --yes`                    — same plan, no prompt, proceed
                                      immediately. Safe for scripts.
    `stop --running-only`           — only kills PIDs, leaves
                                      schedule/cron jobs intact.
    `stop --scheduled-only`         — only removes one-shot schedule
                                      jobs, leaves running PIDs and
                                      crons intact.
    `stop --cron-only`              — only removes recurring cron jobs.
    All --*-only flags can be combined with --yes.

Self-healing via `doctor`:

    doctor is intentionally conservative. It classifies but does not
    auto-edit. That preserves the 100%-coverage + immutable-executor
    invariants the repo relies on. Recommended workflow:
        1. `stop` to halt execution
        2. `doctor` to produce a fix plan
        3. Read the generated .prompt_executor_{slug}_fixplan.md
        4. Apply the recommendations by hand (increase --retry-wait,
           switch model, fix MCP server, etc.)
        5. `run` or `schedule` / `cron` again

Backend selection:
    Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code CLI
    All other models (glm-*, zai/*, etc.)           → OpenCode CLI

Backend selection:
    Anthropic models (opus, sonnet, haiku, claude-*) → Claude Code CLI
    All other models (glm-*, zai/*, etc.)           → OpenCode CLI

Model alias conventions:
    Claude backend:
        opus                         → claude-opus-4-7[1m]     (1M context)
        sonnet, haiku                → claude-sonnet-4-6, etc. (200k context)
        sonnet-1m                    → claude-sonnet-4-6[1m]   (opt-in, requires extra usage)
        opus-200k, sonnet-200k       → claude-opus-4-7, etc.   (explicit 200k)
    OpenCode backend (zai/ prefix required):
        glm-5.1                      → zai-coding/glm-5.1  (default GLM)
        glm-5                        → zai-coding/glm-5
        glm-5-turbo                  → zai-coding/glm-5-turbo
        glm-4.7                      → zai-coding/glm-4.7
        glm-4.7-flash / flash        → zai-coding/glm-4.7-flash
        glm                          → zai-coding/glm-5.1

OpenCode command construction (_build_opencode_cmd):
    - Builds: opencode run --model <resolved> [flags] [prompt]
    - --agent <name>: selects a primary agent from .opencode/agent/*.md
    - --continue: resumes the last session
    - (permissions are configured in opencode.jsonc's `permission` block,
      e.g. `{"bash":"allow","edit":"allow"}`. The legacy CLI flag
      `--dangerously-skip-permissions` was removed in opencode >= 1.0.x.)
    - --file <path>: attaches a file to the message
    - Prompts <= 32KB: passed as positional argument
    - Prompts > 32KB: piped via stdin (OpenCode reads stdin when not a TTY)

CLI authentication (the executor does NOT read API keys):
    - Claude backend: authenticated by `claude login`. Credentials live in
      ~/.claude/ and are used by the `claude` CLI directly. The executor
      does NOT read or forward ANTHROPIC_API_KEY.
    - OpenCode backend: authenticated by `opencode auth login`. Credentials
      live in ~/.local/share/opencode/auth.json (e.g. the Z.AI Coding Plan
      subscription). The executor does NOT read or forward ZAI_API_KEY.
    - OPENCODE_CONFIG: When set, passed through to the OpenCode subprocess,
      allowing a non-default config file path (e.g., for CI environments).

Working directory (--working-dir):
    By default, prompts run from the project root (where .opencode/
    lives). Use --working-dir to override when running from a non-project
    directory. The executor verifies .opencode/opencode.jsonc is discoverable
    from the working directory and warns if it is not — MCP servers and
    custom skills will not load without a valid config.

MCP/skill error classification:
    When a subprocess exits non-zero, the executor scans stderr for known
    error patterns and logs a classification label:
    - MCP_ERROR: MCP server failures, timeouts, auth issues, unreachable hosts
    - SKILL_ERROR: Skill not found, validation failures, permission denied
    These labels appear in the log as "CLASSIFIED: MCP_ERROR" etc. and help
    diagnose whether a failure is infrastructure (MCP) vs prompt (skill).

Features:
- Required --model argument (determines which CLI backend to use)
- Required folder argument (relative to project root or absolute)
- Recursive nested folder support (depth-first, sorted by name)
- Skip files/folders ending with _done
- Rename completed files -> _done.md, completed folders -> _done
- Retry with exponential backoff on timeout/error (default: 3 retries)
- Skip-and-continue when retries exhausted (never stops on retryable failures)
- Auto-restart on crash (up to 5 crashes before giving up)
- Daemon stderr -> log file (Python tracebacks are never lost)
- atexit + sys.excepthook crash handlers
- Heartbeat logging during sleep
- Stale PID cleanup on startup
- os.fsync on every log write

Usage:
    cd prompt-executor
    python3 -m prompt_executor start - --model opus --period 1 --max-retries 30 --retry-wait 1
    python3 -m prompt_executor start - --period 1 --max-retries 30 --retry-wait 1 --mode auto
    python3 -m prompt_executor start prompts/brand-kit-pro-max --period 1 --mode auto --halt-on-fail 
    python3 -m prompt_executor run   <folder> --model <model> [--period MINUTES] [--max-retries N] [--retry-wait MINUTES]
    python3 -m prompt_executor stop  [<folder>] [--yes] [--running-only] [--scheduled-only] [--cron-only]
    python3 -m prompt_executor status [<folder>]

    python3 -m prompt_executor schedule <folder> --at "2026-04-17 09:00" --model <model>
    python3 -m prompt_executor schedule <folder> --in 2h30m --model <model>
    python3 -m prompt_executor schedule list
    python3 -m prompt_executor schedule remove <job-id>

    python3 -m prompt_executor cron <folder> --expr "0 9 * * 1-5" --model <model>
    python3 -m prompt_executor cron list
    python3 -m prompt_executor cron remove <job-id>

    python3 -m prompt_executor doctor [<folder>]

Parallel execution:
    Multiple instances can run simultaneously on different folders.
    Each instance gets its own PID file, log file, and failures log,
    keyed by the target folder name (e.g., .prompt_executor_blog-system.pid).

Examples:
    # Execute with Claude Code (Anthropic models)
    python3 -m prompt_executor run prompts/blog-system --model opus
    python3 -m prompt_executor run prompts/blog-system --model sonnet

    # Execute with OpenCode (GLM models)
    python3 -m prompt_executor run prompts/blog-system --model glm-5.1
    python3 -m prompt_executor run prompts/blog-system --model flash

    # Run with custom working directory (when .opencode/ is elsewhere)
    python3 -m prompt_executor run prompts/blog-system --model glm-5.1 --working-dir /path/to/project

    # Run parallel instances with different backends
    python3 -m prompt_executor start prompts/fire-and-forget --model opus --period 5
    python3 -m prompt_executor start prompts/blog-system --model glm-5.1 --period 5

    # Check all running instances
    python3 -m prompt_executor status

    # Stop all instances
    python3 -m prompt_executor stop

    # Stop a specific instance
    python3 -m prompt_executor stop prompts/blog-system

    # Schedule a one-shot run at a specific time
    python3 -m prompt_executor schedule prompts/blog-system --at "2026-04-17 09:00" -m opus

    # Schedule a one-shot run 90 seconds from now
    python3 -m prompt_executor schedule prompts/blog-system --in 90s -m flash

    # List all scheduled jobs
    python3 -m prompt_executor schedule list

    # Remove a scheduled job by ID
    python3 -m prompt_executor schedule remove sch_01HZ...

    # Recurring cron: every weekday at 09:00
    python3 -m prompt_executor cron prompts/blog-system --expr "0 9 * * 1-5" -m sonnet

    # Recurring cron: every minute (smoke test)
    python3 -m prompt_executor cron prompts/blog-system --expr "* * * * *" -m flash

    # Stop everything (prompts for confirmation)
    python3 -m prompt_executor stop

    # Stop everything without confirmation (CI-safe)
    python3 -m prompt_executor stop --yes

    # Only remove scheduled jobs; leave running daemons + crons alone
    python3 -m prompt_executor stop --scheduled-only --yes

    # Analyze logs and produce a fix plan
    python3 -m prompt_executor doctor prompts/blog-system
"""

from __future__ import annotations

import argparse
import atexit
import json
import os
import re
import secrets
import signal
import subprocess
import sys
import time
import traceback as tb_module
from collections import namedtuple
from datetime import datetime, timedelta
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────────
#
# Every default value, threshold, regex pattern, and classification table
# lives in `config.py`. Re-exporting wholesale keeps the public surface
# (`prompt_executor.SCRIPT_DIR`, `prompt_executor.MAX_RETRIES`, etc.)
# intact for tests and external callers.
from .config import *  # noqa: F401, F403

# Python's `import *` skips underscore-prefixed names by default. The
# executor's helpers reference these private constants directly, so import
# them explicitly so they're bound in this module's namespace.
from .config import (  # noqa: F401
    _SORTED_ALIAS_KEYS,
    _JSONC_LINE_COMMENT,
    _JSONC_BLOCK_COMMENT,
    _JSONC_TRAILING_COMMA,
)

# Pure helpers and storage operations live in dedicated submodules. Re-export
# them so `prompt_executor.X` remains a valid attribute path for tests and
# external callers — internal call sites in this module pick up the same
# binding so test patches on `prompt_executor.X` propagate.
from .utils import (  # noqa: F401
    _classify_stderr,
    _filename_descriptor,
    _is_reference_prompt,
    _load_dotenv,
    _no_change_ok_kind,
    _parse_cron_field,
    _pid_alive,
    _strip_model_alias_suffix,
    _strip_numeric_prefix,
    _sweep_descendants,
    detect_backend,
    extract_model_from_filename,
    find_matching_executor_pids,
    is_autocompact_error,
    is_credit_error,
    is_done,
    is_reference_file,
    next_fire_after,
    parse_cron_expr,
    parse_duration,
)
from .storage import (  # noqa: F401
    JOB_STORE_VERSION,
    JobStore,
    _empty_store,
    _find_opencode_config,
    _make_job_id,
    _parse_jsonc,
    detect_git_changes,
    get_pending_files_in_dir,
    has_done_files_in_dir,
    is_dir_fully_complete,
    resolve_target_folder,
    snapshot_git_state,
)


# ── Dotenv loading at module-import time ──────────────────────────────────
#
# `_load_dotenv` itself lives in utils.py; the call site stays here because
# it must run during package import (after `from .config import *` makes
# PROJECT_ROOT available, before anything else may need env vars).
_DOTENV_LOADED_COUNT = _load_dotenv(PROJECT_ROOT / ".env")

# Runtime files — initialized per-instance by init_runtime_files()
# Each instance gets its own files keyed by target folder name.
PID_FILE: Path | None = None
LOG_FILE: Path | None = None
FAILURES_FILE: Path | None = None


def init_runtime_files(target_folder: Path) -> str:
    """
    Derive runtime file paths from target folder name for parallel execution.
    Returns the slug used for file naming.
    """
    global PID_FILE, LOG_FILE, FAILURES_FILE
    slug = target_folder.name  # e.g., "fire-and-forget", "blog-system"
    PID_FILE = SCRIPT_DIR / f".prompt_executor_{slug}.pid"
    LOG_FILE = SCRIPT_DIR / f".prompt_executor_{slug}.log"
    FAILURES_FILE = SCRIPT_DIR / f".prompt_executor_{slug}_failures.log"
    return slug


# ── Auto-mode helpers (filename-based model selection + credit-swap) ────────
#
# Auto mode (`--mode=auto`) lets a single folder mix prompt files that target
# different model tiers. The model is derived from a filename suffix:
#
#     01-heavy-refactor-opus-4.7.md     → opus 4.7
#     02-moderate-work-sonnet-4.6.md    → sonnet 4.6
#     03-simple-rename-glm-5.1.md       → glm 5.1
#
# If a run hits a credit/quota error on GLM 5.1, the executor sticky-swaps to
# Claude Haiku 4.5 for the remainder of the run (and vice versa). The swap
# fires ONLY on recognizable credit/quota signatures — not on arbitrary
# failures — so real bugs aren't silently masked.
#
# `_SORTED_ALIAS_KEYS`, `SWAP_PAIRS`, `CREDIT_ERROR_PATTERNS`, and the
# escalation tables live in `config.py` and arrive here via the wildcard
# re-export at the top of this file.


# NOTE: Provider authentication is delegated to the CLI's own credential
# store. Claude reads ~/.claude/ (populated by `claude login`); OpenCode
# reads ~/.local/share/opencode/auth.json (populated by `opencode auth
# login`, e.g. the Z.AI Coding Plan). The executor deliberately does NOT
# validate or forward ANTHROPIC_API_KEY / ZAI_API_KEY. If a CLI reports an
# auth failure at runtime, it will be surfaced via the doctor AUTH
# classifier below with a recommendation to re-run the CLI login command.


def _ensure_opencode_config(working_dir: Path) -> None:
    """Log warnings about the discovered opencode config.

    Two checks:
      1. Config file is discoverable. If not, MCP servers and custom agents
         will NOT be loaded.
      2. Config declares a top-level `permission` block. Opencode >= 1.0.x
         removed `--dangerously-skip-permissions`; without a permission
         block it will prompt for every tool call and hang the non-TTY
         subprocess driven by this executor.
    """
    config = _find_opencode_config(working_dir)
    if config is None:
        log(f"  WARNING: No .opencode/opencode.jsonc found under {working_dir}")
        log(f"           MCP servers and custom agents will NOT be loaded.")
        return

    log(f"  Using OpenCode config: {config}")
    try:
        parsed = _parse_jsonc(config.read_text(encoding="utf-8"))
    except OSError as e:
        log(f"  WARNING: Could not read OpenCode config ({e}); skipping permission check.")
        return

    if parsed is None:
        log(
            f"  WARNING: OpenCode config at {config} is not valid JSONC; "
            "cannot verify `permission` block."
        )
        return

    permission = parsed.get("permission")
    if not isinstance(permission, dict) or not permission:
        log(
            f"  WARNING: OpenCode config at {config} has no `permission` block. "
            "Opencode >= 1.0.x will prompt for every tool call and hang this "
            "non-interactive run. Add e.g. "
            '{"permission":{"bash":"allow","edit":"allow","webfetch":"allow",'
            '"websearch":"allow"}} to the config.'
        )


# `_classify_stderr` lives in utils.py — re-imported at the top of this file.


# ── Logging (fsync on every write — nothing is ever lost) ───────────────────


def _maybe_rotate_log() -> None:
    """Rotate LOG_FILE once it crosses LOG_ROTATE_BYTES. Best-effort."""
    try:
        if LOG_FILE.exists() and LOG_FILE.stat().st_size >= LOG_ROTATE_BYTES:
            rotated = LOG_FILE.with_suffix(LOG_FILE.suffix + ".1")
            try:
                if rotated.exists():
                    rotated.unlink()
            except OSError:
                pass
            LOG_FILE.rename(rotated)
    except OSError:
        pass


def log(msg: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}\n"
    try:
        _maybe_rotate_log()
        with open(LOG_FILE, "a") as f:
            f.write(line)
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        pass  # If we can't log, don't crash the process


def log_failure(prompt_path: str, attempts: int, last_error: str) -> None:
    """Append to the dedicated failures log."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(FAILURES_FILE, "a") as f:
            f.write(f"[{timestamp}] SKIPPED: {prompt_path}\n")
            f.write(f"  Attempts: {attempts}\n")
            f.write(f"  Last error: {last_error}\n\n")
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        log(f"  WARNING: Could not write to failures log: {FAILURES_FILE}")


# ── Crash handlers (never die silently) ─────────────────────────────────────


def install_crash_handlers() -> None:
    """Install global exception hook and atexit handler."""

    def crash_handler(exc_type, exc_value, exc_tb):
        tb_str = "".join(tb_module.format_exception(exc_type, exc_value, exc_tb))
        log(f"UNHANDLED EXCEPTION:\n{tb_str}")

    sys.excepthook = crash_handler

    def on_exit():
        log("Process exiting.")

    atexit.register(on_exit)


# ── PID management ──────────────────────────────────────────────────────────


def read_pid() -> int | None:
    try:
        pid = int(PID_FILE.read_text().strip())
        os.kill(pid, 0)
        return pid
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        return None


def write_pid(pid: int) -> None:
    PID_FILE.write_text(str(pid))


def remove_pid() -> None:
    try:
        PID_FILE.unlink()
    except FileNotFoundError:
        pass


def _read_pid_from_file(pid_file: Path) -> int | None:
    """Read PID from an arbitrary PID file (not the global). Used for multi-instance ops."""
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 0)
        return pid
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        return None


def clean_stale_pid() -> None:
    """If PID file exists but process is dead, clean it up."""
    if not PID_FILE.exists():
        return
    pid = read_pid()
    if pid is None:
        log("Cleaned stale PID file from previous crash.")
        remove_pid()


# `find_matching_executor_pids` lives in utils.py — re-imported at top.


def assert_no_duplicate_executor(target: Path) -> None:
    """Refuse to start a new executor when another is already targeting this folder.

    The existing PID-file check only catches daemons started via `cmd_start`.
    This adds a second layer that scans the process table and catches foreground
    `run` processes and orphaned daemons too. Exits with a helpful error
    instead of silently racing on the same log file.
    """
    rogue_pids = find_matching_executor_pids(target)
    if not rogue_pids:
        return
    slug = target.name
    pid_list = ", ".join(str(p) for p in rogue_pids)
    print(
        f"ERROR: Another prompt_executor is already running for [{slug}] "
        f"(PID(s) {pid_list}).",
        file=sys.stderr,
    )
    print(
        "Stop it first with: "
        f"python3 -m prompt_executor stop {target.relative_to(PROJECT_ROOT) if target.is_absolute() else target}",
        file=sys.stderr,
    )
    print(
        f"Or force-kill any stragglers: kill {pid_list}",
        file=sys.stderr,
    )
    sys.exit(1)


# ── Sleep with heartbeat ───────────────────────────────────────────────────


def safe_sleep(minutes: int, label: str = "next prompt") -> None:
    """Sleep in small chunks with heartbeat logging so we know the process is alive."""
    total_seconds = minutes * 60
    if total_seconds <= 0:
        return
    elapsed = 0
    HEARTBEAT_INTERVAL = 120  # log every 2 minutes
    log(f"  Sleeping {minutes}m before {label}...")
    while elapsed < total_seconds:
        chunk = min(HEARTBEAT_INTERVAL, total_seconds - elapsed)
        time.sleep(chunk)
        elapsed += chunk
        remaining_min = (total_seconds - elapsed) // 60
        if remaining_min > 0:
            log(f"  ... heartbeat ({remaining_min}m remaining)")


# ── Folder/path resolution ──────────────────────────────────────────────────
#
# `resolve_target_folder`, `is_done`, `_strip_numeric_prefix`,
# `_strip_model_alias_suffix`, `_filename_descriptor`, `is_reference_file`
# all live in utils.py / storage.py — re-imported at top.


def collect_pending_items(directory: Path) -> list[Path]:
    """
    Collect all pending .md files recursively, depth-first, sorted by name.

    At each directory level:
      - Entries sorted alphabetically (numeric prefix ensures correct order)
      - Hidden entries (starting with .) are skipped
      - Folders ending with _done are skipped
      - Files ending with _done.md are skipped
      - .md files are collected in order
      - Sub-directories are recursed into in order

    Returns a flat, ordered list of .md file paths to execute.
    """
    if not directory.exists() or not directory.is_dir():
        return []

    items: list[Path] = []

    for entry in sorted(directory.iterdir(), key=lambda e: e.name):
        # Skip hidden files/folders
        if entry.name.startswith("."):
            continue

        if entry.is_dir():
            # Skip completed folders
            if is_done(entry.name):
                continue
            # Recurse into pending sub-folders
            items.extend(collect_pending_items(entry))

        elif entry.is_file() and entry.suffix == ".md":
            # Skip completed files
            if is_done(entry.stem):
                continue
            # Skip reference / overview / README files — feeding them to the
            # LLM produces text-only output which the file-change gate then
            # rejects, wasting the entire retry budget on an unexecutable file.
            if is_reference_file(entry):
                log(
                    f"  SKIP: Reference file (overview/README, not executable): {entry.name}"
                )
                continue
            # Skip empty / whitespace-only prompt files — executing them would
            # either mark them as done without real work (old bug) or produce
            # confusing LLM responses. Log a warning and leave them on disk.
            try:
                if not entry.read_text(encoding="utf-8").strip():
                    log(f"  SKIP: Empty prompt file (not marked done): {entry.name}")
                    continue
            except (OSError, UnicodeDecodeError) as e:
                log(f"  WARNING: Could not read {entry.name}: {e}")
                continue
            items.append(entry)

    return items


# `get_pending_files_in_dir`, `has_done_files_in_dir`, `is_dir_fully_complete`
# all live in storage.py — re-imported at top.


# ── Rename helpers ──────────────────────────────────────────────────────────


def mark_file_done(filepath: Path) -> Path:
    """Rename file.md -> file_done.md.

    Idempotent: if the LLM already renamed the file (Claude with Bash + bypass
    permissions sometimes infers the `_done` convention from sibling files and
    renames its own prompt mid-run), treat the already-renamed state as
    success instead of crashing with FileNotFoundError. The previous version
    crashed the whole daemon and burned an auto-restart slot every time.
    """
    new_path = filepath.parent / (filepath.stem + "_done" + filepath.suffix)
    src_exists = filepath.exists()
    dst_exists = new_path.exists()

    if src_exists and not dst_exists:
        filepath.rename(new_path)
        log(f"  Renamed: {filepath.name} -> {new_path.name}")
        return new_path

    if not src_exists and dst_exists:
        log(f"  Already renamed by LLM (idempotent): -> {new_path.name}")
        return new_path

    if src_exists and dst_exists:
        # Self-heal byte-identical duplicates. A common cause is a sub-agent
        # running `git stash` / `git stash apply` mid-prompt: the original
        # `.md` gets restored from the stash AFTER the executor renamed it
        # to `_done.md`, leaving both. When contents match exactly the
        # duplicate is safe to remove; the LLM's verdict is already on disk
        # at the `_done.md` path. Genuine divergence still falls through to
        # the safe "leave as-is" branch.
        try:
            if filepath.read_bytes() == new_path.read_bytes():
                filepath.unlink()
                log(
                    f"  Self-healed duplicate: removed {filepath.name} "
                    f"(byte-identical to {new_path.name})"
                )
                return new_path
        except OSError:
            pass
        log(
            f"  WARNING: both {filepath.name} and {new_path.name} exist; "
            f"leaving as-is. Manual cleanup may be required."
        )
        return new_path

    # Neither exists — genuine corruption.
    raise FileNotFoundError(
        f"Cannot mark done: neither {filepath} nor {new_path} exists"
    )


def try_mark_ancestors_done(filepath: Path, target_root: Path) -> None:
    """
    After completing a file, walk up to check if parent folders
    are now fully complete. Mark them _done bottom-up, stopping
    at (but not including) the target_root.
    """
    current = filepath.parent

    while current != target_root and current != target_root.parent:
        if is_dir_fully_complete(current) and has_done_files_in_dir(current):
            new_path = current.parent / (current.name + "_done")
            try:
                current.rename(new_path)
                log(f"  Folder complete: {current.name} -> {new_path.name}")
            except OSError as e:
                log(f"  WARNING: Could not rename folder {current.name}: {e}")
                break
            current = new_path.parent  # Move up
        else:
            break  # Not complete yet, stop


# ── Git-based change detection ────────────────────────────────────────────

PromptResult = namedtuple(
    "PromptResult", ["result_code", "err_msg", "stdout", "files_changed"]
)


# `snapshot_git_state` and `detect_git_changes` live in storage.py.


# ── Prompt execution ───────────────────────────────────────────────────────


def _wrap_prompt_with_directive(prompt_content: str, prompt_rel_path: str) -> str:
    """Wrap raw prompt-file markdown with an execution directive.

    Without this wrapper the LLM receives bare spec markdown via stdin and,
    when the prompt looks documentation-like or sibling prompts appear deleted
    in `git status` (because the executor renamed completed prompts to
    `_done.md`), it bails out with "what would you like me to do?" — which
    the executor (correctly) classifies as unrecoverable, burning the prompt's
    retry budget on the first attempt.

    The wrapper:
    - Frames the markdown as a TASK PROMPT to execute now, not a doc to
      discuss.
    - Forbids the LLM from renaming/deleting the prompt file (also closes the
      `mark_file_done` race; `mark_file_done` itself is idempotent as a
      defence-in-depth fallback).
    - Tells the LLM to ignore suspicious `prompts/` git churn.
    - Tells the LLM that recent commit titles claiming the work is done don't
      count if the diff only added markdown — trust the actual code state.
    """
    return (
        "You are executing an automated prompt-execution pipeline "
        "(prompt-executor.py).\n"
        "The block between the BEGIN/END markers below is a TASK PROMPT.\n"
        "Read it and IMPLEMENT IT NOW using your Edit / Write / Bash tools.\n"
        "\n"
        "CRITICAL RULES (non-negotiable):\n"
        f"  - The prompt file is `{prompt_rel_path}`. The orchestrator handles "
        "done-marking. DO NOT rename, move, or delete it. DO NOT add a "
        "`_done` suffix.\n"
        "  - This is NON-INTERACTIVE. DO NOT ask 'what would you like me to "
        "do?' — the answer is always 'implement the prompt below'.\n"
        "  - The `prompts/` directory normally shows sibling files as deleted "
        "in `git status` — that is the orchestrator renaming completed "
        "prompts. IGNORE it.\n"
        "  - If the prompt declares a dependency on a sibling prompt that "
        "appears deleted/renamed, treat the dependency as ALREADY COMPLETED "
        "and proceed.\n"
        "  - Recent commits whose titles suggest the work was already done "
        "but whose diffs only add markdown files do NOT mean the work is "
        "done. Trust the actual code state, not commit titles.\n"
        "  - If a HARD blocker (missing tool, broken build, true "
        "contradiction) prevents implementation, do as much partial work as "
        "is safe AND surface the specific blocker. Do not stop on "
        "philosophical questions or scope-confirmation requests.\n"
        "  - Honour the project's Docker-only execution rules in `CLAUDE.md`.\n"
        "\n"
        "=== TASK PROMPT BEGINS ===\n"
        f"{prompt_content.rstrip()}\n"
        "=== TASK PROMPT ENDS ===\n"
        "\n"
        "Begin implementation now."
    )


def _build_claude_cmd(model: str) -> list[str]:
    """Build Claude Code CLI command.

    Uses `--permission-mode bypassPermissions` so Claude can actually use
    Edit/Write/Bash tools in non-interactive `-p` mode. Without it, Claude
    may silently produce text-only output because there is no UI to
    approve tool calls, which then trips the "no filesystem changes"
    retry loop in execute_prompt().
    """
    resolved = MODEL_ALIASES.get(model.lower(), model)
    return [
        CLAUDE_BIN,
        "-p",
        "--model",
        resolved,
        "--effort",
        EFFORT,
        "--permission-mode",
        "bypassPermissions",
        "--allowedTools",
        ALLOWED_TOOLS,
        "--output-format",
        "text",
    ]


def _build_opencode_cmd(
    model: str,
    prompt_content: str | None = None,
    prompt_file_path: Path | None = None,
    agent: str | None = None,
    continue_session: bool = False,
) -> tuple[list[str], str | None]:
    """
    Build OpenCode CLI command.

    Returns (cmd, stdin_input). For prompts <=32KB the content is passed as a
    positional argument and stdin_input is None. For prompts >32KB (or when
    prompt_file_path is provided), the prompt is piped via stdin and
    stdin_input holds the content — OpenCode reads stdin when not attached to
    a TTY.

    Valid flags (opencode >= 1.0.137):
      --model provider/model   (required for explicit routing)
      --agent <name>           (primary agent from .opencode/agent/*.md)
      --continue | -c          (resume last session)
      --file <path>            (attach file, repeatable)

    Permissions: the legacy `--dangerously-skip-permissions` flag was removed
    in opencode 1.0.x. Permissions are now declared in the project's
    opencode.jsonc under the top-level "permission" block, e.g.
    { "permission": { "bash": "allow", "edit": "allow", "webfetch": "allow",
    "websearch": "allow" } }. Without that block opencode will prompt for
    every tool call and hang the executor's non-TTY subprocess.
    `_ensure_opencode_config` warns when the block is missing.

    Args:
        model: Short alias (e.g. "glm-5.1") or fully qualified ID
            (e.g. "zai-coding/glm-5.1"). Resolved via MODEL_ALIASES.
        prompt_content: Prompt text (used when prompt_file_path is None and
            prompt is small enough for a positional arg or stdin piping).
        prompt_file_path: Path to a prompt file to attach via --file.
        agent: Optional agent name from .opencode/agent/*.md.
        continue_session: Pass --continue to resume a prior session.
    """
    resolved = MODEL_ALIASES.get(model.lower(), model)
    cmd = [
        OPENCODE_BIN,
        "run",
        "--model",
        resolved,
    ]

    if agent:
        cmd.extend(["--agent", agent])

    if continue_session:
        cmd.append("--continue")

    if prompt_file_path:
        cmd.extend(["--file", str(prompt_file_path)])
        return cmd, None

    if prompt_content is None:
        raise ValueError("Either prompt_content or prompt_file_path must be provided")

    if len(prompt_content) > 32768:
        return cmd, prompt_content

    cmd.append(prompt_content)
    return cmd, None


def _build_codex_cmd(
    model: str,
    prompt_content: str | None = None,
    working_dir: Path | None = None,
) -> tuple[list[str], str | None]:
    """
    Build OpenAI Codex CLI command for non-interactive execution.

    Returns (cmd, stdin_input). For prompts <= 32 KB the content is passed as
    the trailing positional argument and stdin_input is None. For prompts
    > 32 KB, the prompt is replaced with ``-`` so Codex reads it from stdin,
    and stdin_input holds the content.

    Pinned flags for the daemon path (all non-interactive, see
    `.claude/skills/codex-cli/references/prompt-executor-integration.md`):

      codex exec
        --model <resolved>
        --sandbox workspace-write   # safe default, mirrors Claude posture
        --skip-git-repo-check       # executor manages git context itself
        --cd <working_dir>
        --json                      # newline-delimited event stream
        <prompt | ->                # ≤ 32 KB positional; > 32 KB stdin via "-"

    Note: ``--ask-for-approval`` is intentionally NOT passed. The ``codex
    exec`` subcommand is non-interactive by construction and the published
    flag landed on the interactive ``codex`` command, not on ``exec``.
    Passing it to ``exec`` on codex-cli 0.130.x fails with "unexpected
    argument". If a future codex release adds ``--ask-for-approval`` to
    ``exec`` and the executor needs explicit control, re-add it here and
    update the corresponding test.

    Args:
        model: Short alias (e.g. ``"gpt-5.5"``) or fully qualified ID.
            Resolved via MODEL_ALIASES.
        prompt_content: Prompt text to send to Codex. Required.
        working_dir: Workspace root passed as ``--cd``. Defaults to
            PROJECT_ROOT when None.
    """
    if prompt_content is None:
        raise ValueError("prompt_content is required for _build_codex_cmd")

    resolved = MODEL_ALIASES.get(model.lower(), model)
    effective_cwd = working_dir or PROJECT_ROOT

    cmd = [
        CODEX_BIN,
        "exec",
        "--model",
        resolved,
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "--cd",
        str(effective_cwd),
        "--json",
    ]

    # ≤ 32 KB: positional argument. > 32 KB: pipe via stdin using ``-`` so
    # the executor doesn't blow the OS arg-length limit on huge prompts.
    if len(prompt_content) > 32768:
        cmd.append("-")
        return cmd, prompt_content

    cmd.append(prompt_content)
    return cmd, None


def execute_prompt(
    prompt_file: Path,
    model: str,
    backend: str,
    snapshot_before: set[str] | None = None,
    agent: str | None = None,
    working_dir: Path | None = None,
) -> PromptResult:
    """
    Execute a single prompt via Claude Code CLI or OpenCode CLI.
    Returns a PromptResult(result_code, err_msg, stdout, files_changed).

    When snapshot_before is provided, takes a git snapshot after execution
    and compares to detect whether the LLM actually modified files.
    A prompt that exits 0 but produces no file changes is treated as a failure
    (RESULT_ERROR with files_changed=False) so the retry loop will re-attempt it.

    For OpenCode backend:
    - Prompts <= 32KB are passed as positional arguments
    - Prompts > 32KB are piped via stdin (OpenCode reads stdin when not a TTY)

    Args:
        prompt_file: Path to the .md prompt to execute.
        model: Short model alias or fully qualified model ID.
        backend: BACKEND_CLAUDE or BACKEND_OPENCODE.
        snapshot_before: Git state snapshot for change detection.
        agent: Optional agent name for OpenCode backend.
        working_dir: Directory to run the subprocess from. Defaults to PROJECT_ROOT.
    """
    effective_cwd = working_dir or PROJECT_ROOT

    try:
        rel = prompt_file.relative_to(PROJECT_ROOT)
    except ValueError:
        rel = prompt_file

    log(f"  Executing: {rel}")

    if backend == BACKEND_OPENCODE:
        _ensure_opencode_config(effective_cwd)

    try:
        prompt_content = prompt_file.read_text(encoding="utf-8")
    except PermissionError as e:
        log(f"  FATAL: Permission denied reading file: {e}")
        return PromptResult(RESULT_FATAL, str(e), "", True)
    except OSError as e:
        log(f"  FATAL: OS error reading file: {e}")
        return PromptResult(RESULT_FATAL, str(e), "", True)

    if not prompt_content.strip():
        log(f"  SKIP: Empty prompt file")
        return PromptResult(RESULT_SUCCESS, "", "", True)

    # Wrap raw markdown with an execution-directive preamble so the LLM treats
    # the prompt as a task to execute, not a doc to discuss. Applied to both
    # Claude and OpenCode paths. Without this wrapper, Claude/OpenCode bail
    # out with "what would you like me to do?" on dense spec-style prompts —
    # which the executor's CONVERSATIONAL_QUESTION_MARKERS heuristic
    # (correctly) flags as unrecoverable, burning the prompt's retry budget.
    wrapped_prompt = _wrap_prompt_with_directive(prompt_content, str(rel))

    if backend == BACKEND_CLAUDE:
        cmd = _build_claude_cmd(model)
        stdin_input = wrapped_prompt
        resolved_model = MODEL_ALIASES.get(model.lower(), model)
        log(
            f"  CMD: [claude] claude -p --model {resolved_model} --effort {EFFORT} --permission-mode bypassPermissions (stdin: {len(wrapped_prompt)} chars, raw: {len(prompt_content)})"
        )
    elif backend == BACKEND_CODEX:
        resolved_model = MODEL_ALIASES.get(model.lower(), model)
        prompt_size = len(wrapped_prompt)
        cmd, stdin_input = _build_codex_cmd(
            model, prompt_content=wrapped_prompt, working_dir=effective_cwd
        )
        if stdin_input is not None:
            log(
                f"  CMD: [codex] codex exec --model {resolved_model} --sandbox workspace-write --skip-git-repo-check --cd {effective_cwd} --json (stdin: {prompt_size} chars, >32KB; raw: {len(prompt_content)})"
            )
        else:
            log(
                f"  CMD: [codex] codex exec --model {resolved_model} --sandbox workspace-write --skip-git-repo-check --cd {effective_cwd} --json (arg: {prompt_size} chars, raw: {len(prompt_content)})"
            )
    else:
        resolved_model = MODEL_ALIASES.get(model.lower(), model)
        prompt_size = len(wrapped_prompt)
        cmd, stdin_input = _build_opencode_cmd(
            model, prompt_content=wrapped_prompt, agent=agent
        )
        if stdin_input is not None:
            log(
                f"  CMD: [opencode] opencode run --model {resolved_model} (stdin: {prompt_size} chars, >32KB; raw: {len(prompt_content)})"
            )
        else:
            log(
                f"  CMD: [opencode] opencode run --model {resolved_model} (arg: {prompt_size} chars, raw: {len(prompt_content)})"
            )

    if backend == BACKEND_CLAUDE:
        bin_name = CLAUDE_BIN
    elif backend == BACKEND_CODEX:
        bin_name = CODEX_BIN
    else:
        bin_name = OPENCODE_BIN

    # Child inherits MCP config, working-dir env, and OPENCODE_CONFIG.
    # Provider authentication is handled by each CLI's own credential
    # store — `claude login` (~/.claude/) and `opencode auth login`
    # (~/.local/share/opencode/auth.json, e.g. Z.AI Coding Plan). The
    # executor does not inject API keys.
    child_env = os.environ.copy()

    if os.environ.get("OPENCODE_CONFIG"):
        child_env["OPENCODE_CONFIG"] = os.environ["OPENCODE_CONFIG"]

    try:
        # Run in its own session/process group so (a) terminal-control signals
        # (SIGTTIN/SIGTTOU) from the daemon's session can't freeze the child
        # tree into state "T (stopped)" — a failure mode confirmed on this
        # host, where week-old claude trees sat in do_signal_stop — and
        # (b) on timeout we can os.killpg() the whole tree (claude + any MCP
        # node children) instead of only the immediate child.
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(effective_cwd),
            text=True,
            env=child_env,
            start_new_session=True,
        )
        try:
            stdout_raw, stderr_raw = proc.communicate(
                input=stdin_input,
                timeout=TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            # Kill the whole process group; a single .kill() would leave MCP
            # subprocesses orphaned and potentially in the "stopped" state.
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
            try:
                proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            raise

        class _CompletedLite:
            pass

        result = _CompletedLite()
        result.returncode = proc.returncode  # type: ignore[attr-defined]
        result.stdout = stdout_raw  # type: ignore[attr-defined]
        result.stderr = stderr_raw  # type: ignore[attr-defined]

        stdout_text = result.stdout or ""
        if stdout_text:
            tail = stdout_text[-3000:]
            log(f"  STDOUT (last 3000 chars):\n{tail}")
        if result.stderr:
            tail = result.stderr[-1000:]
            log(f"  STDERR:\n{tail}")

        combined_output = stdout_text + (result.stderr or "")
        for pattern in UNRECOVERABLE_ERROR_PATTERNS:
            if pattern in combined_output:
                err_msg = f"Unrecoverable: {pattern}"
                log(f"  SKIP: {err_msg} — skipping prompt without retrying.")
                log_failure(str(rel), 1, err_msg)
                return PromptResult(RESULT_SKIP, err_msg, stdout_text, True)

        if result.returncode != 0:
            stderr_text = result.stderr or ""
            classification = _classify_stderr(stderr_text)
            if classification:
                log(f"  CLASSIFIED: {classification}")
            err_msg = f"{bin_name} exited with code {result.returncode}"
            log(f"  ERROR: {err_msg}")
            return PromptResult(RESULT_ERROR, err_msg, stdout_text, True)

        if snapshot_before is not None:
            snapshot_after = snapshot_git_state(PROJECT_ROOT)
            files_changed = detect_git_changes(snapshot_before, snapshot_after)
            if not files_changed:
                kind = _no_change_ok_kind(prompt_file)
                if kind == "validation":
                    log(
                        f"  INFO: No filesystem changes, but '{prompt_file.name}' "
                        f"is a validation/verify prompt. Text-only PASS report is "
                        f"the expected outcome — treating as success."
                    )
                    return PromptResult(RESULT_SUCCESS, "", stdout_text, False)
                if kind == "reference":
                    log(
                        f"  INFO: No filesystem changes, but '{prompt_file.name}' "
                        f"is a reference/architecture document. Treating as success."
                    )
                    return PromptResult(RESULT_SUCCESS, "", stdout_text, False)
                tail = (stdout_text or "").lower()[-2000:]

                # Group (b) — "already done" audit responses. The LLM verified
                # the deliverable is on disk from earlier work and correctly
                # declined to re-implement. Treat as a real success: the
                # prompt's goal IS achieved, just with no diff this run.
                # Order matters: this check runs FIRST so prompts whose output
                # mentions both an audit-pass AND any clarifying phrasing are
                # biased toward the productive interpretation.
                if any(m in tail for m in ALREADY_DONE_MARKERS):
                    log(
                        f"  SUCCESS: LLM audited the codebase and reports the "
                        f"deliverable is already in place (no diff produced). "
                        f"Treating as completed and marking the prompt done."
                    )
                    return PromptResult(RESULT_SUCCESS, "", stdout_text, False)

                # Only NOW log the warning — pure-audit cases shouldn't be
                # warned about because they are productive responses.
                log(f"  WARNING: Exit code 0 but NO filesystem changes detected.")
                log(f"  WARNING: LLM likely produced text output without using tools.")
                err_msg = (
                    "No filesystem changes detected (text-only output, no tool use)"
                )

                # Group (a) — clarifying-question replies. Retrying the same
                # prompt won't elicit different behavior; the prompt failed
                # to communicate intent. Mark as unrecoverable.
                if any(m in tail for m in CONVERSATIONAL_QUESTION_MARKERS):
                    log(
                        f"  SKIP: LLM replied conversationally "
                        f"('what should I do?'-style). Retrying will not help — "
                        f"marking prompt as unrecoverable."
                    )
                    log_failure(str(rel), 1, err_msg + " [conversational reply]")
                    return PromptResult(RESULT_SKIP, err_msg, stdout_text, False)
                log_failure(str(rel), 1, err_msg)
                return PromptResult(RESULT_ERROR, err_msg, stdout_text, False)

        log(f"  Completed successfully.")
        return PromptResult(RESULT_SUCCESS, "", stdout_text, True)

    except subprocess.TimeoutExpired:
        err_msg = f"Timed out after {TIMEOUT_SECONDS}s"
        log(f"  TIMEOUT: {err_msg}")
        return PromptResult(RESULT_TIMEOUT, err_msg, "", True)

    except FileNotFoundError:
        err_msg = f"'{bin_name}' not found in PATH. Is {backend.title()} installed?"
        log(f"  FATAL: {err_msg}")
        return PromptResult(RESULT_FATAL, err_msg, "", True)

    except MemoryError as e:
        err_msg = f"MemoryError: {e}"
        log(f"  FATAL: {err_msg}")
        return PromptResult(RESULT_FATAL, err_msg, "", True)

    except KeyboardInterrupt:
        raise

    except Exception as e:
        err_msg = f"{type(e).__name__}: {e}"
        log(f"  ERROR: {err_msg}")
        return PromptResult(RESULT_ERROR, err_msg, "", True)


def execute_prompt_with_retry(
    prompt_file: Path,
    max_retries: int,
    retry_wait_min: int,
    model: str,
    backend: str,
    agent: str | None = None,
    working_dir: Path | None = None,
    *,
    auto_mode: bool = False,
    sticky_state: dict | None = None,
    no_sticky_swap: bool = False,
) -> tuple[bool, bool]:
    """
    Execute a prompt with retry logic and a fixed inter-attempt wait.

    Takes a git snapshot before each attempt and verifies file changes
    after each successful execution. If the LLM exits 0 but did not
    modify any files (text-only output), the attempt is treated as a
    retryable failure.

    The wait between attempts is exactly ``retry_wait_min`` minutes every
    time — no exponential backoff, no doubling. ``--retry-wait 1`` means
    one minute between every retry, regardless of attempt number.

    When ``auto_mode=True`` and the failure signature matches a credit or
    quota error, the function will perform a sticky GLM↔Haiku swap: it
    swaps the model for the current attempt and writes the new alias into
    ``sticky_state["overrides"][source_backend]`` (keyed by the failing
    model's backend family — Claude or OpenCode) so the outer run-loop
    keeps using the swapped model for subsequent prompts **of that same
    family**. Cross-family prompts (e.g. a glm-5.1 file after a sonnet
    autocompact) keep routing per their filename. The swap consumes one
    of the ``max_retries`` attempts — it is not a free extra try.

    When ``no_sticky_swap=True`` the sticky-swap logic is fully disabled:
    the per-attempt model is never swapped and ``sticky_state`` is never
    written. Use this for strict per-file model adherence (audit /
    cost-control runs).

    Returns (succeeded: bool, fatal: bool).
    - (True, False)  → prompt completed with real file changes, mark as done
    - (False, False) → all retries exhausted, skip and continue
    - (False, True)  → fatal error, stop everything
    """
    try:
        rel = str(prompt_file.relative_to(PROJECT_ROOT))
    except ValueError:
        rel = str(prompt_file)

    last_error = ""
    # Mutable local copy of the active model. Credit-swap in auto mode may
    # rebind this mid-loop; the outer caller sees the final value through
    # sticky_state["overrides"][source_backend] if it passed a dict in.
    active_model = model
    active_backend = backend

    # Count consecutive TIMEOUTs on the active model. Reset whenever the model
    # is swapped or the result is non-timeout. Used by auto-mode timeout
    # escalation below.
    consecutive_timeouts = 0

    # Snapshot the working tree ONCE before the retry loop. If a later attempt
    # reports "no per-attempt changes" but the tree differs from this baseline,
    # an earlier attempt (typically one that timed out post-write) already did
    # the work — treat that as success instead of looping to exhaustion.
    prompt_start_snapshot = snapshot_git_state(PROJECT_ROOT)

    for attempt in range(1, max_retries + 1):
        log(f"  Attempt {attempt}/{max_retries} (model={active_model})")

        snapshot_before = snapshot_git_state(PROJECT_ROOT)

        pr = execute_prompt(
            prompt_file,
            active_model,
            active_backend,
            snapshot_before,
            agent=agent,
            working_dir=working_dir,
        )

        if pr.result_code == RESULT_SUCCESS:
            return True, False

        if pr.result_code == RESULT_FATAL:
            log(f"  FATAL error on attempt {attempt} — stopping execution.")
            log_failure(rel, attempt, pr.err_msg)
            return False, True

        if pr.result_code == RESULT_SKIP:
            # Auto-mode autocompact escalation. The "Autocompact is thrashing"
            # signature is deterministic on multi-file prompts that exceed the
            # active model's context window. Retrying the same model reproduces
            # the same failure — pointless. Instead, sticky-swap to a 1M-context
            # model and continue the retry loop. One escalation per prompt;
            # don't loop forever if opus also thrashes.
            if (
                auto_mode
                and not no_sticky_swap
                and is_autocompact_error(pr.err_msg)
                and active_model in AUTOCOMPACT_ESCALATION_SOURCES
                and active_model != ESCALATION_TARGET_MODEL
            ):
                # Override is keyed by the failing model's backend family so
                # subsequent cross-family prompts (e.g. glm-5.1 after a sonnet
                # autocompact) still route per their filename.
                source_backend = detect_backend(active_model)
                log(
                    f"  AUTOCOMPACT on '{active_model}' (family={source_backend}). "
                    f"Sticky-swapping to '{ESCALATION_TARGET_MODEL}' (1M context) "
                    f"for remainder of run within the {source_backend} family only."
                )
                active_model = ESCALATION_TARGET_MODEL
                active_backend = detect_backend(active_model)
                if sticky_state is not None:
                    sticky_state["overrides"][source_backend] = active_model
                    sticky_state["reasons"][source_backend] = "autocompact"
                consecutive_timeouts = 0
                last_error = pr.err_msg
                if attempt < max_retries:
                    safe_sleep(
                        retry_wait_min,
                        label=f"retry {attempt + 1} (escalated to {active_model})",
                    )
                else:
                    log(
                        f"  All {max_retries} attempts exhausted for: "
                        f"{prompt_file.name}"
                    )
                continue
            # Already logged to failures file by execute_prompt. Skip retries
            # entirely and let the main loop continue to the next prompt.
            log(f"  SKIPPED (unrecoverable): {prompt_file.name}")
            return False, False

        # Track consecutive timeouts for auto-mode timeout escalation below.
        if pr.result_code == RESULT_TIMEOUT:
            consecutive_timeouts += 1
        else:
            consecutive_timeouts = 0

        # Auto-mode timeout escalation. If the same model has timed out
        # TIMEOUT_ESCALATION_THRESHOLD times in a row, sticky-swap to
        # opus-4.7 for the rest of the run. This catches GLM-5.1 getting
        # stuck on long-reasoning prompts and prevents burning the full
        # max_retries × 1h waiting on a model that clearly isn't coming
        # back. Skips the swap if already on opus or off the source list.
        if (
            auto_mode
            and not no_sticky_swap
            and pr.result_code == RESULT_TIMEOUT
            and consecutive_timeouts >= TIMEOUT_ESCALATION_THRESHOLD
            and active_model in TIMEOUT_ESCALATION_SOURCES
            and active_model != ESCALATION_TARGET_MODEL
        ):
            source_backend = detect_backend(active_model)
            log(
                f"  TIMEOUT escalation: {consecutive_timeouts} timeouts on "
                f"'{active_model}' (family={source_backend}). Sticky-swapping to "
                f"'{ESCALATION_TARGET_MODEL}' for remainder of run within the "
                f"{source_backend} family only."
            )
            active_model = ESCALATION_TARGET_MODEL
            active_backend = detect_backend(active_model)
            if sticky_state is not None:
                sticky_state["overrides"][source_backend] = active_model
                sticky_state["reasons"][source_backend] = "timeout"
            consecutive_timeouts = 0
            # Fall through to the normal retry-wait path below. The swap
            # counts as one of the max_retries attempts — no free extras.

        # Auto-mode sticky credit swap. Only fires when:
        #   1. The user asked for auto mode.
        #   2. The current model is in SWAP_PAIRS (GLM 5.1 or Haiku 4.5 family).
        #   3. The output signature looks like a credit/quota error.
        # A swap replaces active_model/active_backend in place so the *next*
        # retry iteration targets the paired model. We also write the new
        # alias into sticky_state so run_all_prompts keeps using it for
        # subsequent prompts — once credits are gone, stay pivoted.
        if (
            auto_mode
            and not no_sticky_swap
            and active_model in SWAP_PAIRS
            and is_credit_error(pr.stdout, pr.err_msg)
        ):
            swapped_to = SWAP_PAIRS[active_model]
            source_backend = detect_backend(active_model)
            log(
                f"  CREDIT ERROR detected on '{active_model}' (family={source_backend}). "
                f"Sticky-swapping to '{swapped_to}' for remainder of run within the "
                f"{source_backend} family only."
            )
            active_model = swapped_to
            active_backend = detect_backend(active_model)
            if sticky_state is not None:
                sticky_state["overrides"][source_backend] = swapped_to
                sticky_state["reasons"][source_backend] = "credit"
            consecutive_timeouts = 0
            # Fall through to the normal retry-wait path below. The swap
            # counts as one of the max_retries attempts — no free extras.

        # Recovery: the per-attempt diff was empty (RESULT_ERROR with
        # files_changed=False), but the working tree has changed since the
        # prompt started. That means a prior attempt produced files but didn't
        # return cleanly (most commonly: 1h timeout after tool use). Claim
        # success so the caller renames the prompt to _done.md.
        if (
            pr.result_code == RESULT_ERROR
            and not pr.files_changed
            and prompt_start_snapshot is not None
        ):
            snapshot_now = snapshot_git_state(PROJECT_ROOT)
            if (
                snapshot_now is not None
                and snapshot_now != prompt_start_snapshot
            ):
                new_or_changed = snapshot_now - prompt_start_snapshot
                log(
                    f"  RECOVERY: per-attempt diff empty, but working tree "
                    f"changed since prompt start ({len(new_or_changed)} new "
                    f"path(s)). Treating as success — a prior attempt likely "
                    f"produced the work before timing out."
                )
                if new_or_changed:
                    sample = sorted(new_or_changed)[:5]
                    log(f"  RECOVERY: sample paths: {sample}")
                return True, False

        last_error = pr.err_msg

        if attempt < max_retries:
            safe_sleep(retry_wait_min, label=f"retry {attempt + 1}")
        else:
            log(f"  All {max_retries} attempts exhausted for: {prompt_file.name}")

    log_failure(rel, max_retries, last_error)
    return False, False


# ── Main orchestrator ──────────────────────────────────────────────────────


def run_all_prompts(
    target_folder: Path,
    wait_minutes: int,
    max_retries: int,
    retry_wait_min: int,
    model: str,
    backend: str,
    agent: str | None = None,
    working_dir: Path | None = None,
    *,
    mode: str = "manual",
    fallback_model: str | None = None,
    halt_on_fail: bool = False,
    no_sticky_swap: bool = False,
) -> None:
    """Execute all pending prompts in target_folder recursively.

    In manual mode (default), every prompt runs under ``model`` / ``backend``.

    In auto mode (``mode="auto"``), each prompt's model is derived from a
    filename suffix (e.g. ``01-task-opus-4.7.md`` → ``opus-4.7``). Files
    without a recognizable suffix use ``fallback_model`` if provided, or
    are skipped with a warning.

    Sticky-swap: a credit/autocompact/timeout failure triggers a sticky
    swap that is **scoped to the failing model's backend family** (Claude
    or OpenCode). Subsequent prompts targeting that same family use the
    swap target; cross-family prompts (e.g. a glm-5.1 file after a sonnet
    autocompact swap) keep routing per their filename. Pass
    ``no_sticky_swap=True`` to disable the swap entirely and stay strictly
    on the per-file model.
    """
    pending = collect_pending_items(target_folder)

    if not pending:
        log(f"No pending prompts found in: {target_folder}")
        log("All done!")
        return

    total = len(pending)
    log(f"Found {total} pending prompt(s) in: {target_folder}")
    if mode == "auto":
        log(
            f"Config: mode=auto, backend=<per-file>, fallback_model={fallback_model or '(none)'}, "
            f"wait={wait_minutes}m, retries={max_retries}, retry_wait={retry_wait_min}m, "
            f"timeout={TIMEOUT_SECONDS}s"
        )
    else:
        log(
            f"Config: backend={backend}, model={model}, wait={wait_minutes}m, "
            f"retries={max_retries}, retry_wait={retry_wait_min}m, timeout={TIMEOUT_SECONDS}s"
        )
    log(f"Change detection: git-based (files_changed gate enabled)")

    log(f"\nExecution order:")
    for i, p in enumerate(pending, 1):
        try:
            rel = p.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = p
        log(f"  {i:3d}. {rel}")
    log("")

    first_prompt = True
    skipped: list[str] = []
    # Sticky state shared with execute_prompt_with_retry. Overrides are
    # keyed by the backend family of the failing model so subsequent
    # cross-family prompts stay on their filename-targeted model. The
    # ``reasons`` dict records WHY each family was swapped (autocompact /
    # credit / timeout) so log messages stay honest.
    sticky_state: dict = {
        "overrides": {
            BACKEND_CLAUDE: None,
            BACKEND_OPENCODE: None,
        },
        "reasons": {
            BACKEND_CLAUDE: None,
            BACKEND_OPENCODE: None,
        },
    }

    # ── Preflight Claude-family swap ────────────────────────────────────────
    # Some Claude CLI accounts have Opus 1M but NOT Sonnet 1M (Anthropic
    # gates the two tiers separately). On those accounts, large prompts
    # routed to sonnet-4.6 deterministically autocompact-thrash for ~8 min
    # before the in-flight swap kicks in. We can skip that wasted attempt
    # entirely if the user tells us up-front that Sonnet 1M is unavailable.
    #
    # Opt in by setting CLAUDE_SONNET_1M_AVAILABLE=false in the project's
    # .env. Default behavior (unset / true) is unchanged: sonnet runs first,
    # autocompact-swap fires reactively if it thrashes.
    if mode == "auto" and not no_sticky_swap:
        sonnet_1m_avail = os.environ.get(
            "CLAUDE_SONNET_1M_AVAILABLE", "true"
        ).strip().lower()
        if sonnet_1m_avail in ("false", "0", "no", "off"):
            sticky_state["overrides"][BACKEND_CLAUDE] = ESCALATION_TARGET_MODEL
            sticky_state["reasons"][BACKEND_CLAUDE] = "preflight_sonnet_1m_unavailable"
            log(
                f"  Preflight Claude-family swap: CLAUDE_SONNET_1M_AVAILABLE=false. "
                f"Routing all sonnet-targeted prompts to "
                f"'{ESCALATION_TARGET_MODEL}' from the start to avoid the "
                f"deterministic autocompact-thrash on this account. "
                f"(Set CLAUDE_SONNET_1M_AVAILABLE=true once Sonnet 1M is enabled.)"
            )

    for idx, prompt_file in enumerate(pending, 1):
        if not first_prompt:
            safe_sleep(wait_minutes, label=f"prompt {idx}/{total}")
        first_prompt = False

        try:
            rel = prompt_file.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = prompt_file

        log(f"\n{'=' * 60}")
        log(f"PROMPT [{idx}/{total}]: {rel}")
        log(f"{'=' * 60}")

        # Decide which model/backend to use for this prompt.
        if mode == "auto":
            # Step 1: figure out the prompt's intended model from its filename.
            alias = extract_model_from_filename(prompt_file)
            if alias is None:
                if fallback_model:
                    intended_model = fallback_model
                    log(
                        f"  No model suffix in filename; using fallback "
                        f"'{intended_model}'"
                    )
                else:
                    log(
                        f"  SKIPPED: no model suffix in filename and no "
                        f"--model fallback provided. "
                        f"Rename to include a suffix like "
                        f"'-opus-4.7', '-sonnet-4.6', or '-glm-5.1'."
                    )
                    skipped.append(str(rel))
                    continue
            else:
                intended_model = alias

            intended_backend = detect_backend(intended_model)

            # Step 2: a sticky swap from earlier in the run only applies if it
            # was triggered within this prompt's backend family. A sonnet
            # autocompact (Claude) does NOT redirect a glm-5.1 prompt
            # (OpenCode), and vice versa. Cross-family failures can no longer
            # silently reroute prompts to a different provider's quota.
            override_for_family = sticky_state["overrides"].get(intended_backend)
            if override_for_family:
                reason = sticky_state["reasons"].get(intended_backend) or "earlier failure"
                chosen_model = override_for_family
                log(
                    f"  Using sticky-swapped model '{chosen_model}' for "
                    f"{intended_backend} family (triggered by {reason} earlier in this run; "
                    f"filename targeted '{intended_model}')"
                )
            else:
                chosen_model = intended_model
            chosen_backend = detect_backend(chosen_model)
        else:
            chosen_model = model
            chosen_backend = backend

        succeeded, fatal = execute_prompt_with_retry(
            prompt_file,
            max_retries,
            retry_wait_min,
            chosen_model,
            chosen_backend,
            agent=agent,
            working_dir=working_dir,
            auto_mode=(mode == "auto"),
            sticky_state=sticky_state if mode == "auto" else None,
            no_sticky_swap=no_sticky_swap,
        )

        if succeeded:
            mark_file_done(prompt_file)
            try_mark_ancestors_done(prompt_file, target_folder)
        elif fatal:
            log(f"  FATAL failure — stopping all execution.")
            if skipped:
                log(f"\n  Previously skipped prompts ({len(skipped)}):")
                for s in skipped:
                    log(f"    - {s}")
            return
        else:
            skipped.append(str(rel))
            log(f"  SKIPPED (retries exhausted): {prompt_file.name}")
            if halt_on_fail:
                log(
                    f"  HALT: --halt-on-fail set; stopping run on first failure."
                )
                log(f"\n{'=' * 60}")
                log(f"HALTED after failure on: {rel}")
                log(f"Skipped prompt(s) so far ({len(skipped)}):")
                for s in skipped:
                    log(f"  - {s}")
                log(f"Review: {FAILURES_FILE}")
                log(f"{'=' * 60}")
                return
            log(f"  Continuing to next prompt...")

    if is_dir_fully_complete(target_folder) and has_done_files_in_dir(target_folder):
        new_path = target_folder.parent / (target_folder.name + "_done")
        try:
            target_folder.rename(new_path)
            log(f"  Target folder complete: {target_folder.name} -> {new_path.name}")
        except OSError as e:
            log(f"  WARNING: Could not rename target folder: {e}")

    log(f"\n{'=' * 60}")
    if skipped:
        log(f"FINISHED with {len(skipped)} skipped prompt(s):")
        for s in skipped:
            log(f"  - {s}")
        log(f"Review: {FAILURES_FILE}")
    else:
        log("ALL PROMPTS EXECUTED SUCCESSFULLY!")
    log(f"{'=' * 60}")


# ── Resilient runner (auto-restart on crash) ───────────────────────────────


def resilient_run(
    target_folder: Path,
    wait_minutes: int,
    max_retries: int,
    retry_wait_min: int,
    model: str,
    backend: str,
    agent: str | None = None,
    working_dir: Path | None = None,
    *,
    mode: str = "manual",
    fallback_model: str | None = None,
    halt_on_fail: bool = False,
    no_sticky_swap: bool = False,
) -> None:
    """
    Wrap run_all_prompts in a crash-recovery loop.
    If the main loop crashes unexpectedly, wait 2 minutes and resume
    from where it left off (since _done tracking is durable).
    """
    crash_count = 0

    while crash_count < MAX_CRASHES:
        try:
            if not target_folder.exists():
                log(
                    f"Target folder no longer exists (possibly renamed to _done): {target_folder}"
                )
                return
            run_all_prompts(
                target_folder,
                wait_minutes,
                max_retries,
                retry_wait_min,
                model,
                backend,
                agent=agent,
                working_dir=working_dir,
                mode=mode,
                fallback_model=fallback_model,
                halt_on_fail=halt_on_fail,
                no_sticky_swap=no_sticky_swap,
            )
            return  # Normal completion
        except KeyboardInterrupt:
            log("Interrupted by user (KeyboardInterrupt).")
            return
        except SystemExit:
            raise  # Let SIGTERM handler work
        except Exception as e:
            crash_count += 1
            log(f"CRASH #{crash_count}/{MAX_CRASHES}: {type(e).__name__}: {e}")
            log(tb_module.format_exc())
            if crash_count < MAX_CRASHES:
                log(f"Auto-restarting in 2 minutes...")
                time.sleep(120)
                log(f"Resuming from where we left off (crash recovery)...")
            else:
                log(f"Too many crashes ({MAX_CRASHES}). Giving up.")

    if target_folder.exists():
        remaining = collect_pending_items(target_folder)
        if remaining:
            log(
                f"WARNING: {len(remaining)} prompt(s) still pending after {MAX_CRASHES} crashes."
            )


# ── Daemon ──────────────────────────────────────────────────────────────────


def daemonize() -> None:
    """Double-fork to detach from terminal. stderr → log file (not /dev/null)."""
    pid = os.fork()
    if pid > 0:
        sys.exit(0)

    os.setsid()

    pid = os.fork()
    if pid > 0:
        sys.exit(0)

    sys.stdout.flush()
    sys.stderr.flush()

    # stdin → /dev/null
    devnull = os.open(os.devnull, os.O_RDWR)
    os.dup2(devnull, 0)
    os.close(devnull)

    # stdout + stderr → log file (so Python tracebacks are captured)
    log_fd = os.open(str(LOG_FILE), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(log_fd, 1)
    os.dup2(log_fd, 2)
    os.close(log_fd)


def setup_signals() -> None:
    """Install signal handlers for graceful shutdown."""

    def handle_sigterm(signum, frame):  # pragma: no cover
        log(f"Received signal {signum}, shutting down.")
        remove_pid()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)


# ── Job Store (schedule + cron persistence) ─────────────────────────────────
#
# Single JSON document at JOBS_FILE. Writes are atomic: we serialize to a
# sibling ".tmp" file with fsync, then os.replace() to the target path.
# Reads tolerate a missing file (returns the empty-store skeleton) and a
# corrupted file (logs to stderr, returns the empty skeleton — the operator
# can recover from .prompt_executor_jobs.json.bak which we also write).
#
# Schema:
#   {
#     "version": 1,
#     "schedules": [ <schedule_job>, ... ],
#     "crons":     [ <cron_job>, ... ]
#   }
#
# A schedule_job has: id, folder, model, agent, period, max_retries,
# retry_wait, working_dir, at_iso, created_at_iso.
# A cron_job additionally has: expr, last_run_iso, next_run_iso.

# `JOB_STORE_VERSION`, `_empty_store`, `_make_job_id`, and `JobStore` live in
# `storage.py`. Cron parser (`_parse_cron_field`, `parse_cron_expr`,
# `next_fire_after`) and `parse_duration` live in `utils.py`. All are
# re-exported at the top of this file so test patches on `prompt_executor.X`
# continue to update the binding the rest of this module sees.


# ── Failure Classifier + Doctor ─────────────────────────────────────────────
#
# Extends the existing _classify_stderr() (which recognises MCP_ERROR and
# SKILL_ERROR) with additional categories. The doctor command groups log
# + _failures.log entries by prompt path, classifies each failure, and
# writes .prompt_executor_{slug}_fixplan.md with per-prompt recommendations.
#
# Categories (most specific first):
#   MCP_ERROR       — MCP server failures, timeouts, auth issues
#   SKILL_ERROR     — skill not found, validation failures, permission denied
#   RATE_LIMIT      — 429 / "rate limit"
#   QUOTA           — "quota exceeded" / "insufficient_quota"
#   AUTH            — 401/403 / "invalid api key"
#   TIMEOUT         — subprocess TimeoutExpired / elapsed >= TIMEOUT_SECONDS
#   UNRECOVERABLE   — matches the existing unrecoverable skip list
#   EXTERNAL        — DNS failures / 5xx from provider
#   TRANSIENT       — default (covered by --max-retries)

DOCTOR_CATEGORY_MCP = "MCP_ERROR"
DOCTOR_CATEGORY_SKILL = "SKILL_ERROR"
DOCTOR_CATEGORY_RATE_LIMIT = "RATE_LIMIT"
DOCTOR_CATEGORY_QUOTA = "QUOTA"
DOCTOR_CATEGORY_AUTH = "AUTH"
DOCTOR_CATEGORY_TIMEOUT = "TIMEOUT"
DOCTOR_CATEGORY_UNRECOVERABLE = "UNRECOVERABLE"
DOCTOR_CATEGORY_EXTERNAL = "EXTERNAL"
DOCTOR_CATEGORY_TRANSIENT = "TRANSIENT"

_DOCTOR_RECOMMENDATIONS = {
    DOCTOR_CATEGORY_MCP: (
        "MCP server error. Run the `mcp-manager` skill "
        "or `mcp__context-mode__doctor` to diagnose. Restart the affected "
        "MCP server before re-running this prompt."
    ),
    DOCTOR_CATEGORY_SKILL: (
        "Skill not found or invalid. Re-run "
        "`scripts/validate_skills.py` and confirm the skill is installed "
        "under `.opencode/` or `.claude/skills/`. Fix by hand — never "
        "edit the prompt silently."
    ),
    DOCTOR_CATEGORY_RATE_LIMIT: (
        "Provider rate-limited the request. Bump `--retry-wait` "
        "(default 10 min) or switch to a cheaper/faster model "
        "(flash / haiku) for this folder."
    ),
    DOCTOR_CATEGORY_QUOTA: (
        "Account quota exhausted. Skip this prompt, top up "
        "credits in the provider dashboard, then re-queue."
    ),
    DOCTOR_CATEGORY_AUTH: (
        "Authentication failed. For Claude backend, run `claude login`. "
        "For OpenCode backend, run `opencode auth login` and select the "
        "Z.AI Coding Plan. Do NOT add API keys to .env — the executor "
        "relies on each CLI's own credential store."
    ),
    DOCTOR_CATEGORY_TIMEOUT: (
        "Subprocess exceeded the per-prompt timeout "
        "(default 1 h). Split the prompt into smaller phases or raise "
        "TIMEOUT_SECONDS."
    ),
    DOCTOR_CATEGORY_UNRECOVERABLE: (
        "Already flagged as unrecoverable by the executor "
        "(autocompact thrashing, missing model, etc.). Edit the prompt or "
        "pick a different model."
    ),
    DOCTOR_CATEGORY_EXTERNAL: (
        "External service degraded (DNS / 5xx / connection "
        "refused). Wait it out — not an executor bug."
    ),
    DOCTOR_CATEGORY_TRANSIENT: (
        "Transient error — already handled by the normal "
        "`--max-retries` loop. No action needed unless the failure count "
        "is unusually high."
    ),
}


def _classify_failure_reason(
    stderr: str | None,
    exit_code: int | None = None,
    elapsed_s: float | None = None,
) -> str:
    """
    Extended classifier used by the doctor. Returns one of the
    DOCTOR_CATEGORY_* constants. Never returns None — defaults to
    TRANSIENT so every failure gets a recommendation.
    """
    s = (stderr or "").lower()

    # Timeouts first (explicit signal), before any pattern matching.
    if "timeoutexpired" in s or "timed out" in s:
        return DOCTOR_CATEGORY_TIMEOUT
    if elapsed_s is not None and elapsed_s >= TIMEOUT_SECONDS:
        return DOCTOR_CATEGORY_TIMEOUT

    # Existing MCP / skill patterns (reuse the module-level classifier).
    existing = _classify_stderr(stderr or "")
    if existing == "MCP_ERROR":
        return DOCTOR_CATEGORY_MCP
    if existing == "SKILL_ERROR":
        return DOCTOR_CATEGORY_SKILL

    # Rate-limit / quota / auth — string contains is enough; we're not
    # trying to match every possible phrasing.
    if "rate limit" in s or "rate-limit" in s or "429 too many" in s:
        return DOCTOR_CATEGORY_RATE_LIMIT
    if "quota" in s or "insufficient_quota" in s or "exceeded quota" in s:
        return DOCTOR_CATEGORY_QUOTA
    if (
        "invalid api key" in s
        or "authentication failed" in s
        or "unauthori" in s  # covers unauthorised / unauthorized
        or "401 " in s
        or "403 " in s
    ):
        return DOCTOR_CATEGORY_AUTH

    # Unrecoverable keywords the executor itself already flags.
    if (
        "autocompact is thrashing" in s
        or "providermodelnotfounderror" in s
        or "no such model" in s
    ):
        return DOCTOR_CATEGORY_UNRECOVERABLE

    # External / infrastructure.
    if (
        "name or service not known" in s
        or "temporary failure in name resolution" in s
        or "connection refused" in s
        or "connection reset" in s
        or "502 bad gateway" in s
        or "503 service unavailable" in s
        or "504 gateway timeout" in s
    ):
        return DOCTOR_CATEGORY_EXTERNAL

    return DOCTOR_CATEGORY_TRANSIENT


# Failure log format (see log_failure at line ~600):
#   [iso-timestamp] SKIPPED: <path>  attempts=<n>  last_error=<...>
# Each entry is one line. The doctor parses these to reconstruct a map
# prompt_path -> (attempts, last_error).
_FAILURE_LINE_RE = re.compile(
    r"^\[(?P<ts>[^\]]+)\]\s*SKIPPED:\s*(?P<path>[^\s]+)\s+"
    r"attempts=(?P<attempts>\d+)\s+last_error=(?P<err>.*)$"
)


def _parse_failure_log(path: Path) -> list[dict]:
    """Parse a failures log into a list of dicts. Missing file → []."""
    if not path.exists():
        return []
    out: list[dict] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    for line in text.splitlines():
        m = _FAILURE_LINE_RE.match(line.strip())
        if not m:
            continue
        out.append(
            {
                "ts": m.group("ts"),
                "path": m.group("path"),
                "attempts": int(m.group("attempts")),
                "last_error": m.group("err"),
            }
        )
    return out


def _generate_fix_plan(slug: str, failures: list[dict]) -> str:
    """Render a markdown fix-plan for the given slug + failures list."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines: list[str] = [
        f"# Prompt Executor Doctor Report — {slug}",
        "",
        f"Generated: {ts}",
        f"Failures analyzed: {len(failures)}",
        "",
        "This file is **advisory only**. The executor never edits prompts "
        "or `prompt_executor.py` itself — apply the recommendations by hand.",
        "",
    ]
    if not failures:
        lines.append("No skipped prompts found. Nothing to fix.")
        return "\n".join(lines) + "\n"

    # Aggregate by category first, so the operator sees the shape of the
    # problem before drilling into individual prompts.
    by_category: dict[str, list[dict]] = {}
    for f in failures:
        cat = _classify_failure_reason(f.get("last_error", ""))
        f["_category"] = cat
        by_category.setdefault(cat, []).append(f)

    lines.append("## Category summary")
    lines.append("")
    lines.append("| Category | Count | Recommendation |")
    lines.append("|---|---|---|")
    for cat in sorted(by_category.keys()):
        count = len(by_category[cat])
        rec = _DOCTOR_RECOMMENDATIONS.get(cat, "").split(".")[0]
        lines.append(f"| `{cat}` | {count} | {rec} |")
    lines.append("")
    lines.append("## Per-prompt detail")
    lines.append("")
    for f in failures:
        cat = f["_category"]
        rec = _DOCTOR_RECOMMENDATIONS.get(cat, "")
        lines.append(f"### `{f['path']}`")
        lines.append("")
        lines.append(f"- **Category:** `{cat}`")
        lines.append(f"- **Attempts:** {f['attempts']}")
        lines.append(f"- **Last error:** `{f['last_error']}`")
        lines.append(f"- **Timestamp:** {f['ts']}")
        lines.append(f"- **Recommendation:** {rec}")
        lines.append("")
    return "\n".join(lines) + "\n"


def run_doctor(target_folder: Path | None) -> Path | None:
    """
    Run the doctor against one folder (or, if target_folder is None,
    every failures log in SCRIPT_DIR). Writes a .prompt_executor_{slug}
    _fixplan.md next to the failures log and returns the fix-plan path
    (or None if no failures logs exist).
    """
    if target_folder is None:
        failure_files = sorted(SCRIPT_DIR.glob(".prompt_executor_*_failures.log"))
    else:
        slug = target_folder.name
        failure_files = [SCRIPT_DIR / f".prompt_executor_{slug}_failures.log"]
    written: list[Path] = []
    for ff in failure_files:
        if not ff.exists():
            continue
        slug = ff.stem.replace(".prompt_executor_", "").replace("_failures", "")
        failures = _parse_failure_log(ff)
        report = _generate_fix_plan(slug, failures)
        out_path = SCRIPT_DIR / f".prompt_executor_{slug}_fixplan.md"
        out_path.write_text(report, encoding="utf-8")
        written.append(out_path)
    return written[0] if written else None


# ── Scheduler Daemon ────────────────────────────────────────────────────────
#
# Long-lived background process that owns the schedule/cron job store.
# Reads the store on every tick (so adds/removes take effect live), fires
# any due jobs by Popen-ing "python3 -m prompt_executor run ..." as a subprocess,
# then sleeps SCHEDULER_TICK_SECONDS.
#
# One-shot schedules are deleted from the store immediately after they
# fire so they never run twice — even if the daemon crashes mid-tick,
# worst case the job fires a second time on recovery (idempotency is up
# to the prompt author).
#
# Cron jobs update last_run_iso / next_run_iso in place and stay in the
# store forever (until explicitly removed via `cron remove`).


def _spawn_run(
    folder: str,
    model: str,
    agent: str | None,
    period: int,
    max_retries: int,
    retry_wait: int,
    working_dir: str | None,
    halt_on_fail: bool = False,
    no_sticky_swap: bool = False,
) -> int:
    """
    Fire off a single `python3 -m prompt_executor run` subprocess. Returns the
    child PID. The subprocess inherits our env (MCP config, OPENCODE_CONFIG,
    working-dir env — not API keys; provider auth comes from each CLI's own
    credential store). Stdout/stderr are redirected to the per-folder log
    via the `run` command's own logging.
    """
    cmd: list[str] = [
        sys.executable,
        "-m",
        "prompt_executor",
        "run",
        folder,
        "--model",
        model,
        "--period",
        str(period),
        "--max-retries",
        str(max_retries),
        "--retry-wait",
        str(retry_wait),
    ]
    if agent:
        cmd.extend(["--agent", agent])
    if working_dir:
        cmd.extend(["--working-dir", working_dir])
    if halt_on_fail:
        cmd.append("--halt-on-fail")
    if no_sticky_swap:
        cmd.append("--no-sticky-swap")
    # Detach so the child survives if the scheduler daemon exits. cwd
    # must be `prompt-executor/` so `-m prompt_executor` resolves.
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        cwd=str(SCRIPT_DIR),
    )
    return proc.pid


def _scheduler_log(msg: str) -> None:
    """Write to the scheduler's own log file (fsync'd)."""
    SCHEDULER_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}\n"
    with SCHEDULER_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(line)
        f.flush()
        try:
            os.fsync(f.fileno())
        except OSError:
            pass


def _scheduler_is_running() -> bool:
    """True if the scheduler daemon's PID file points at a live process."""
    pid = _read_pid_from_file(SCHEDULER_PID_FILE)
    if not pid:
        return False
    return _pid_alive(pid)


def _scheduler_tick(now: datetime | None = None) -> int:
    """
    Single scheduler pass. Returns the number of jobs fired.

    Exposed at module level so tests can drive it deterministically with
    a frozen `now`.
    """
    if now is None:
        now = datetime.now()
    store = JobStore()
    data = store.read()
    fired = 0

    # One-shot schedules: fire every job whose at_iso <= now, then remove.
    remaining_schedules: list[dict] = []
    for job in data.get("schedules", []):
        try:
            at = datetime.fromisoformat(job["at_iso"])
        except (KeyError, ValueError):
            _scheduler_log(f"ERROR: schedule {job.get('id')} has bad at_iso; dropping.")
            continue
        if at <= now:
            try:
                pid = _spawn_run(
                    job["folder"],
                    job["model"],
                    job.get("agent"),
                    int(job.get("period", WAIT_MINUTES)),
                    int(job.get("max_retries", MAX_RETRIES)),
                    int(job.get("retry_wait", RETRY_WAIT_MINUTES)),
                    job.get("working_dir"),
                    halt_on_fail=bool(job.get("halt_on_fail", False)),
                    no_sticky_swap=bool(job.get("no_sticky_swap", False)),
                )
                _scheduler_log(
                    f"FIRED schedule {job['id']} → pid {pid} "
                    f"folder={job['folder']} model={job['model']}"
                )
                fired += 1
            except Exception as e:  # pragma: no cover — defensive
                _scheduler_log(f"ERROR firing schedule {job.get('id')}: {e}")
                remaining_schedules.append(job)
        else:
            remaining_schedules.append(job)
    data["schedules"] = remaining_schedules

    # Cron jobs: fire when next_run_iso <= now, then advance next_run_iso.
    for job in data.get("crons", []):
        expr = job.get("expr")
        if not expr:
            continue
        next_run_iso = job.get("next_run_iso")
        if not next_run_iso:
            # Freshly added, compute from scratch.
            try:
                job["next_run_iso"] = next_fire_after(expr, now).isoformat()
            except ValueError:
                _scheduler_log(
                    f"ERROR: cron {job.get('id')} has bad expr {expr!r}; dropping next_run."
                )
            continue
        try:
            due = datetime.fromisoformat(next_run_iso)
        except ValueError:
            _scheduler_log(
                f"ERROR: cron {job.get('id')} has bad next_run_iso; recomputing."
            )
            job["next_run_iso"] = next_fire_after(expr, now).isoformat()
            continue
        if due <= now:
            try:
                pid = _spawn_run(
                    job["folder"],
                    job["model"],
                    job.get("agent"),
                    int(job.get("period", WAIT_MINUTES)),
                    int(job.get("max_retries", MAX_RETRIES)),
                    int(job.get("retry_wait", RETRY_WAIT_MINUTES)),
                    job.get("working_dir"),
                    halt_on_fail=bool(job.get("halt_on_fail", False)),
                    no_sticky_swap=bool(job.get("no_sticky_swap", False)),
                )
                job["last_run_iso"] = now.isoformat()
                job["next_run_iso"] = next_fire_after(expr, now).isoformat()
                _scheduler_log(
                    f"FIRED cron {job['id']} → pid {pid} "
                    f"folder={job['folder']} next={job['next_run_iso']}"
                )
                fired += 1
            except Exception as e:  # pragma: no cover — defensive
                _scheduler_log(f"ERROR firing cron {job.get('id')}: {e}")
    store.write(data)
    return fired


def _scheduler_main_loop() -> None:
    """Wake every SCHEDULER_TICK_SECONDS, fire due jobs, repeat forever."""
    _scheduler_log(
        f"scheduler-daemon started (tick={SCHEDULER_TICK_SECONDS}s, "
        f"jobs={JOBS_FILE})"
    )
    while True:
        try:
            fired = _scheduler_tick()
            if fired:
                _scheduler_log(f"tick complete, fired {fired} job(s)")
        except Exception as e:
            _scheduler_log(f"CRASH in tick: {type(e).__name__}: {e}")
            _scheduler_log(tb_module.format_exc())
        time.sleep(SCHEDULER_TICK_SECONDS)


def _start_scheduler_daemon_if_needed() -> None:
    """
    Idempotent: no-op if the scheduler daemon is already running. Else
    spawn ourselves with `scheduler-daemon` and return once the child has
    daemonized. Used by `schedule` / `cron` add paths so the operator
    never has to think about the daemon lifecycle.
    """
    if _scheduler_is_running():
        return
    # Clean stale PID file, then spawn.
    if SCHEDULER_PID_FILE.exists():
        try:
            SCHEDULER_PID_FILE.unlink()
        except OSError:
            pass
    cmd = [sys.executable, "-m", "prompt_executor", "scheduler-daemon"]
    subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        cwd=str(SCRIPT_DIR),
    )
    # Wait briefly for PID file to appear so `status` immediately reflects it.
    for _ in range(20):
        if _scheduler_is_running():
            return
        time.sleep(0.1)


# ── Commands ────────────────────────────────────────────────────────────────


def cmd_start(args: argparse.Namespace) -> None:
    apply_mode_defaults(args)
    apply_runtime_overrides(args)
    target = resolve_target_folder(args.folder)
    slug = init_runtime_files(target)
    mode = getattr(args, "mode", "manual")
    # In auto mode, backend is resolved per-prompt. The value passed through
    # here is used only as a logging placeholder and as the backend for the
    # fallback model (if any).
    backend_seed_model = args.model or "auto"
    backend = detect_backend(backend_seed_model) if args.model else BACKEND_OPENCODE
    agent = getattr(args, "agent", None)
    working_dir = getattr(args, "working_dir", None) or PROJECT_ROOT

    existing = read_pid()
    if existing:
        print(f"Already running for [{slug}] (PID {existing}). Stop it first.")
        sys.exit(1)

    clean_stale_pid()
    assert_no_duplicate_executor(target)

    print(f"Starting prompt executor daemon [{slug}]...")
    print(f"  Target: {target}")
    print(f"  Mode: {mode}")
    if mode == "auto":
        print(f"  Model: <per-file> (fallback: {args.model or '(none)'})")
    else:
        print(f"  Backend: {backend}  Model: {args.model}")
    if agent:
        print(f"  Agent: {agent}")
    print(
        f"  wait={args.period}m  retries={args.max_retries}  retry_wait={args.retry_wait}m"
    )
    if getattr(args, "halt_on_fail", False):
        print(f"  halt_on_fail: ON (stop on first failing prompt)")
    if getattr(args, "no_sticky_swap", False):
        print(f"  no_sticky_swap: ON (strict per-file model, no escalation)")
    print(f"  PID file: {PID_FILE}")
    print(f"  Log: {LOG_FILE}")
    print(f"  Failures: {FAILURES_FILE}")

    daemonize()
    install_crash_handlers()
    setup_signals()
    log(
        f"Daemon started [{slug}] (PID {os.getpid()}, target={target}, mode={mode}, "
        f"model={args.model or '(per-file)'}, backend={backend}, agent={agent}, "
        f"wait={args.period}m, retries={args.max_retries})"
    )
    write_pid(os.getpid())

    resilient_run(
        target,
        args.period,
        args.max_retries,
        args.retry_wait,
        args.model or "",
        backend,
        agent=agent,
        working_dir=working_dir,
        mode=mode,
        fallback_model=args.model,
        halt_on_fail=bool(getattr(args, "halt_on_fail", False)),
        no_sticky_swap=bool(getattr(args, "no_sticky_swap", False)),
    )

    remove_pid()
    log("Daemon finished — all work complete or max crashes reached.")


def cmd_run(args: argparse.Namespace) -> None:
    """Run in foreground (no daemonization)."""
    apply_mode_defaults(args)
    apply_runtime_overrides(args)
    target = resolve_target_folder(args.folder)
    slug = init_runtime_files(target)
    mode = getattr(args, "mode", "manual")
    backend_seed_model = args.model or "auto"
    backend = detect_backend(backend_seed_model) if args.model else BACKEND_OPENCODE
    agent = getattr(args, "agent", None)
    working_dir = getattr(args, "working_dir", None) or PROJECT_ROOT

    existing = read_pid()
    if existing:
        print(f"Already running for [{slug}] (PID {existing}). Stop it first.")
        sys.exit(1)

    clean_stale_pid()
    assert_no_duplicate_executor(target)

    pending = collect_pending_items(target)

    print(f"Running prompt executor in foreground [{slug}]...")
    print(f"  Target: {target}")
    print(f"  Mode: {mode}")
    if mode == "auto":
        print(f"  Model: <per-file> (fallback: {args.model or '(none)'})")
    else:
        print(f"  Backend: {backend}  Model: {args.model}")
    if agent:
        print(f"  Agent: {agent}")
    print(f"  Pending: {len(pending)} prompt(s)")
    print(
        f"  wait={args.period}m  retries={args.max_retries}  retry_wait={args.retry_wait}m"
    )
    if getattr(args, "halt_on_fail", False):
        print(f"  halt_on_fail: ON (stop on first failing prompt)")
    if getattr(args, "no_sticky_swap", False):
        print(f"  no_sticky_swap: ON (strict per-file model, no escalation)")
    print(f"  PID file: {PID_FILE}")
    print(f"  Log: {LOG_FILE}")
    print(f"  Failures: {FAILURES_FILE}")

    if not pending:
        print("\n  No pending prompts found. Nothing to do.")
        return

    print(f"\n  Execution order:")
    for i, p in enumerate(pending, 1):
        try:
            rel = p.relative_to(PROJECT_ROOT)
        except ValueError:
            rel = p
        print(f"    {i:3d}. {rel}")
    print()

    install_crash_handlers()
    setup_signals()
    log(
        f"Foreground run started (PID {os.getpid()}, target={target}, mode={mode}, "
        f"model={args.model or '(per-file)'}, backend={backend}, agent={agent}, "
        f"wait={args.period}m, retries={args.max_retries})"
    )

    resilient_run(
        target,
        args.period,
        args.max_retries,
        args.retry_wait,
        args.model or "",
        backend,
        agent=agent,
        working_dir=working_dir,
        mode=mode,
        fallback_model=args.model,
        halt_on_fail=bool(getattr(args, "halt_on_fail", False)),
        no_sticky_swap=bool(getattr(args, "no_sticky_swap", False)),
    )

    log("Foreground run finished.")


# `_pid_alive` and `_sweep_descendants` live in utils.py.


def _stop_pid_file(pid_file: Path) -> bool:
    """
    Stop the instance tracked by a PID file and ALL of its descendants.

    Strategy:
      1. Look up the daemon's process group (PGID). The daemon called
         ``os.setsid()`` during daemonization so PGID == PID in the normal
         case. Fall back to the PID if getpgid fails.
      2. Send SIGTERM to the whole process group via ``killpg``. This
         reaches the daemon and any in-flight ``claude`` / ``opencode``
         subprocess it spawned.
      3. Wait up to 10 seconds for graceful exit.
      4. Any survivor in the group gets SIGKILL via ``killpg``.
      5. As a final safety net, walk /proc and SIGKILL any process whose
         PPid chain still traces back to the daemon (catches grandchildren
         that set up their own session).

    Returns True if we found and acted on a live PID.
    """
    pid = _read_pid_from_file(pid_file)
    if not pid:
        try:
            pid_file.unlink()
        except FileNotFoundError:
            pass
        return False

    slug = pid_file.stem.replace(".prompt_executor_", "")
    print(f"  Stopping [{slug}] (PID {pid})...")

    try:
        pgid = os.getpgid(pid)
    except ProcessLookupError:
        pgid = pid
    except PermissionError:
        pgid = pid

    # 1) Polite: SIGTERM the whole process group.
    def _signal_group(sig: int) -> None:
        try:
            os.killpg(pgid, sig)
        except ProcessLookupError:
            pass
        except PermissionError:
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                pass

    _signal_group(signal.SIGTERM)

    # 2) Wait up to 10 seconds for graceful exit.
    for _ in range(20):
        if not _pid_alive(pid):
            break
        time.sleep(0.5)

    # 3) Hard kill any survivor in the group.
    if _pid_alive(pid):
        print(f"  [{slug}] did not exit within 10s, sending SIGKILL...")
        _signal_group(signal.SIGKILL)
        for _ in range(10):
            if not _pid_alive(pid):
                break
            time.sleep(0.2)

    # 4) Safety net: sweep /proc for any descendants still tracing to us.
    root_pids = {pid}
    if pgid and pgid != pid:
        root_pids.add(pgid)
    stragglers = _sweep_descendants(root_pids)
    if stragglers:
        print(f"  [{slug}] killed {stragglers} straggler descendant(s).")

    try:
        pid_file.unlink()
    except FileNotFoundError:
        pass

    if _pid_alive(pid):
        print(f"  WARNING: [{slug}] (PID {pid}) is still alive after SIGKILL.")
    else:
        print(f"  Stopped [{slug}].")
    return True


def _confirm_stop_plan(
    pid_files: list[Path],
    schedules: list[dict],
    crons: list[dict],
    auto_yes: bool,
) -> bool:
    """
    Print the 'what's about to be stopped' plan and prompt for confirmation.

    Returns True if the user approved (or auto_yes is set).
    """
    print("Found:")
    if pid_files:
        slugs = [pf.stem.replace(".prompt_executor_", "") for pf in pid_files]
        print(f"  Running   : {len(pid_files)} instance(s)   [{', '.join(slugs)}]")
    else:
        print("  Running   : 0")
    if schedules:
        first = schedules[0]
        label = (
            f"{first.get('id')}: {first.get('folder')} "
            f"at {first.get('at_iso')}"
        )
        extra = "" if len(schedules) == 1 else f" (+{len(schedules) - 1} more)"
        print(f"  Scheduled : {len(schedules)} one-shot      [{label}{extra}]")
    else:
        print("  Scheduled : 0")
    if crons:
        first = crons[0]
        label = (
            f"{first.get('id')}: {first.get('folder')} "
            f"every \"{first.get('expr')}\""
        )
        extra = "" if len(crons) == 1 else f" (+{len(crons) - 1} more)"
        print(f"  Cron      : {len(crons)} recurring     [{label}{extra}]")
    else:
        print("  Cron      : 0")

    if auto_yes:
        print("--yes supplied, proceeding without prompt.")
        return True

    running_part = f"stop {len(pid_files)} running"
    sched_part = f"disable {len(schedules)} scheduled" if schedules else ""
    cron_part = f"disable {len(crons)} cron" if crons else ""
    parts = [p for p in (running_part, sched_part, cron_part) if p]
    question = " + ".join(parts) + "? [y/N]: "
    try:
        reply = input(question).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    return reply in ("y", "yes")


def _gather_all_running_pid_files() -> list[Path]:
    """Every .pid file in SCRIPT_DIR, including the scheduler."""
    return sorted(SCRIPT_DIR.glob(".prompt_executor_*.pid"))


def cmd_stop(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)
    auto_yes = bool(getattr(args, "yes", False))
    running_only = bool(getattr(args, "running_only", False))
    scheduled_only = bool(getattr(args, "scheduled_only", False))
    cron_only = bool(getattr(args, "cron_only", False))

    # Mutually exclusive scope flags — argparse already enforces, but we
    # keep a defensive check in case callers construct argparse.Namespace
    # by hand (tests do).
    scope_flags = sum(
        [
            1 if running_only else 0,
            1 if scheduled_only else 0,
            1 if cron_only else 0,
        ]
    )
    if scope_flags > 1:
        print("ERROR: --running-only / --scheduled-only / --cron-only are mutually exclusive.")
        return

    store = JobStore()
    store_data = store.read()
    schedules = store_data.get("schedules", [])
    crons = store_data.get("crons", [])

    if folder_arg:
        # Legacy single-folder path: stop the running instance, and if the
        # folder ALSO has a scheduled or cron job, confirm before removing.
        target = resolve_target_folder(folder_arg)
        slug = target.name
        init_runtime_files(target)
        pid = read_pid()

        matching_schedules = [j for j in schedules if Path(j.get("folder", "")).name == slug]
        matching_crons = [j for j in crons if Path(j.get("folder", "")).name == slug]

        stopped_anything = False

        # Running process.
        if pid and not (scheduled_only or cron_only):
            _stop_pid_file(PID_FILE)
            stopped_anything = True
        elif not pid and not (scheduled_only or cron_only):
            print(f"Not running for [{slug}].")
            clean_stale_pid()

        # Scheduled / cron deletions for this folder need confirmation.
        if matching_schedules and not (running_only or cron_only):
            if auto_yes or _confirm_stop_plan(
                [], matching_schedules, [], auto_yes
            ):
                for j in matching_schedules:
                    store.remove_schedule(j["id"])
                    print(f"  Removed schedule {j['id']}.")
                    stopped_anything = True
        if matching_crons and not (running_only or scheduled_only):
            if auto_yes or _confirm_stop_plan(
                [], [], matching_crons, auto_yes
            ):
                for j in matching_crons:
                    store.remove(j["id"])
                    print(f"  Removed cron {j['id']}.")
                    stopped_anything = True

        if not stopped_anything:
            print(f"Nothing to stop for [{slug}].")
        return

    # No folder arg — global scope.
    pid_files = _gather_all_running_pid_files()

    # Filter each list by the --*-only scope.
    do_running = not (scheduled_only or cron_only)
    do_scheduled = not (running_only or cron_only)
    do_cron = not (running_only or scheduled_only)

    if not pid_files and not schedules and not crons:
        print("No running instances, no scheduled jobs, no cron jobs.")
        return

    if not _confirm_stop_plan(
        pid_files if do_running else [],
        schedules if do_scheduled else [],
        crons if do_cron else [],
        auto_yes,
    ):
        print("Aborted.")
        return

    if do_running and pid_files:
        print(f"Stopping {len(pid_files)} instance(s)...")
        for pf in pid_files:
            _stop_pid_file(pf)
        print("All running instances stopped.")

    if do_scheduled and schedules:
        for j in schedules:
            store.remove_schedule(j["id"])
        print(f"Removed {len(schedules)} scheduled job(s).")

    if do_cron and crons:
        for j in crons:
            store.remove(j["id"])
        print(f"Removed {len(crons)} cron job(s).")


def _print_scheduled_cron_status() -> None:
    """Print the Scheduled + Cron sections shared by all status views."""
    store = JobStore()
    data = store.read()
    schedules = data.get("schedules", [])
    crons = data.get("crons", [])
    if schedules:
        print(f"{len(schedules)} scheduled job(s):")
        for j in schedules:
            print(
                f"  [{j.get('id')}] {j.get('folder')} "
                f"model={j.get('model')} at={j.get('at_iso')}"
            )
    else:
        print("0 scheduled job(s).")
    if crons:
        print(f"{len(crons)} cron job(s):")
        for j in crons:
            last = j.get("last_run_iso") or "never"
            print(
                f"  [{j.get('id')}] {j.get('folder')} "
                f"model={j.get('model')} expr={j.get('expr')!r} "
                f"next={j.get('next_run_iso')} last={last}"
            )
    else:
        print("0 cron job(s).")


def cmd_status(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)

    if folder_arg:
        # Show status for a specific folder
        target = resolve_target_folder(folder_arg)
        init_runtime_files(target)
        pid = read_pid()
        if pid:
            print(f"[{target.name}] Running (PID {pid})")
        else:
            print(f"[{target.name}] Not running.")
            if PID_FILE.exists():  # pragma: no cover
                print("  (stale PID file detected — previous crash?)")
        print(f"  Log: {LOG_FILE}")
        print(f"  Failures: {FAILURES_FILE}")
        _show_failures_summary()
        # Also show any schedule/cron jobs targeting this folder.
        store = JobStore()
        data = store.read()
        slug = target.name
        matching_sched = [
            j for j in data.get("schedules", [])
            if Path(j.get("folder", "")).name == slug
        ]
        matching_cron = [
            j for j in data.get("crons", [])
            if Path(j.get("folder", "")).name == slug
        ]
        if matching_sched:
            print(f"  Scheduled: {len(matching_sched)} job(s)")
            for j in matching_sched:
                print(f"    [{j.get('id')}] at={j.get('at_iso')}")
        if matching_cron:
            print(f"  Cron: {len(matching_cron)} job(s)")
            for j in matching_cron:
                print(
                    f"    [{j.get('id')}] expr={j.get('expr')!r} "
                    f"next={j.get('next_run_iso')}"
                )
    else:
        pid_files = sorted(SCRIPT_DIR.glob(".prompt_executor_*.pid"))
        if not pid_files:
            print("No running instances.")
        else:
            print(f"{len(pid_files)} instance(s):")
            for pf in pid_files:
                slug = pf.stem.replace(".prompt_executor_", "")
                pid = _read_pid_from_file(pf)
                if pid:
                    print(f"  [{slug}] Running (PID {pid})")
                else:
                    print(f"  [{slug}] Stale PID file (cleaned)")
                    try:
                        pf.unlink()
                    except FileNotFoundError:  # pragma: no cover
                        pass
        print()
        _print_scheduled_cron_status()
        return

    # Dead code — resolve_target_folder already validated at line 1560.
    target = Path(folder_arg)  # pragma: no cover
    if not target.is_absolute():  # pragma: no cover
        target = (PROJECT_ROOT / target).resolve()  # pragma: no cover

    if not target.exists():  # pragma: no cover
        done_path = target.parent / (target.name + "_done")  # pragma: no cover
        if done_path.exists():  # pragma: no cover
            print(
                f"\nTarget folder already completed: {done_path.name}"
            )  # pragma: no cover
            return  # pragma: no cover
        print(f"\nFolder not found: {target}")  # pragma: no cover
        return  # pragma: no cover

    if not target.is_dir():  # pragma: no cover
        print(f"\nNot a directory: {target}")  # pragma: no cover
        return  # pragma: no cover

    pending = collect_pending_items(target)  # pragma: no cover
    done_count, pending_count = _count_files_recursive(target)  # pragma: no cover
    total = done_count + pending_count  # pragma: no cover

    print(f"\nTarget: {target}")  # pragma: no cover
    print(
        f"  Prompts: {done_count}/{total} executed ({pending_count} pending)"
    )  # pragma: no cover

    if pending:
        print(f"\n  Next up:")
        for i, p in enumerate(pending[:5], 1):
            try:
                rel = p.relative_to(PROJECT_ROOT)
            except ValueError:
                rel = p
            print(f"    {i}. {rel}")
        if len(pending) > 5:
            print(f"    ... and {len(pending) - 5} more")

    _show_failures_summary()


def _count_files_recursive(directory: Path) -> tuple[int, int]:
    """Count (done, pending) .md files recursively."""
    done = 0
    pending = 0
    for entry in directory.iterdir():
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            if is_done(entry.name):
                # All files in a _done folder count as done
                d, p = _count_all_md(entry)
                done += d + p  # everything in _done folder is done
            else:
                d, p = _count_files_recursive(entry)
                done += d
                pending += p
        elif entry.is_file() and entry.suffix == ".md":
            if is_done(entry.stem):
                done += 1
            else:
                pending += 1
    return done, pending


def _count_all_md(directory: Path) -> tuple[int, int]:
    """Count all .md files in a directory (for _done folders)."""
    count = 0
    for entry in directory.rglob("*.md"):
        if entry.is_file():
            count += 1
    return count, 0


def _show_failures_summary() -> None:
    """Show failures file summary if it exists."""
    if FAILURES_FILE.exists():
        try:
            failures_text = FAILURES_FILE.read_text()
            failure_count = failures_text.count("SKIPPED:")
            if failure_count > 0:
                print(f"\n  Failed: {failure_count} prompt(s) skipped after retries")
                print(f"  Details: {FAILURES_FILE}")
        except OSError:
            pass


# ── Schedule / Cron / Doctor Commands ───────────────────────────────────────


def _build_job_from_args(args: argparse.Namespace) -> dict:
    """Common job-field extraction shared by schedule + cron add paths."""
    target = resolve_target_folder(args.folder)
    # Validate backend early so typos are caught at add-time, not fire-time.
    _ = detect_backend(args.model)
    working_dir_arg = getattr(args, "working_dir", None)
    return {
        "folder": str(target),
        "model": args.model,
        "agent": getattr(args, "agent", None),
        "period": int(getattr(args, "period", WAIT_MINUTES)),
        "max_retries": int(getattr(args, "max_retries", MAX_RETRIES)),
        "retry_wait": int(getattr(args, "retry_wait", RETRY_WAIT_MINUTES)),
        "working_dir": str(working_dir_arg) if working_dir_arg else None,
        "halt_on_fail": bool(getattr(args, "halt_on_fail", False)),
        "no_sticky_swap": bool(getattr(args, "no_sticky_swap", False)),
        "created_at_iso": datetime.now().isoformat(),
    }


def cmd_schedule_add(args: argparse.Namespace) -> None:
    at_str = getattr(args, "at", None)
    in_str = getattr(args, "in_", None)
    if not (at_str or in_str):
        print("ERROR: supply exactly one of --at \"YYYY-MM-DD HH:MM\" or --in <duration>.")
        return
    if at_str and in_str:
        print("ERROR: --at and --in are mutually exclusive.")
        return

    if in_str:
        delta = parse_duration(in_str)
        at_dt = datetime.now() + delta
    else:
        # Accept either ISO ("2026-04-17T09:00") or "YYYY-MM-DD HH:MM".
        try:
            at_dt = datetime.fromisoformat(at_str)
        except ValueError:
            try:
                at_dt = datetime.strptime(at_str, "%Y-%m-%d %H:%M")
            except ValueError:
                try:
                    at_dt = datetime.strptime(at_str, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    print(f"ERROR: cannot parse --at value: {at_str!r}")
                    return
    if at_dt <= datetime.now():
        print(f"ERROR: --at must be in the future; got {at_dt.isoformat()}")
        return

    job = _build_job_from_args(args)
    job["id"] = _make_job_id("sch")
    job["at_iso"] = at_dt.isoformat()
    store = JobStore()
    store.add_schedule(job)
    print(f"Scheduled job {job['id']} for {at_dt.isoformat()}")
    print(f"  folder={job['folder']} model={job['model']}")
    _start_scheduler_daemon_if_needed()
    print("  scheduler-daemon is running.")


def cmd_schedule_list(_args: argparse.Namespace) -> None:
    store = JobStore()
    data = store.read()
    schedules = data.get("schedules", [])
    if not schedules:
        print("No scheduled jobs.")
        return
    print(f"{len(schedules)} scheduled job(s):")
    for j in schedules:
        print(
            f"  [{j.get('id')}] {j.get('folder')} "
            f"model={j.get('model')} at={j.get('at_iso')}"
        )


def cmd_schedule_remove(args: argparse.Namespace) -> None:
    job_id = args.job_id
    store = JobStore()
    if store.remove(job_id):
        print(f"Removed job {job_id}.")
    else:
        print(f"Job {job_id} not found.")


def cmd_cron_add(args: argparse.Namespace) -> None:
    expr = args.expr
    try:
        parse_cron_expr(expr)  # validation only
    except ValueError as e:
        print(f"ERROR: invalid cron expression: {e}")
        return
    job = _build_job_from_args(args)
    job["id"] = _make_job_id("cron")
    job["expr"] = expr
    now = datetime.now()
    job["last_run_iso"] = None
    job["next_run_iso"] = next_fire_after(expr, now).isoformat()
    store = JobStore()
    store.add_cron(job)
    print(f"Cron job {job['id']} registered.")
    print(f"  folder={job['folder']} model={job['model']} expr={expr!r}")
    print(f"  next fire: {job['next_run_iso']}")
    _start_scheduler_daemon_if_needed()
    print("  scheduler-daemon is running.")


def cmd_cron_list(_args: argparse.Namespace) -> None:
    store = JobStore()
    data = store.read()
    crons = data.get("crons", [])
    if not crons:
        print("No cron jobs.")
        return
    print(f"{len(crons)} cron job(s):")
    for j in crons:
        last = j.get("last_run_iso") or "never"
        print(
            f"  [{j.get('id')}] {j.get('folder')} "
            f"model={j.get('model')} expr={j.get('expr')!r} "
            f"next={j.get('next_run_iso')} last={last}"
        )


def cmd_cron_remove(args: argparse.Namespace) -> None:
    job_id = args.job_id
    store = JobStore()
    if store.remove(job_id):
        print(f"Removed cron job {job_id}.")
    else:
        print(f"Cron job {job_id} not found.")


def cmd_scheduler_daemon(args: argparse.Namespace) -> None:
    """Entry point for the scheduler daemon itself."""
    # Per-instance runtime files already hold None at this point; set our
    # own slug so log() / remove_pid() paths work when we borrow them.
    global PID_FILE, LOG_FILE, FAILURES_FILE, SCHEDULER_TICK_SECONDS
    PID_FILE = SCHEDULER_PID_FILE
    LOG_FILE = SCHEDULER_LOG_FILE
    FAILURES_FILE = SCRIPT_DIR / f".prompt_executor_{SCHEDULER_SLUG}_failures.log"
    # `--tick` overrides the config default for this process only.
    if getattr(args, "tick", None) is not None:
        SCHEDULER_TICK_SECONDS = args.tick

    if _scheduler_is_running():
        print("scheduler-daemon already running.")
        return

    foreground = bool(getattr(args, "foreground", False))
    if not foreground:
        daemonize()
    install_crash_handlers()
    setup_signals()
    # Clean any stale PID file first.
    if SCHEDULER_PID_FILE.exists():
        try:
            SCHEDULER_PID_FILE.unlink()
        except OSError:
            pass
    write_pid(os.getpid())
    try:
        _scheduler_main_loop()
    finally:
        remove_pid()


def cmd_doctor(args: argparse.Namespace) -> None:
    folder_arg = getattr(args, "folder", None)
    target: Path | None = None
    if folder_arg:
        try:
            target = resolve_target_folder(folder_arg)
        except SystemExit:
            return
    out = run_doctor(target)
    if out is None:
        print("No failure logs found. Nothing to analyze.")
        return
    print(f"Fix plan written to: {out}")
    try:
        print()
        print(out.read_text(encoding="utf-8"))
    except OSError:
        pass


# ── CLI ─────────────────────────────────────────────────────────────────────
#
# `AUTO_MODE_WAIT_MINUTES`, `AUTO_MODE_MAX_RETRIES`, and
# `AUTO_MODE_RETRY_WAIT_MINUTES` live in `config.py` (re-exported above).
# Argparse uses sentinel `None` defaults so `apply_mode_defaults()` can
# tell "user passed this flag" from "user didn't" and fill in the right
# manual-vs-auto value at command-dispatch time.


def add_common_args(parser: argparse.ArgumentParser) -> None:
    """Add shared arguments to start/run subcommands."""
    parser.add_argument(
        "folder",
        help="Target folder to execute (relative to project root or absolute path)",
    )
    parser.add_argument(
        "-m",
        "--model",
        default=None,
        help="Model to use. Required in --mode=manual (default). "
        "Optional in --mode=auto, where it acts as a fallback for prompt "
        "files whose filename has no model suffix. "
        "Anthropic models (opus, sonnet, haiku, claude-*) use Claude Code; "
        "all others (e.g., glm-5.1, flash) use OpenCode.",
    )
    parser.add_argument(
        "--mode",
        choices=["manual", "auto"],
        default="manual",
        help="manual (default): every prompt runs under --model. "
        "auto: derive the model per-prompt from the filename suffix "
        "(e.g. '01-task-opus-4.7.md' → opus-4.7). "
        "In auto mode, --model is optional and acts as a fallback for "
        "files without a recognizable suffix. GLM 5.1 and Haiku 4.5 "
        "sticky-swap for each other on credit/quota errors.",
    )
    parser.add_argument(
        "-a",
        "--agent",
        default=None,
        help="OpenCode agent to use (from .opencode/agent/*.md). Ignored for Claude backend.",
    )
    parser.add_argument(
        "-p",
        "--period",
        type=int,
        default=None,
        help=f"Wait time in minutes between prompts "
        f"(default: {WAIT_MINUTES} manual / {AUTO_MODE_WAIT_MINUTES} auto)",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=None,
        help=f"Max retry attempts per prompt before skipping "
        f"(default: {MAX_RETRIES} manual / {AUTO_MODE_MAX_RETRIES} auto)",
    )
    parser.add_argument(
        "--retry-wait",
        type=int,
        default=None,
        help=f"Fixed wait in minutes between retries "
        f"(default: {RETRY_WAIT_MINUTES} manual / {AUTO_MODE_RETRY_WAIT_MINUTES} auto)",
    )
    parser.add_argument(
        "--working-dir",
        type=Path,
        default=None,
        help="Directory to run subprocess commands from. Default: project root.",
    )
    parser.add_argument(
        "--halt-on-fail",
        action="store_true",
        default=False,
        help="Stop the whole run on the first prompt that exhausts retries or "
        "hits an unrecoverable skip. Default: skip the failing prompt and "
        "continue to the next one.",
    )
    parser.add_argument(
        "--no-sticky-swap",
        action="store_true",
        default=False,
        help="Disable automatic sticky-swap on autocompact / credit / timeout "
        "errors. Each prompt runs strictly on its filename-suffixed model and "
        "retries exhaust naturally if it keeps failing. Use for cost control "
        "or audit reproducibility. Default: sticky-swap is enabled and scoped "
        "to the failing model's backend family (Claude or OpenCode).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=None,
        help=f"Per-prompt subprocess timeout in seconds. The Claude/OpenCode "
        f"child is killed (whole process group) if it doesn't exit within "
        f"this window. (default: {TIMEOUT_SECONDS}s)",
    )
    parser.add_argument(
        "--max-crashes",
        type=int,
        default=None,
        help=f"Maximum number of times resilient_run() will auto-restart "
        f"after an unhandled exception before giving up. Set to 0 to disable "
        f"crash recovery. (default: {MAX_CRASHES})",
    )
    parser.add_argument(
        "--effort",
        choices=["low", "medium", "high", "max"],
        default=None,
        help=f"Reasoning effort passed to Claude Code via "
        f"`--reasoning-effort`. Higher effort spends more thinking tokens "
        f"per prompt. (default: {EFFORT})",
    )


def apply_runtime_overrides(args: argparse.Namespace) -> None:
    """Apply user-provided CLI overrides to the module-level runtime knobs.

    Some defaults (per-prompt timeout, crash budget, reasoning effort) are
    consumed by helper functions that read module globals rather than
    threading the values through every call site. To support `--timeout`
    / `--max-crashes` / `--effort` without rewiring every call, this
    helper rebinds the names in this module's namespace once, before
    `cmd_run` / `cmd_start` dispatches into the execution pipeline.

    The CLI flag wins; the constants in `config.py` are the fallback.
    `args.X is None` means "user didn't pass the flag" (argparse uses
    `None` sentinels, mirroring the manual/auto-mode pattern).
    """
    global TIMEOUT_SECONDS, MAX_CRASHES, EFFORT

    if getattr(args, "timeout", None) is not None:
        TIMEOUT_SECONDS = args.timeout
    if getattr(args, "max_crashes", None) is not None:
        MAX_CRASHES = args.max_crashes
    if getattr(args, "effort", None) is not None:
        EFFORT = args.effort


def apply_mode_defaults(args: argparse.Namespace) -> None:
    """
    Fill in numeric retry defaults based on --mode, preserving any value the
    user explicitly passed. Also validates --model vs --mode.

    Manual mode: --model is required. Period/retries default to the
    pre-existing manual values.

    Auto mode: --model is optional (acts as fallback). Period/retries
    default to the tighter auto-mode values (5 min waits, 1 retry).

    Exits with a friendly error if the combination is invalid.
    """
    mode = getattr(args, "mode", "manual")

    if mode == "manual":
        if not args.model:
            print(
                "error: --model is required in --mode=manual. "
                "Pass -m/--model, or switch to --mode=auto.",
                file=sys.stderr,
            )
            sys.exit(2)
        if args.period is None:
            args.period = WAIT_MINUTES
        if args.max_retries is None:
            args.max_retries = MAX_RETRIES
        if args.retry_wait is None:
            args.retry_wait = RETRY_WAIT_MINUTES
    elif mode == "auto":
        # --model is a fallback here; may be None
        if args.period is None:
            args.period = AUTO_MODE_WAIT_MINUTES
        if args.max_retries is None:
            args.max_retries = AUTO_MODE_MAX_RETRIES
        if args.retry_wait is None:
            args.retry_wait = AUTO_MODE_RETRY_WAIT_MINUTES
    else:
        print(f"error: unknown --mode '{mode}'", file=sys.stderr)
        sys.exit(2)


def _add_schedule_cron_common_args(parser: argparse.ArgumentParser) -> None:
    """Subset of add_common_args that schedule/cron add need (no positional folder)."""
    parser.add_argument(
        "folder",
        help="Target folder to execute (relative to project root or absolute path)",
    )
    parser.add_argument(
        "-m",
        "--model",
        required=True,
        help="Model to use (REQUIRED). Same semantics as run/start.",
    )
    parser.add_argument("-a", "--agent", default=None)
    parser.add_argument("-p", "--period", type=int, default=WAIT_MINUTES)
    parser.add_argument("--max-retries", type=int, default=MAX_RETRIES)
    parser.add_argument("--retry-wait", type=int, default=RETRY_WAIT_MINUTES)
    parser.add_argument("--working-dir", type=Path, default=None)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prompt Executor — sequential prompt runner using Claude Code CLI or OpenCode CLI"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    start_p = sub.add_parser("start", help="Start as background daemon")
    add_common_args(start_p)
    start_p.set_defaults(func=cmd_start)

    run_p = sub.add_parser("run", help="Run in foreground (no daemon)")
    add_common_args(run_p)
    run_p.set_defaults(func=cmd_run)

    stop_p = sub.add_parser(
        "stop",
        help="Stop running daemons and/or remove scheduled/cron jobs. "
        "Prompts for confirmation unless --yes is supplied.",
    )
    stop_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: stop only the instance running this folder (default: stop all)",
    )
    stop_p.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt (safe for scripts).",
    )
    stop_group = stop_p.add_mutually_exclusive_group()
    stop_group.add_argument(
        "--running-only",
        action="store_true",
        help="Only kill running daemons; leave scheduled and cron jobs intact.",
    )
    stop_group.add_argument(
        "--scheduled-only",
        action="store_true",
        help="Only remove one-shot scheduled jobs.",
    )
    stop_group.add_argument(
        "--cron-only",
        action="store_true",
        help="Only remove recurring cron jobs.",
    )
    stop_p.set_defaults(func=cmd_stop)

    status_p = sub.add_parser(
        "status",
        help="Check status — running daemons, scheduled jobs, cron jobs.",
    )
    status_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: target folder to show progress for",
    )
    status_p.set_defaults(func=cmd_status)

    # ── schedule ──
    schedule_p = sub.add_parser(
        "schedule",
        help="Schedule a one-shot run at a future time (--at) or relative offset (--in).",
    )
    schedule_sub = schedule_p.add_subparsers(dest="schedule_cmd", required=True)

    schedule_add_p = schedule_sub.add_parser(
        "add", help="Register a new one-shot scheduled run."
    )
    _add_schedule_cron_common_args(schedule_add_p)
    when_group = schedule_add_p.add_mutually_exclusive_group(required=True)
    when_group.add_argument(
        "--at",
        dest="at",
        default=None,
        help="Absolute time, e.g. \"2026-04-17 09:00\" or \"2026-04-17T09:00:00\".",
    )
    when_group.add_argument(
        "--in",
        dest="in_",
        default=None,
        help="Relative offset, e.g. \"2h30m\", \"45m\", \"90s\".",
    )
    schedule_add_p.set_defaults(func=cmd_schedule_add)

    schedule_list_p = schedule_sub.add_parser("list", help="List scheduled jobs.")
    schedule_list_p.set_defaults(func=cmd_schedule_list)

    schedule_remove_p = schedule_sub.add_parser(
        "remove", help="Remove a scheduled job by ID."
    )
    schedule_remove_p.add_argument("job_id")
    schedule_remove_p.set_defaults(func=cmd_schedule_remove)

    # Bare `schedule <folder> --at ...` without `add` — friendly shortcut.
    # We defer to the add subparser if the first arg after `schedule` is
    # not one of {add, list, remove}.
    #
    # Implemented by inspecting sys.argv before parse_args().
    # (argparse can't express "optional subcommand" cleanly.)

    # ── cron ──
    cron_p = sub.add_parser(
        "cron",
        help="Register a recurring cron-driven run (standard 5-field expression).",
    )
    cron_sub = cron_p.add_subparsers(dest="cron_cmd", required=True)

    cron_add_p = cron_sub.add_parser("add", help="Register a new cron job.")
    _add_schedule_cron_common_args(cron_add_p)
    cron_add_p.add_argument(
        "--expr",
        required=True,
        help="5-field cron expression: \"minute hour dom month dow\".",
    )
    cron_add_p.set_defaults(func=cmd_cron_add)

    cron_list_p = cron_sub.add_parser("list", help="List cron jobs.")
    cron_list_p.set_defaults(func=cmd_cron_list)

    cron_remove_p = cron_sub.add_parser("remove", help="Remove a cron job by ID.")
    cron_remove_p.add_argument("job_id")
    cron_remove_p.set_defaults(func=cmd_cron_remove)

    # ── scheduler-daemon ──
    sd_p = sub.add_parser(
        "scheduler-daemon",
        help="Internal: run the scheduler daemon. Auto-spawned by schedule/cron add.",
    )
    sd_p.add_argument(
        "--foreground",
        action="store_true",
        help="Run in the foreground (for debugging). Default: daemonize.",
    )
    sd_p.add_argument(
        "--tick",
        type=int,
        default=None,
        help=f"Scheduler wake-up cadence in seconds. Lower values reduce "
        f"latency between a job's `next_run_iso` and its actual fire, at "
        f"the cost of slightly more wakeups. (default: "
        f"{SCHEDULER_TICK_SECONDS}s)",
    )
    sd_p.set_defaults(func=cmd_scheduler_daemon)

    # ── doctor ──
    doctor_p = sub.add_parser(
        "doctor",
        help="Analyze failure logs and write a fix-plan markdown. Advisory only.",
    )
    doctor_p.add_argument(
        "folder",
        nargs="?",
        default=None,
        help="Optional: target folder. Default: every failures log in prompt-executor/.",
    )
    doctor_p.set_defaults(func=cmd_doctor)

    # Rewrite argv so `schedule <folder> --at ...` implicitly means
    # `schedule add <folder> --at ...`. Same treatment for `cron`.
    _argv = sys.argv[1:]
    if len(_argv) >= 2 and _argv[0] in ("schedule", "cron"):
        verbs = {"add", "list", "remove"}
        if _argv[1] not in verbs and not _argv[1].startswith("-"):
            sys.argv = [sys.argv[0], _argv[0], "add"] + _argv[1:]

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":  # pragma: no cover
    main()
