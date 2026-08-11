import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/bloque" },
};

export default function BloqueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
