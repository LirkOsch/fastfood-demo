import "server-only";
import { formatPhone, formatRub } from "@/lib/format";
import type { AppSettings } from "@/lib/settings";
import { menuCategoryLines } from "./knowledge";

/**
 * Необязательный LLM-адаптер.
 *
 * По умолчанию помощник работает на детерминированном ядре (brain.ts) и не требует
 * ключей. Если задан ASSISTANT_LLM_KEY, этот адаптер получает тот же контекст кафе
 * и отвечает только когда локальное ядро не распознало вопрос. При любой ошибке
 * возвращается null — вызывающий код оставляет локальный ответ.
 *
 * Внимание: путь с реальным ключом не проверялся в этом демо, ключа нет.
 */

export function llmEnabled(): boolean {
  return Boolean(process.env.ASSISTANT_LLM_KEY?.trim());
}

function facts(settings: AppSettings): string {
  const { company, pricing, game } = settings;
  const lines: string[] = [
    `Кафе: ${company.name}. ${company.tagline}`,
    `Город и зона: ${company.city}; ${company.deliveryArea}.`,
    `Адрес самовывоза: ${company.address}.`,
    `Часы работы: ${company.workingHours}.`,
    `Доставка: ${formatRub(pricing.deliveryFee)}; выезд за город: ${formatRub(pricing.outOfTownFee)}.`,
    `Минимальный заказ: ${formatRub(pricing.minOrder)} по позициям с известной ценой.`,
    "Онлайн-оплата не подключена: способ оплаты согласует человек при подтверждении.",
  ];
  if (company.phone) lines.push(`Телефон: ${formatPhone(company.phone)}.`);
  if (company.email) lines.push(`Почта: ${company.email}.`);
  if (game.mode === "bonus") {
    lines.push(
      `После выполненного заказа доступна мини-игра; бонус ${formatRub(game.bonusAmount)} ₽ при заказе от ${formatRub(game.bonusMinOrder)} ₽, срок ${game.bonusDays} дн.`,
    );
  } else if (game.mode === "play") {
    lines.push("После выполненного заказа доступна мини-игра без бонуса.");
  } else {
    lines.push("Мини-игра отключена.");
  }
  lines.push("Меню с ценами:");
  for (const line of menuCategoryLines(pricing)) lines.push(`- ${line}`);
  lines.push("- Своё блюдо: цена по запросу, нужны описание и хотя бы одно фото.");
  return lines.join("\n");
}

const SYSTEM_PROMPT = [
  "Ты — помощник демо-кафе «Тёплый бокс». Пиши по-русски, коротко и дружелюбно.",
  "Используй только факты из блока «Факты».",
  "Никогда не выдумывай цены, состав, аллергены, время доставки и статусы заказов.",
  "Если данных нет — честно скажи, что это уточнит кухня, и предложи контакты из фактов.",
  "Не обещай онлайн-оплату: её нет.",
  "Не раскрывай персональные данные и не проси номер карты.",
  "Не добавляй позиции в корзину сам — это делает интерфейс по кнопке.",
].join(" ");

export interface LlmInput {
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  settings: AppSettings;
}

export async function askLlm(input: LlmInput): Promise<string | null> {
  const key = process.env.ASSISTANT_LLM_KEY?.trim();
  if (!key) return null;

  const endpoint =
    process.env.ASSISTANT_LLM_URL?.trim() || "https://api.openai.com/v1/chat/completions";
  const model = process.env.ASSISTANT_LLM_MODEL?.trim() || "gpt-4o-mini";

  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nФакты:\n${facts(input.settings)}` },
    ...input.history.slice(-6).map((entry) => ({ role: entry.role, content: entry.text })),
    { role: "user", content: input.message },
  ];

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 350,
        messages,
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const clean = content.trim().slice(0, 900);
    return clean.length > 0 ? clean : null;
  } catch {
    return null;
  }
}
