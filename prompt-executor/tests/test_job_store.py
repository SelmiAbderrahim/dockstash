"""Tests for the JobStore JSON persistence layer."""
import json

import pytest

from prompt_executor import JOB_STORE_VERSION, JobStore, _empty_store, _make_job_id


class TestMakeJobId:
    def test_schedule_prefix(self):
        jid = _make_job_id("sch")
        assert jid.startswith("sch_")

    def test_cron_prefix(self):
        jid = _make_job_id("cron")
        assert jid.startswith("cron_")

    def test_uniqueness(self):
        seen = {_make_job_id("sch") for _ in range(50)}
        assert len(seen) == 50


class TestEmptyStore:
    def test_shape(self):
        s = _empty_store()
        assert s == {"version": JOB_STORE_VERSION, "schedules": [], "crons": []}


class TestJobStoreRead:
    def test_missing_file_returns_empty(self, tmp_path):
        store = JobStore(tmp_path / "missing.json")
        assert store.read() == _empty_store()

    def test_empty_file_returns_empty(self, tmp_path):
        path = tmp_path / "empty.json"
        path.write_text("")
        assert JobStore(path).read() == _empty_store()

    def test_whitespace_only_returns_empty(self, tmp_path):
        path = tmp_path / "ws.json"
        path.write_text("   \n  ")
        assert JobStore(path).read() == _empty_store()

    def test_corrupt_json_moves_aside(self, tmp_path, capsys):
        path = tmp_path / "bad.json"
        path.write_text("{ not json")
        data = JobStore(path).read()
        assert data == _empty_store()
        # Original moved to .corrupt.
        assert (tmp_path / "bad.json.corrupt").exists() or not path.exists()
        captured = capsys.readouterr()
        assert "corrupt job store" in captured.err

    def test_valid_file_roundtrips(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        store.write(
            {
                "version": 1,
                "schedules": [{"id": "sch_a", "folder": "x"}],
                "crons": [],
            }
        )
        data = store.read()
        assert data["schedules"] == [{"id": "sch_a", "folder": "x"}]

    def test_schema_missing_keys_tolerated(self, tmp_path):
        path = tmp_path / "jobs.json"
        path.write_text(json.dumps({"schedules": []}))  # no version, no crons
        data = JobStore(path).read()
        assert data["crons"] == []
        assert data["version"] == JOB_STORE_VERSION

    def test_non_dict_returns_empty(self, tmp_path):
        path = tmp_path / "jobs.json"
        path.write_text("[]")
        assert JobStore(path).read() == _empty_store()

    def test_read_error_returns_empty(self, tmp_path, monkeypatch, capsys):
        path = tmp_path / "jobs.json"
        path.write_text("{}")

        def bad_read(self, *a, **kw):
            raise OSError("simulated")

        monkeypatch.setattr("pathlib.Path.read_text", bad_read)
        data = JobStore(path).read()
        assert data == _empty_store()
        captured = capsys.readouterr()
        assert "failed to read" in captured.err


class TestJobStoreMutations:
    def test_add_schedule(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        job = {"id": "sch_1", "folder": "x", "model": "flash", "at_iso": "2026-04-17T09:00:00"}
        store.add_schedule(job)
        data = store.read()
        assert data["schedules"] == [job]

    def test_add_cron(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        job = {"id": "cron_1", "folder": "x", "model": "flash", "expr": "* * * * *"}
        store.add_cron(job)
        data = store.read()
        assert data["crons"] == [job]

    def test_remove_found(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        store.add_schedule({"id": "sch_1", "folder": "x"})
        store.add_cron({"id": "cron_1", "folder": "y"})
        assert store.remove("sch_1") is True
        assert store.remove("cron_1") is True
        data = store.read()
        assert data["schedules"] == []
        assert data["crons"] == []

    def test_remove_not_found(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        assert store.remove("nonexistent") is False

    def test_update_cron_run(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        store.add_cron(
            {
                "id": "cron_1",
                "folder": "x",
                "expr": "* * * * *",
                "last_run_iso": None,
                "next_run_iso": "2026-04-17T09:00:00",
            }
        )
        store.update_cron_run("cron_1", "2026-04-17T09:00:00", "2026-04-17T09:01:00")
        data = store.read()
        assert data["crons"][0]["last_run_iso"] == "2026-04-17T09:00:00"
        assert data["crons"][0]["next_run_iso"] == "2026-04-17T09:01:00"

    def test_update_cron_run_nonexistent(self, tmp_path):
        # Silent no-op.
        store = JobStore(tmp_path / "jobs.json")
        store.update_cron_run("missing", "a", "b")
        assert store.read()["crons"] == []

    def test_remove_schedule_only(self, tmp_path):
        store = JobStore(tmp_path / "jobs.json")
        store.add_schedule({"id": "sch_1", "folder": "x"})
        store.add_cron({"id": "cron_1", "folder": "y"})
        store.remove_schedule("sch_1")
        data = store.read()
        assert data["schedules"] == []
        # Cron untouched.
        assert data["crons"][0]["id"] == "cron_1"


class TestAtomicity:
    def test_write_creates_tmp_then_renames(self, tmp_path):
        path = tmp_path / "jobs.json"
        store = JobStore(path)
        store.write({"version": 1, "schedules": [], "crons": []})
        # No leftover .tmp file.
        assert not path.with_suffix(".json.tmp").exists()
        assert path.exists()

    def test_parent_dir_is_created(self, tmp_path):
        nested = tmp_path / "nested" / "dir" / "jobs.json"
        JobStore(nested).write({"version": 1, "schedules": [], "crons": []})
        assert nested.exists()
