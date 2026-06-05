import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency OS",
  description: "Workforce management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "dark",
        GeistSans.variable,
        GeistMono.variable
      )}
    >
      <body className={cn("min-h-screen bg-background font-sans antialiased", GeistSans.className)}>
        {children}
      </body>
    </html>
  );
}
