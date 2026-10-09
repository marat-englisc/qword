import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appSettingsTable = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  value: text("value").notNull(),
});
