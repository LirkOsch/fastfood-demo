export type CategoryId =
  | "burgers"
  | "shawarma"
  | "pizza"
  | "snacks"
  | "drinks"
  | "desserts"
  | "custom";

export type VariantId = "standard" | "large" | "single";
export type OptionId = "double" | "sauce";
export type ModelKind =
  | "burger"
  | "shawarma"
  | "pizza"
  | "fries"
  | "drink"
  | "donut"
  | "box";

export interface Visual {
  patty?: string;
  doublePatty?: boolean;
  cheese?: boolean;
  sauce?: string;
  topping?: string;
  icing?: string;
  liquid?: string;
  wrapper?: string;
}

export interface MenuCategory {
  id: CategoryId;
  title: string;
  shortTitle: string;
  description: string;
  model: ModelKind;
  variants: VariantId[];
  variantLabels: Partial<Record<VariantId, string>>;
  note?: string;
}

export interface MenuItem {
  id: string;
  categoryId: CategoryId;
  name: string;
  description: string;
  tags?: string[];
  options: OptionId[];
  model: ModelKind;
  visual?: Visual;
  isCustom?: boolean;
}

export const CATEGORIES: MenuCategory[] = [
  {
    id: "burgers",
    title: "Бургеры",
    shortTitle: "Бургеры",
    description: "Котлеты из охлаждённой говядины, свои соусы и булочки с хрустящей корочкой.",
    model: "burger",
    variants: ["standard", "large"],
    variantLabels: { standard: "Стандарт", large: "Большой" },
    note: "Большой — двойная котлета и больше соуса.",
  },
  {
    id: "shawarma",
    title: "Шаурма",
    shortTitle: "Шаурма",
    description: "Собираем на гриле при вас: тонкий лаваш, сочная начинка, свежие овощи.",
    model: "shawarma",
    variants: ["standard", "large"],
    variantLabels: { standard: "Стандарт", large: "Большой" },
  },
  {
    id: "pizza",
    title: "Пицца",
    shortTitle: "Пицца",
    description: "Тесто холодного брожения и щедрая начинка. Режем на восемь кусков.",
    model: "pizza",
    variants: ["standard", "large"],
    variantLabels: { standard: "30 см", large: "40 см" },
    note: "3D-иллюстрация показывает один кусок, а не точный размер пиццы.",
  },
  {
    id: "snacks",
    title: "Закуски",
    shortTitle: "Закуски",
    description: "Хрустящая сторона заказа: картофель, наггетсы и кольца.",
    model: "fries",
    variants: ["standard", "large"],
    variantLabels: { standard: "Стандарт", large: "Большой" },
  },
  {
    id: "drinks",
    title: "Напитки",
    shortTitle: "Напитки",
    description: "Домашние лимонады, кола со льдом и густые молочные коктейли.",
    model: "drink",
    variants: ["standard", "large"],
    variantLabels: { standard: "0,4 л", large: "0,6 л" },
  },
  {
    id: "desserts",
    title: "Десерты",
    shortTitle: "Десерты",
    description: "Небольшая сладкая точка в конце. Готовим небольшими партиями.",
    model: "donut",
    variants: ["single"],
    variantLabels: { single: "Порция" },
  },
  {
    id: "custom",
    title: "Своё блюдо",
    shortTitle: "Своё",
    description: "Опишите, что приготовить, и приложите фото-референс. Стоимость согласуем после просмотра.",
    model: "box",
    variants: ["single"],
    variantLabels: { single: "На заказ" },
    note: "Для своего блюда нужны описание и хотя бы одно фото. Цена — по запросу.",
  },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "b-boxy",
    categoryId: "burgers",
    name: "Боксик-бургер",
    description: "Говядина, чеддер, салат айсберг, маринованный огурец и соус «Тёплый».",
    tags: ["хит"],
    options: ["double", "sauce"],
    model: "burger",
    visual: { patty: "#7a4328", cheese: true, sauce: "#d96b35" },
  },
  {
    id: "b-chicken",
    categoryId: "burgers",
    name: "Чикен-бокс",
    description: "Куриное филе в панировке, свежий помидор, айсберг и медово-горчичный соус.",
    options: ["double", "sauce"],
    model: "burger",
    visual: { patty: "#c98a52", cheese: false, sauce: "#e6b34a" },
  },
  {
    id: "b-double",
    categoryId: "burgers",
    name: "Дабл-смэш",
    description: "Две тонкие котлеты, двойной чеддер, лук на гриле и перечный соус.",
    tags: ["остро"],
    options: ["double", "sauce"],
    model: "burger",
    visual: { patty: "#6b3822", doublePatty: true, cheese: true, sauce: "#b63b27" },
  },
  {
    id: "b-green",
    categoryId: "burgers",
    name: "Зелёный бокс",
    description: "Котлета из нута, авокадо, томат, руккола и соус из петрушки.",
    tags: ["веган"],
    options: ["double", "sauce"],
    model: "burger",
    visual: { patty: "#6f7d4a", cheese: false, sauce: "#6f7f52" },
  },
  {
    id: "s-classic",
    categoryId: "shawarma",
    name: "Шаурма классик",
    description: "Курица на гриле, капуста, морковь по-корейски, свежий огурец и чесночный соус.",
    options: ["double", "sauce"],
    model: "shawarma",
    visual: { sauce: "#f1e4c9" },
  },
  {
    id: "s-spicy",
    categoryId: "shawarma",
    name: "Шаурма остряк",
    description: "Курица, халапеньо, красный лук и соус чили. Согревает, но не сжигает.",
    tags: ["остро"],
    options: ["double", "sauce"],
    model: "shawarma",
    visual: { sauce: "#c9452f" },
  },
  {
    id: "s-cheese",
    categoryId: "shawarma",
    name: "Шаурма сырная",
    description: "Курица, двойной чеддер, помидор и сливочно-сырный соус.",
    options: ["double", "sauce"],
    model: "shawarma",
    visual: { sauce: "#e8cf87" },
  },
  {
    id: "p-margherita",
    categoryId: "pizza",
    name: "Маргарита",
    description: "Томатный соус, моцарелла и базилик. Ничего лишнего.",
    tags: ["веган-опция"],
    options: ["double", "sauce"],
    model: "pizza",
    visual: { topping: "#c84a35" },
  },
  {
    id: "p-pepperoni",
    categoryId: "pizza",
    name: "Пепперони",
    description: "Пикантная пепперони, моцарелла и томатный соус.",
    tags: ["хит"],
    options: ["double", "sauce"],
    model: "pizza",
    visual: { topping: "#b73a2c" },
  },
  {
    id: "p-chicken",
    categoryId: "pizza",
    name: "Сырный цыплёнок",
    description: "Курица, моцарелла, чеддер и сливочный соус.",
    options: ["double", "sauce"],
    model: "pizza",
    visual: { topping: "#d9a65a" },
  },
  {
    id: "k-fries",
    categoryId: "snacks",
    name: "Картофель фри",
    description: "Тонкая соломка, морская соль, хрустящая корочка.",
    tags: ["веган"],
    options: ["sauce"],
    model: "fries",
    visual: { sauce: "#e2542c" },
  },
  {
    id: "k-nuggets",
    categoryId: "snacks",
    name: "Наггетсы",
    description: "Шесть кусочков куриного филе в золотистой панировке.",
    options: ["sauce"],
    model: "fries",
    visual: { sauce: "#e6b34a" },
  },
  {
    id: "k-onion",
    categoryId: "snacks",
    name: "Луковые кольца",
    description: "Пять колец в кляре, подаём с соусом на выбор.",
    options: ["sauce"],
    model: "fries",
    visual: { sauce: "#d8c4a0" },
  },
  {
    id: "d-lemonade",
    categoryId: "drinks",
    name: "Домашний лимонад",
    description: "Лимон, мята и немного тростникового сахара. Готовим каждый день.",
    tags: ["веган"],
    options: [],
    model: "drink",
    visual: { liquid: "#e7c94f" },
  },
  {
    id: "d-cola",
    categoryId: "drinks",
    name: "Кола со льдом",
    description: "Классика в стакане со льдом и лаймом.",
    options: [],
    model: "drink",
    visual: { liquid: "#4a2a20" },
  },
  {
    id: "d-shake",
    categoryId: "drinks",
    name: "Молочный коктейль",
    description: "Ваниль, клубника или шоколад. Спросим вкус при подтверждении.",
    options: [],
    model: "drink",
    visual: { liquid: "#e8c9b4" },
  },
  {
    id: "t-donut",
    categoryId: "desserts",
    name: "Донат с глазурью",
    description: "Пышный донат и тонкая глазурь. Сегодня — ванильная.",
    options: [],
    model: "donut",
    visual: { icing: "#e9a7a0" },
  },
  {
    id: "t-icecream",
    categoryId: "desserts",
    name: "Мороженое",
    description: "Два шарика пломбира в вафельном стаканчике.",
    options: [],
    model: "donut",
    visual: { icing: "#f2e7cf" },
  },
  {
    id: "t-cookie",
    categoryId: "desserts",
    name: "Печенье",
    description: "Большое шоколадное печенье с солёной карамелью.",
    options: [],
    model: "donut",
    visual: { icing: "#b97a4a" },
  },
  {
    id: "custom",
    categoryId: "custom",
    name: "Своё блюдо",
    description: "Опишите идею и приложите фото. Мы посмотрим и вернёмся с ценой.",
    options: [],
    model: "box",
    isCustom: true,
  },
];

export const OPTION_LABELS: Record<OptionId, string> = {
  double: "Двойная начинка",
  sauce: "Второй соус",
};

export const OPTION_HINTS: Record<OptionId, string> = {
  double: "Двойная котлета, сыр или начинка — зависит от блюда.",
  sauce: "Добавим ещё один соус на выбор.",
};

export function getCategory(id: string): MenuCategory | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

export function getItem(id: string): MenuItem | undefined {
  return MENU_ITEMS.find((item) => item.id === id);
}

export function getVariantLabel(categoryId: string, variant: VariantId): string {
  const category = getCategory(categoryId);
  return category?.variantLabels[variant] ?? variant;
}

export function getCategoryItems(categoryId: CategoryId): MenuItem[] {
  return MENU_ITEMS.filter((item) => item.categoryId === categoryId);
}

export function makeLineKey(
  itemId: string,
  variant: VariantId,
  options: OptionId[],
): string {
  return `${itemId}:${variant}:${[...options].sort().join("+")}`;
}

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);
export const OPTION_IDS: OptionId[] = ["double", "sauce"];
export const VARIANT_IDS: VariantId[] = ["standard", "large", "single"];
