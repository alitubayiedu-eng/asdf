"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { supabase } from "@/lib/supabase";
import { fmtDate, QUALITY_KINDS } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, svgLines, CH } from "@/lib/export";
import { fileToDataUrl } from "@/lib/img";

export default function QualityTab({ projectId, profile, canEdit }: any) {
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [f, setF] = useState({ kind: "inspection", title: "", location: "", severity: "متوسط", description: "", due_date: "", photos: [] as string[] });

  const load = () => supabase.from("quality_records").select("*").eq("project_id", projectId)
    .order("created_at", { ascending: false }).then(({ data }: any) => setRecords(data || []));
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.title) return;
    await supabase.from("quality_records").insert({
      project_id: projectId, kind: f.kind, title: f.title, location: f.location, severity: f.severity,
      description: f.description, due_date: f.due_date || null, photos: f.photos,
      status: "open", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, QUALITY_KINDS[f.kind], f.title);
    setF({ kind: "inspection", title: "", location: "", severity: "متوسط", description: "", due_date: "", photos: [] });
    load();
  };

  const close = async (r: any, action: string) => {
    await supabase.from("quality_records").update({ status: "closed", action }).eq("id", r.id);
    logAction(projectId, profile.id, `بستن ${QUALITY_KINDS[r.kind]}`, r.title);
    load();
  };

  const shown = records.filter(r => !filter || r.kind === filter);
  const openCount = (k: string) => records.filter(r => r.kind === k && r.status === "open").length;

  const qPdf = () => {
    const byKind = Object.entries(QUALITY_KINDS).map(([k, l]) => ({ name: l, value: records.filter(r => r.kind === k).length }));
    const bySev: Record<string, number> = {};
    for (const r of records) bySev[r.severity || "—"] = (bySev[r.severity || "—"] || 0) + 1;
    const months: Record<string, number> = {};
    for (const r of records) { const m = String(r.created_at || "").slice(0, 7); if (m) months[m] = (months[m] || 0) + 1; }
    const ms = Object.keys(months).sort();
    printPdf("گزارش کیفیت و HSE", "بازرسی‌ها، عدم انطباق‌ها، حوادث و پانچ‌لیست",
      kpis([["کل رکوردها", faN(records.length)], ["موارد باز", faN(records.filter(r => r.status === "open").length)],
        ["بسته‌شده", faN(records.filter(r => r.status === "closed").length)],
        ["بحرانی / زیاد", faN(records.filter(r => ["بحرانی", "زیاد"].includes(r.severity)).length)]]) +
      svgPie("پراکندگی بر اساس نوع", byKind) +
      svgHBars("پراکندگی بر اساس شدت", Object.entries(bySev).map(([name, value]) => ({
        name, value, color: ["بحرانی", "زیاد"].includes(name) ? CH.danger : CH.primary, note: faN(value) + " مورد" }))) +
      (ms.length > 1 ? svgLines("روند ثبت موارد", ms, [{ name: "تعداد", color: CH.accent, values: ms.map(m => months[m]) }]) : "") +
      "<h2>فهرست کامل</h2>" + tbl(["نوع", "عنوان", "محل", "شدت", "مهلت", "وضعیت", "اقدام اصلاحی"],
        records.map(r => [QUALITY_KINDS[r.kind], r.title, r.location || "—", r.severity || "—",
          faD(r.due_date), r.status === "open" ? "باز" : "بسته‌شده", (r.action || "—").slice(0, 60)])));
  };

  const del = async (table: string, row: any, label: string, detail: string) => {
    if (await deleteRow(table, row, { projectId, profile, label, detail })) load();
  };

  return (
    <div className="space-y-3">
      <div className="card py-2"><ExcelIO table="quality_records" projectId={projectId} rows={records} canEdit={canEdit} profile={profile} onDone={load} pdf={qPdf} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Object.entries(QUALITY_KINDS).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(filter === k ? "" : k)}
            className={`card text-right ${filter === k ? "border-blueprint" : ""}`}>
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${openCount(k) ? "text-danger" : "text-ok"}`}>
              {openCount(k).toLocaleString("fa-IR")} باز
            </div>
          </button>
        ))}
      </div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-6">
          <select className="input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
            {Object.entries(QUALITY_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input md:col-span-2" placeholder="عنوان (مثلاً: عدم انطباق کاور آرماتور ستون C4)" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <input className="input" placeholder="محل" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
          <select className="input" value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}>
            <option>کم</option><option>متوسط</option><option>زیاد</option><option>بحرانی</option>
          </select>
          <DateInput className="input" title="مهلت رفع" value={f.due_date} onChange={v => setF({ ...f, due_date: v })} />
          <textarea className="input md:col-span-4" rows={2} placeholder="شرح / نتیجه بازرسی / شرح حادثه…" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <label className="btn-ghost cursor-pointer justify-center">
            {f.photos.length ? `${f.photos.length} عکس` : "پیوست عکس"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
              const arr = [...f.photos];
              for (const file of Array.from(e.target.files || [])) arr.push(await fileToDataUrl(file, 900, 0.65));
              setF({ ...f, photos: arr });
            }} />
          </label>
          <button className="btn-primary" onClick={add}>ثبت</button>
        </div>
      )}

      {shown.map(r => (
        <div key={r.id} className="card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-blueprint/10 text-blueprint">{QUALITY_KINDS[r.kind]}</span>
            <span className="font-black">{r.title}</span>
            <span className={`chip ${r.severity === "بحرانی" || r.severity === "زیاد" ? "bg-danger/10 text-danger" : "bg-surface"}`}>{r.severity}</span>
            <span className="text-xs text-ink/50">{r.location}</span>
            <span className="mr-auto text-xs text-ink/40">{r.created_by_name} · مهلت: {fmtDate(r.due_date)}</span>
            <span className={`chip ${r.status === "open" ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"}`}>{r.status === "open" ? "باز" : "بسته‌شده"}</span>
            {canEdit && <button className="text-[11px] text-danger"
              onClick={() => del("quality_records", r, "رکورد کیفیت", r.title)}>حذف</button>}
          </div>
          {r.description && <p className="mt-1 text-sm text-ink/80">{r.description}</p>}
          {(r.photos || []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(r.photos || []).map((p: string, i: number) => <img key={i} src={p} alt="" className="h-20 rounded-lg border border-line" />)}
            </div>
          )}
          {r.status === "closed" && r.action && <p className="mt-1 text-xs text-ok">اقدام اصلاحی: {r.action}</p>}
          {r.status === "open" && canEdit && (
            <div className="mt-2 flex gap-2">
              <button className="btn-primary py-1 text-xs" onClick={() => {
                const a = prompt("اقدام اصلاحی انجام‌شده را بنویسید:");
                if (a != null) close(r, a);
              }}>رفع و بستن</button>
            </div>
          )}
        </div>
      ))}
      {shown.length === 0 && <p className="text-sm text-ink/40">رکوردی ثبت نشده است.</p>}
    </div>
  );
}
