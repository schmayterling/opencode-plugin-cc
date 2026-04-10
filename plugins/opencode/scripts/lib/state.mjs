import { readFile, writeFile, readdir, mkdir, unlink, rename } from "node:fs/promises";
import { join, resolve } from "node:path";

const STATE_DIR_NAME = ".opencode-plugin";
const JOBS_DIR_NAME = "jobs";

function getJobsDir() {
  const base = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  return join(base, STATE_DIR_NAME, JOBS_DIR_NAME);
}

function safeJobPath(id) {
  if (typeof id !== "string" || /[/\\]/.test(id)) return null;
  const dir = getJobsDir();
  const resolved = resolve(dir, `${id}.json`);
  if (!resolved.startsWith(resolve(dir) + "/")) return null;
  return resolved;
}

export async function saveJob(job) {
  const dir = getJobsDir();
  await mkdir(dir, { recursive: true });
  const path = safeJobPath(job.id);
  if (!path) throw new Error(`invalid job id: ${job.id}`);
  const tmp = path + ".tmp";
  await writeFile(tmp, JSON.stringify(job, null, 2));
  await rename(tmp, path);
}

export async function loadJob(id) {
  const path = safeJobPath(id);
  if (!path) return null;
  try {
    const data = await readFile(path, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function listJobs() {
  const dir = getJobsDir();
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const results = await Promise.allSettled(
    files.map((f) => readFile(join(dir, f), "utf8").then((d) => JSON.parse(d))),
  );
  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
}

export async function deleteJob(id) {
  const path = safeJobPath(id);
  if (!path) return false;
  try {
    await unlink(path);
    return true;
  } catch {
    return false;
  }
}

export async function cleanSessionJobs(sessionId) {
  const jobs = await listJobs();
  const toDelete = jobs.filter(
    (j) => j.session_id === sessionId && j.status !== "running",
  );
  await Promise.all(toDelete.map((j) => deleteJob(j.id)));
}
