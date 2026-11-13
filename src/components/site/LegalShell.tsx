import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import type { CompanySettings } from "@/lib/settings";

export function LegalShell({
  company,
  title,
  meta,
  children,
}: {
  company: CompanySettings;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader compact />
      <main id="main" className="page legal-page">
        <article className="legal-shell">
          <header>
            <h1>{title}</h1>
            {meta ? <p className="legal-meta" style={{ marginTop: 12 }}>{meta}</p> : null}
          </header>
          {children}
        </article>
      </main>
      <SiteFooter company={company} />
    </>
  );
}
