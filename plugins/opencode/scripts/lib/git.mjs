import { captureCommand } from "./process.mjs";

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
