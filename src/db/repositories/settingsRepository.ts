import { db, runDatabaseTransaction } from "@/config/connection";
import { readSettings, writeSettings } from "../queries/settings";
import type { StudySettings } from "@/lib/settings";

export const getSettings = () => readSettings(db);
export const saveSettings = (settings: StudySettings) => runDatabaseTransaction((tx) => writeSettings(tx, settings));
