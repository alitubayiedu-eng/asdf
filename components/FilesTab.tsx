"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { printPdf, tbl, kpis, faN, faD, svgPie } from "@/lib/export";
import { fmtDate, FILE_CATEGORIES } from "@/lib/constants";
import { fileToDataUrl } from "@/lib/files";

export default function FilesTab({ projectId, profile }: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [cat, setCat] = useState(FILE_CATEGORIES[0]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const load = () => supabase.from("project_files").select("*, profiles:uploaded_by(full_name)")
    .eq("project_id", projectId).order("created_at", { ascending: false })
    .then(({ data }: any) => setFiles(data || []));
  useEffect(() => { load(); }, [projectId]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    for (const f of Array.from(list)) {
      try {
        const data = await fileToDataUrl(f);
        await supabase.from("project_files").insert({
          project_id: projectId, name: f.name, category: cat,
          mime: f.type || "application/octet-stream", data, uploaded_by: profile.id,
        });
      } catch (e: any) { alert(`${f.name}: ${e.message}`); }
    }
    setBusy(false); load();
  };
  const remove = async (id: string) => { await supabase.from("project_files").delete().eq("id", id); load(); };
  const shown = files.filter(f => !filter || f.category === filter);

  const filesPdf = () => {
    const byCat: Record<string, number> = {};
    for (const f2 of files) byCat[f2.category || "—"] = (byCat[f2.category || "—"] || 0) + 1;
    printPdf("گزارش فایل‌های پروژه", "فهرست فایل‌های بارگذاری‌شده",
      kpis([["کل فایل‌ها", faN(files.length)], ["دسته‌ها", faN(Object.keys(byCat).length)]]) +
      (files.length ? svgPie("پراکندگی فایل‌ها بر اساس دسته",
        Object.entries(byCat).map(([name, value]) => ({ name, value }))) : "") +
      tbl(["نام فایل", "دسته", "بارگذار", "تاریخ"],
        files.map(f2 => [f2.file_name || f2.title || "—", f2.category || "—", f2.profiles?.full_name || "—", faD(f2.created_at)])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={filesPdf}>خروجی PDF</button></div>
      <div className="card flex flex-wrap items-center gap-2">
        <select className="input max-w-52" value={cat} onChange={e => setCat(e.target.value)}>
          {FILE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <label className="btn-accent cursor-pointer">
          {busy ? "در حال بارگذاری…" : "بارگذاری نقشه / رندر / عکس"}
          <input type="file" multiple accept="image/*,.pdf,.dwg,.dxf" className="hidden"
            onChange={e => upload(e.target.files)} />
        </label>
        <select className="input mr-auto max-w-52" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">همه دسته‌ها</option>
          {FILE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map(f => (
          <div key={f.id} className="card p-2">
            {f.mime?.startsWith("image/") ? (
              <button className="block w-full" onClick={() => setPreview(f)}>
                <img src={f.data} alt={f.name} className="h-36 w-full rounded-lg object-cover" />
              </button>
            ) : (
              <a href={f.data} download={f.name} className="grid h-36 w-full place-items-center rounded-lg bg-surface text-3xl">📄</a>
            )}
            <div className="mt-2 truncate text-sm font-bold" title={f.name}>{f.name}</div>
            <div className="flex items-center justify-between text-[11px] text-ink/50">
              <span className="chip bg-blueprint/10 text-blueprint">{f.category}</span>
              <span>{fmtDate(f.created_at)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-ink/50">{f.profiles?.full_name}</span>
              <span className="flex gap-2">
                <a className="text-blueprint" href={f.data} download={f.name}>دانلود</a>
                <button className="text-danger" onClick={() => remove(f.id)}>حذف</button>
              </span>
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-ink/40">فایلی در این دسته بارگذاری نشده است.</p>}
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4" onClick={() => setPreview(null)}>
          <img src={preview.data} alt={preview.name} className="max-h-[85vh] max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
