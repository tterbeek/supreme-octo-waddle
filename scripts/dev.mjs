import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run from the checkout, including when invoked from another directory.
const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
let forceStop;

function signalChildren(signal) {
  for (const child of children) {
    if (!child.pid) continue;
    try {
      // Include npx's child processes so the function server exits as well.
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error.message);
    }
  }
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  signalChildren('SIGTERM');
  forceStop = setTimeout(() => signalChildren('SIGKILL'), 5000);
  forceStop.unref();
}

function start(command, args) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', detached: true });
  children.push(child);
  child.on('error', (error) => {
    console.error(`Could not start ${command}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) stop(code ?? (signal ? 1 : 0));
    if (children.every((entry) => entry.exitCode !== null || entry.signalCode !== null)) {
      clearTimeout(forceStop);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

start('npx', ['supabase', 'functions', 'serve', '--env-file', 'supabase/functions/.env']);
start(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), ...process.argv.slice(2)]);
