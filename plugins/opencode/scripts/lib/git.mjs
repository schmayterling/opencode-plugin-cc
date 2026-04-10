import { captureCommand } from "./process.mjs";

const SAFE_REF = /^[a-zA-Z0-9][a-zA-Z0-9_.~\-/]*$/;

export async function getDiffContent(opts = {}) {
  const args = ["diff"];
  if (opts.base) {
    if (!SAFE_REF.test(opts.base)) {
      return { ok: false, output: `invalid base ref: ${opts.base}` };
    }
    args.push(`${opts.base}...HEAD`);
  }
  args.push("--no-color");
  return captureCommand("git", args);
}

export async function getWorkingTreeDiff() {
  return captureCommand("git", ["diff", "--no-color"]);
}

export async function getStagedDiff() {
  return captureCommand("git", ["diff", "--cached", "--no-color"]);
}
