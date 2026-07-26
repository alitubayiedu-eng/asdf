"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/constants";
import { fileToDataUrl } from "@/lib/img";
import { logAction } from "@/lib/log";
import { printPdf, tbl, kpis, faN, faD, svgPie, CH } from "@/lib/export";

const KINDS: Record<string, string> = { plan: "نقشه", render: "رندر", file: "فایل و مدارک" };

export default function ArchitectureTab({ projectId, profile, canEdit }: any) {
  const [docs, setDocs] = useState<any[]>([]);
  const [kind, setKind] = useState("plan");
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  const [rev, setRev] = useState("0");
  const [docStatus, setDocStatus] = useState("در انتظار تایید");
  const [rfis, setRfis] = useState<any[]>([]);
  const [rfiF, setRfiF] = useState({ no: "", subject: "", question: "", to_party: "مشاور طرح", due_date: "" });
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<any>(null);

  const load = () => supabase.from("documents").select("*, profiles:uploaded_by(full_name)")
    .eq("project_id", projectId).order("created_at", { ascending: false })
    .then(({ data }: any) => setDocs(data || []));
  const loadRfis = () => supabase.from("rfis").select("*").eq("project_id", projectId)
    .order("created_at", { ascending: false }).then(({ data }: any) => setRfis(data || []));
  useEffect(() => { load(); loadRfis(); }, [projectId]);

  const addRfi = async () => {
    if (!rfiF.subject) return;
    await supabase.from("rfis").insert({ project_id: projectId, ...rfiF, due_date: rfiF.due_date || null, status: "open", created_by_name: profile.full_name });
    logAction(projectId, profile.id, "ثبت RFI", `${rfiF.no} — ${rfiF.subject}`);
    setRfiF({ no: "", subject: "", question: "", to_party: "مشاور طرح", due_date: "" }); loadRfis();
  };
  const answerRfi = async (r: any) => {
    const a = prompt("پاسخ دریافتی را وارد کنید:");
    if (a == null) return;
    await supabase.from("rfis").update({ answer: a, status: "answered" }).eq("id", r.id);
    logAction(projectId, profile.id, "پاسخ RFI", r.subject);
    loadRfis();
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await fileToDataUrl(file, 1400, 0.75);
        const { error } = await supabase.from("documents").insert({
          project_id: projectId, kind, title: title || file.name, file_name: file.name,
          mime: file.type, data_url: dataUrl, uploaded_by: profile.id,
          rev: rev || "0", doc_status: docStatus,
        });
        if (error) { alert("خطا در ذخیره: " + (error.message || "حافظه مرورگر پر است")); break; }
      }
    } catch (e: any) { alert(e.message); }
    logAction(projectId, profile.id, "بارگذاری در معماری", title || (files[0]?.name ?? ""));
    setTitle(""); setBusy(false); load();
  };

  const remove = async (d: any) => {
    if (d.uploaded_by !== profile.id && !canEdit) return;
    if (!confirm("این مورد حذف شود؟")) return;
    await supabase.from("documents").delete().eq("id", d.id);
    logAction(projectId, profile.id, "حذف از معماری", d.title || d.file_name);
    load();
  };

  const shown = docs.filter(d => !filter || d.kind === filter);

  const docPdf = () => {
    const byKind: Record<string, number> = {}, byStatus: Record<string, number> = {};
    for (const d of docs) {
      byKind[KINDS[d.kind] || "—"] = (byKind[KINDS[d.kind] || "—"] || 0) + 1;
      byStatus[d.doc_status || "نامشخص"] = (byStatus[d.doc_status || "نامشخص"] || 0) + 1;
    }
    printPdf("گزارش مدارک و نقشه‌ها", "فهرست مدارک، نسخه‌ها و پرسش‌های فنی (RFI)",
      kpis([["کل مدارک", faN(docs.length)], ["تاییدشده", faN(docs.filter(d => d.doc_status === "تاییدشده").length)],
        ["RFI باز", faN(rfis.filter(r => r.status === "open").length)],
        ["RFI پاسخ‌داده‌شده", faN(rfis.filter(r => r.status === "answered").length)]]) +
      (docs.length ? svgPie("پراکندگی مدارک بر اساس نوع", Object.entries(byKind).map(([name, value]) => ({ name, value }))) : "") +
      (docs.length ? svgPie("وضعیت تایید مدارک", Object.entries(byStatus).map(([name, value]) => ({ name, value }))) : "") +
      "<h2>فهرست مدارک</h2>" + tbl(["عنوان", "نوع", "نسخه (Rev)", "وضعیت", "بارگذار", "تاریخ"],
        docs.map(d => [d.title, KINDS[d.kind] || "—", d.rev ?? "—", d.doc_status || "—",
          d.profiles?.full_name || "—", faD(d.created_at)])) +
      (rfis.length ? "<h2>پرسش‌های فنی (RFI)</h2>" + tbl(["شماره", "موضوع", "مخاطب", "مهلت", "وضعیت", "پاسخ"],
        rfis.map(r => [r.no || "—", r.subject, r.to_party || "—", faD(r.due_date),
          r.status === "open" ? "در انتظار" : "پاسخ‌داده‌شده", (r.answer || "—").slice(0, 60)])) : ""));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={docPdf}>خروجی PDF</button></div>
      {canEdit && <div className="card grid gap-2 md:grid-cols-5">
        <select className="input" value={kind} onChange={e => setKind(e.target.value)}>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" placeholder="عنوان مدرک"
          value={title} onChange={e => setTitle(e.target.value)} />
        <div className="flex gap-2">
          <input className="input w-20" dir="ltr" placeholder="رِو" value={rev} onChange={e => setRev(e.target.value)} />
          <select className="input" value={docStatus} onChange={e => setDocStatus(e.target.value)}>
            <option>در انتظار تایید</option><option>تاییدشده</option><option>تایید مشروط</option><option>مردود</option>
          </select>
        </div>
        <label className="btn-accent cursor-pointer justify-center md:col-span-2">
          {busy ? "در حال بارگذاری…" : "بارگذاری تصویر / فایل (چندتایی)"}
          <input type="file" multiple className="hidden" accept="image/*,.pdf,.dwg,.dxf,.zip"
            onChange={e => upload(e.target.files)} />
        </label>
        <p className="text-[11px] text-ink/40 md:col-span-5">
          تصاویر خودکار فشرده می‌شوند. فایل‌های غیرتصویری تا ۲ مگابایت. در حالت نمایشی، فایل‌ها در حافظه مرورگر ذخیره می‌شوند.
        </p>
      </div>}

      <div className="flex gap-2">
        <button className={`chip ${!filter ? "chip-on" : "bg-card border border-line"}`} onClick={() => setFilter("")}>همه</button>
        {Object.entries(KINDS).map(([k, v]) => (
          <button key={k} className={`chip ${filter === k ? "chip-on" : "bg-card border border-line"}`}
            onClick={() => setFilter(k)}>{v}</button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map(d => (
          <div key={d.id} className="card p-2">
            {String(d.mime || "").startsWith("image/") || String(d.data_url || "").startsWith("data:image") ? (
              <button className="block w-full" onClick={() => setView(d)}>
                <img src={d.data_url} alt={d.title} className="h-40 w-full rounded-lg object-cover" />
              </button>
            ) : (
              <a href={d.data_url} download={d.file_name}
                className="grid h-40 place-items-center rounded-lg bg-surface text-3xl">📄</a>
            )}
            <div className="mt-2 flex items-start justify-between gap-1">
              <div>
                <div className="text-sm font-bold leading-5">{d.title}</div>
                <div className="text-[10px] text-ink/40">
                  {KINDS[d.kind]}{d.rev != null && <> · <span className="code-chip">Rev {d.rev}</span></>}
                  {d.doc_status && <> · <span className={d.doc_status === "تاییدشده" ? "text-ok" : d.doc_status === "مردود" ? "text-danger" : "text-crane"}>{d.doc_status}</span></>}
                  {" · "}{d.profiles?.full_name} · {fmtDate(d.created_at)}
                </div>
              </div>
              <button className="text-xs text-danger" onClick={() => remove(d)}>حذف</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-ink/40">موردی بارگذاری نشده است. نقشه‌ها و رندرهای پروژه را اینجا بارگذاری کنید.</p>}
      </div>

      {/* ---------- RFI ---------- */}
      <div className="card space-y-2">
        <h2 className="font-black">پرسش‌های فنی (RFI)</h2>
        {canEdit && (
          <div className="grid gap-2 md:grid-cols-6">
            <input className="input" placeholder="شماره" value={rfiF.no} onChange={e => setRfiF({ ...rfiF, no: e.target.value })} />
            <input className="input md:col-span-2" placeholder="موضوع" value={rfiF.subject} onChange={e => setRfiF({ ...rfiF, subject: e.target.value })} />
            <input className="input" placeholder="مخاطب" value={rfiF.to_party} onChange={e => setRfiF({ ...rfiF, to_party: e.target.value })} />
            <DateInput className="input" title="مهلت پاسخ" value={rfiF.due_date} onChange={v => setRfiF({ ...rfiF, due_date: v })} />
            <button className="btn-primary" onClick={addRfi}>ثبت RFI</button>
            <textarea className="input md:col-span-6" rows={2} placeholder="متن سوال فنی…" value={rfiF.question} onChange={e => setRfiF({ ...rfiF, question: e.target.value })} />
          </div>
        )}
        {rfis.map(r => (
          <div key={r.id} className="rounded-lg border border-line p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="code-chip">{r.no || "RFI"}</span>
              <span className="font-bold">{r.subject}</span>
              <span className="text-xs text-ink/50">به: {r.to_party} · مهلت: {fmtDate(r.due_date)}</span>
              <span className={`chip mr-auto ${r.status === "open" ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"}`}>
                {r.status === "open" ? "در انتظار پاسخ" : "پاسخ‌داده‌شده"}
              </span>
              {r.status === "open" && canEdit && <button className="btn-ghost py-0.5 text-xs" onClick={() => answerRfi(r)}>ثبت پاسخ</button>}
            </div>
            {r.question && <p className="mt-1 text-xs text-ink/70">{r.question}</p>}
            {r.answer && <p className="mt-1 rounded bg-ok/5 p-1 text-xs text-ok">پاسخ: {r.answer}</p>}
          </div>
        ))}
        {rfis.length === 0 && <p className="text-xs text-ink/40">RFI ثبت نشده است.</p>}
      </div>

      {view && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setView(null)}>
          <div className="max-h-full max-w-4xl overflow-auto rounded-xl bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold">{view.title}</span>
              <button className="btn-ghost py-1" onClick={() => setView(null)}>بستن</button>
            </div>
            <img src={view.data_url} alt={view.title} className="max-h-[80vh] w-auto rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
