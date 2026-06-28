import Link from "next/link";
import { localeLabels, localizedHref, publicCopy, publicLocales, type PublicLocale } from "@/lib/public_i18n";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type PublicFooterProps = {
  locale?: PublicLocale;
};

export function PublicFooter({ locale = "es" }: PublicFooterProps) {
  const copy = publicCopy[locale].footer;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#e6e8eb] bg-white text-[#4b5563]">
      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_2fr]">
          <div className="max-w-sm">
            <TuLectorLogo href={localizedHref("/", locale)} />
            <p className="mt-4 text-sm leading-6">{copy.tagline}</p>
            <p className="mt-4 text-sm font-medium text-[#111827]">{copy.location}</p>
            <a href={`mailto:${copy.contact}`} className="mt-5 inline-flex text-sm font-semibold text-[#111827] hover:underline">
              {copy.contact}
            </a>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <FooterColumn title={copy.product} links={copy.columns.product} locale={locale} />
            <FooterColumn title={copy.resources} links={copy.columns.resources} locale={locale} />
            <FooterColumn title={copy.company} links={copy.columns.company} locale={locale} />

            <div>
              <h2 className="text-sm font-semibold text-[#111827]">{copy.language}</h2>
              <div className="mt-4 flex flex-col gap-2">
                {publicLocales.map((item) => (
                  <Link
                    key={item}
                    href={localizedHref("/", item)}
                    className={item === locale
                      ? "text-sm font-semibold text-[#111827]"
                      : "text-sm hover:text-[#111827]"}
                  >
                    {localeLabels[item]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[#e6e8eb] pt-6 text-xs text-[#6b7280] md:flex-row md:items-center md:justify-between">
          <p>© {year} TuLector. {copy.copyright}</p>
          <div className="flex flex-wrap gap-4">
            <Link href={localizedHref("/terms", locale)} className="hover:text-[#111827]">{copy.legal}</Link>
            <Link href={localizedHref("/privacy", locale)} className="hover:text-[#111827]">{copy.dataProtection}</Link>
            <Link href={localizedHref("/security", locale)} className="hover:text-[#111827]">{copy.securityLink}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  locale,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
  locale: PublicLocale;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={localizedHref(link.href, locale)} className="text-sm hover:text-[#111827]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

