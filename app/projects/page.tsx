"use client";
import { useSearchParams } from "next/navigation";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fmt, fmtDate, DEFAULT_PHASES, MANAGER_ROLES } from "@/lib/constants";
import { logAction } from "@/lib/log";

function ProjectsInner() {
  const sp = useSearchParams();
  const kq = sp.get("kind");
  const kind = kq === "factory" ? "factory" : kq === "solar" ? "solar" : kq === "chp" ? "chp" : "construction";
  const { profile } = useSession();
  const [projects, setProjects] = useState<any[]>([]);
  const isFactory = kind === "factory";
  const isSolar = kind === "solar";
  const isChp = kind === "chp";
  const kindLabel = isChp ? "نیروگاه سیکل ترکیبی" : isSolar ? "نیروگاه" : isFactory ? "کارخانه" : "پروژه عمرانی";
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [ef, setEf] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", code: "", location: "", budget: "", start_date: "", end_date: "", description: "" });

  const load = async () => {
    if (!profile) return;
    if (["admin", "pm", "investor", "ceo", "board_member"].includes(profile.role)) {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      setProjects((data || []).filter((p: any) => (p.kind || "construction") === kind));
    } else {
      const { data: mem } = await supabase.from("project_members").select("project_id").eq("user_id", profile.id);
      const ids = (mem || []).map((m: any) => m.project_id);
      if (!ids.length) { setProjects([]); return; }
      const { data } = await supabase.from("projects").select("*").in("id", ids).order("created_at", { ascending: false });
      setProjects((data || []).filter((p: any) => (p.kind || "construction") === kind));
    }
  };
  useEffect(() => { load(); }, [profile, kind]);

  const canCreate = profile && MANAGER_ROLES.includes(profile.role);

  const openEdit = (p: any) => {
    setEditing(p);
    setEf({
      name: p.name || "", code: p.code || "", location: p.location || "",
      budget: p.budget || "", start_date: p.start_date || "", end_date: p.end_date || "",
      description: p.description || "", status: p.status || "active",
    });
  };

  const saveEdit = async () => {
    if (!ef.name?.trim()) { alert("نام پروژه الزامی است."); return; }
    setBusy(true);
    const { error } = await supabase.from("projects").update({
      name: ef.name.trim(), code: ef.code, location: ef.location,
      budget: num(ef.budget) || 0, start_date: ef.start_date || null,
      end_date: ef.end_date || null, description: ef.description, status: ef.status,
    }).eq("id", editing.id);
    setBusy(false);
    if (error) { alert("خطا در ذخیره: " + error.message); return; }
    logAction(editing.id, profile!.id, "ویرایش مشخصات پروژه", ef.name);
    setEditing(null); load();
  };

  // حذف پروژه — همه داده‌های وابسته با cascade پاک می‌شوند
  const TABLES_TO_PURGE = [
    "section_entries", "custom_sections", "shareholders", "overheads", "personnel", "energy_logs",
    "sales_orders", "customers", "qc_tests", "maintenance_orders", "machines", "production_records",
    "production_orders", "products", "rfis", "letters", "meetings", "quality_records",
    "equipment_logs", "equipment", "timesheets", "daily_reports", "purchase_orders",
    "purchase_requests", "vendors", "disputes", "change_orders", "progress_claims", "contracts",
    "documents", "project_files", "notes", "directives", "transactions", "accounts",
    "warehouse_txns", "warehouse_items", "cbs_items", "tasks", "phases",
    "activity_log", "project_members",
  ];

  const removeProject = async (p: any) => {
    const typed = prompt(
      `⚠️ حذف پروژه «${p.name}» و تمام داده‌های آن (اسناد مالی، قراردادها، انبار، گزارش‌ها و…).\n` +
      `این کار برگشت‌ناپذیر است.\n\nبرای تایید، نام دقیق پروژه را تایپ کنید:`
    );
    if (typed == null) return;
    if (typed.trim() !== p.name.trim()) { alert("نام وارد‌شده مطابقت ندارد — حذف انجام نشد."); return; }
    setBusy(true);
    // در حالت نمایشی cascade وجود ندارد؛ دستی پاک می‌کنیم (در Supabase هم بی‌ضرر است)
    for (const t of TABLES_TO_PURGE) {
      try { await supabase.from(t).delete().eq("project_id", p.id); } catch {}
    }
    const { error } = await supabase.from("projects").delete().eq("id", p.id);
    setBusy(false);
    if (error) { alert("خطا در حذف: " + error.message); return; }
    load();
  };

  const create = async () => {
    if (!f.name) return;
    const { data: proj, error } = await supabase.from("projects").insert({
      kind,
      name: f.name, code: f.code, location: f.location, description: f.description,
      budget: num(f.budget) || 0, start_date: f.start_date || null, end_date: f.end_date || null,
      status: "active", created_by: profile!.id,
    }).select().single();
    if (error || !proj) { alert("خطا در ایجاد پروژه: " + error?.message); return; }
    await supabase.from("project_members").insert({ project_id: proj.id, user_id: profile!.id, member_role: "pm" });
    if (!isFactory && !isSolar && !isChp) {
      await supabase.from("phases").insert(DEFAULT_PHASES.map((name, i) => ({
        project_id: proj.id, name, sort: i + 1, progress: 0, status: "todo",
      })));
    }
    logAction(proj.id, profile!.id, "ایجاد پروژه", f.name);
    setShow(false); setF({ name: "", code: "", location: "", budget: "", start_date: "", end_date: "", description: "" });
    load();
  };

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-black">{isChp ? "🔥 بخش سیکل ترکیبی" : isSolar ? "☀️ بخش نیروگاه" : isFactory ? "🏭 بخش کارخانه" : "🏗 بخش عمران"}</h1>
        {canCreate && <button className="btn-accent" onClick={() => setShow(!show)}>+ افزودن {kindLabel}</button>}
      </div>
      {show && (
        <div className="card mb-4 grid gap-3 md:grid-cols-3">
          <div><label className="label">نام پروژه *</label><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label">کد پروژه</label><input className="input" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></div>
          <div><label className="label">موقعیت</label><input className="input" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} /></div>
          <div><label className="label">بودجه مصوب (ریال)</label><input className="input" dir="ltr" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} /></div>
          <div><label className="label">تاریخ شروع</label><DateInput className="input" value={f.start_date} onChange={v => setF({ ...f, start_date: v })} /></div>
          <div><label className="label">تاریخ پایان برنامه‌ای</label><DateInput className="input" value={f.end_date} onChange={v => setF({ ...f, end_date: v })} /></div>
          <div className="md:col-span-3"><label className="label">توضیحات</label><textarea className="input" rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
          <div className="md:col-span-3"><button className="btn-primary" onClick={create}>{isChp ? "ایجاد نیروگاه سیکل ترکیبی" : isSolar ? "ایجاد نیروگاه با ماژول‌های تولید و فروش" : isFactory ? "ایجاد کارخانه با ماژول‌های تولید" : "ایجاد پروژه با ۱۷ فاز CBS"}</button></div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {projects.map(p => (
          <div key={p.id} className="card card-hover">
            <Link href={`/project?id=${p.id}`} className="block">
              <div className="flex items-center justify-between">
                <div className="font-black">{p.name}</div>
                {p.code && <span className="code-chip">{p.code}</span>}
              </div>
              <div className="mt-1 text-xs text-ink/50">{p.location || "—"}</div>
              <div className="mt-3 flex justify-between text-xs">
                <span>بودجه: <b>{fmt(p.budget)}</b> ریال</span>
                <span className={`chip ${p.status === "active" ? "bg-ok/10 text-ok" : "bg-ink/10"}`}>
                  {p.status === "active" ? "فعال" : p.status === "closed" ? "بسته‌شده" : "متوقف"}
                </span>
              </div>
              <div className="mt-1 text-xs text-ink/50">شروع: {fmtDate(p.start_date)}</div>
            </Link>
            {canCreate && (
              <div className="mt-3 flex gap-2 border-t border-line pt-2">
                <button className="btn-ghost py-1 text-xs" onClick={() => openEdit(p)}>ویرایش مشخصات</button>
                <button className="btn-ghost py-1 text-xs text-danger" disabled={busy} onClick={() => removeProject(p)}>حذف</button>
              </div>
            )}
          </div>
        ))}

        {/* ---------- پنجره ویرایش ---------- */}
        {editing && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setEditing(null)}>
            <div className="card w-full max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-black">ویرایش مشخصات {isFactory ? "کارخانه" : "پروژه"}</h2>
                <button className="btn-ghost py-1 text-xs" onClick={() => setEditing(null)}>بستن ✕</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div><label className="label">نام *</label>
                  <input className="input" value={ef.name} onChange={e => setEf({ ...ef, name: e.target.value })} /></div>
                <div><label className="label">کد پروژه</label>
                  <input className="input" value={ef.code} onChange={e => setEf({ ...ef, code: e.target.value })} /></div>
                <div><label className="label">موقعیت</label>
                  <input className="input" value={ef.location} onChange={e => setEf({ ...ef, location: e.target.value })} /></div>
                <div><label className="label">بودجه مصوب (ریال)</label>
                  <input className="input" dir="ltr" value={ef.budget} onChange={e => setEf({ ...ef, budget: e.target.value })} /></div>
                <div><label className="label">تاریخ شروع</label>
                  <DateInput className="input" value={ef.start_date || ""} onChange={v => setEf({ ...ef, start_date: v })} /></div>
                <div><label className="label">تاریخ پایان</label>
                  <DateInput className="input" value={ef.end_date || ""} onChange={v => setEf({ ...ef, end_date: v })} /></div>
                <div><label className="label">وضعیت</label>
                  <select className="input" value={ef.status} onChange={e => setEf({ ...ef, status: e.target.value })}>
                    <option value="active">فعال</option><option value="paused">متوقف</option><option value="closed">بسته‌شده</option>
                  </select></div>
                <div className="md:col-span-2"><label className="label">شرح</label>
                  <textarea className="input" rows={2} value={ef.description} onChange={e => setEf({ ...ef, description: e.target.value })} /></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary" disabled={busy} onClick={saveEdit}>{busy ? "در حال ذخیره…" : "ذخیره تغییرات"}</button>
                <button className="btn-ghost" onClick={() => setEditing(null)}>انصراف</button>
                <span className="mr-auto self-center text-[11px] text-ink/40">نوع پروژه ({kindLabel}) قابل تغییر نیست</span>
              </div>
            </div>
          </div>
        )}
        {projects.length === 0 && <p className="text-sm text-ink/40">{canCreate ? "هنوز پروژه‌ای ثبت نشده است. اولین پروژه را اضافه کنید." : "شما هنوز عضو هیچ پروژه‌ای نیستید. از مدیر پروژه بخواهید شما را اضافه کند."}</p>}
      </div>
    </Shell>
  );
}


export default function Projects() {
  return <Suspense fallback={null}><ProjectsInner /></Suspense>;
}
