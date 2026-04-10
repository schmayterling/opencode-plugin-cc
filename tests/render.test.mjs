import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderSetupReport,
  renderReviewResult,
  renderStatusReport,
  renderJobDetail,
  renderTaskResult,
  renderSessionList,
} from "../plugins/opencode/scripts/lib/render.mjs";

describe("renderSetupReport", () => {
  it("shows installed and authenticated with usage guide", () => {
    const out = renderSetupReport({
      installed: true,
      version: "1.0.0",
      authenticated: true,
      providers: ["GitHub Copilot"],
    });
    assert.ok(out.includes("**installed**: yes"));
    assert.ok(out.includes("**version**: 1.0.0"));
    assert.ok(out.includes("**authenticated**: yes"));
    assert.ok(out.includes("**providers**: GitHub Copilot"));
    assert.ok(out.includes("quick reference"));
    assert.ok(out.includes("--background"));
  });

  it("shows installation instructions when not installed", () => {
    const out = renderSetupReport({ installed: false });
    assert.ok(out.includes("**installed**: no"));
    assert.ok(out.includes("npm install"));
  });

  it("shows auth instructions when not authenticated", () => {
    const out = renderSetupReport({ installed: true, authenticated: false });
    assert.ok(out.includes("opencode auth login"));
  });
});

describe("renderReviewResult", () => {
  it("renders approval", () => {
    const out = renderReviewResult({
      verdict: "approve",
      summary: "looks good",
      findings: [],
      next_steps: [],
    });
    assert.ok(out.includes("APPROVE"));
    assert.ok(out.includes("looks good"));
  });

  it("renders findings", () => {
    const out = renderReviewResult({
      verdict: "needs-attention",
      summary: "issues found",
      findings: [
        {
          severity: "high",
          title: "sql injection",
          body: "user input not sanitized",
          file: "src/db.ts",
          line_start: 42,
          recommendation: "use parameterized queries",
        },
      ],
      next_steps: ["fix the query"],
    });
    assert.ok(out.includes("NEEDS ATTENTION"));
    assert.ok(out.includes("[HIGH]"));
    assert.ok(out.includes("sql injection"));
    assert.ok(out.includes("src/db.ts:42"));
    assert.ok(out.includes("fix the query"));
  });

  it("handles null result", () => {
    const out = renderReviewResult(null);
    assert.ok(out.includes("error"));
  });
});

describe("renderStatusReport", () => {
  it("handles empty jobs", () => {
    const out = renderStatusReport([]);
    assert.ok(out.includes("no opencode jobs"));
  });

  it("renders job table", () => {
    const out = renderStatusReport([
      { status: "running", command: "review", created_at: Date.now() },
    ]);
    assert.ok(out.includes("running"));
    assert.ok(out.includes("review"));
  });
});

describe("renderJobDetail", () => {
  it("handles null job", () => {
    assert.equal(renderJobDetail(null), "job not found.");
  });

  it("renders job details", () => {
    const out = renderJobDetail({
      id: "abc123",
      status: "completed",
      command: "task",
      created_at: Date.now(),
      result: "done",
    });
    assert.ok(out.includes("abc123"));
    assert.ok(out.includes("completed"));
  });
});

describe("renderTaskResult", () => {
  it("handles null job", () => {
    assert.equal(renderTaskResult(null), "job not found.");
  });

  it("shows running message", () => {
    const out = renderTaskResult({ id: "x", status: "running" });
    assert.ok(out.includes("still running"));
  });

  it("shows error", () => {
    const out = renderTaskResult({ id: "x", status: "failed", error: "boom" });
    assert.ok(out.includes("boom"));
  });

  it("shows result string", () => {
    const out = renderTaskResult({
      id: "x",
      status: "completed",
      result: "all done",
    });
    assert.equal(out, "all done");
  });
});

describe("renderSessionList", () => {
  it("handles empty sessions", () => {
    const out = renderSessionList([]);
    assert.ok(out.includes("no opencode sessions"));
  });

  it("renders session table", () => {
    const out = renderSessionList([
      { id: "abc123def456", title: "fix auth bug", time: { updated: 1700000000 } },
    ]);
    assert.ok(out.includes("abc123def456"));
    assert.ok(out.includes("fix auth bug"));
  });
});
