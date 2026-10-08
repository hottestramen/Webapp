// 체험용: 가짜 Supabase 서버(scripts/mock-supabase.ts)와 개발 서버(vite)를 한 번에 띄운다.
// 실제 Supabase 프로젝트 없이 화면·실시간 동기화를 둘러볼 때 쓴다. 데이터는 메모리에만 있고 종료하면 사라진다.
import { spawn } from 'node:child_process';

const PORT = '54321';
const env = {
  ...process.env,
  PORT,
  VITE_SUPABASE_URL: `http://localhost:${PORT}`,
  VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
};

const run = (command, args) =>
  spawn(command, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });

const mock = run('node', ['scripts/mock-supabase.ts']);
const vite = run('npx', ['vite']);

const stop = () => {
  mock.kill();
  vite.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
vite.on('exit', stop);
