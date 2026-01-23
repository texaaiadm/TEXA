import { spawn } from 'node:child_process';

const run = (command, args) => {
  const child = spawn(command, args, { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
};

const admin = run('npm', ['run', 'admin:server']);
const web = run('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '3000']);

const shutdown = () => {
  admin.kill('SIGINT');
  web.kill('SIGINT');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

