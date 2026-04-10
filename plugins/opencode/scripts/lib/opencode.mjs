import { runCommand, captureCommand } from "./process.mjs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "..", "..", "schemas", "review-output.schema.json");
const PROMPT_PATH = join(__dirname, "..", "..", "prompts", "review.md");

export async function getOpenCodeAvailability() {
  const result = await captureCommand("opencode", ["--version"]);
  if (!result.ok) return { installed: false };
  return { installed: true, version: result.output };
}

export async function getOpenCodeAuthStatus() {
  const result = await captureCommand("opencode", ["auth", "list"], {
    timeout: 15_000,
  });
  if (!result.ok) return { authenticated: false, providers: [] };

  // parse provider names from output (lines like "●  GitHub Copilot ...")
  const providers = [];
  for (const line of result.output.split("\n")) {
    const match = line.match(/[●○]\s+(.+?)(?:\s+\x1b|\s{2,}|$)/);
    if (match) providers.push(match[1].trim());
  }

  return {
    authenticated: providers.length > 0,
    providers,
    output: result.output,
  };
}

export async function listAgents() {
  return captureCommand("opencode", ["agent", "list"]);
}

export async function listModels(opts = {}) {
  const args = ["models"];
  if (opts.provider) args.push(opts.provider);
  if (opts.verbose) args.push("--verbose");
  if (opts.refresh) args.push("--refresh");
  return captureCommand("opencode", args);
}

export async function listSessions(opts = {}) {
  const args = ["session", "list", "--format", "json"];
  if (opts.maxCount) args.push("-n", String(opts.maxCount));
  return captureCommand("opencode", args, { timeout: 15_000 });
}

export async function getRecentSessions(maxCount = 5) {
  const result = await listSessions({ maxCount });
  if (!result.ok) return [];
  try {
    return JSON.parse(result.output);
  } catch {
    return [];
  }
}

export async function runOpenCode(prompt, opts = {}) {
  const args = ["run"];
  if (opts.model) args.push("--model", opts.model);
  if (opts.agent) args.push("--agent", opts.agent);
  if (opts.session) args.push("--session", opts.session);
  else if (opts.continue) args.push("--continue");
  if (opts.fork) args.push("--fork");
  if (opts.title) args.push("--title", opts.title);
  args.push(prompt);

  const result = await runCommand("opencode", args, {
    timeout: opts.timeout ?? 600_000,
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd,
  });

  return result.stdout;
}

export async function runReview(diff, opts = {}) {
  const [schema, promptTemplate] = await Promise.all([
    readFile(SCHEMA_PATH, "utf8"),
    readFile(PROMPT_PATH, "utf8"),
  ]);

  const prompt = [
    promptTemplate,
    "\n## output schema\n",
    "```json",
    schema,
    "```\n",
    "respond with ONLY the JSON object, no markdown fences, no explanation.\n",
    "---\n",
    diff,
  ].join("\n");

  const output = await runOpenCode(prompt, opts);
  const parsed = parseStructuredOutput(output);
  if (!parsed) {
    throw new Error("review produced malformed output (could not parse JSON)");
  }
  return parsed;
}

function parseStructuredOutput(raw) {
  let text = raw.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // give up
      }
    }
    return null;
  }
}
