import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/consulta" },
};

export default function ConsultaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
