import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Grant Portal", template: "%s · Grant Portal" },
  description: "Grant documents, deadlines and alerts in one place",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#143e36" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
