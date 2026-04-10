import { captureCommand } from "./process.mjs";

export async function getDiff(opts = {}) {
  const args = ["diff"];
  if (opts.base) args.push(`${opts.base}...HEAD`);
  if (opts.stat) args.push("--stat");
  args.push("--no-color");
  return captureCommand("git", args);
}

export async function getDiffContent(opts = {}) {
  const args = ["diff"];
  if (opts.base) args.push(`${opts.base}...HEAD`);
  args.push("--no-color");
  return captureCommand("git", args);
}

export async function getWorkingTreeDiff() {
  return captureCommand("git", ["diff", "--no-color"]);
}

export async function getStagedDiff() {
  return captureCommand("git", ["diff", "--cached", "--no-color"]);
}

export async function getBranchName() {
  return captureCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export async function getRepoRoot() {
  return captureCommand("git", ["rev-parse", "--show-toplevel"]);
}
