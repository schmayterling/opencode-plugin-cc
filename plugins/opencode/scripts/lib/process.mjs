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
  const timeout = opts.timeout ?? 600_000;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timer;
    if (timeout > 0) {
      timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`timed out after ${timeout}ms`));
      }, timeout);
    }

    const stdoutChunks = [];
    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      if (opts.onStderr) {
        opts.onStderr(chunk.toString());
      } else {
        process.stderr.write(chunk);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
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
