"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { supabase, DEMO } from "@/lib/supabase";
import { callFn } from "@/lib/fn";
import { useSession } from "@/lib/useSession";
import { ROLES, ADMIN_ONLY_ROLES } from "@/lib/constants";
import Link from "next/link";

export default function Admin() {
  const { profile } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [f, setF] = useState({ full_name: "", email: "", password: "", role: "accountant" });
  const [msg, setMsg] = useState("");
  const load = () => supabase.from("profiles").select("*").order("created_at").then(({ data }: any) => setUsers(data || []));
  useEffect(() => { load(); }, []);

  const isAdmin = profile?.role === "admin";
  const isPm = profile?.role === "pm";
  if (profile && !isAdmin && !isPm)
    return <Shell><p className="text-danger">دسترسی به این بخش مخصوص مدیر سیستم و مدیر پروژه است.</p></Shell>;

  const createUser = async () => {
    setMsg("");
    if (!f.email || !f.password || !f.full_name) { setMsg("همه فیلدها الزامی است."); return; }
    if (f.password.length < 8) { setMsg("رمز عبور حداقل ۸ کاراکتر باشد."); return; }
    if (DEMO) {
      const { data: exists } = await supabase.from("demo_auth").select("*").eq("email", f.email);
      if (exists?.length) { setMsg("این ایمیل قبلاً ثبت شده است."); return; }
      const { data: row } = await supabase.from("demo_auth").insert({ email: f.email, password: f.password }).select().single();
      await supabase.from("profiles").insert({ id: row.id, full_name: f.full_name, role: f.role, email: f.email, is_active: true });
    } else {
      const j = await callFn("create-user", f);
      if (!j.ok) { setMsg("خطا: " + (j.error || "ایجاد کاربر ناموفق بود")); return; }
    }
    setMsg(`کاربر «${f.full_name}» ساخته شد. ایمیل و رمز را به ایشان اطلاع دهید.`);
    setF({ full_name: "", email: "", password: "", role: "accountant" });
    load();
  };

  const setRole = async (id: string, role: string) => {
    await supabase.from("profiles").update({ role }).eq("id", id); load();
  };
  const toggleActive = async (u: any) => {
    if (u.id === profile.id) { alert("نمی‌توانید حساب خودتان را غیرفعال کنید."); return; }
    await supabase.from("profiles").update({ is_active: u.is_active === false ? true : false }).eq("id", u.id);
    load();
  };
  const roleOptions = Object.entries(ROLES).filter(([k]) => isAdmin || !ADMIN_ONLY_ROLES.includes(k));

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-black">کاربران و نقش‌ها</h1>

      <div className="card mb-4">
        <h2 className="mb-2 font-black">ایجاد کاربر جدید</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <input className="input" placeholder="نام و نام خانوادگی" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} />
          <input className="input" dir="ltr" placeholder="ایمیل" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          <input className="input" dir="ltr" placeholder="رمز عبور اولیه" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
          <select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
            {roleOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-accent" onClick={createUser}>ایجاد کاربر</button>
        </div>
        {msg && <p className="mt-2 text-sm font-bold text-blueprint">{msg}</p>}
        <p className="mt-1 text-[11px] text-ink/40">ثبت‌نام آزاد غیرفعال است؛ فقط از همین‌جا کاربر بسازید و سپس در تب «اعضای پروژه» به پروژه اضافه کنید. مدیران پروژه می‌توانند همه نقش‌ها به‌جز «مدیر سیستم» را بسازند و تغییر دهند.</p>
      </div>

      <div className="card overflow-auto">
        <table className="w-full">
          <thead className="bg-surface"><tr><th className="th">کاربر</th><th className="th">نقش و دسترسی</th><th className="th">وضعیت حساب</th><th className="th">اقدام</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={u.is_active === false ? "opacity-50" : ""}>
                <td className="td">
                  <Link href={`/admin/user?uid=${u.id}`} className="font-bold text-blueprint hover:underline">{u.full_name || "—"}</Link>
                  <div className="text-[10px] text-ink/40" dir="ltr">{u.email || ""}</div>
                </td>
                <td className="td">
                  {!isAdmin && ADMIN_ONLY_ROLES.includes(u.role) ? (
                    <span className="chip chip-on">{ROLES[u.role]} — فقط توسط مدیر سیستم قابل تغییر</span>
                  ) : (
                    <select className="input w-52" value={u.role} onChange={e => setRole(u.id, e.target.value)}>
                      {roleOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                </td>
                <td className="td">
                  {u.is_active === false ? <span className="chip bg-danger/10 text-danger">غیرفعال</span> : <span className="chip bg-ok/10 text-ok">فعال</span>}
                </td>
                <td className="td">
                  {isAdmin && (
                    <span className="flex gap-2">
                      <button className={`btn-ghost py-0.5 text-xs ${u.is_active === false ? "text-ok" : "text-danger"}`} onClick={() => toggleActive(u)}>
                        {u.is_active === false ? "فعال‌سازی" : "غیرفعال‌سازی"}
                      </button>
                      <Link href={`/admin/user?uid=${u.id}`} className="btn-ghost py-0.5 text-xs">پروفایل ←</Link>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
