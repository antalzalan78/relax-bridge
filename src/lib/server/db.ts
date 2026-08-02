import postgres from 'postgres';

export type Database = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var relaxBridgeDatabase: Database | undefined;
}

export function getDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!globalThis.relaxBridgeDatabase) {
    globalThis.relaxBridgeDatabase = postgres(databaseUrl, {
      max: 3,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: databaseUrl.includes('localhost') ? false : 'require',
    });
  }

  return globalThis.relaxBridgeDatabase;
}
