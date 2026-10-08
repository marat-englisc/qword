export type WordContent = {
  id: string;
  title: string;
  ipa: string;
  definitionEn: string;
  definitionRu: string;
  attributes?: { label: string; value: string }[];
  examples: { textEn: string; textRu: string }[];
};

type DeckContent = {
  id: string;
  title: string;
  description: string;
  level: string;
  icon: string;
  color: string;
  words: WordContent[];
};

// Увеличьте версию после изменения контента. Прогресс существующих слов сохранится.
export const CONTENT_VERSION = 1;

export const builtInDecks: DeckContent[] = [
  {
    id: "everyday",
    title: "Каждый день",
    description: "Небольшие привычки, знакомые вещи и повседневные дела.",
    level: "A1–A2",
    icon: "weather-sunny",
    color: "#EEE7FA",
    words: [
      {
        id: "everyday-routine",
        title: "routine",
        ipa: "/ruːˈtiːn/",
        definitionEn:
          "The usual things you do regularly, often in the same order.",
        definitionRu: "Привычный порядок действий; распорядок.",
        attributes: [
          { label: "Часть речи", value: "noun · существительное" },
          { label: "Сочетание", value: "daily routine" },
        ],
        examples: [
          {
            textEn: "A short walk is part of my morning routine.",
            textRu: "Короткая прогулка — часть моего утреннего распорядка.",
          },
          {
            textEn: "I want to change my daily routine.",
            textRu: "Я хочу изменить свой ежедневный распорядок.",
          },
        ],
      },
      {
        id: "everyday-notice",
        title: "notice",
        ipa: "/ˈnəʊtɪs/",
        definitionEn: "To see or become aware of something.",
        definitionRu: "Замечать; обращать внимание на что-либо.",
        attributes: [{ label: "Часть речи", value: "verb · глагол" }],
        examples: [
          {
            textEn: "Did you notice the new café?",
            textRu: "Ты заметил новое кафе?",
          },
        ],
      },
      {
        id: "everyday-enough",
        title: "enough",
        ipa: "/ɪˈnʌf/",
        definitionEn: "As much or as many as you need.",
        definitionRu: "Достаточно; столько, сколько нужно.",
        attributes: [
          { label: "Сочетание", value: "enough time · достаточно времени" },
        ],
        examples: [
          {
            textEn: "We have enough time for breakfast.",
            textRu: "У нас достаточно времени для завтрака.",
          },
        ],
      },
      {
        id: "everyday-borrow",
        title: "borrow",
        ipa: "/ˈbɒrəʊ/",
        definitionEn: "To take and use something that you will give back.",
        definitionRu: "Брать взаймы или на время.",
        attributes: [
          { label: "Часть речи", value: "verb · глагол" },
          { label: "Сочетание", value: "borrow something from someone" },
        ],
        examples: [
          {
            textEn: "Can I borrow your pen?",
            textRu: "Можно я возьму твою ручку на время?",
          },
        ],
      },
      {
        id: "everyday-quiet",
        title: "quiet",
        ipa: "/ˈkwaɪət/",
        definitionEn: "Making little or no noise.",
        definitionRu: "Тихий; почти без шума.",
        attributes: [
          { label: "Часть речи", value: "adjective · прилагательное" },
        ],
        examples: [
          {
            textEn: "The house is quiet in the morning.",
            textRu: "Утром в доме тихо.",
          },
        ],
      },
      {
        id: "everyday-prepare",
        title: "prepare",
        ipa: "/prɪˈpeə/",
        definitionEn: "To make something ready for use or for an event.",
        definitionRu: "Готовить; подготавливать.",
        attributes: [{ label: "Часть речи", value: "verb · глагол" }],
        examples: [
          {
            textEn: "Let’s prepare dinner together.",
            textRu: "Давай приготовим ужин вместе.",
          },
        ],
      },
      {
        id: "everyday-usually",
        title: "usually",
        ipa: "/ˈjuːʒuəli/",
        definitionEn: "In the way that happens most of the time.",
        definitionRu: "Обычно; чаще всего.",
        attributes: [{ label: "Часть речи", value: "adverb · наречие" }],
        examples: [
          {
            textEn: "I usually read before bed.",
            textRu: "Я обычно читаю перед сном.",
          },
        ],
      },
      {
        id: "everyday-improve",
        title: "improve",
        ipa: "/ɪmˈpruːv/",
        definitionEn: "To become better or to make something better.",
        definitionRu: "Улучшать; становиться лучше.",
        examples: [
          {
            textEn: "Practice helps you improve your English.",
            textRu: "Практика помогает улучшить английский.",
          },
        ],
      },
    ],
  },
  {
    id: "travel",
    title: "В пути",
    description: "Слова для новых городов, поездок и маленьких приключений.",
    level: "A1–A2",
    icon: "compass-outline",
    color: "#E3EFE8",
    words: [
      {
        id: "travel-journey",
        title: "journey",
        ipa: "/ˈdʒɜːni/",
        definitionEn: "An act of travelling from one place to another.",
        definitionRu: "Поездка; путешествие из одного места в другое.",
        attributes: [{ label: "Часть речи", value: "noun · существительное" }],
        examples: [
          {
            textEn: "The train journey takes two hours.",
            textRu: "Поездка на поезде занимает два часа.",
          },
        ],
      },
      {
        id: "travel-arrive",
        title: "arrive",
        ipa: "/əˈraɪv/",
        definitionEn: "To reach the place you are travelling to.",
        definitionRu: "Прибывать; приезжать.",
        attributes: [
          {
            label: "Сочетание",
            value: "arrive at the station · arrive in London",
          },
        ],
        examples: [
          {
            textEn: "We arrive in London at six.",
            textRu: "Мы приезжаем в Лондон в шесть.",
          },
        ],
      },
      {
        id: "travel-ticket",
        title: "ticket",
        ipa: "/ˈtɪkɪt/",
        definitionEn: "A document that lets you travel or enter a place.",
        definitionRu: "Билет на транспорт или мероприятие.",
        examples: [
          {
            textEn: "I bought a return ticket.",
            textRu: "Я купил билет туда и обратно.",
          },
        ],
      },
      {
        id: "travel-luggage",
        title: "luggage",
        ipa: "/ˈlʌɡɪdʒ/",
        definitionEn: "The bags and cases you take when you travel.",
        definitionRu: "Багаж; сумки и чемоданы в поездке.",
        attributes: [
          { label: "Грамматика", value: "uncountable · неисчисляемое" },
        ],
        examples: [
          {
            textEn: "You can leave your luggage here.",
            textRu: "Вы можете оставить свой багаж здесь.",
          },
        ],
      },
      {
        id: "travel-nearby",
        title: "nearby",
        ipa: "/ˌnɪəˈbaɪ/",
        definitionEn: "Not far away.",
        definitionRu: "Поблизости; неподалёку.",
        examples: [
          {
            textEn: "There is a small hotel nearby.",
            textRu: "Поблизости есть небольшой отель.",
          },
        ],
      },
      {
        id: "travel-explore",
        title: "explore",
        ipa: "/ɪkˈsplɔː/",
        definitionEn: "To travel around a place to learn about it.",
        definitionRu: "Исследовать; знакомиться с новым местом.",
        attributes: [{ label: "Часть речи", value: "verb · глагол" }],
        examples: [
          {
            textEn: "We spent the afternoon exploring the city.",
            textRu: "Мы провели вторую половину дня, исследуя город.",
          },
        ],
      },
      {
        id: "travel-direction",
        title: "direction",
        ipa: "/dəˈrekʃən/",
        definitionEn: "The way that someone or something moves or points.",
        definitionRu: "Направление движения.",
        examples: [
          {
            textEn: "Are we going in the right direction?",
            textRu: "Мы идём в правильном направлении?",
          },
        ],
      },
      {
        id: "travel-book",
        title: "book",
        ipa: "/bʊk/",
        definitionEn:
          "To arrange to have a room, seat, or ticket at a future time.",
        definitionRu: "Бронировать; заказывать заранее.",
        attributes: [{ label: "Часть речи", value: "verb · глагол" }],
        examples: [
          {
            textEn: "I need to book a room for two nights.",
            textRu: "Мне нужно забронировать номер на две ночи.",
          },
        ],
      },
    ],
  },
  {
    id: "conversation",
    title: "Легко общаться",
    description: "Делиться мыслями, задавать вопросы и понимать друг друга.",
    level: "A2–B1",
    icon: "chat-outline",
    color: "#F7EADB",
    words: [
      {
        id: "conversation-suggest",
        title: "suggest",
        ipa: "/səˈdʒest/",
        definitionEn: "To offer an idea for someone to think about.",
        definitionRu: "Предлагать идею для обсуждения.",
        attributes: [{ label: "Сочетание", value: "suggest doing something" }],
        examples: [
          {
            textEn: "She suggested meeting after lunch.",
            textRu: "Она предложила встретиться после обеда.",
          },
        ],
      },
      {
        id: "conversation-agree",
        title: "agree",
        ipa: "/əˈɡriː/",
        definitionEn: "To have the same opinion as someone.",
        definitionRu: "Соглашаться; иметь одинаковое мнение.",
        attributes: [{ label: "Сочетание", value: "agree with someone" }],
        examples: [
          {
            textEn: "I agree with you about that.",
            textRu: "В этом я с тобой согласен.",
          },
        ],
      },
      {
        id: "conversation-explain",
        title: "explain",
        ipa: "/ɪkˈspleɪn/",
        definitionEn: "To make something clear or easy to understand.",
        definitionRu: "Объяснять; делать понятным.",
        examples: [
          {
            textEn: "Could you explain this word to me?",
            textRu: "Можешь объяснить мне это слово?",
          },
        ],
      },
      {
        id: "conversation-perhaps",
        title: "perhaps",
        ipa: "/pəˈhæps/",
        definitionEn: "Used to say that something may be true or may happen.",
        definitionRu: "Возможно; может быть.",
        examples: [
          {
            textEn: "Perhaps we can try again tomorrow.",
            textRu: "Возможно, мы сможем попробовать снова завтра.",
          },
        ],
      },
      {
        id: "conversation-prefer",
        title: "prefer",
        ipa: "/prɪˈfɜː/",
        definitionEn: "To like one thing more than another.",
        definitionRu: "Предпочитать что-то чему-то другому.",
        attributes: [{ label: "Сочетание", value: "prefer tea to coffee" }],
        examples: [
          {
            textEn: "I prefer walking to taking the bus.",
            textRu: "Я предпочитаю ходить пешком, а не ездить на автобусе.",
          },
        ],
      },
      {
        id: "conversation-actually",
        title: "actually",
        ipa: "/ˈæktʃuəli/",
        definitionEn:
          "Used to say what is really true, often when it is surprising.",
        definitionRu: "На самом деле; в действительности.",
        attributes: [{ label: "Не путать", value: "Не означает «актуально»." }],
        examples: [
          {
            textEn: "Actually, I have never been there.",
            textRu: "На самом деле я там никогда не был.",
          },
        ],
      },
      {
        id: "conversation-mind",
        title: "mind",
        ipa: "/maɪnd/",
        definitionEn: "To feel annoyed or unhappy about something.",
        definitionRu: "Возражать; быть против чего-либо.",
        attributes: [{ label: "Часть речи", value: "verb · глагол" }],
        examples: [
          {
            textEn: "Do you mind if I open the window?",
            textRu: "Ты не против, если я открою окно?",
          },
        ],
      },
      {
        id: "conversation-reason",
        title: "reason",
        ipa: "/ˈriːzən/",
        definitionEn:
          "Something that explains why a thing happens or why you do it.",
        definitionRu: "Причина; объяснение поступка или события.",
        examples: [
          {
            textEn: "Is there a reason for the delay?",
            textRu: "Есть ли причина задержки?",
          },
        ],
      },
    ],
  },
];
