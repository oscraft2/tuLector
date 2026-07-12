import Link from "next/link";
import { JsonLd } from "./JsonLd";

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `https://tulector.app${item.href}`,
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-[#6b7280]">
        {items.map((item, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-2">/</span>}
            <Link href={item.href}>{item.name}</Link>
          </span>
        ))}
      </nav>
      <JsonLd data={ld} />
    </>
  );
}
