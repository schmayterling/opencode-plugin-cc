export function renderSetupReport(report) {
  const lines = ["## opencode setup\n"];

  lines.push(`- **installed**: ${report.installed ? "yes" : "no"}`);
  if (report.version) lines.push(`- **version**: ${report.version}`);
  lines.push(`- **authenticated**: ${report.authenticated ? "yes" : "no"}`);
  if (report.provider) lines.push(`- **provider**: ${report.provider}`);
  if (report.model) lines.push(`- **model**: ${report.model}`);

  if (!report.installed) {
    lines.push("\n### installation\n");
    lines.push("install opencode: `npm install -g opencode` or `npx opencode`");
    lines.push("or visit https://opencode.ai for other options.");
  }

  if (report.installed && !report.authenticated) {
    lines.push("\n### authentication\n");
    lines.push("run `opencode auth login` to authenticate.");
  }

  return lines.join("\n");
}

export function renderReviewResult(result) {
  if (!result || !result.verdict) {
    return "**error**: no review output received. run `/opencode:setup` to verify installation.";
  }

  const icon = result.verdict === "approve" ? "APPROVE" : "NEEDS ATTENTION";
  const lines = [`## review: ${icon}\n`];
  lines.push(result.summary);

  if (result.findings?.length) {
    lines.push("\n### findings\n");
    for (const f of result.findings) {
      const sev = f.severity.toUpperCase();
      lines.push(`#### [${sev}] ${f.title}`);
      if (f.file) {
        const loc = f.line_start ? `${f.file}:${f.line_start}` : f.file;
        lines.push(`*${loc}*`);
      }
      lines.push(f.body);
      if (f.recommendation) lines.push(`\n**recommendation**: ${f.recommendation}`);
      lines.push("");
    }
  }

  if (result.next_steps?.length) {
    lines.push("### next steps\n");
    for (const s of result.next_steps) {
      lines.push(`- ${s}`);
    }
  }

  return lines.join("\n");
}

export function renderStatusReport(jobs) {
  if (!jobs.length) return "no opencode jobs found.";

  const lines = ["## opencode jobs\n"];
  lines.push("| status | command | created |");
  lines.push("|--------|---------|---------|");
  for (const j of jobs) {
    const ts = j.created_at
      ? new Date(j.created_at).toLocaleTimeString()
      : "?";
    lines.push(`| ${j.status} | ${j.command} | ${ts} |`);
  }
  return lines.join("\n");
}

export function renderJobDetail(job) {
  if (!job) return "job not found.";

  const lines = [`## job ${job.id}\n`];
  lines.push(`- **status**: ${job.status}`);
  lines.push(`- **command**: ${job.command}`);
  if (job.model) lines.push(`- **model**: ${job.model}`);
  lines.push(`- **created**: ${new Date(job.created_at).toISOString()}`);

  if (job.result) {
    lines.push("\n### result\n");
    lines.push(
      typeof job.result === "string"
        ? job.result
        : JSON.stringify(job.result, null, 2),
    );
  }

  if (job.error) {
    lines.push("\n### error\n");
    lines.push(job.error);
  }

  return lines.join("\n");
}

export function renderTaskResult(job) {
  if (!job) return "job not found.";
  if (job.status === "running")
    return `job ${job.id} is still running. use \`/opencode:status ${job.id} --wait\` to wait for completion.`;
  if (job.error) return `**error**: ${job.error}`;
  if (!job.result) return "no output captured.";
  return typeof job.result === "string"
    ? job.result
    : JSON.stringify(job.result, null, 2);
}
