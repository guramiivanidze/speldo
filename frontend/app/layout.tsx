import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { GameHeaderProvider } from "@/contexts/GameHeaderContext";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Splendor Online",
  description: "Play Splendor online with friends",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased min-h-screen`}>
        <AuthProvider>
          <GameHeaderProvider>
            <Header />
            <main className="px-4 py-6 max-w-screen-2xl mx-auto">
              {children}
            </main>
          </GameHeaderProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
