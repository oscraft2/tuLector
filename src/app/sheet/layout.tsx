import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/sheet" },
};

export default function SheetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
