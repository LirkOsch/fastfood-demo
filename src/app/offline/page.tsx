import type { Metadata } from "next";
import Link from "next/link";
import { BoxMark } from "@/components/site/BoxMark";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Нет соединения",
  description: "Офлайн-страница демо-кафе «Тёплый бокс».",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <>
      <SiteHeader compact />
      <main id="main" className="page legal-page">
        <article className="legal-shell">
          <div className="legal-card" style={{ textAlign: "center" }}>
            <BoxMark className="brand__mark" />
            <h1 style={{ marginTop: 16 }}>Нет соединения</h1>
            <p>
              Похоже, интернет пропал. Меню и корзина сохраняются на устройстве, но отправить
              заказ или посмотреть статус получится после восстановления связи.
            </p>
            <p>
              <Link href="/" className="btn btn--primary btn--small">
                Попробовать снова
              </Link>
            </p>
          </div>
          <section>
            <h2>Что можно сделать</h2>
            <ul>
              <li>проверить Wi-Fi или мобильный интернет;</li>
              <li>вернуться на главную — корзина не потеряется;</li>
              <li>открыть приватную ссылку заказа позже, когда связь появится.</li>
            </ul>
          </section>
        </article>
      </main>
    </>
  );
}
