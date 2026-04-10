import { spawn, execFile } from "node:child_process";

const MAX_STDOUT = 10 * 1024 * 1024;

export function spawnDetached(command, args, opts = {}) {
  const child = spawn(command, args, {
    ...opts,
    detached: true,
    stdio: opts.stdio ?? "ignore",
  });
  child.unref();
}

export function runCommand(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        ...opts,
        timeout: opts.timeout ?? 120_000,
        maxBuffer: opts.maxBuffer ?? MAX_STDOUT,
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

export function runStreaming(command, args, opts = {}) {
  const timeout = opts.timeout ?? 600_000;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timedOut = false;
    let timer;
    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        reject(new Error(`timed out after ${timeout}ms`));
      }, timeout);
    }

    let stdoutLen = 0;
    const stdoutChunks = [];
    child.stdout.on("data", (chunk) => {
      stdoutLen += chunk.length;
      if (stdoutLen <= MAX_STDOUT) stdoutChunks.push(chunk);
    });

    const stderrChunks = [];
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk);
      if (opts.onStderr) opts.onStderr(chunk.toString());
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if (!timedOut) reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      if (code !== 0) {
        const err = new Error(`command exited with code ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout });
      }
    });
  });
}
