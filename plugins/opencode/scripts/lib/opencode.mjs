import { runCommand, captureCommand } from "./process.mjs";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(
  __dirname,
  "..",
  "..",
  "schemas",
  "review-output.schema.json",
);

export async function getOpenCodeAvailability() {
  const result = await captureCommand("opencode", ["--version"]);
  if (!result.ok) return { installed: false };
  return { installed: true, version: result.output };
}

export async function getOpenCodeAuthStatus() {
  const result = await captureCommand("opencode", ["auth", "list"], {
    timeout: 15_000,
  });
  if (!result.ok) return { authenticated: false };
  return { authenticated: true, output: result.output };
}

export async function runOpenCode(prompt, opts = {}) {
  const args = ["run"];
  if (opts.model) args.push("--model", opts.model);
  args.push("-q"); // quiet, suppress spinner
  args.push(prompt);

  const result = await runCommand("opencode", args, {
    timeout: opts.timeout ?? 600_000,
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd,
  });

  return result.stdout;
}

export async function runReview(diff, opts = {}) {
  const schema = await readFile(SCHEMA_PATH, "utf8");

  const prompt = [
    "you are performing a code review. analyze the following diff and respond with JSON matching this schema:\n",
    "```json",
    schema,
    "```\n",
    "focus on correctness, security, data safety, error handling, and compatibility.",
    "only report material findings with evidence. no style nits.\n",
    "respond with ONLY the JSON object, no markdown fences, no explanation.\n",
    "---\n",
    diff,
  ].join("\n");

  const output = await runOpenCode(prompt, opts);
  return parseStructuredOutput(output);
}

export function parseStructuredOutput(raw) {
  let text = raw.trim();

  // strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    // try to find a JSON object in the output
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
