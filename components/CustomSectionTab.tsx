"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { printPdf, tbl, kpis, faN, faD } from "@/lib/export";
import { fileToDataUrl } from "@/lib/img";

// بخش سفارشی عمومی: عنوان + متن + پیوست
export default function CustomSectionTab({ projectId, profile, section, canEdit }: any) {
  const [entries, setEntries] = useState<any[]>([]);
  const [f, setF] = useState({ title: "", body: "" });
  const [file, setFile] = useState<string | null>(null);

  const load = () => supabase.from("section_entries").select("*").eq("section_id", section.id)
    .order("created_at", { ascending: false }).then(({ data }: any) => setEntries(data || []));
  useEffect(() => { load(); }, [section.id]);

  const add = async () => {
    if (!f.title && !f.body) return;
    await supabase.from("section_entries").insert({
      project_id: projectId, section_id: section.id, title: f.title, body: f.body,
      data_url: file, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, `ثبت در بخش ${section.name}`, f.title);
    setF({ title: "", body: "" }); setFile(null); load();
  };

  const secPdf = () => printPdf(`گزارش بخش: ${section.name}`, "موارد ثبت‌شده در بخش سفارشی",
    kpis([["تعداد موارد", faN(entries.length)],
      ["دارای پیوست", faN(entries.filter(e => e.data_url).length)]]) +
    tbl(["عنوان", "شرح", "ثبت‌کننده", "تاریخ"],
      entries.map(e => [e.title || "—", (e.body || "—").slice(0, 120), e.created_by_name || "—", faD(e.created_at)])));

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={secPdf}>خروجی PDF</button></div>
      {canEdit && (
        <div className="card space-y-2">
          <h2 className="font-black">ثبت مورد جدید در «{section.name}»</h2>
          <input className="input" placeholder="عنوان" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <textarea className="input" rows={3} placeholder="شرح…" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
          <div className="flex gap-2">
            <label className="btn-ghost cursor-pointer">{file ? "✓ پیوست شد" : "پیوست تصویر / فایل"}
              <input type="file" className="hidden" onChange={async e => { const x = e.target.files?.[0]; if (x) setFile(await fileToDataUrl(x, 1200, 0.7)); }} />
            </label>
            <button className="btn-primary" onClick={add}>ثبت</button>
          </div>
        </div>
      )}
      {entries.map(en => (
        <div key={en.id} className="card">
          <div className="flex justify-between text-xs text-ink/50">
            <b className="text-sm text-ink">{en.title}</b>
            <span>{en.created_by_name} · {fmtDate(en.created_at)}</span>
          </div>
          {en.body && <p className="mt-1 whitespace-pre-wrap text-sm">{en.body}</p>}
          {en.data_url && String(en.data_url).startsWith("data:image") && <img src={en.data_url} alt="" className="mt-2 max-h-60 rounded-lg border border-line" />}
        </div>
      ))}
      {entries.length === 0 && <p className="text-sm text-ink/40">موردی ثبت نشده است.</p>}
    </div>
  );
}
