import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: databaseUrl.includes('localhost') ? false : 'require',
});

try {
  const migrationDirectory = resolve('db/migrations');
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  await sql.begin(async (transaction) => {
    for (const file of migrationFiles) {
      const migration = await readFile(resolve(migrationDirectory, file), 'utf8');
      await transaction.unsafe(migration);
    }
    if (process.env.BOOKING_TIME_ZONE) {
      await transaction`
        UPDATE booking_settings
        SET time_zone = ${process.env.BOOKING_TIME_ZONE}, updated_at = now()
        WHERE id = 1
      `;
    }
  });
  console.log(`Database migration completed (${migrationFiles.length} files).`);
} finally {
  await sql.end();
}
