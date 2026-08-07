import { spawn } from 'child_process';

export class GitCliError extends Error {
  constructor(
    message: string,
    readonly code?: number | null,
    readonly stderr?: string
  ) {
    super(message);
    this.name = 'GitCliError';
  }
}

/**
 * Jalankan `git` di `cwd`. Timeout default 45s.
 */
export async function runGit(
  cwd: string,
  args: string[],
  options: { timeoutMs?: number; maxBuffer?: number } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const maxBuffer = options.maxBuffer ?? 8 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LANG: 'C' }
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let killedForSize = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGKILL');
      reject(new GitCliError(`git ${args.join(' ')} timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      if (stdout.length > maxBuffer) {
        killedForSize = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });

    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (killedForSize) {
        reject(new GitCliError(`git ${args.join(' ')} output terlalu besar`, code, stderr.trim()));
        return;
      }
      if (code !== 0) {
        reject(
          new GitCliError(
            stderr.trim() || `git ${args.join(' ')} exited with code ${code}`,
            code,
            stderr.trim()
          )
        );
        return;
      }
      resolve(stdout);
    });
  });
}

export async function isGitRepository(cwd: string): Promise<boolean> {
  try {
    const out = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'], { timeoutMs: 8_000 });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

export async function resolveGitRoot(cwd: string): Promise<string | undefined> {
  try {
    const out = await runGit(cwd, ['rev-parse', '--show-toplevel'], { timeoutMs: 8_000 });
    const root = out.trim();
    return root || undefined;
  } catch {
    return undefined;
  }
}
