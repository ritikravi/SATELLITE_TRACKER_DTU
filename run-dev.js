import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[36m%s\x1b[0m', '>>> Starting NAVIC-TRACK (Orbit Engine + Mock Server + Next.js App)...');

const isWindows = process.platform === 'win32';
const npmCmd    = isWindows ? 'npm.cmd' : 'npm';

// 1. Spawn Python orbit engine (port 8200)
const orbitDir    = path.join(__dirname, 'orbit-engine');
const venvPython  = isWindows
  ? path.join(orbitDir, 'venv', 'Scripts', 'python.exe')
  : path.join(orbitDir, 'venv', 'bin', 'python3');

let orbitProcess = null;
if (existsSync(venvPython)) {
  console.log('\x1b[32m%s\x1b[0m', '  [1/3] Starting Python orbit engine on :8200...');
  orbitProcess = spawn(venvPython, ['main.py'], {
    cwd: orbitDir,
    stdio: 'inherit',
    shell: false
  });
} else {
  console.log('\x1b[33m%s\x1b[0m',
    '  [1/3] SKIP orbit engine — venv not found.\n' +
    '        Run: cd orbit-engine && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt'
  );
}

// 2. Spawn mock server (port 8080)
console.log('\x1b[32m%s\x1b[0m', '  [2/3] Starting mock server on :8080...');
const mockProcess = spawn(npmCmd, ['start'], {
  cwd: path.join(__dirname, 'mock-server'),
  stdio: 'inherit',
  shell: true
});

// 3. Spawn Next.js web app (port 3000)
console.log('\x1b[32m%s\x1b[0m', '  [3/3] Starting Next.js dashboard on :3000...');
const webProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'web'),
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down NAVIC-TRACK servers...');
  try { if (orbitProcess) orbitProcess.kill(); } catch (e) {}
  try { mockProcess.kill(); } catch (e) {}
  try { webProcess.kill(); } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
