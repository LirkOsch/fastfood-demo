import Link from "next/link";
import { BoxMark } from "@/components/site/BoxMark";

export default function NotFound() {
  return (
    <main id="main" className="page not-found">
      <BoxMark className="brand__mark" />
      <p className="eyebrow">404</p>
      <h1>Такой страницы нет</h1>
      <p className="muted" style={{ maxWidth: "44ch" }}>
        Возможно, ссылка устарела или в адресе опечатка. Меню и оформление заказа работают как
        обычно.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        <Link href="/" className="btn btn--primary btn--small">
          На главную
        </Link>
        <Link href="/#menu" className="btn btn--ghost btn--small">
          Открыть меню
        </Link>
      </div>
    </main>
  );
}
