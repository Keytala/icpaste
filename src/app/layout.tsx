import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "icpaste — BOM Price Finder",
  description: "Paste your BOM. Get the best price and stock across Mouser, Digi-Key and Farnell. No signup. Instant results.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body>{children}</body>
    </html>
  );
}
