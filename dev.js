// Zero-dependency concurrent runner for WorkPulse backend & frontend
const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[36m%s\x1b[0m', '  🚀 Starting WorkPulse: Backend (:5000) & Frontend (:3000)');
console.log('\x1b[36m%s\x1b[0m', '=====================================================\n');

function runService(name, color, cwd, command, args) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  const prefix = `${color}[${name}]\x1b[0m `;

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.log(prefix + line);
      }
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.error(prefix + line);
      }
    });
  });

  child.on('close', (code) => {
    console.log(`${prefix}process exited with code ${code}`);
  });

  return child;
}

const backend = runService(
  'BACKEND',
  '\x1b[34m', // Blue
  path.join(rootDir, 'backend'),
  npmCmd,
  ['run', 'dev']
);

const frontend = runService(
  'FRONTEND',
  '\x1b[32m', // Green
  path.join(rootDir, 'frontend'),
  npmCmd,
  ['run', 'dev']
);

function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', 'Stopping WorkPulse processes...');
  try {
    if (backend && !backend.killed) {
      if (isWindows) spawn('taskkill', ['/pid', backend.pid, '/f', '/t']);
      else backend.kill('SIGTERM');
    }
    if (frontend && !frontend.killed) {
      if (isWindows) spawn('taskkill', ['/pid', frontend.pid, '/f', '/t']);
      else frontend.kill('SIGTERM');
    }
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
