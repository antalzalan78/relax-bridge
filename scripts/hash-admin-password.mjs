import { randomBytes, scryptSync } from 'node:crypto';

const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 12) {
  console.error('Set ADMIN_PASSWORD to a password of at least 12 characters.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});

console.log(`scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`);
