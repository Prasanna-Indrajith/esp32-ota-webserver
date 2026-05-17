// scripts/setup.js
// Interactive first-time setup: generates .env with bcrypt hash + session secret
import { createInterface } from 'readline';
import { randomBytes }     from 'crypto';
import { writeFileSync, existsSync } from 'fs';
import { execSync }        from 'child_process';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));

console.log('\n⚡ ESP32 OTA Server — First-time setup\n');

if (existsSync('.env')) {
  const ans = await ask('.env already exists. Overwrite? (y/N): ');
  if (ans.toLowerCase() !== 'y') { console.log('Aborted.'); process.exit(0); }
}

const password = await ask('Admin password: ');
const port     = await ask('Port [3000]: ') || '3000';
const baseUrl  = await ask(`Base URL [http://localhost:${port}]: `) || `http://localhost:${port}`;
rl.close();

console.log('\nHashing password with bcrypt (this takes a moment)...');
// Dynamically import bcrypt (it's a native module)
const { default: bcrypt } = await import('bcrypt');
const hash   = await bcrypt.hash(password, 12);
const secret = randomBytes(64).toString('hex');

const env = `PORT=${port}
NODE_ENV=development
BASE_URL=${baseUrl}
SESSION_SECRET=${secret}
ADMIN_PASSWORD_HASH=${hash}
MAX_FIRMWARE_MB=10
KEEP_OLD_VERSIONS=3
ROLLBACK_EXPIRE_MIN=15
`;

writeFileSync('.env', env, 'utf8');
console.log('\n✅ .env created successfully!');
console.log('   Run: npm start\n');
