-- Merge historical duplicates before introducing identity constraints.
-- Keep the latest scheduler state and reattach every review before deleting.
CREATE TEMP TABLE progress_duplicates (
  duplicate_id INTEGER PRIMARY KEY, keep_id INTEGER NOT NULL
);
--> statement-breakpoint
INSERT INTO progress_duplicates
SELECT id AS duplicate_id, keep_id FROM (
  SELECT id, FIRST_VALUE(id) OVER (
    PARTITION BY card_meaning_id
    ORDER BY COALESCE(last_review, -1) DESC, reps DESC, id DESC
  ) AS keep_id FROM user_card_meaning
) WHERE id <> keep_id;
--> statement-breakpoint
UPDATE user_card_meaning_review
SET user_card_meaning_id = (
  SELECT keep_id FROM progress_duplicates
  WHERE duplicate_id = user_card_meaning_id
) WHERE user_card_meaning_id IN (
  SELECT duplicate_id FROM progress_duplicates
);
--> statement-breakpoint
DELETE FROM user_card_meaning
WHERE id IN (SELECT duplicate_id FROM progress_duplicates);
--> statement-breakpoint
DROP TABLE progress_duplicates;
--> statement-breakpoint
UPDATE user_deck SET
  created_at = (
    SELECT MIN(other.created_at) FROM user_deck AS other
    WHERE other.deck_id = user_deck.deck_id
  ),
  last_reviewed_at = (
    SELECT MAX(other.last_reviewed_at) FROM user_deck AS other
    WHERE other.deck_id = user_deck.deck_id
  )
WHERE id IN (SELECT MIN(id) FROM user_deck GROUP BY deck_id);
--> statement-breakpoint
DELETE FROM user_deck
WHERE id NOT IN (SELECT MIN(id) FROM user_deck GROUP BY deck_id);
--> statement-breakpoint
DROP INDEX IF EXISTS `user_card_meanings_card_meaning_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `user_decks_deck_index`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_card_meanings_card_meaning_unique` ON `user_card_meaning` (`card_meaning_id`);--> statement-breakpoint
CREATE INDEX `user_card_meaning_reviews_meaning_index` ON `user_card_meaning_review` (`card_meaning_id`,`review`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_decks_deck_unique` ON `user_deck` (`deck_id`);
