import { db, runDatabaseTransaction } from "@/config/connection";
import { readSettings, writeAppearance, writeSettings } from "../queries/settings";
import type { Appearance, StudySettings } from "@/lib/settings";

export const getSettings = () => readSettings(db);
export const saveSettings = (settings: StudySettings) => runDatabaseTransaction(async (tx) => {
  const current = await readSettings(tx);
  return writeSettings(tx, { ...settings, appearance: current.appearance });
});
export const saveAppearance = (appearance: Appearance) => runDatabaseTransaction((tx) => writeAppearance(tx, appearance));
