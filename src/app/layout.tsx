import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "icpaste.com — Find the best price for every component",
  description: "Paste your BOM and instantly find the best price across Mouser, Digi-Key and Farnell. Stock checked, quantity optimized.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title:       "icpaste.com — BOM Price Finder",
    description: "Find the best price for every electronic component. Paste your BOM, we do the rest.",
    url:         "https://icpaste.com",
    siteName:    "icpaste.com",
    locale:      "en_US",
    type:        "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0ea5e9" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
