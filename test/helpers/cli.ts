import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));

export interface CliRun {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Запускает CLI отдельным процессом Node, как это делает пользователь. */
export function runCli(args: string[]): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
