import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SidebarLayout from "@/components/SidebarLayout";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WatchTower",
  description: "Internal QA/Anticheat Issue Dashboard",
  icons: {
    icon: '/lighthouse.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <SidebarLayout>
          {children}
        </SidebarLayout>
      </body>
    </html>
  );
}
