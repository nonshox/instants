import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Mono",
  description:
    "Share everyday photos with the people you choose. Here for a while, yours to keep.",
  manifest: "/manifest.webmanifest",
  applicationName: "Mono",
  appleWebApp: {
    capable: true,
    title: "Mono",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/logotype/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/logotype/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logotype/favicon.ico" },
    ],
    apple: "/logotype/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
