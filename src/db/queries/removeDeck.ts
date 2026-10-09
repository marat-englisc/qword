import { eq } from "drizzle-orm";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { userDeckTable } from "../schemas/user/userDeck";

// Progress belongs to meanings, so removing a subscription preserves every answer.
export async function removeDeck(
  database: Pick<SqliteRemoteDatabase, "delete">,
  deckId: number,
) {
  if (!Number.isSafeInteger(deckId) || deckId <= 0)
    throw new Error("Некорректная коллекция.");
  await database.delete(userDeckTable).where(eq(userDeckTable.deckId, deckId));
}
