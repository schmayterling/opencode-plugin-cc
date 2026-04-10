import { spawn, execFile } from "node:child_process";

export function spawnDetached(command, args, opts = {}) {
  const child = spawn(command, args, {
    ...opts,
    detached: true,
    stdio: opts.stdio ?? "ignore",
  });
  child.unref();
}

// uses execFile (no shell), safe from injection
export function runCommand(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        ...opts,
        timeout: opts.timeout ?? 120_000,
        maxBuffer: opts.maxBuffer ?? 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
  });
}

export async function captureCommand(command, args, opts = {}) {
  try {
    const { stdout } = await runCommand(command, args, opts);
    return { ok: true, output: stdout.trim() };
  } catch (err) {
    return { ok: false, output: err.stderr?.trim() ?? err.message };
  }
}

// spawn with live stderr streaming to console, capture stdout
export function runStreaming(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: opts.timeout ?? 600_000,
    });

    const stdoutChunks = [];
    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      const line = chunk.toString();
      // filter out noisy bootstrap logs, surface meaningful progress
      if (opts.onStderr) {
        opts.onStderr(line);
      } else {
        process.stderr.write(line);
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      if (code !== 0) {
        const err = new Error(`command exited with code ${code}`);
        err.stdout = stdout;
        reject(err);
      } else {
        resolve({ stdout });
      }
    });
  });
}
