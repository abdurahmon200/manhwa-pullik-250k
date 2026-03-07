import { spawn } from 'child_process';

const child = spawn('npx', ['tsx', 'server.ts'], {
  env: { ...process.env, NODE_ENV: 'development' }
});

child.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data}`);
});

child.stderr.on('data', (data) => {
  console.log(`STDERR: ${data}`);
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
});

setTimeout(() => {
  console.log('Killing child process...');
  child.kill();
}, 10000);
