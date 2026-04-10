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
