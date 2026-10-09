import { eq } from "drizzle-orm";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import {
  defaultSettings,
  validateSettings,
  type Appearance,
  type StudySettings,
} from "../../lib/settings";
import { appSettingsTable } from "../schemas/user/appSettings";

export async function readSettings(
  database: Pick<SqliteRemoteDatabase, "select">,
) {
  const [row] = await database
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.id, 1))
    .limit(1);
  return validateSettings(
    row ? { ...defaultSettings, ...JSON.parse(row.value) } : defaultSettings,
  );
}

export async function writeSettings(
  database: Pick<SqliteRemoteDatabase, "insert">,
  settings: StudySettings,
) {
  const validated = validateSettings(settings);
  await database
    .insert(appSettingsTable)
    .values({ id: 1, value: JSON.stringify(validated) })
    .onConflictDoUpdate({
      target: appSettingsTable.id,
      set: { value: JSON.stringify(validated) },
    });
  return validated;
}

// Call inside a transaction so another settings write cannot lose this choice.
export async function writeAppearance(
  database: Pick<SqliteRemoteDatabase, "select" | "insert">,
  appearance: Appearance,
) {
  const current = await readSettings(database);
  return writeSettings(database, { ...current, appearance });
}
