import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockSense | Inventory operations",
  description: "Stock balances, warehouse operations, and a traceable history of every movement.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
