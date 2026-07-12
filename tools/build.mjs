import fs from 'node:fs';
import path from 'node:path';

import { resolveExecutable, run } from './tooling.mjs';

const required = ['cmake', 'circom'];
for (const name of required) {
  if (!resolveExecutable(name)) throw new Error(`Required build tool is unavailable: ${name}`);
}
if (!fs.existsSync(path.resolve('node_modules/circomlib/circuits'))) {
  throw new Error('circomlib is not installed; run pnpm install first.');
}
if (!fs.existsSync(path.resolve('node_modules/snarkjs/build/cli.cjs'))) {
  throw new Error('snarkjs is not installed; run pnpm install first.');
}

const buildDirectory = path.resolve('build');
run('cmake', ['-S', '.', '-B', buildDirectory, '-DCMAKE_BUILD_TYPE=Release']);
run('cmake', ['--build', buildDirectory, '--config', 'Release']);

console.log('PASS native C++20 library build');
console.log('PASS Circom/snarkjs dependency preflight');
console.log('Scope: build validates P/N521 sources and tools; it does not make a security-audit claim.');
