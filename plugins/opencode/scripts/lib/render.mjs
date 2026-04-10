export function renderSetupReport(report) {
  const lines = ["## opencode setup\n"];

  lines.push(`- **installed**: ${report.installed ? "yes" : "no"}`);
  if (report.version) lines.push(`- **version**: ${report.version}`);
  lines.push(`- **authenticated**: ${report.authenticated ? "yes" : "no"}`);

  if (report.providers?.length) {
    lines.push(`- **providers**: ${report.providers.join(", ")}`);
  }

  if (!report.installed) {
    lines.push("\n### installation\n");
    lines.push("install opencode: `npm install -g opencode` or `npx opencode`");
    lines.push("or visit https://opencode.ai for other options.");
    return lines.join("\n");
  }

  if (!report.authenticated) {
    lines.push("\n### authentication\n");
    lines.push("run `opencode auth login` to authenticate with a provider.");
    lines.push("opencode supports 75+ providers: openai, anthropic, google, github-copilot, and more.");
    return lines.join("\n");
  }

  const exampleProvider = report.providers?.[0] ?? "github-copilot";
  lines.push("\n### usage\n");
  lines.push("models use the exact `provider/model` format from `/opencode:models`. the provider slug must match exactly.");
  lines.push(`your available provider slugs: ${report.providers?.length ? report.providers.map(p => `\`${p}\``).join(", ") : "run `/opencode:models` to see"}`);
  lines.push(`example: \`--model ${exampleProvider}/claude-sonnet-4.6\``);
  lines.push("");
  lines.push("run `/opencode:models` to list all models, `/opencode:models <provider>` to filter.");
  lines.push("run `/opencode:agents` to list available agents.");
  lines.push("");
  lines.push("### quick reference\n");
  lines.push("| command | description |");
  lines.push("|---------|-------------|");
  lines.push("| `/opencode:rescue <task>` | delegate a task to opencode |");
  lines.push("| `/opencode:review` | review current changes |");
  lines.push("| `/opencode:rescue --resume <task>` | continue the last opencode session |");
  lines.push(`| \`/opencode:rescue --model ${exampleProvider}/model <task>\` | use a specific model |`);
  lines.push("| `/opencode:sessions` | list recent sessions |");
  lines.push("");
  lines.push("**note**: opencode tasks run in the foreground by default. pass `--background` to run in the background with job tracking. this is different from claude code's ctrl+b, which backgrounds the bash command itself without creating a trackable job.");

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
