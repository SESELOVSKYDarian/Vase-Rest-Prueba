import { spawn, spawnSync } from 'node:child_process';

const root = '/app';
const backend = `${root}/backend-reservas`;
const prisma = `${backend}/node_modules/.bin/prisma`;
const schema = `${backend}/prisma/schema.prisma`;

function run(command, args, label) {
  console.log(`[inicio] ${label}`);
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(prisma, ['generate', '--schema', schema], 'Generando Prisma Client');

for (const migration of [
  '000_roles.sql',
  '001_schema.sql',
  '002_application_extensions.sql',
  '003_seed.sql',
]) {
  run(prisma, ['db', 'execute', '--schema', schema, '--file', `${root}/database/init/${migration}`], `Aplicando ${migration}`);
}

const children = [
  spawn('node', ['src/server.js'], { cwd: backend, env: process.env, stdio: 'inherit' }),
  spawn('node', ['server.js'], {
    cwd: `${root}/noctua`,
    env: { ...process.env, PORT: process.env.FRONTEND_PORT || '3000', HOSTNAME: '0.0.0.0' },
    stdio: 'inherit',
  }),
];

let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill(signal));
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

children.forEach((child, index) => child.on('exit', (code, signal) => {
  console.error(`[inicio] ${index === 0 ? 'Backend' : 'Frontend'} finalizó (${signal ?? code ?? 0})`);
  stop();
  process.exitCode = code && code !== 0 ? code : 1;
}));
