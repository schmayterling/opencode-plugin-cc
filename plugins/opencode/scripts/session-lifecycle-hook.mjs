#!/usr/bin/env node

import { cleanSessionJobs } from "./lib/state.mjs";

const [action] = process.argv.slice(2);

if (action === "session-end") {
  const sessionId = process.env.CLAUDE_SESSION_ID;
  if (sessionId) {
    await cleanSessionJobs(sessionId);
  }
  process.exit(0);
}

console.error(`unknown action: ${action}`);
process.exit(1);
