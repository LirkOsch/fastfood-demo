import type { CategoryId, MenuItem } from "@/lib/menu";

export const MODEL_PATHS = {
  beef: "/models/burger-beef.glb",
  double: "/models/burger-double.glb",
  chicken: "/models/burger-chicken.glb",
  veggie: "/models/burger-veggie.glb",
  shawarma: "/models/shawarma.glb",
  pizza: "/models/pizza.glb",
  fries: "/models/fries.glb",
  drink: "/models/drink.glb",
  donut: "/models/donut.glb",
  box: "/models/box.glb",
  tray: "/models/tray.glb",
} as const;

export const ALL_MODELS = Object.values(MODEL_PATHS);

export function modelPathForItem(item: MenuItem | undefined): string {
  if (!item) return MODEL_PATHS.beef;
  switch (item.id) {
    case "b-boxy":
      return MODEL_PATHS.beef;
    case "b-double":
      return MODEL_PATHS.double;
    case "b-chicken":
      return MODEL_PATHS.chicken;
    case "b-green":
      return MODEL_PATHS.veggie;
    case "s-classic":
    case "s-spicy":
    case "s-cheese":
      return MODEL_PATHS.shawarma;
    case "p-margherita":
    case "p-pepperoni":
    case "p-chicken":
      return MODEL_PATHS.pizza;
    case "k-fries":
    case "k-nuggets":
    case "k-onion":
      return MODEL_PATHS.fries;
    case "d-lemonade":
    case "d-cola":
    case "d-shake":
      return MODEL_PATHS.drink;
    case "t-donut":
    case "t-icecream":
    case "t-cookie":
      return MODEL_PATHS.donut;
    default:
      return MODEL_PATHS.box;
  }
}

export const PHRASES: Record<CategoryId | "default", string[]> = {
  default: [
    "Я Боксик. Соберу заказ без очереди.",
    "Горячее — в бокс, холодное — рядом.",
    "Если что, я тут за главного.",
  ],
  burgers: [
    "Котлета горячая, булочка мягкая. Проверено.",
    "Бургер не любит ждать. Я тоже.",
    "Сыр плавится, пока вы выбираете.",
  ],
  shawarma: [
    "Заворачиваю так, чтобы соус не убежал.",
    "Лаваш тонкий, начинки не жалею.",
    "Острый соус — по желанию. Честно.",
  ],
  pizza: [
    "На картинке один кусок. Так честнее.",
    "Тесто отдыхало, начинка старалась.",
    "Режем на восемь. Делиться придётся.",
  ],
  snacks: [
    "Хрустит громче, чем я говорю.",
    "Картошку долго не держим.",
    "Соус — половина удовольствия.",
  ],
  drinks: [
    "Лёд, лимон, немного магии.",
    "Стакан держу крепко.",
    "Коктейль густой — ложка не нужна.",
  ],
  desserts: [
    "Сладкая точка. После неё можно всё.",
    "Глазурь сегодня особенно блестит.",
    "Маленький, но важный финал.",
  ],
  custom: [
    "Опишите идею — приготовим, если сможем.",
    "Фото помогает лучше сотни слов.",
    "Своё блюдо согласуем голосом.",
  ],
};
