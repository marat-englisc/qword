# Репозитории

Обычные асинхронные функции Drizzle. ID — числа из таблиц. Если запись не найдена,
функции получения одной записи возвращают `undefined`, списки — пустой массив.
Даты прогресса возвращаются как `Date` благодаря режиму `timestamp_ms` в схемах.

## Контент — `cardRepository.ts`

- `getDecks()` — все колоды.
- `getDeck(deckId)` — одна колода.
- `getCards(deckId?)` — карточки колоды или всех колод.
- `getCard(cardId)` — одна карточка.
- `getCardMeanings(cardId)` — значения слова.
- `getCardMeaning(cardMeaningId)` — одно значение.
- `getCardExamples(cardMeaningId)` — примеры значения.
- `getCardMeaningAttributes(cardMeaningId)` — атрибуты с названиями и значениями.

Контент только читается. Пользовательские функции не создают колоды или слова.

## Пользователь — `userRepository.ts`

Прогресс хранится отдельно для каждого значения слова (`cardMeaningId`).
Пользователь один, локальный, поэтому `userId` не нужен.

- `getUserDecks()` — добавленные колоды, элементы вида `{ userDeck, deck }`.
- `getUserDeck(deckId)` — пользовательская запись колоды.
- `addUserDeck(deckId)` — добавить существующую колоду пользователю.
- `getUserCardMeanings(deckId?)` — прогресс колоды или всех колод по сроку повторения.
- `getUserCardMeaning(cardMeaningId)` — прогресс одного значения.
- `addUserCardMeaning(cardMeaningId, now?)` — начальный прогресс через `createEmptyCard`.
- `toFsrsCard(progress)` — преобразовать запись базы в карточку TS-FSRS.
- `saveUserCardMeaningReview(cardMeaningId, result)` — сохранить результат `scheduler.next`.
- `getUserCardMeaningReviews(cardMeaningId)` — история ответов, сначала последние.

Повторное добавление колоды или значения возвращает существующую запись.
Сохранение ответа создаёт прогресс при первом ответе или обновляет его, добавляет
запись истории и обновляет `lastReviewedAt` добавленной колоды. Все эти изменения
выполняются в одной транзакции.

Пример для существующей колоды и значения:

```ts
import { Rating } from "ts-fsrs";
import { scheduler } from "@/lib/scheduler";
import {
  addUserDeck,
  addUserCardMeaning,
  saveUserCardMeaningReview,
  toFsrsCard,
} from "@/db/repositories/userRepository";

await addUserDeck(deckId);
const progress = await addUserCardMeaning(cardMeaningId);
const result = scheduler.next(toFsrsCard(progress), new Date(), Rating.Good);
await saveUserCardMeaningReview(cardMeaningId, result);
```

Сейчас репозитории используют существующее подключение `src/config/connection.ts`:
`@libsql/client` и файл из `DB_FILE_NAME`. Это подключение для Node.js при разработке.
Для работы на телефоне его нужно заменить подключением Drizzle к `expo-sqlite`
и подготовить локальную базу устройства. Экраны пока ссылаются на удалённые
`@/db/database` и `@/content/decks`; подключение экранов к репозиториям — отдельный шаг.
