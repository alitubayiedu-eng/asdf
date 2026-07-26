"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, DEMO } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { ROLES } from "@/lib/constants";
import Notifications from "./Notifications";
import ThemeToggle from "./ThemeToggle";

export default function Shell({ children, sideNav, sideTitle }: {
  children: React.ReactNode;
  sideNav?: React.ReactNode;      // تب‌های پروژه — در سایدبار زیر منوی اصلی
  sideTitle?: string;             // عنوان بخش (نام پروژه)
}) {
  const router = useRouter();
  const path = usePathname();
  const { profile, loading } = useSession();
  const [search, setSearch] = useState("");
  const [gq, setGq] = useState("");
  const [mobileNav, setMobileNav] = useState(false);   // کشوی موبایل
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setSearch(typeof window !== "undefined" ? window.location.search : ""); }, [path]);
  useEffect(() => { setMobileNav(false); }, [path]);   // با تغییر صفحه بسته شود

  useEffect(() => {
    if (!loading && !profile) router.replace("/login");
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-primary" />
          <p className="text-sm text-ink/50">در حال بارگذاری…</p>
        </div>
      </div>
    );
  }

  const isGlobal = ["admin", "pm", "investor", "ceo", "board_member"].includes(profile.role);

  // منوی گروه‌بندی‌شده — پیدا کردن بخش‌ها ساده‌تر می‌شود
  const groups: { title: string; items: any[] }[] = [
    {
      title: "نمای کلی",
      items: [
        { href: "/dashboard", label: "داشبورد", icon: "◈", desc: "نمای کلی همه بخش‌ها" },
        ...(isGlobal ? [{ href: "/portfolio", label: "گزارش تجمیعی", icon: "📊", desc: "مالی همه پروژه‌ها" }] : []),
        { href: "/search", label: "جستجوی سراسری", icon: "🔍", desc: "جستجو در همه داده‌ها" },
      ],
    },
    {
      title: "بخش‌های کاری",
      items: [
        { href: "/projects?kind=construction", label: "عمران", icon: "🏗", match: "kind=construction" },
        { href: "/projects?kind=factory", label: "کارخانه", icon: "🏭", match: "kind=factory" },
        { href: "/projects?kind=solar", label: "نیروگاه خورشیدی", icon: "☀️", match: "kind=solar" },
        { href: "/projects?kind=chp", label: "سیکل ترکیبی", icon: "🔥", match: "kind=chp" },
      ],
    },
    ...(["admin", "pm"].includes(profile.role)
      ? [{ title: "مدیریت", items: [{ href: "/admin", label: "کاربران و نقش‌ها", icon: "👥" }] }]
      : []),
  ];

  const isActive = (n: any) =>
    n.match ? (path.startsWith("/projects") && search.includes(n.match)) : path.startsWith(n.href);

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (gq.trim()) { router.push(`/search?q=${encodeURIComponent(gq.trim())}`); setGq(""); }
  };

  const NavLinks = () => (
    <>
      {groups.map(g => (
        <div key={g.title} className="mb-4">
          <div className="nav-group-title">{g.title}</div>
          <div className="space-y-1">
            {g.items.map((n: any) => (
              <Link key={n.href} href={n.href} title={n.desc || n.label}
                className={`nav-item ${isActive(n) ? "nav-item-active" : ""}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[15px]"
                  style={isActive(n) ? { background: "rgb(var(--sidebar-accent) / .20)" } : { background: "rgb(255 255 255 / .06)" }}>
                  {n.icon}
                </span>
                <span className="flex-1">{n.label}</span>
                {isActive(n) && <span className="pulse-dot" />}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const Brand = () => (
    <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-black"
        style={{ background: "linear-gradient(135deg, rgb(var(--sidebar-accent)), rgb(var(--accent)))", color: "#fff" }}>D</div>
      <div className="min-w-0">
        <div className="text-sm font-black tracking-tight" dir="ltr">Different</div>
        <div className="truncate text-[10px] text-white/45">Agency Platform</div>
      </div>
    </div>
  );

  const UserCard = () => (
    <div className="border-t border-white/[0.07] p-3">
      <Link href={`/admin/user?uid=${profile.id}`}
        className="flex items-center gap-2.5 rounded-xl p-2 transition hover:bg-white/[0.06]"
        style={{ background: "rgb(255 255 255 / .04)" }}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black"
          style={{ background: "rgb(var(--sidebar-accent) / .20)", color: "rgb(var(--sidebar-accent))" }}>
          {(profile.full_name || "؟").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold">{profile.full_name || profile.email}</div>
          <div className="truncate text-[10px] text-white/50">{ROLES[profile.role] || profile.role}</div>
        </div>
      </Link>
      <button className="mt-2 w-full rounded-xl py-2 text-[11px] font-bold text-white/55 transition hover:bg-white/[0.06] hover:text-white"
        onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}>
        خروج از حساب
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* ───── سایدبار دسکتاپ ───── */}
      <aside className="sidebar-shell hidden w-64 shrink-0 flex-col md:flex">
        <Brand />
        <nav className="shrink-0 p-3"><NavLinks /></nav>
        {sideNav ? (
          <div className="side-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto border-t border-white/[0.07] px-3 pb-3 pt-3">
            <div className="mb-2 flex items-center gap-1.5 px-3">
              <span className="nav-group-title mb-0">بخش‌های پروژه</span>
              {sideTitle && <span className="truncate text-[10px] text-white/30">· {sideTitle}</span>}
            </div>
            {sideNav}
          </div>
        ) : <div className="flex-1" />}
        <UserCard />
      </aside>

      {/* ───── کشوی موبایل ───── */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileNav(false)}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
          <aside className="sidebar-shell absolute inset-y-0 right-0 flex w-72 flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <Brand />
            <nav className="side-scroll min-h-0 flex-1 overflow-y-auto p-3">
              <NavLinks />
              {sideNav && (
                <div className="border-t border-white/[0.07] pt-3">
                  <div className="nav-group-title">بخش‌های پروژه</div>
                  {sideNav}
                </div>
              )}
            </nav>
            <UserCard />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ───── نوار بالا ───── */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-card/90 px-3 py-2.5 backdrop-blur md:px-4">
          {/* دکمه منوی موبایل */}
          <button className="btn-ghost px-3 py-1.5 text-lg md:hidden" onClick={() => setMobileNav(true)} title="منو">☰</button>

          <button className="btn-ghost hidden px-3 py-1.5 text-sm sm:inline-flex" title="بازگشت"
            onClick={() => (history.length > 1 ? router.back() : router.push("/dashboard"))}>→ بازگشت</button>
          <Link href="/dashboard" className="btn-ghost hidden px-3 py-1.5 text-sm sm:inline-flex" title="خانه">⌂ خانه</Link>

          {/* جستجو — روی موبایل هم در دسترس */}
          <form onSubmit={runSearch} className="flex min-w-0 flex-1 items-center">
            <input value={gq} onChange={e => setGq(e.target.value)}
              className="input w-full py-1.5 text-sm" placeholder="🔍 جستجو در همه پروژه‌ها…" />
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Notifications profile={profile} />
          </div>
        </header>

        {mounted && DEMO && (
          <div className="border-b border-danger/20 bg-danger/[0.06] px-4 py-2 text-center text-xs font-bold text-danger">
            حالت نمایشی — به پایگاه‌داده وصل نیست. برای اتصال، فایل <span dir="ltr">config.js</span> را تکمیل کنید.
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
