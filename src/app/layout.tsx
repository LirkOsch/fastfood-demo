import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { PwaRegister } from "@/components/site/PwaRegister";

const appUrl = process.env.APP_URL?.startsWith("http")
  ? process.env.APP_URL
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Тёплый бокс — бургеры, шаурма и пицца с доставкой",
    template: "%s — Тёплый бокс",
  },
  description:
    "Демо-кафе быстрого питания: бургеры, шаурма, пицца, закуски и домашние напитки. Соберите заказ, приложите фото для своего блюда и следите за статусом по приватной ссылке.",
  applicationName: "Тёплый бокс",
  keywords: [
    "бургеры",
    "шаурма",
    "пицца",
    "доставка еды",
    "самовывоз",
    "кафе быстрого питания",
    "Тёплый бокс",
  ],
  authors: [{ name: "Тёплый бокс" }],
  creator: "Тёплый бокс",
  category: "food",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "Тёплый бокс",
    title: "Тёплый бокс — горячо, быстро, по-соседски",
    description:
      "Соберите заказ за пару минут: бургеры, шаурма, пицца и напитки. Приватная ссылка на заказ, статус от кухни и бонус после получения.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Тёплый бокс — кафе быстрого питания",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Тёплый бокс — горячо, быстро, по-соседски",
    description:
      "Демо-кафе быстрого питания с заказом, приватной ссылкой и бонусной игрой.",
    images: ["/og.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf5ea" },
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
  ],
  colorScheme: "light dark",
};

const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("tb-theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Перейти к содержимому
        </a>
        <CartProvider>{children}</CartProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
