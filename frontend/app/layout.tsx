import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

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
          {/* Header */}
          <header className="
            sticky top-0 z-50
            flex items-center justify-between
            px-6 py-3
            bg-[#0b0f1a]/80 backdrop-blur-md
            border-b border-white/5
          ">
            <div className="flex items-center gap-3">
              {/* Gem row accent */}
              <div className="flex gap-1">
                {['#f1f5f9','#3b82f6','#10b981','#ef4444','#475569','#fde047'].map((c, i) => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{ background: c, opacity: .8 }} />
                ))}
              </div>
              <h1 className="text-base font-black tracking-widest uppercase gold-text">
                Splendor
              </h1>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider hidden sm:block">
                Online
              </span>
            </div>
          </header>

          <main className="px-4 py-6 max-w-screen-2xl mx-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
