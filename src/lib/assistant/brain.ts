import { formatPhone, formatRub } from "@/lib/format";
import { getCategory, type MenuItem } from "@/lib/menu";
import {
  availableItemsByIds,
  buildAddLine,
  categoryItemLines,
  detectCategory,
  extractOrderNumber,
  extractOrderToken,
  isOrderStatusQuestion,
  itemsByTag,
  matchMenuItems,
  menuCategoryLines,
  normalizeText,
  optionNote,
  priceLines,
  priceSummary,
  tokenize,
  variantPrices,
  type ItemMatch,
} from "./knowledge";
import {
  STARTER_CHIPS,
  STATUS_CHIPS,
  type AssistantAddAction,
  type AssistantContext,
  type AssistantOrderInfo,
  type AssistantReply,
} from "./types";

/**
 * Детерминированный «мозг» помощника.
 * Отвечает только по живым настройкам кафе и не сочиняет цены, состав и статусы.
 */

const GREETINGS = [
  "здравствуйте",
  "здравствуй",
  "приветствую",
  "привет",
  "добрый день",
  "добрый вечер",
  "доброе утро",
  "хай",
];

const THANKS = ["спасибо", "благодарю", "спс", "пасибо"];

function local(
  text: string,
  intent: string,
  extra: Partial<Omit<AssistantReply, "text" | "intent" | "source">> = {},
): AssistantReply {
  return { text, intent, source: "local", ...extra };
}

function stripGreeting(normalized: string): string {
  for (const greeting of GREETINGS) {
    if (normalized === greeting) return "";
    if (normalized.startsWith(`${greeting} `)) {
      return normalized.slice(greeting.length + 1).trim();
    }
  }
  return normalized;
}

function helperName(ctx: AssistantContext): string {
  return ctx.settings.character.preset === "none"
    ? "помощник «Тёплого бокса»"
    : ctx.settings.character.name;
}

function contactLine(ctx: AssistantContext): string {
  const { phone, email } = ctx.settings.company;
  const parts: string[] = [];
  if (phone) parts.push(`телефон ${formatPhone(phone)}`);
  if (email) parts.push(`почта ${email}`);
  return parts.length > 0 ? parts.join(", ") : "контакты указаны на странице «Контакты»";
}

function addAction(item: MenuItem, ctx: AssistantContext): AssistantAddAction | undefined {
  const line = buildAddLine(item, ctx.settings.pricing);
  if (!line) return undefined;
  return { type: "add-to-cart", label: "Добавить в корзину", line };
}

function recommendReply(ctx: AssistantContext): AssistantReply {
  const { pricing } = ctx.settings;
  const hits = itemsByTag("хит", pricing);
  const picks = hits.length > 0 ? hits.slice(0, 3) : [];
  if (picks.length === 0) {
    return local(
      "Сейчас в меню нет отмеченных хитов — откройте меню и выберите по составу. Подскажу цену по любой позиции.",
      "recommend",
      { chips: STARTER_CHIPS, link: { href: "/#menu", label: "Открыть меню" } },
    );
  }
  const first = picks[0]!;
  return local(`Если выбирать за вас — начните с «${first.name}». Остальное хорошо дополнит заказ.`, "recommend", {
    bullets: picks.map(
      (item) => `${item.name} — ${priceSummary(item, pricing)}. ${item.description}`,
    ),
    chips: ["Что остренькое?", "Есть веган?", "Сколько стоит доставка?"],
    add: addAction(first, ctx),
    link: { href: "/#menu", label: "Открыть меню" },
  });
}

function orderReply(ctx: AssistantContext): AssistantReply | null {
  if (ctx.order.kind === "found") return foundOrderReply(ctx.order.order);
  if (ctx.order.kind === "not-found") {
    return local(
      "Не нашёл заказ по этой ссылке. Проверьте, что она скопирована целиком: возможно, заказ удалён или ссылка устарела.",
      "order-status",
      { chips: STATUS_CHIPS },
    );
  }
  return null;
}

function foundOrderReply(order: AssistantOrderInfo): AssistantReply {
  const bullets: string[] = [];
  if (order.finalTotal !== null) {
    bullets.push(`Итоговая сумма: ${formatRub(order.finalTotal)}`);
  } else {
    bullets.push(`Сумма по известным позициям: ${formatRub(order.totalKnown)}`);
    if (order.hasQuote) bullets.push("Есть позиции по запросу — итог согласует кухня.");
  }
  bullets.push(`Способ получения: ${order.deliveryLabel}`);
  if (order.agreedAtLabel) bullets.push(`Согласованное время: ${order.agreedAtLabel}`);
  bullets.push(`Оформлен: ${order.createdAtLabel}`);
  return local(`Заказ ${order.orderNo}: ${order.statusLabel}.`, "order-status", {
    bullets,
    chips: STATUS_CHIPS,
    link: { href: order.url, label: "Открыть страницу заказа" },
  });
}

function orderPromptReply(message: string, ctx: AssistantContext): AssistantReply {
  const orderNo = extractOrderNumber(message);
  if (orderNo) {
    return local(
      `Номер ${orderNo} вижу. Но статус открывается только по приватной ссылке — вставьте её целиком, и я покажу статус и сумму.`,
      "order-status",
      { chips: STATUS_CHIPS },
    );
  }
  return local(
    "Статус заказа виден по приватной ссылке, которую вы получили после оформления. Вставьте ссылку целиком (или токен из неё) — прочитаю статус и сумму.",
    "order-status",
    {
      bullets: ["Ссылка выглядит так: /order/… — её же можно открыть в браузере."],
      chips: STATUS_CHIPS,
      link: { href: "/contacts", label: "Написать в кафе" },
    },
  );
}

export function answerAssistant(message: string, ctx: AssistantContext): AssistantReply {
  const { company, pricing, game } = ctx.settings;
  const raw = normalizeText(message);
  const normalized = stripGreeting(raw);
  const tokens = tokenize(normalized);
  const name = helperName(ctx);

  // 1. Статус заказа — по токену из ссылки или по прямому вопросу.
  const fromOrder = orderReply(ctx);
  if (fromOrder) return fromOrder;
  if (
    extractOrderToken(message) ||
    extractOrderNumber(message) ||
    isOrderStatusQuestion(message)
  ) {
    return orderPromptReply(message, ctx);
  }

  // 2. Приветствие без вопроса.
  if (normalized.length === 0) {
    return local(`Здравствуйте! Я ${name}. Подскажу по меню и ценам, доставке и статусу заказа.`, "greeting", {
      chips: STARTER_CHIPS,
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }

  // 3. Благодарность без вопроса.
  if (tokens.length > 0 && tokens.every((token) => THANKS.includes(token))) {
    return local("Пожалуйста! Если что-то ещё понадобится — я рядом.", "thanks", {
      chips: STARTER_CHIPS,
    });
  }

  // 4. «Кто ты» и «что умеешь».
  if (
    normalized === "помощь" ||
    normalized.startsWith("что ты умеешь") ||
    normalized.startsWith("что умеешь") ||
    normalized.startsWith("кто ты") ||
    normalized.startsWith("как ты работаешь")
  ) {
    return local(`Я ${name}, встроенный помощник кафе. Отвечаю по данным кафе, без выдуманных цен.`, "help", {
      bullets: [
        "Подскажу состав, цены и варианты порций.",
        "Расскажу про доставку, самовывоз, минимальный заказ и оплату.",
        "Объясню, как заказать своё блюдо с фото.",
        "Прочитаю статус заказа по приватной ссылке.",
      ],
      chips: STARTER_CHIPS,
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }

  // 5. Своё блюдо.
  if (
    normalized.includes("свое блюдо") ||
    normalized.includes("свое блюд") ||
    normalized.includes("свой рецепт") ||
    normalized.includes("не из меню") ||
    normalized.includes("приготовить на заказ")
  ) {
    return local(
      "Своё блюдо можно заказать, даже если его нет в меню: опишите идею и приложите хотя бы одно фото.",
      "custom-dish",
      {
        bullets: [
          "Фото нужно обязательно: JPEG, PNG или WebP, до трёх штук.",
          "Без описания и фото заявка не отправится.",
          "Цена — по запросу: её согласует кухня, поэтому в корзине позиция не считается бесплатной.",
        ],
        chips: ["Сколько стоит доставка?", "Как оформить заказ?", "Покажи меню"],
        link: { href: "/#menu", label: "Собрать заказ" },
      },
    );
  }

  // 6. Доставка.
  if (normalized.includes("доставк") || normalized.includes("курьер") || normalized.includes("привез")) {
    const fee =
      pricing.deliveryFee > 0
        ? `Доставка — ${formatRub(pricing.deliveryFee)}`
        : "Доставка бесплатная";
    const outOfTown =
      pricing.outOfTownFee > 0
        ? `выезд за город — +${formatRub(pricing.outOfTownFee)}`
        : "за город — без доплаты";
    return local(`${fee}, ${outOfTown}. Зона: ${company.deliveryArea}.`, "delivery", {
      bullets: [
        `Минимальный заказ — ${formatRub(pricing.minOrder)} по позициям с известной ценой.`,
        "Время и итоговую сумму кухня подтверждает после заявки.",
      ],
      chips: ["Самовывоз?", "Сколько стоит доставка за город?", "Как оформить заказ?"],
      link: { href: "/#how", label: "Как оформить" },
    });
  }

  // 7. Самовывоз.
  if (normalized.includes("самовывоз") || normalized.includes("забрать") || normalized.includes("адрес")) {
    return local(`Забрать можно по адресу: ${company.address}. Часы: ${company.workingHours}.`, "pickup", {
      bullets: [
        `Минимальный заказ — ${formatRub(pricing.minOrder)} по позициям с известной ценой.`,
        "Заказ собираем к согласованному времени.",
      ],
      chips: ["Доставка?", "Как оформить заказ?", "Покажи меню"],
      link: { href: "/contacts", label: "Контакты и адрес" },
    });
  }

  // 8. Часы работы.
  if (
    normalized.includes("часы") ||
    normalized.includes("во сколько") ||
    normalized.includes("работаете") ||
    normalized.includes("открыт") ||
    normalized.includes("закрыт")
  ) {
    return local(`Работаем: ${company.workingHours}.`, "hours", {
      bullets: [`Город: ${company.city}.`, "Приём заказов — на доставку и самовывоз."],
      chips: ["Самовывоз?", "Доставка?", "Покажи меню"],
      link: { href: "/contacts", label: "Контакты" },
    });
  }

  // 9. Минимальный заказ.
  if (normalized.includes("минимальн") || normalized.includes("минимум")) {
    return local(`Минимальный заказ — ${formatRub(pricing.minOrder)}.`, "min-order", {
      bullets: [
        "Считается по позициям с известной ценой.",
        "Если сумма меньше, разница добавляется к заказу.",
        "Позиции «по запросу» в минимум не входят.",
      ],
      chips: ["Покажи меню", "Сколько стоит доставка?", "Как оформить заказ?"],
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }

  // 10. Оплата.
  if (
    normalized.includes("оплат") ||
    normalized.includes("оплатить") ||
    normalized.includes("картой") ||
    normalized.includes("наличн") ||
    normalized.includes("перевод")
  ) {
    return local(
      "Онлайн-оплата в демо-версии не подключена: заявку подтверждает человек и согласует способ оплаты.",
      "payment",
      {
        bullets: [
          "Сумму и время кухня подтверждает после заявки.",
          "Данные карты сайт не запрашивает и не хранит.",
        ],
        chips: ["Как оформить заказ?", "Сколько стоит доставка?", "Покажи меню"],
        link: { href: "/terms", label: "Условия заказа" },
      },
    );
  }

  // 11. Игра и бонус.
  if (
    normalized.includes("игр") ||
    normalized.includes("бонус") ||
    normalized.includes("скидк") ||
    normalized.includes("промокод")
  ) {
    if (game.mode === "off") {
      return local("Мини-игра сейчас отключена — на заказ это не влияет.", "game", {
        chips: STARTER_CHIPS,
      });
    }
    const bullets = [
      "После выполненного заказа на его странице открывается мини-игра «протри поднос».",
    ];
    if (game.mode === "bonus") {
      bullets.push(
        `За прохождение — бонусный код на ${formatRub(game.bonusAmount)} ₽ при заказе от ${formatRub(game.bonusMinOrder)} ₽.`,
        `Код действует ${game.bonusDays} дн. и вводится при оформлении.`,
      );
    }
    return local("Мини-игра доступна после выполнения заказа.", "game", {
      bullets,
      chips: ["Как оформить заказ?", "Покажи меню"],
    });
  }

  // 12. Аллергены.
  if (
    normalized.includes("аллерг") ||
    normalized.includes("глютен") ||
    normalized.includes("лактоз") ||
    normalized.includes("орех") ||
    normalized.includes("непереносимость")
  ) {
    return local(
      `В демо нет структурированных данных об аллергенах, поэтому не буду угадывать состав. Состав каждой позиции указан в меню, а аллергены и замены согласуйте с кухней: ${contactLine(ctx)}.`,
      "allergy",
      {
        bullets: [
          "В комментарии к заказу можно указать ограничения — кухня увидит их до подтверждения.",
        ],
        chips: ["Покажи меню", "Есть веган?", "Как оформить заказ?"],
        link: { href: "/contacts", label: "Контакты" },
      },
    );
  }

  // 13. Острое: с отрицанием или без.
  const spicyNegated =
    normalized.includes("не остр") ||
    normalized.includes("неостр") ||
    normalized.includes("без остр") ||
    normalized.includes("не люблю остр");
  if (normalized.includes("остр") || normalized.includes("чили") || normalized.includes("халапеньо")) {
    if (spicyNegated) {
      const safe = availableItemsByIds(
        ["b-boxy", "b-chicken", "s-classic", "s-cheese", "k-fries"],
        pricing,
      );
      const first = safe[0];
      return local("Тогда без острого — вот спокойные позиции.", "spicy-mild", {
        bullets: safe.map(
          (item) => `${item.name} — ${priceSummary(item, pricing)}. ${item.description}`,
        ),
        chips: ["Покажи меню", "Есть веган?", "Сколько стоит доставка?"],
        add: first ? addAction(first, ctx) : undefined,
      });
    }
    const spicy = itemsByTag("остро", pricing);
    if (spicy.length === 0) {
      return local("Сейчас острых позиций нет — меню обновляется.", "spicy", {
        chips: ["Что посоветуешь?", "Покажи меню"],
      });
    }
    const first = spicy[0]!;
    return local(
      `Остро у нас: ${spicy.map((item) => item.name).join(" и ")}. Жжёт умеренно — так задумано.`,
      "spicy",
      {
        bullets: spicy.map(
          (item) => `${item.name} — ${priceSummary(item, pricing)}. ${item.description}`,
        ),
        chips: ["Что посоветуешь?", "Есть веган?", "Покажи меню"],
        add: addAction(first, ctx),
      },
    );
  }

  // 14. Веганское.
  if (
    normalized.includes("веган") ||
    normalized.includes("вегетариан") ||
    normalized.includes("без мяса") ||
    normalized.includes("постн") ||
    normalized.includes("растительн")
  ) {
    const vegan = itemsByTag("веган", pricing);
    const options = itemsByTag("веган-опция", pricing);
    if (vegan.length === 0) {
      return local(
        "Полностью растительных позиций сейчас нет — уточните состав у кухни.",
        "vegan",
        {
          chips: ["Покажи меню", "Что посоветуешь?"],
          link: { href: "/contacts", label: "Контакты" },
        },
      );
    }
    const first = vegan[0]!;
    const bullets = vegan.map(
      (item) => `${item.name} — ${priceSummary(item, pricing)}. ${item.description}`,
    );
    if (options.length > 0) {
      bullets.push(
        `${options.map((item) => item.name).join(", ")} — есть веган-опция, но по умолчанию с сыром: уточните при заказе.`,
      );
    }
    return local("Полностью растительные позиции:", "vegan", {
      bullets,
      chips: ["Что посоветуешь?", "Что остренькое?", "Покажи меню"],
      add: addAction(first, ctx),
    });
  }

  // 15. Рекомендация.
  if (
    normalized.includes("посовет") ||
    normalized.includes("что взять") ||
    normalized.includes("что заказать") ||
    normalized.includes("хит") ||
    normalized.includes("популярн") ||
    normalized.includes("вкусн") ||
    normalized.includes("на компанию") ||
    normalized.includes("на двоих")
  ) {
    return recommendReply(ctx);
  }

  // 16. Конкретная позиция.
  const matches = matchMenuItems(message);
  const best = matches[0];
  if (best && best.score >= 4) {
    const tied = matches.filter((match) => match.score === best.score).slice(0, 3);
    if (tied.length > 1) {
      return local("Похоже на несколько позиций — уточните, что именно интересует.", "item-clarify", {
        bullets: tied.map((match) => `${match.item.name} — ${priceSummary(match.item, pricing)}`),
        chips: ["Покажи меню", "Что посоветуешь?"],
        link: { href: "/#menu", label: "Открыть меню" },
      });
    }
    const item = best.item;
    const prices = variantPrices(item, pricing);
    if (prices.length === 0) {
      return local(`${item.name} сейчас недоступен.`, "item-unavailable", {
        bullets: categoryItemLines(item.categoryId, pricing).slice(0, 3),
        chips: ["Покажи меню", "Что посоветуешь?"],
        link: { href: "/#menu", label: "Открыть меню" },
      });
    }
    const bullets = priceLines(item, pricing);
    const extra = optionNote(item, pricing);
    if (extra) bullets.push(extra);
    const line = buildAddLine(item, pricing);
    return local(`${item.name} — ${priceSummary(item, pricing)}. ${item.description}`, "item", {
      bullets,
      chips: ["Что посоветуешь?", "Сколько стоит доставка?", "Покажи меню"],
      add: line ? { type: "add-to-cart", label: "Добавить в корзину", line } : undefined,
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }
  if (matches.length > 0) {
    // Слабые совпадения (например, «бокс») показываем списком, а не угадываем.
    return local("Возможно, вы про одну из этих позиций:", "item-clarify", {
      bullets: matches.slice(0, 3).map(
        (match: ItemMatch) => `${match.item.name} — ${priceSummary(match.item, pricing)}`,
      ),
      chips: ["Покажи меню", "Что посоветуешь?"],
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }

  // 17. Вопрос о цене без названия блюда.
  if (
    normalized.includes("сколько стоит") ||
    normalized.includes("сколько стоят") ||
    normalized.includes("почем") ||
    normalized === "цена" ||
    normalized.startsWith("цена ")
  ) {
    return local("Уточните блюдо — назову цену по актуальным настройкам кафе.", "price-clarify", {
      chips: ["Боксик-бургер", "Шаурма классик", "Картофель фри"],
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }

  // 18. Категория меню.
  const categoryId = detectCategory(message);
  if (categoryId) {
    const category = getCategory(categoryId);
    if (category) {
      const lines = categoryItemLines(categoryId, pricing);
      return local(`${category.title}. ${category.description}`, "category", {
        bullets: lines.length > 0 ? lines : ["В этой категории сейчас нет доступных позиций."],
        chips: ["Что посоветуешь?", "Сколько стоит доставка?", "Как оформить заказ?"],
        link: { href: "/#menu", label: "Открыть меню" },
      });
    }
  }

  // 19. Обзор меню.
  if (
    normalized.includes("меню") ||
    normalized.includes("что есть") ||
    normalized.includes("ассортимент") ||
    normalized.includes("поесть") ||
    normalized.includes("перекус")
  ) {
    const bullets = menuCategoryLines(pricing);
    bullets.push("Своё блюдо — по запросу: нужно описание и хотя бы одно фото.");
    return local("Вот меню с актуальными ценами.", "menu", {
      bullets,
      chips: ["Что посоветуешь?", "Сколько стоит доставка?", "Как оформить заказ?"],
      link: { href: "/#menu", label: "Открыть меню" },
    });
  }

  // 20. Корзина и оформление.
  if (normalized.includes("что в корзине") || normalized.includes("моя корзина")) {
    return local(
      "Корзина хранится в вашем браузере, поэтому я её не вижу. Откройте кнопку «Корзина» в шапке — там состав, количество и сумма.",
      "cart",
      {
        bullets: ["Черновик оформления и фото тоже сохраняются после перезагрузки."],
        chips: ["Как оформить заказ?", "Покажи меню"],
        link: { href: "/checkout", label: "Перейти к оформлению" },
      },
    );
  }
  if (
    normalized.includes("как заказать") ||
    normalized.includes("как оформить") ||
    normalized.includes("сделать заказ") ||
    normalized.includes("оформление") ||
    normalized.includes("корзин")
  ) {
    return local("Заказ собирается за несколько шагов.", "how-to-order", {
      bullets: [
        "Выберите блюдо и настройте порцию и добавки.",
        "Проверьте состав и сумму в корзине.",
        "Укажите имя, телефон и способ получения: доставка или самовывоз.",
        "Отправьте заявку — сразу появится приватная ссылка на заказ.",
      ],
      chips: ["Покажи меню", "Сколько стоит доставка?", "Как заказать своё блюдо?"],
      link: { href: "/#menu", label: "Собрать заказ" },
    });
  }

  // 21. Честный fallback.
  return local(
    `Пока не понял вопрос. Я ${name}: отвечаю по меню и настройкам кафе — без выдуманных цен.`,
    "fallback",
    {
      bullets: [
        "Спросите про блюдо, цену, состав или добавки.",
        "Могу рассказать про доставку, самовывоз, минимальный заказ и оплату.",
        "Пришлите ссылку на заказ — покажу статус.",
      ],
      chips: STARTER_CHIPS,
      link: { href: "/contacts", label: "Написать в кафе" },
    },
  );
}
