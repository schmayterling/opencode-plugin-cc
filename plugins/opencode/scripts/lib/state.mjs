import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const STATE_DIR_NAME = ".opencode-plugin";

function getStateDir() {
  const base = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  return join(base, STATE_DIR_NAME);
}

function getJobsDir() {
  return join(getStateDir(), "jobs");
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function saveJob(job) {
  const dir = getJobsDir();
  await ensureDir(dir);
  await writeFile(join(dir, `${job.id}.json`), JSON.stringify(job, null, 2));
}

export async function loadJob(id) {
  try {
    const data = await readFile(join(getJobsDir(), `${id}.json`), "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function listJobs() {
  const dir = getJobsDir();
  await ensureDir(dir);
  const files = await readdir(dir);
  const jobs = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const data = await readFile(join(dir, f), "utf8");
      jobs.push(JSON.parse(data));
    } catch {
      // skip malformed entries
    }
  }
  return jobs.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
}

export async function deleteJob(id) {
  try {
    await unlink(join(getJobsDir(), `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

export async function cleanSessionJobs(sessionId) {
  const jobs = await listJobs();
  for (const job of jobs) {
    if (job.session_id === sessionId && job.status !== "running") {
      await deleteJob(job.id);
    }
  }
}
