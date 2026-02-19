import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DownloadQueueProvider } from "@/lib/download-queue";
import { DebugProvider } from "@/components/debug";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Modrinth Server Panel",
  description: "Minecraft 服务器模组管理面板",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} antialiased font-sans`}>
        <DebugProvider>
          <DownloadQueueProvider>
            {children}
          </DownloadQueueProvider>
        </DebugProvider>
      </body>
    </html>
  );
}
