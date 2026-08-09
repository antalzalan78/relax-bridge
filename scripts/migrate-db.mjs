import { readFile } from 'node:fs/promises';
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
  const migrationPath = resolve('db/migrations/0001_booking.sql');
  const migration = await readFile(migrationPath, 'utf8');
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
    if (process.env.BOOKING_TIME_ZONE) {
      await transaction`
        UPDATE booking_settings
        SET time_zone = ${process.env.BOOKING_TIME_ZONE}, updated_at = now()
        WHERE id = 1
      `;
    }
  });
  console.log('Booking database migration completed.');
} finally {
  await sql.end();
}
