import type { Metadata } from "next";
import { Cinzel, Fira_Code, Spectral } from "next/font/google";
import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { UserProvider } from "@/components/UserContext";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TureCode — Trials & Coding Arenas",
  description:
    "Multi-round technical contest arena with strict proctoring, DSL code stubs, and sandboxed C/C++/Java/Python execution.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${spectral.variable} ${firaCode.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#1A0F0A] text-[#F5E6D3] selection:bg-[#CA8A04]/30 selection:text-[#F5E6D3]">
        <UserProvider>
          <Suspense
            fallback={
              <header className="h-16 border-b border-[#5C3D2E] bg-[#2C1A10]" />
            }
          >
            <Navbar />
          </Suspense>
          <div className="flex-1 flex flex-col">{children}</div>
        </UserProvider>
      </body>
    </html>
  );
}
