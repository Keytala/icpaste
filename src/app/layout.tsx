import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "icpaste // BOM price finder",
  description: "Paste your BOM. Get the best price across Mouser, Digi-Key and Farnell.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
