"use client";

import { Code2, LogIn, LogOut, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "./UserContext";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, loading } = useUser();

  const navItems = [
    { href: "/", label: "Contests", icon: Trophy, show: true },
    {
      href: "/moderator",
      label: "Moderator Studio",
      icon: ShieldCheck,
      show: currentUser?.role === "moderator",
    },
  ].filter((i) => i.show);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#5C3D2E] border-t-2 border-t-[#CA8A04] bg-[#2C1A10] shadow-[0_2px_8px_rgba(202,138,4,0.2)]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#DAA520] bg-[#CA8A04] text-[#1A0F0A] shadow-[0_1px_3px_rgba(202,138,4,0.3)] transition-all duration-300 group-hover:bg-[#B8780A]">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-cinzel text-lg font-bold tracking-wider text-[#F5E6D3]">
                TureCode
              </span>
              <span className="font-cinzel text-[10px] font-normal uppercase tracking-[1.5px] text-[#CA8A04]">
                Contest Realm
              </span>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/contests")
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-[4px] px-3.5 py-2 font-cinzel text-xs font-semibold uppercase tracking-[1px] transition-all duration-300 ${
                    active
                      ? "border border-[#CA8A04] bg-[#3D2517] text-[#F5E6D3] shadow-[0_0_20px_rgba(202,138,4,0.25)]"
                      : "text-[#BFA98A] hover:bg-[#3D2517] hover:text-[#F5E6D3]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 text-[#CA8A04]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-[4px] bg-[#3D2517]" />
          ) : currentUser ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5 rounded-[4px] border border-[#5C3D2E] bg-[#1A0F0A] px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#DAA520] bg-[#CA8A04] font-cinzel text-xs font-bold text-[#1A0F0A] uppercase">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="leading-tight">
                  <div className="font-spectral text-xs font-semibold text-[#F5E6D3]">
                    {currentUser.name}
                  </div>
                  <div className="font-cinzel text-[10px] uppercase tracking-[1px] text-[#CA8A04]">
                    {currentUser.role}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#5C3D2E] bg-transparent px-3 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.8px] text-[#BFA98A] hover:bg-[#3D2517] hover:text-[#F5E6D3] transition-all duration-300 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#CA8A04] bg-transparent px-3.5 py-2 font-cinzel text-xs font-semibold uppercase tracking-[0.8px] text-[#CA8A04] hover:bg-[#CA8A04]/10 transition-all duration-300"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Link>
              <Link
                href="/login?mode=register"
                className="rounded-[4px] border border-[#DAA520] bg-[#CA8A04] px-3.5 py-2 font-cinzel text-xs font-bold uppercase tracking-[0.8px] text-[#1A0F0A] shadow-[0_1px_3px_rgba(202,138,4,0.2)] hover:bg-[#B8780A] transition-all duration-300"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
