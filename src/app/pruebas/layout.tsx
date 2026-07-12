import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/pruebas" },
};

export default function PruebasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
