import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Database } from '../client';
import { createPgliteDatabase, createPostgresDatabase } from '../client';

interface ClosableDatabase extends Database {
  $client?: {
    close?: () => Promise<void>;
    end?: () => Promise<void>;
  };
}

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCAL_DATA_DIR = join(PACKAGE_ROOT, '.pglite', 'hrms');

export async function createScriptDatabase(): Promise<ClosableDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return createPostgresDatabase(databaseUrl);
  }

  await mkdir(dirname(LOCAL_DATA_DIR), { recursive: true });
  return createPgliteDatabase({ dataDir: LOCAL_DATA_DIR });
}

export async function closeScriptDatabase(db: ClosableDatabase): Promise<void> {
  if (db.$client?.close) {
    await db.$client.close();
    return;
  }
  await db.$client?.end?.();
}
