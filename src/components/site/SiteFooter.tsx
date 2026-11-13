import Link from "next/link";
import { BoxMark } from "@/components/site/BoxMark";
import type { CompanySettings } from "@/lib/settings";
import { formatPhone } from "@/lib/format";

export function SiteFooter({ company }: { company: CompanySettings }) {
  return (
    <footer className="site-footer">
      <div className="page">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="Тёплый бокс — на главную">
              <BoxMark className="brand__mark" />
              <span className="brand__text">
                {company.name}
                <small>{company.tagline}</small>
              </span>
            </Link>
            <p>{company.description}</p>
            <p className="tiny muted">
              {company.address}
              <br />
              {company.workingHours}
            </p>
          </div>

          <div className="footer-col">
            <h4>Заказ</h4>
            <Link href="/#menu">Меню</Link>
            <Link href="/checkout">Корзина и оформление</Link>
            <Link href="/#how">Как это работает</Link>
            <Link href="/#about">О кафе</Link>
          </div>

          <div className="footer-col">
            <h4>Связь и документы</h4>
            <Link href="/contacts">Контакты</Link>
            {company.phone ? (
              <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>
                {formatPhone(company.phone)}
              </a>
            ) : (
              <span>Телефон уточняется</span>
            )}
            <a href={`mailto:${company.email}`}>{company.email}</a>
            <Link href="/privacy">Политика конфиденциальности</Link>
            <Link href="/terms">Условия заказа</Link>
            <Link href="/licenses">Лицензии и атрибуция</Link>
          </div>
        </div>

        <div className="footer-base">
          <span>
            © {new Date().getFullYear()} {company.legalName}. Демонстрационный проект.
          </span>
          <span>Сделано без сторонних фотографий и чужих 3D-моделей.</span>
        </div>
      </div>
    </footer>
  );
}
