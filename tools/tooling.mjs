import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const ROOT = process.cwd();

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });

  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${detail ? `\n${detail}` : ''}`);
  }
  return result;
}

export function resolveExecutable(name) {
  const lookup = run('bash', ['-lc', `command -v -- ${JSON.stringify(name)}`], { allowFailure: true });
  const candidate = lookup.stdout.trim();
  if (lookup.status !== 0 || !candidate) return null;
  // Preserve the invoked basename. Compiler launchers such as ccache select
  // their wrapped compiler from argv[0], which realpath would erase.
  return candidate;
}

export function relative(file) {
  return path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
}

export function firstNonEmptyLine(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? 'unreported';
}
