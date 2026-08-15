import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";

export const metadata: Metadata = {
  title: "Life Pulse",
  description: "Your personal operating system for tracking goals, habits, health, mind, money, passions, and weekly progress.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Life Pulse",
    statusBarStyle: "black-translucent",
  },
  other: {
    "theme-color": "#0a0a0b",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-[var(--text)] bg-[var(--bg)]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
