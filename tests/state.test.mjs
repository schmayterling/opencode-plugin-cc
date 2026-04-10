import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// set up isolated state dir before importing
const testDir = await mkdtemp(join(tmpdir(), "opencode-test-"));
process.env.CLAUDE_PROJECT_DIR = testDir;

const { saveJob, loadJob, listJobs, deleteJob } = await import(
  "../plugins/opencode/scripts/lib/state.mjs"
);

describe("state", () => {
  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });
  it("saves and loads a job", async () => {
    const job = {
      id: "test-1",
      command: "review",
      status: "running",
      created_at: Date.now(),
    };
    await saveJob(job);
    const loaded = await loadJob("test-1");
    assert.equal(loaded.id, "test-1");
    assert.equal(loaded.status, "running");
  });

  it("returns null for missing job", async () => {
    const loaded = await loadJob("nonexistent");
    assert.equal(loaded, null);
  });

  it("lists jobs sorted by created_at descending", async () => {
    await saveJob({ id: "a", command: "task", status: "done", created_at: 1 });
    await saveJob({
      id: "b",
      command: "review",
      status: "done",
      created_at: 3,
    });
    await saveJob({ id: "c", command: "task", status: "done", created_at: 2 });
    const jobs = await listJobs();
    const ids = jobs.map((j) => j.id);
    assert.ok(ids.indexOf("b") < ids.indexOf("c"));
    assert.ok(ids.indexOf("c") < ids.indexOf("a"));
  });

  it("deletes a job", async () => {
    await saveJob({ id: "del-1", command: "task", status: "done", created_at: 1 });
    const ok = await deleteJob("del-1");
    assert.equal(ok, true);
    const loaded = await loadJob("del-1");
    assert.equal(loaded, null);
  });
});
