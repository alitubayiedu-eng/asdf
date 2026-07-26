"use client";
import { useRef, useState } from "react";
import { TABLES, exportTable, downloadTemplate, importTable } from "@/lib/xlsxio";
import { logAction } from "@/lib/log";

/**
 * نوار ورودی/خروجی اکسل — در همه تب‌ها قابل استفاده
 * <ExcelIO table="contracts" projectId={id} rows={contracts} canEdit={ce} profile={profile} onDone={load} />
 */
export default function ExcelIO({ table, projectId, rows = [], canEdit, profile, onDone, extra = {}, label, pdf }: any) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const def = TABLES[table];
  if (!def) return null;

  const onFile = async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const r = await importTable(f, table, projectId, extra);
      setMsg(r);
      if (r.ok && profile) logAction(projectId, profile.id, `ورودی اکسل — ${def.title}`, `${r.ok} سطر افزوده شد`);
      if (r.ok) onDone?.();
    } catch (err: any) {
      setMsg({ ok: 0, skipped: 0, errors: [err?.message || "خطا در خواندن فایل"] });
    }
    setBusy(false);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-ink/40">{label || def.title}:</span>
      <button className="btn-ghost py-1 text-xs" onClick={() => exportTable(table, rows)}>
        خروجی اکسل {rows.length ? `(${rows.length.toLocaleString("fa-IR")})` : ""}
      </button>
      {pdf && <button className="btn-ghost py-1 text-xs" onClick={pdf}>خروجی PDF</button>}
      {canEdit && <>
        <button className="btn-ghost py-1 text-xs" onClick={() => downloadTemplate(table)} title="فایل نمونه با سرستون‌های درست">قالب خالی</button>
        <button className="btn-accent py-1 text-xs" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? "در حال خواندن…" : "ورودی از اکسل"}
        </button>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
      </>}
      {msg && (
        <span className={`chip ${msg.ok ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger"}`}>
          {msg.ok ? `${msg.ok.toLocaleString("fa-IR")} سطر افزوده شد` : "افزوده نشد"}
          {msg.skipped ? ` · ${msg.skipped.toLocaleString("fa-IR")} رد شد` : ""}
        </span>
      )}
      {msg?.errors?.length > 0 && (
        <details className="w-full">
          <summary className="cursor-pointer text-[11px] text-danger">مشاهده {msg.errors.length} خطا</summary>
          <ul className="mt-1 max-h-32 overflow-auto rounded-lg bg-danger/5 p-2 text-[11px] text-danger">
            {msg.errors.map((e: string, i: number) => <li key={i}>• {e}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
