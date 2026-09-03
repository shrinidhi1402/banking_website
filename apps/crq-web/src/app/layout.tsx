import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import QueryProvider from "@/components/providers/QueryProvider";
import { Shield } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRQ Executive Dashboard",
  description: "CyberRisk Quantifier - Financial Risk Posture",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <QueryProvider>
          {/* Top Navbar */}
          <nav className="h-16 border-b border-surfaceBorder bg-background backdrop-blur-md sticky top-0 z-50 flex items-center px-6">
            <div className="flex items-center gap-2 text-navy">
              <Shield className="w-5 h-5 text-brand-500" />
              <span className="font-semibold tracking-wide">CRQ<span className="text-muted font-normal ml-1">Platform</span></span>
            </div>
            <div className="ml-auto flex items-center gap-4 text-sm text-muted">
              <a href="/" className="hover:text-navy transition-colors">Executive Dashboard</a>
              <a href="/report-finding" className="hover:text-navy transition-colors">Submit Finding</a>
              <div className="w-8 h-8 rounded-full bg-surface border border-surfaceBorder ml-2 flex items-center justify-center text-xs font-medium text-navy">
                JD
              </div>
            </div>
          </nav>

          <main className="flex-1 max-w-7xl w-full mx-auto p-6">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
