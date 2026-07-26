"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { ROLES, ADMIN_ONLY_ROLES, fmtDate, tabsForKind } from "@/lib/constants";

// صفحه پروفایل هر کاربر
function UserProfileInner() {
  const sp = useSearchParams();
  const uid = sp.get("uid") || "";
  const { profile } = useSession();
  const [user, setUser] = useState<any>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [phone, setPhone] = useState("");

  const load = async () => {
    const { data: u } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setUser(u); setPhone(u?.phone || "");
    const { data: ms } = await supabase.from("project_members").select("*").eq("user_id", uid);
    setMemberships(ms || []);
    const ids = (ms || []).map((m: any) => m.project_id);
    if (ids.length) {
      const { data: ps } = await supabase.from("projects").select("*").in("id", ids);
      setProjects(ps || []);
    }
    const { data: lg } = await supabase.from("activity_log").select("*").eq("user_id", uid)
      .order("created_at", { ascending: false }).limit(15);
    setLogs(lg || []);
  };
  useEffect(() => { load(); }, [uid]);

  if (!profile) return <Shell><div /></Shell>;
  const isAdmin = profile.role === "admin";
  const isPm = profile.role === "pm";
  if (!isAdmin && !isPm && profile.id !== uid)
    return <Shell><p className="text-danger">فقط مدیران و خود کاربر به این پروفایل دسترسی دارند.</p></Shell>;
  if (!user) return <Shell><p className="text-ink/40">در حال بارگذاری…</p></Shell>;

  const canEditRole = isAdmin || (isPm && !ADMIN_ONLY_ROLES.includes(user.role));

  const setRole = async (role: string) => { await supabase.from("profiles").update({ role }).eq("id", uid); load(); };
  const toggleActive = async () => {
    if (user.id === profile.id) { alert("نمی‌توانید حساب خودتان را غیرفعال کنید."); return; }
    await supabase.from("profiles").update({ is_active: user.is_active === false ? true : false }).eq("id", uid); load();
  };
  const savePhone = async () => { await supabase.from("profiles").update({ phone }).eq("id", uid); load(); };

  const projOf = (pid: string) => projects.find(p => p.id === pid);

  return (
    <Shell>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/admin" className="btn-ghost">← کاربران</Link>
        <h1 className="text-xl font-black">پروفایل کاربر</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------- کارت هویت ---------- */}
        <div className="card">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl accent-solid text-xl font-black">
              {(user.full_name || "؟").slice(0, 1)}
            </div>
            <div>
              <div className="text-lg font-black">{user.full_name}</div>
              <div className="text-xs text-ink/50" dir="ltr">{user.email || "—"}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink/50">نقش سراسری</span>
              {canEditRole ? (
                <select className="input w-44" value={user.role} onChange={e => setRole(e.target.value)}>
                  {Object.entries(ROLES).filter(([k]) => isAdmin || !ADMIN_ONLY_ROLES.includes(k))
                    .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : <span className="chip chip-on">{ROLES[user.role] || user.role}</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink/50">وضعیت حساب</span>
              <span className="flex items-center gap-2">
                {user.is_active === false ? <span className="chip bg-danger/10 text-danger">غیرفعال</span> : <span className="chip bg-ok/10 text-ok">فعال</span>}
                {isAdmin && <button className="btn-ghost py-0.5 text-xs" onClick={toggleActive}>{user.is_active === false ? "فعال‌سازی" : "غیرفعال‌سازی"}</button>}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-ink/50">تلفن (پیامک)</span>
              <input className="input" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0918xxxxxxx" />
              <button className="btn-ghost py-1 text-xs" onClick={savePhone}>ذخیره</button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink/50">عضویت از</span><span>{fmtDate(user.created_at)}</span>
            </div>
          </div>
          {isAdmin && ADMIN_ONLY_ROLES.includes(user.role) && (
            <p className="mt-3 rounded-lg bg-blueprint/5 p-2 text-[11px] text-blueprint">
              نقش «{ROLES[user.role]}» فقط توسط مدیر سیستم قابل ایجاد و تغییر است.
            </p>
          )}
        </div>

        {/* ---------- عضویت در پروژه‌ها ---------- */}
        <div className="card lg:col-span-2">
          <h2 className="mb-2 font-black">عضویت در پروژه‌ها و دسترسی‌ها</h2>
          {memberships.map(m => {
            const p = projOf(m.project_id);
            if (!p) return null;
            const kind = p.kind || "construction";
            const labels = Object.fromEntries(tabsForKind(kind));
            const view = ["admin", "pm", "investor", "ceo", "board_member", "factory_manager", "plant_manager"].includes(user.role)
              ? "همه بخش‌ها (نقش مدیریتی)"
              : (m.allowed_tabs ? String(m.allowed_tabs).split(",").map(t => labels[t.trim()] || t).join("، ") : "پیش‌فرض نقش");
            return (
              <div key={m.id} className="mb-2 rounded-xl border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-surface">{kind === "factory" ? "🏭" : kind === "solar" ? "☀️" : kind === "chp" ? "🔥" : "🏗"}</span>
                  <Link href={`/project?id=${p.id}`} className="font-bold text-blueprint hover:underline">{p.name}</Link>
                  <Link href={`/project?id=${p.id}&tab=members`} className="mr-auto text-xs text-crane hover:underline">مدیریت دسترسی در تب اعضا ←</Link>
                </div>
                <p className="mt-1 text-xs text-ink/50">دید: {view}</p>
              </div>
            );
          })}
          {memberships.length === 0 && <p className="text-sm text-ink/40">این کاربر عضو هیچ پروژه‌ای نیست. از تب «اعضای پروژه» اضافه‌اش کنید.</p>}

          <h2 className="mb-2 mt-4 font-black">آخرین فعالیت‌ها</h2>
          {logs.map(l => (
            <div key={l.id} className="mb-1 flex gap-2 rounded-lg bg-surface p-2 text-xs">
              <b>{l.action}</b><span className="flex-1 truncate text-ink/60">{l.detail}</span>
              <span className="text-ink/40">{fmtDate(l.created_at)}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-ink/40">فعالیتی ثبت نشده است.</p>}
        </div>
      </div>
    </Shell>
  );
}


export default function UserProfile() {
  return <Suspense fallback={<Shell><p className="text-ink/40">در حال بارگذاری…</p></Shell>}><UserProfileInner /></Suspense>;
}
