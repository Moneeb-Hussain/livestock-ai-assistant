import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MaweshiAI",
  description: "AI-assisted guidance for livestock health",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <AppToaster />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
