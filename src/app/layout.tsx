import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import { AppSplash } from "@/components/app-splash";
import AppBackground from "@/components/app-background";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency OS",
  description: "Workforce management platform",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark", GeistSans.variable, GeistMono.variable)}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/N4.png" />
        <meta name="theme-color" content="#09090b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Runs synchronously before the browser paints anything, so on a
            fresh session the real app is hidden (via the CSS rule for
            html.splash-pending in globals.css) from the very first frame.
            Without this, the SSR'd app HTML paints for a moment before
            React hydrates and the splash overlay mounts — that flash is
            what was making the boot animation feel like it "stutters" in.
            AppSplash removes this class itself the instant it mounts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!sessionStorage.getItem('agencyos-splash-shown')){document.documentElement.classList.add('splash-pending')}}catch(e){}",
          }}
        />
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased", GeistSans.className)}>
        <AppBackground />
        <AppSplash />
        <div id="app-content">{children}</div>
      </body>
    </html>
  );
}