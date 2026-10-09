import { runDatabaseTransaction } from "@/config/connection";
import { readSettings } from "../queries/settings";
import { readStatistics } from "../queries/statistics";

export const getStatistics = (now = new Date()) => runDatabaseTransaction(async (tx) =>
  readStatistics(tx, await readSettings(tx), now));
