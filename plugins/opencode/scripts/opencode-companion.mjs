#!/usr/bin/env node

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { writeFile as fsWriteFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  getOpenCodeAvailability,
  getOpenCodeAuthStatus,
  runOpenCode,
  runReview,
  listAgents,
  listModels,
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
} from "./lib/render.mjs";
import { spawnDetached } from "./lib/process.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

async function enqueueBackgroundJob(command, type, payload, opts = {}) {
  const jobId = randomUUID().slice(0, 8);
  const job = {
    id: jobId,
    command,
    status: "running",
    model: opts.model,
    agent: opts.agent,
    created_at: Date.now(),
    session_id: process.env.CLAUDE_SESSION_ID,
  };
  if (command === "task") job.task = payload;
  await saveJob(job);

  const payloadPath = join(tmpdir(), `opencode-job-${jobId}.txt`);
  await fsWriteFile(payloadPath, payload);

  spawnDetached(
    "node",
    [
      join(__dirname, "opencode-companion.mjs"),
      "task-worker",
      "--job-id",
      jobId,
      "--type",
      type,
      "--payload-file",
      payloadPath,
      ...(opts.model ? ["--model", opts.model] : []),
      ...(opts.agent ? ["--agent", opts.agent] : []),
    ],
    { stdio: "ignore", env: { ...process.env } },
  );

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
      scope: { type: "string", default: "auto" },
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
    console.log("no changes found to review.");
    return;
  }

  const diff = diffResult.output;
  const runOpts = { model: values.model, agent: values.agent };

  if (values.background) {
    await enqueueBackgroundJob("review", "review", diff, runOpts);
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
      background: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const taskText = taskParts.join(" ").trim();
  if (!taskText) {
    console.error(
      "no task text provided. usage: task [--model <model>] [--agent <name>] -- <task text>",
    );
    process.exit(1);
  }

  const runOpts = { model: values.model, agent: values.agent };

  if (values.background) {
    await enqueueBackgroundJob("task", "task", taskText, runOpts);
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
    const { readFile } = await import("node:fs/promises");
    payload = await readFile(payloadFile, "utf8");
    await unlink(payloadFile).catch(() => {});
  } else {
    const dashIdx = args.indexOf("--");
    payload = dashIdx >= 0 ? args.slice(dashIdx + 1).join(" ") : "";
  }

  const runOpts = { model: values.model, agent: values.agent };

  try {
    let result;
    if (values.type === "review") {
      result = await runReview(payload, runOpts);
    } else {
      result = await runOpenCode(payload, runOpts);
    }

    // check if job was cancelled while we were running
    const job = await loadJob(jobId);
    if (!job) {
      console.error(`job ${jobId} no longer exists, discarding result.`);
      return;
    }
    if (job.status === "cancelled") return;

    job.status = "completed";
    job.result = result;
    job.completed_at = Date.now();
    await saveJob(job);
  } catch (err) {
    const job = await loadJob(jobId);
    if (!job) {
      console.error(`job ${jobId} no longer exists, discarding error: ${err.message}`);
      return;
    }
    if (job.status === "cancelled") return;

    job.status = "failed";
    job.error = err.message;
    job.completed_at = Date.now();
    await saveJob(job);
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
    const job = await loadJob(jobId);
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
      running[0].status = "cancelled";
      running[0].completed_at = Date.now();
      await saveJob(running[0]);
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

  job.status = "cancelled";
  job.completed_at = Date.now();
  await saveJob(job);
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
