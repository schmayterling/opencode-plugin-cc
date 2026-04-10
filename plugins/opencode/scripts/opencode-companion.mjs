#!/usr/bin/env node

import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import {
  getOpenCodeAvailability,
  getOpenCodeAuthStatus,
  runOpenCode,
  runReview,
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
      background: { type: "boolean", default: false },
      wait: { type: "boolean", default: true },
    },
    allowPositionals: false,
  });

  let diffResult;
  if (values.scope === "working-tree" || values.scope === "auto") {
    diffResult = await getWorkingTreeDiff();
    if (diffResult.ok && !diffResult.output) {
      diffResult = await getStagedDiff();
    }
  }
  if (values.base) {
    diffResult = await getDiffContent({ base: values.base });
  }

  if (!diffResult?.ok || !diffResult.output) {
    console.log("no changes found to review.");
    return;
  }

  const diff = diffResult.output;

  if (values.background) {
    const jobId = randomUUID().slice(0, 8);
    const job = {
      id: jobId,
      command: "review",
      status: "running",
      model: values.model,
      created_at: Date.now(),
      session_id: process.env.CLAUDE_SESSION_ID,
    };
    await saveJob(job);

    spawnDetached(
      "node",
      [
        join(__dirname, "opencode-companion.mjs"),
        "task-worker",
        "--job-id",
        jobId,
        "--type",
        "review",
        ...(values.model ? ["--model", values.model] : []),
        "--",
        diff,
      ],
      { stdio: "ignore", env: { ...process.env } },
    );

    console.log(`background review started. job id: ${jobId}`);
    console.log(`use \`/opencode:status ${jobId}\` to check progress.`);
    return;
  }

  const result = await runReview(diff, { model: values.model });
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
      background: { type: "boolean", default: false },
      wait: { type: "boolean", default: true },
      write: { type: "boolean", default: true },
    },
    allowPositionals: true,
  });

  const taskText = taskParts.join(" ").trim();
  if (!taskText) {
    console.error(
      "no task text provided. usage: task [--model <model>] -- <task text>",
    );
    process.exit(1);
  }

  if (values.background) {
    const jobId = randomUUID().slice(0, 8);
    const job = {
      id: jobId,
      command: "task",
      status: "running",
      model: values.model,
      task: taskText,
      created_at: Date.now(),
      session_id: process.env.CLAUDE_SESSION_ID,
    };
    await saveJob(job);

    spawnDetached(
      "node",
      [
        join(__dirname, "opencode-companion.mjs"),
        "task-worker",
        "--job-id",
        jobId,
        "--type",
        "task",
        ...(values.model ? ["--model", values.model] : []),
        "--",
        taskText,
      ],
      { stdio: "ignore", env: { ...process.env } },
    );

    console.log(`background task started. job id: ${jobId}`);
    console.log(`use \`/opencode:status ${jobId}\` to check progress.`);
    return;
  }

  const output = await runOpenCode(taskText, { model: values.model });
  console.log(output);
}

async function handleTaskWorker(args) {
  const { values } = parseArgs({
    args,
    options: {
      "job-id": { type: "string" },
      type: { type: "string", default: "task" },
      model: { type: "string" },
    },
    allowPositionals: true,
  });

  const jobId = values["job-id"];
  if (!jobId) {
    console.error("--job-id required");
    process.exit(1);
  }

  const dashIdx = args.indexOf("--");
  const payload = dashIdx >= 0 ? args.slice(dashIdx + 1).join(" ") : "";

  try {
    let result;
    if (values.type === "review") {
      result = await runReview(payload, { model: values.model });
    } else {
      result = await runOpenCode(payload, { model: values.model });
    }

    const job = await loadJob(jobId);
    if (job) {
      job.status = "completed";
      job.result = result;
      job.completed_at = Date.now();
      await saveJob(job);
    }
  } catch (err) {
    const job = await loadJob(jobId);
    if (job) {
      job.status = "failed";
      job.error = err.message;
      job.completed_at = Date.now();
      await saveJob(job);
    }
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
