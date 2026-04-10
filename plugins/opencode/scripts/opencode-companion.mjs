#!/usr/bin/env node

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, unlink, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getOpenCodeAvailability,
  getOpenCodeAuthStatus,
  runOpenCode,
  runReview,
  listAgents,
  listModels,
  listSessions,
  getRecentSessions,
} from "./lib/opencode.mjs";
import {
  getDiffContent,
  getWorkingTreeDiff,
  getStagedDiff,
} from "./lib/git.mjs";
import {
  saveJob,
  loadJob,
  listJobs,
} from "./lib/state.mjs";
import {
  renderSetupReport,
  renderReviewResult,
  renderStatusReport,
  renderJobDetail,
  renderTaskResult,
  renderSessionList,
} from "./lib/render.mjs";
import { spawnDetached } from "./lib/process.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const [subcommand, ...rest] = process.argv.slice(2);

const handlers = {
  setup: handleSetup,
  review: handleReview,
  task: handleTask,
  "task-worker": handleTaskWorker,
  status: handleStatus,
  result: handleResult,
  cancel: handleCancel,
  agents: handleAgents,
  models: handleModels,
  sessions: handleSessions,
  "resume-candidate": handleResumeCandidate,
};

const handler = handlers[subcommand];
if (!handler) {
  console.error(`unknown subcommand: ${subcommand}`);
  console.error(`available: ${Object.keys(handlers).join(", ")}`);
  process.exit(1);
}

try {
  await handler(rest);
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}

// --- shared helpers ---

async function writePayloadSecure(jobId, payload) {
  const path = join(tmpdir(), `opencode-job-${jobId}.txt`);
  const fh = await open(path, "wx", 0o600);
  try {
    await fh.writeFile(payload);
  } finally {
    await fh.close();
  }
  return path;
}

async function finalizeJob(jobId, update) {
  const job = await loadJob(jobId);
  if (!job) {
    console.error(`job ${jobId} no longer exists, discarding.`);
    return;
  }
  if (job.status !== "running") return;
  Object.assign(job, update, { completed_at: Date.now() });
  await saveJob(job);
}

async function enqueueBackgroundJob(command, payload, opts = {}) {
  const jobId = randomUUID().slice(0, 8);
  const job = {
    id: jobId,
    command,
    status: "running",
    created_at: Date.now(),
    session_id: process.env.CLAUDE_SESSION_ID,
  };
  await saveJob(job);

  let payloadPath;
  try {
    payloadPath = await writePayloadSecure(jobId, payload);
    spawnDetached(
      "node",
      [
        join(__dirname, "opencode-companion.mjs"),
        "task-worker",
        "--job-id",
        jobId,
        "--type",
        command,
        "--payload-file",
        payloadPath,
        ...(opts.model ? ["--model", opts.model] : []),
        ...(opts.agent ? ["--agent", opts.agent] : []),
        ...(opts.session ? ["--session", opts.session] : []),
        ...(opts.continue ? ["--resume"] : []),
        ...(opts.timeout ? ["--timeout-ms", String(opts.timeout)] : []),
      ],
      { stdio: "ignore", env: { ...process.env } },
    );
  } catch (err) {
    // cleanup on failure: mark job failed and remove temp file
    await finalizeJob(jobId, { status: "failed", error: err.message });
    if (payloadPath) await unlink(payloadPath).catch(() => {});
    throw err;
  }

  console.log(`background ${command} started. job id: ${jobId}`);
  console.log(`use \`/opencode:status ${jobId}\` to check progress.`);
}

// --- handlers ---

async function handleSetup(args) {
  const { values } = parseArgs({
    args,
    options: { json: { type: "boolean", default: false } },
    allowPositionals: false,
  });

  const availability = await getOpenCodeAvailability();
  let report = { ...availability };

  if (availability.installed) {
    const auth = await getOpenCodeAuthStatus();
    report = { ...report, ...auth };
  }

  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderSetupReport(report));
  }
}

async function handleReview(args) {
  const { values } = parseArgs({
    args,
    options: {
      base: { type: "string" },
      model: { type: "string" },
      agent: { type: "string" },
      background: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  let diffResult;
  if (values.base) {
    diffResult = await getDiffContent({ base: values.base });
  } else {
    diffResult = await getWorkingTreeDiff();
    if (diffResult.ok && !diffResult.output) {
      diffResult = await getStagedDiff();
    }
  }

  if (!diffResult?.ok || !diffResult.output) {
    console.log(diffResult?.ok === false && diffResult.output
      ? `error: ${diffResult.output}`
      : "no changes found to review.");
    return;
  }

  const diff = diffResult.output;
  const runOpts = { model: values.model, agent: values.agent };

  if (values.background) {
    await enqueueBackgroundJob("review", diff, runOpts);
    return;
  }

  const result = await runReview(diff, runOpts);
  console.log(renderReviewResult(result));
}

async function handleTask(args) {
  const dashIdx = args.indexOf("--");
  const flagArgs = dashIdx >= 0 ? args.slice(0, dashIdx) : args;
  const taskParts = dashIdx >= 0 ? args.slice(dashIdx + 1) : [];

  const { values } = parseArgs({
    args: flagArgs,
    options: {
      model: { type: "string" },
      agent: { type: "string" },
      session: { type: "string" },
      "timeout-ms": { type: "string" },
      resume: { type: "boolean", default: false },
      fresh: { type: "boolean", default: false },
      background: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const taskText = taskParts.join(" ").trim();
  if (!taskText) {
    console.error(
      "no task text provided. usage: task [--model <model>] [--agent <name>] [--timeout-ms <ms>] [--resume|--fresh|--session <id>] -- <task text>",
    );
    process.exit(1);
  }

  const runOpts = { model: values.model, agent: values.agent };
  if (values["timeout-ms"]) {
    const ms = parseInt(values["timeout-ms"], 10);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 3_600_000) {
      console.error("--timeout-ms must be between 1 and 3600000");
      process.exit(1);
    }
    runOpts.timeout = ms;
  }
  if (values.session) {
    runOpts.session = values.session;
  } else if (values.resume && !values.fresh) {
    runOpts.continue = true;
  }

  if (values.background) {
    await enqueueBackgroundJob("task", taskText, runOpts);
    return;
  }

  const output = await runOpenCode(taskText, runOpts);
  console.log(output);
}

async function handleTaskWorker(args) {
  const { values } = parseArgs({
    args,
    options: {
      "job-id": { type: "string" },
      type: { type: "string", default: "task" },
      model: { type: "string" },
      agent: { type: "string" },
      session: { type: "string" },
      "timeout-ms": { type: "string" },
      resume: { type: "boolean", default: false },
      "payload-file": { type: "string" },
    },
    allowPositionals: true,
  });

  const jobId = values["job-id"];
  if (!jobId) {
    console.error("--job-id required");
    process.exit(1);
  }

  let payload = "";
  const payloadFile = values["payload-file"];
  if (payloadFile) {
    payload = await readFile(payloadFile, "utf8");
    await unlink(payloadFile).catch(() => {});
  } else {
    const dashIdx = args.indexOf("--");
    payload = dashIdx >= 0 ? args.slice(dashIdx + 1).join(" ") : "";
  }

  const runOpts = { model: values.model, agent: values.agent, quiet: true };
  if (values.session) runOpts.session = values.session;
  else if (values.resume) runOpts.continue = true;
  if (values["timeout-ms"]) {
    const ms = parseInt(values["timeout-ms"], 10);
    if (Number.isFinite(ms) && ms > 0) runOpts.timeout = ms;
  }

  try {
    let result;
    if (values.type === "review") {
      result = await runReview(payload, runOpts);
    } else {
      result = await runOpenCode(payload, runOpts);
    }
    await finalizeJob(jobId, { status: "completed", result });
  } catch (err) {
    await finalizeJob(jobId, { status: "failed", error: err.message });
  }
}

async function handleStatus(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      wait: { type: "boolean", default: false },
      "timeout-ms": { type: "string", default: "300000" },
      all: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const jobId = positionals[0];

  if (jobId) {
    let job = await loadJob(jobId);
    if (!job) {
      console.log(`job ${jobId} not found.`);
      return;
    }

    if (values.wait && job.status === "running") {
      const timeout = parseInt(values["timeout-ms"], 10);
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const current = await loadJob(jobId);
        if (!current) {
          console.log(`job ${jobId} was deleted while waiting.`);
          return;
        }
        if (current.status !== "running") {
          console.log(renderJobDetail(current));
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log(`timeout waiting for job ${jobId}.`);
      // re-read for fresh state after timeout
      job = (await loadJob(jobId)) ?? job;
    }

    console.log(renderJobDetail(job));
    return;
  }

  let jobs = await listJobs();
  if (!values.all) {
    const cutoff = Date.now() - 3600_000;
    jobs = jobs.filter((j) => j.status === "running" || j.created_at > cutoff);
  }
  console.log(renderStatusReport(jobs));
}

async function handleResult(args) {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const jobId = positionals[0];
  if (!jobId) {
    const jobs = await listJobs();
    const completed = jobs.find(
      (j) => j.status === "completed" || j.status === "failed",
    );
    if (!completed) {
      console.log("no completed jobs found.");
      return;
    }
    console.log(renderTaskResult(completed));
    return;
  }

  const job = await loadJob(jobId);
  if (!job) {
    console.log(`job ${jobId} not found.`);
    return;
  }
  console.log(renderTaskResult(job));
}

async function handleCancel(args) {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const jobId = positionals[0];
  if (!jobId) {
    const jobs = await listJobs();
    const running = jobs.filter((j) => j.status === "running");
    if (running.length === 0) {
      console.log("no running jobs to cancel.");
      return;
    }
    if (running.length === 1) {
      await finalizeJob(running[0].id, { status: "cancelled" });
      console.log(`cancelled job ${running[0].id}.`);
      return;
    }
    console.log("multiple running jobs. specify a job id:");
    for (const j of running) {
      console.log(
        `  ${j.id} - ${j.command} (${new Date(j.created_at).toLocaleTimeString()})`,
      );
    }
    return;
  }

  const job = await loadJob(jobId);
  if (!job) {
    console.log(`job ${jobId} not found.`);
    return;
  }
  if (job.status !== "running") {
    console.log(`job ${jobId} is not running (status: ${job.status}).`);
    return;
  }

  await finalizeJob(jobId, { status: "cancelled" });
  console.log(`cancelled job ${jobId}.`);
}

async function handleAgents() {
  const result = await listAgents();
  if (!result.ok) {
    console.error(`error: ${result.output}`);
    process.exit(1);
  }
  console.log(result.output);
}

async function handleSessions(args) {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
      count: { type: "string", default: "10" },
    },
    allowPositionals: false,
  });

  const result = await listSessions({
    maxCount: parseInt(values.count, 10),
  });
  if (!result.ok) {
    console.error(`error: ${result.output}`);
    process.exit(1);
  }

  if (values.json) {
    console.log(result.output);
  } else {
    try {
      const sessions = JSON.parse(result.output);
      console.log(renderSessionList(sessions));
    } catch {
      console.log(result.output);
    }
  }
}

async function handleResumeCandidate(args) {
  const { values } = parseArgs({
    args,
    options: { json: { type: "boolean", default: false } },
    allowPositionals: false,
  });

  const sessions = await getRecentSessions(5);
  if (!sessions.length) {
    if (values.json) {
      console.log(JSON.stringify({ found: false }));
    } else {
      console.log("no recent sessions to resume.");
    }
    return;
  }

  const latest = sessions[0];
  if (values.json) {
    console.log(JSON.stringify({
      found: true,
      session_id: latest.id,
      title: latest.title,
      updated: latest.time?.updated,
    }));
  } else {
    console.log(`resumable session found: ${latest.id}`);
    console.log(`  title: ${latest.title || "untitled"}`);
    if (latest.time?.updated) {
      console.log(`  last active: ${new Date(latest.time.updated * 1000).toLocaleString()}`);
    }
    console.log(`\nuse \`--resume\` to continue this session, or \`--fresh\` to start new.`);
  }
}

async function handleModels(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      verbose: { type: "boolean", default: false },
      refresh: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const result = await listModels({
    provider: positionals[0],
    verbose: values.verbose,
    refresh: values.refresh,
  });
  if (!result.ok) {
    console.error(`error: ${result.output}`);
    process.exit(1);
  }
  console.log(result.output);
}
