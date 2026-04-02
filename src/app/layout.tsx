import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title:       "icpaste.com — Find the best price for your BOM",
  description: "Paste your BOM, get the best price and stock for every component across Mouser, Digi-Key and Farnell. Instant results, no signup required.",
  keywords:    ["BOM", "electronic components", "MPN search", "Mouser", "Digikey", "Farnell", "price comparison"],
  openGraph: {
    title:       "icpaste.com",
    description: "Paste your BOM. Get the best price. Click and buy.",
    url:         "https://icpaste.com",
    siteName:    "icpaste.com",
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
      <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
