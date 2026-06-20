import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeRegistry } from "@/components/providers/ThemeRegistry";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moto POS — Spare Parts Shop",
  description: "Cloud POS & FIFO inventory for motorcycle spare parts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
