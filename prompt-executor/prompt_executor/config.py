"""
Prompt Executor — Configuration

Single source of truth for every default value, threshold, regex pattern, and
classification table the executor uses. Imported wholesale into the package
namespace via ``from .config import *`` in ``__init__.py``.

Sections (in order):

    1. Paths                         — SCRIPT_DIR, PROJECT_ROOT, JOBS_FILE, …
    2. Timing & retry (manual mode)  — WAIT_MINUTES, TIMEOUT_SECONDS, …
    3. Timing & retry (auto mode)    — AUTO_MODE_*  (was buried in argparse)
    4. Daemon & crash handling       — SCHEDULER_TICK_SECONDS, MAX_CRASHES, …
    5. Backend selection             — BACKEND_CLAUDE, CLAUDE_BIN, …
    6. Claude / OpenCode invocation  — EFFORT, ALLOWED_TOOLS
    7. Model routing                 — MODEL_ALIASES, ESCALATION_TARGET_MODEL …
    8. Result codes                  — RESULT_SUCCESS, RESULT_TIMEOUT, …
    9. Logging                       — LOG_ROTATE_BYTES
   10. Error classifiers             — MCP_ERROR_PATTERNS, UNRECOVERABLE_…, …
   11. Prompt-file classifiers       — REFERENCE_FILENAME_SUBSTRINGS, …
   12. JSONC parsing regexes

User-overridable values are also exposed as CLI flags in ``cli.py`` /
``add_common_args()``. The flag wins; the constant here is the default the
flag falls back to.
"""

import re
from pathlib import Path


# ─── 1. Paths ───────────────────────────────────────────────────────────────
#
# SCRIPT_DIR is the prompt-executor/ directory itself. With the package
# layout ``prompt-executor/prompt_executor/config.py``, ``parent`` is
# ``prompt_executor/`` and ``parent.parent`` is ``prompt-executor/``.
SCRIPT_DIR = Path(__file__).resolve().parent.parent  # prompt-executor/
PROJECT_ROOT = SCRIPT_DIR.parent  # serverlessbase-v2/

# Scheduler-daemon owns its own PID + log pair (slug = "scheduler") so
# `status` / `stop` can reason about it uniformly with per-folder daemons.
JOBS_FILE = SCRIPT_DIR / ".prompt_executor_jobs.json"
SCHEDULER_SLUG = "scheduler"
SCHEDULER_PID_FILE = SCRIPT_DIR / f".prompt_executor_{SCHEDULER_SLUG}.pid"
SCHEDULER_LOG_FILE = SCRIPT_DIR / f".prompt_executor_{SCHEDULER_SLUG}.log"


# ─── 2. Timing & retry (manual-mode defaults) ───────────────────────────────
#
# Hoisted to the top so every default the user may want to override is
# discoverable here. CLI flags in `add_common_args()`:
#   --period, --max-retries, --retry-wait, --timeout
#
WAIT_MINUTES = 5  # rest between prompts; --period
TIMEOUT_SECONDS = 3600  # per-prompt subprocess timeout (1 h); --timeout
MAX_RETRIES = 3  # retries per prompt before skipping; --max-retries
RETRY_WAIT_MINUTES = 10  # base wait between retries (doubles each); --retry-wait


# ─── 3. Timing & retry (auto-mode overrides) ────────────────────────────────
#
# `--mode=auto` derives the model per-prompt from a filename suffix and
# uses tighter defaults than manual mode. `apply_mode_defaults()` in
# cli.py fills these in when the user did NOT pass an explicit override.
#
# Were buried inside the argparse setup pre-2026-05; hoisted here so they
# sit next to their manual-mode counterparts.
AUTO_MODE_WAIT_MINUTES = 5
AUTO_MODE_MAX_RETRIES = 5  # 4 real retries on transient failures
AUTO_MODE_RETRY_WAIT_MINUTES = 5


# ─── 4. Daemon & crash handling ─────────────────────────────────────────────
#
# Scheduler wake-up cadence. The loop recomputes the next-due trigger on
# every tick; 30 s is more than enough granularity for cron's 1-minute
# resolution and for --in / --at schedules. CLI flag: --tick.
SCHEDULER_TICK_SECONDS = 30

# Auto-restart limit before resilient_run() gives up. CLI flag: --max-crashes.
MAX_CRASHES = 5

# Per-call timeout for the `git diff/ls-files` snapshot used to detect
# whether a prompt actually modified files. Was hardcoded as
# `subprocess.run(..., timeout=30)` at the call site pre-2026-05.
GIT_SNAPSHOT_TIMEOUT = 30


# ─── 5. Backend selection ───────────────────────────────────────────────────
#
# The executor auto-routes a model name to a CLI binary. Anthropic short
# names (opus/sonnet/haiku) and `claude-*` go to Claude Code. OpenAI `gpt-*`
# names go to the Codex CLI. GLM names and provider-prefixed (`x/y`) names
# go to OpenCode. See `detect_backend()`.
BACKEND_CLAUDE = "claude"
BACKEND_OPENCODE = "opencode"
BACKEND_CODEX = "codex"
CLAUDE_BIN = "claude"
OPENCODE_BIN = "opencode"
CODEX_BIN = "codex"


# ─── 6. Claude / OpenCode invocation ────────────────────────────────────────
#
# Reasoning effort passed to Claude Code (`--reasoning-effort`).
# CLI flag: --effort.
EFFORT = "high"  # low | medium | high | max

# Tools the executor allows the LLM to use. Comma-separated, passed as
# `--allowed-tools` to Claude Code; OpenCode reads its own permissions
# from `.opencode/opencode.jsonc` so this is informational on that path.
ALLOWED_TOOLS = "Read,Write,Edit,Bash,Glob,Grep,Agent,Skill,ToolSearch"


# ─── 7. Model routing ───────────────────────────────────────────────────────
#
# Anthropic short names — the routing predicate `detect_backend()` keys off
# this set to send the call to Claude Code rather than OpenCode.
ANTHROPIC_MODELS = {"opus", "sonnet", "haiku"}

# Resolve short names to full model IDs.
#
# Opus defaults to its 1M-context variant. Prompt-executor prompts routinely
# ask Claude Code to read many large files across the repo, which fills the
# 200k window and triggers Claude Code's "Autocompact is thrashing" failure.
# The [1m] variant gives 5× more headroom and eliminates this failure mode
# for all realistic multi-file prompts.
#
# Sonnet defaults to its 200k variant because Anthropic gates the Sonnet 1M
# tier separately from the Opus 1M tier on Claude subscriptions. Many
# subscriptions that have Opus 1M enabled do NOT have Sonnet 1M enabled, and
# invoking the CLI with `claude-sonnet-4-6[1m]` on those accounts fails
# deterministically with "Extra usage is required for 1M context". Users
# whose accounts DO have Sonnet 1M enabled can opt in via the `sonnet-1m`
# alias.
MODEL_ALIASES = {
    # Anthropic Claude models — short aliases
    "opus": "claude-opus-4-7[1m]",
    "sonnet": "claude-sonnet-4-6",
    "haiku": "claude-haiku-4-5-20251001",
    "opus-200k": "claude-opus-4-7",
    "sonnet-200k": "claude-sonnet-4-6",
    # Opt-in 1M variant for accounts with Sonnet 1M extra usage enabled.
    "sonnet-1m": "claude-sonnet-4-6[1m]",
    # Verbose aliases — used primarily by filename-based auto mode
    # (e.g. `01-task-opus-4.7.md`). Keep in sync with the short aliases above.
    "opus-4.7": "claude-opus-4-7[1m]",
    "sonnet-4.6": "claude-sonnet-4-6",
    "haiku-4.5": "claude-haiku-4-5-20251001",
    # Z.AI GLM models (5-model family with zai-coding/ namespace prefix)
    "glm-5.1": "zai-coding/glm-5.1",
    "glm-5": "zai-coding/glm-5",
    "glm-5-turbo": "zai-coding/glm-5-turbo",
    "glm-4.7": "zai-coding/glm-4.7",
    "glm-4.7-flash": "zai-coding/glm-4.7-flash",
    "flash": "zai-coding/glm-4.7-flash",  # Convenience alias for glm-4.7-flash
    "glm": "zai-coding/glm-5.1",  # Default alias for glm
    # OpenAI Codex CLI models — routed via `codex exec --model <model> --json`.
    # `gpt-5.5` is the "Hardest" tier peer of `opus-4.7` (different provider,
    # same difficulty band). See `.claude/skills/codex-cli/` and
    # `prompts/dont-execute-me.md` for the tier rubric.
    "gpt-5.5": "gpt-5.5",
}

# Ordered longest-first so compound aliases (`opus-4.7`) win over their
# shorter prefixes (`opus`). Used by `extract_model_from_filename()`.
_SORTED_ALIAS_KEYS = sorted(MODEL_ALIASES.keys(), key=len, reverse=True)

# Sticky-swap pairs for credit/quota errors in auto mode. GLM 5.1 ↔ Haiku 4.5.
# Short aliases (`glm`, `haiku`) map to the same pair so whichever alias the
# user puts in a filename, we know where to pivot.
SWAP_PAIRS = {
    "glm": "haiku-4.5",
    "glm-5.1": "haiku-4.5",
    "haiku": "glm-5.1",
    "haiku-4.5": "glm-5.1",
    # GPT-5.5 ↔ Opus-4.7 — peer-tier swap on credit/quota errors. Both are
    # "Hardest"-tier models on different providers; if one provider is out
    # of credit, the daemon flips to the other for the rest of the run.
    # Bidirectional so neither provider is privileged. Per-backend scoping
    # in `_maybe_swap_model` keeps GLM↔Haiku swaps unaffected.
    "gpt-5.5": "opus-4.7",
    "opus-4.7": "gpt-5.5",
}

# ── Auto-mode escalation targets ───────────────────────────────────────────
#
# On the user's local Claude CLI, opus-4.7 has the 1M-context variant enabled
# (see user memory `project_claude_cli_1m_access.md`) but sonnet-4.6 does NOT.
# When a small-context model (sonnet-4.6 / haiku-4.5) deterministically
# thrashes on "Autocompact is thrashing", or when GLM-5.1 times out
# repeatedly, we escalate to opus-4.7 as a sticky swap for the rest of the
# run. This mirrors the GLM↔Haiku credit-swap pattern and is the only way
# to "guarantee all files execute" in auto mode — retrying the same model on
# a deterministic failure is a waste of hours.

# The canonical 1M-context fallback alias. Must resolve via MODEL_ALIASES.
ESCALATION_TARGET_MODEL = "opus-4.7"

# Models that escalate to the 1M-context opus when they hit autocompact.
# These are small-context Claude models where retrying the same prompt
# reproduces the same context-window thrash.
AUTOCOMPACT_ESCALATION_SOURCES = frozenset(
    {
        "sonnet",
        "sonnet-4.6",
        "sonnet-200k",
        "haiku",
        "haiku-4.5",
    }
)

# Models that escalate to opus after repeated hard timeouts (TIMEOUT_SECONDS
# elapsed with no exit). GLM-5.1 is slow on long-reasoning prompts; rather
# than burn max_retries × 1h waiting, we pivot after 2 timeouts.
TIMEOUT_ESCALATION_SOURCES = frozenset(
    {
        "glm",
        "glm-5.1",
        "glm-5",
        "glm-4.7",
        "flash",
        "sonnet",
        "sonnet-4.6",
        "haiku",
        "haiku-4.5",
    }
)

# After this many consecutive TIMEOUTs on the same model, escalate.
TIMEOUT_ESCALATION_THRESHOLD = 2


# ─── 8. Result codes ────────────────────────────────────────────────────────
#
# String enums returned in `PromptResult.result_code`. RETRYABLE is the
# subset that the retry loop should re-attempt; FATAL/SKIP/SUCCESS exit
# the per-prompt loop immediately.
RESULT_SUCCESS = "success"  # completed, returncode 0
RESULT_TIMEOUT = "timeout"  # subprocess timed out → retryable
RESULT_ERROR = "error"  # non-zero exit code → retryable
RESULT_FATAL = "fatal"  # unrecoverable (claude missing, file unreadable)
RESULT_SKIP = "skip"  # prompt-specific unrecoverable → skip, daemon continues

RETRYABLE = {RESULT_TIMEOUT, RESULT_ERROR}


# ─── 9. Logging ─────────────────────────────────────────────────────────────
#
# Rotate the `.prompt_executor_<slug>.log` file once it crosses this size
# (best-effort; rotation never blocks logging).
LOG_ROTATE_BYTES = 10 * 1024 * 1024  # 10 MiB


# ─── 10. Error classifiers ──────────────────────────────────────────────────
#
# Stderr regex patterns for the doctor / classifier. Hits don't skip the
# prompt by themselves — they just label the failure category in the log.
MCP_ERROR_PATTERNS = [
    r"MCP server '([^']+)' failed",
    r"mcp.*timeout",
    r"mcp.*authentication",
    r"mcp.*unreachable",
]

SKILL_ERROR_PATTERNS = [
    r"Skill '([^']+)' not found",
    r"skill validation failed",
    r"skill permission denied",
]

# Substrings that — when seen in the combined stdout+stderr of a failed run —
# mean the prompt cannot succeed by retrying. execute_prompt returns
# RESULT_SKIP on a hit and the retry loop breaks out immediately instead of
# burning the full retry budget (which for large values like --max-retries 30
# can waste multiple hours per stuck prompt).
#
# Keep this list explicit and narrow. Over-matching would silently skip real
# transient failures; under-matching is safe (falls back to normal retries).
UNRECOVERABLE_ERROR_PATTERNS = (
    # Claude Code context window thrashing. Deterministic on multi-file
    # prompts that exceed the 200k window. Defaulting opus/sonnet to the 1M
    # variants fixes the common case; this is the safety net for the rest.
    "Autocompact is thrashing",
    # Safety net for stale OpenCode invocations that slipped through the
    # alias-resolution fix. Should not occur in practice but prevents
    # regression if MODEL_ALIASES drifts.
    "ProviderModelNotFoundError",
)

# Substrings (case-insensitive) that indicate the provider rejected the call
# because the account is out of credits / over quota / rate-limited. Matching
# any of these in the combined stdout+stderr triggers a sticky GLM↔Haiku swap
# in auto mode. Keep patterns narrow — over-matching would mask real bugs.
CREDIT_ERROR_PATTERNS = (
    # Anthropic
    "credit balance is too low",
    "credit_balance_too_low",
    # Generic provider wording
    "insufficient credit",
    "insufficient balance",
    "insufficient_quota",
    "quota exceeded",
    "out of credits",
    "out of tokens",
    # Rate-limit style (treated as a soft quota signal)
    "rate limit",
    "rate_limit_exceeded",
    "too many requests",
    "429",
)


# ─── 11. Prompt-file classifiers ────────────────────────────────────────────
#
# Some .md files in a prompt folder are human-readable overviews, READMEs,
# or tables of contents pointing at the *actual* actionable prompts in the
# same folder. Feeding them to an LLM produces conversational text and zero
# tool calls, which the file-change gate then (correctly) rejects — and the
# daemon burns its entire retry budget re-running a file that can never pass.
#
# Filenames matching any of these case-insensitive substrings are auto-skipped
# at collection time. The `_done` suffix is stripped before matching.
REFERENCE_FILENAME_SUBSTRINGS = (
    "overview",
    "readme",
    "table-of-contents",
    "toc",
    "index-of-prompts",
    "architecture",
    "reference",
    "dependency-graph",
)

# Content-level markers that flag a prompt as a reference / architecture
# document. If a run produces no filesystem changes AND the prompt content
# matches one of these, we treat the run as SUCCESS instead of burning the
# retry budget on a file that was never meant to make edits.
REFERENCE_CONTENT_MARKERS = (
    "architecture overview",
    "architecture summary",
    "architecture reference",
    "architecture document",
    "# architecture",
    "## architecture",
    "table of contents",
    "## overview",
    "# overview",
    "reference document",
    "read-only reference",
    "dependency graph",
)

# Validation / verification prompts that MUST execute (they report PASS/FAIL)
# but whose output is expected to be text-only. They legitimately produce
# zero filesystem changes on a successful run, so the post-run "no file
# changes" gate must not retry them forever. Substrings are matched against
# the filename stem (case-insensitive); they are NOT used at collection time.
VALIDATION_FILENAME_SUBSTRINGS = (
    "validate",
    "validation",
    "verify",
    "verification",
    "check-",
    "-check",
    "sanity",
    "audit",
)

# LLM replies that produce no filesystem changes — but for two CATEGORICALLY
# DIFFERENT reasons that demand different handling:
#
#   (a) "I need more instructions" — the model asked a clarifying question
#       instead of doing work. Retrying with the same prompt won't help; the
#       prompt itself failed to communicate intent. → RESULT_SKIP.
#
#   (b) "The work is already done" — the model AUDITED the codebase, found
#       the artifacts already present, and correctly declined to re-implement.
#       The prompt's deliverable is on disk; this is a *legitimate completion*.
#       → RESULT_SUCCESS so the prompt is renamed to ``*_done.md`` and the run
#       advances to the next prompt.
#
# Matched against the last ~2000 chars of stdout, case-insensitively.

# Group (a): clarifying-question replies. Hit → RESULT_SKIP (unrecoverable).
CONVERSATIONAL_QUESTION_MARKERS = (
    "what would you like me to do",
    "which direction should i take",
    "which prompt would you like me to",
    "what's the task",
    "what's the goal",
    "what would you like me to implement",
    "would you like me to start",
    "let me know what you'd like",
    "what would you like me to work on",
    "which prompt(s) would you like me to",
    "which prompt(s) should i start",
)

# Group (b): "already done" audit replies. Hit → RESULT_SUCCESS (mark the
# prompt as completed via the standard ``mark_file_done`` rename pipeline).
# These are PRODUCTIVE no-op responses: the LLM verified the deliverable
# already exists on disk from earlier work and (correctly) didn't re-write
# it. The previous behavior of treating these as unrecoverable failures
# halted runs unnecessarily — see prompt-executor failure mode "06-color-
# palette-intelligence-sonnet-4.6.md was unrecoverable" (2026-04-25).
ALREADY_DONE_MARKERS = (
    "already fully implemented",
    "already implemented",
    "already complete",
    "already in place",
    "no changes needed",
    "no code changes needed",
    "no changes are needed",
    "no code changes are needed",
    "nothing to do",
    "nothing to change",
    "nothing further to implement",
    "work is complete",
    "work is already complete",
    "this prompt's work is complete",
    "all files are complete",
    "all files already exist",
    "everything is implemented",
    "everything is already implemented",
    "fully in place",
    "is already fully",
    "have already been implemented",
    "have already been created",
    "has already been implemented",
)

# Backward-compat alias for any external callers / tests that still import
# the bundled name. The handler in ``execute_prompt`` no longer uses it —
# it consumes the two split tuples directly so the two cases can take
# different code paths.
CONVERSATIONAL_NO_OP_MARKERS = CONVERSATIONAL_QUESTION_MARKERS + ALREADY_DONE_MARKERS


# ─── 12. JSONC parsing regexes ──────────────────────────────────────────────
#
# Used by `_parse_jsonc()` to strip comments and trailing commas from
# `.opencode/opencode.jsonc` before handing the cleaned text to `json.loads`.
_JSONC_LINE_COMMENT = re.compile(r"^\s*//.*$", re.MULTILINE)
_JSONC_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_JSONC_TRAILING_COMMA = re.compile(r",(\s*[}\]])")
