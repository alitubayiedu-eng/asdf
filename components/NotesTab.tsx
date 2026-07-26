"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { printPdf, tbl, kpis, faN, faD, svgHBars } from "@/lib/export";
import { fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";

export default function NotesTab({ projectId, profile, canEdit }: any) {
  const [notes, setNotes] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const load = () => supabase.from("notes").select("*, profiles:author(full_name)")
    .eq("project_id", projectId).order("created_at", { ascending: false })
    .then(({ data }) => setNotes(data || []));
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!body.trim()) return;
    await supabase.from("notes").insert({ project_id: projectId, body, author: profile.id });
    logAction(projectId, profile.id, "ثبت یادداشت", body.slice(0, 60));
    setBody(""); load();
  };

  const notesPdf = () => {
    const byAuthor: Record<string, number> = {};
    for (const n of notes) byAuthor[n.profiles?.full_name || "—"] = (byAuthor[n.profiles?.full_name || "—"] || 0) + 1;
    printPdf("گزارش یادداشت‌ها", "یادداشت‌های ثبت‌شده در پروژه",
      kpis([["کل یادداشت‌ها", faN(notes.length)], ["نویسندگان", faN(Object.keys(byAuthor).length)]]) +
      (Object.keys(byAuthor).length ? svgHBars("یادداشت به تفکیک نویسنده", Object.entries(byAuthor)
        .sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, note: faN(value) }))) : "") +
      tbl(["تاریخ", "نویسنده", "متن"], notes.map(n => [faD(n.created_at), n.profiles?.full_name || "—", n.body || n.text || "—"])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={notesPdf}>خروجی PDF</button></div>
      {canEdit && <div className="card">
        <label className="label">یادداشت جدید</label>
        <textarea className="input" rows={3} value={body} onChange={e => setBody(e.target.value)}
          placeholder="نکته فنی، صورت‌جلسه، مشاهده کارگاهی…" />
        <button className="btn-primary mt-2" onClick={add}>ثبت یادداشت</button>
      </div>}
      {notes.map(n => (
        <div key={n.id} className="card">
          <div className="mb-1 flex justify-between text-xs text-ink/50">
            <span className="font-bold">{n.profiles?.full_name}</span>
            <span>{fmtDate(n.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{n.body}</p>
        </div>
      ))}
      {notes.length === 0 && <p className="text-sm text-ink/40">هنوز یادداشتی ثبت نشده است.</p>}
    </div>
  );
}
