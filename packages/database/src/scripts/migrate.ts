import { closeScriptDatabase, createScriptDatabase } from './_runtime';
import { migrateDatabase } from '../migrate';

const db = await createScriptDatabase();

try {
  const result = await migrateDatabase(db);
  console.warn(
    `Database migrated: ${result.applied.length} applied, ${result.skipped.length} skipped.`,
  );
} finally {
  await closeScriptDatabase(db);
}
