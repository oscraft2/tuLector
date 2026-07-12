import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: "/test" },
};

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
