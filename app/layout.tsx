import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "McDonough World Cup Pool",
  description: "Private salary-cap World Cup prediction pool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
