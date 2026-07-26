"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, daysBetween } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, CH } from "@/lib/export";

export default function MaintenanceTab({ projectId, profile, canEdit }: any) {
  const [machines, setMachines] = useState<any[]>([]);
  const [wos, setWos] = useState<any[]>([]);
  const [mf, setMf] = useState({ name: "", code: "", location: "", pm_interval_days: "30", last_pm: "" });
  const [wf, setWf] = useState({ machine_id: "", kind: "cm", issue: "", priority: "متوسط" });

  const load = async () => {
    supabase.from("machines").select("*").eq("project_id", projectId).order("name").then(({ data }: any) => setMachines(data || []));
    supabase.from("maintenance_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).then(({ data }: any) => setWos(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const addMachine = async () => {
    if (!mf.name) return;
    await supabase.from("machines").insert({ project_id: projectId, ...mf, pm_interval_days: num(mf.pm_interval_days) || 30, last_pm: mf.last_pm || null });
    logAction(projectId, profile.id, "ثبت ماشین‌آلات کارخانه", mf.name);
    setMf({ name: "", code: "", location: "", pm_interval_days: "30", last_pm: "" }); load();
  };

  const addWo = async () => {
    const m = machines.find(x => x.id === wf.machine_id);
    if (!m || !wf.issue) return;
    await supabase.from("maintenance_orders").insert({
      project_id: projectId, machine_id: m.id, machine_name: m.name, kind: wf.kind,
      issue: wf.issue, priority: wf.priority, status: "open", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, wf.kind === "pm" ? "دستور کار نت پیشگیرانه" : "درخواست تعمیر", `${m.name} — ${wf.issue}`);
    setWf({ machine_id: "", kind: "cm", issue: "", priority: "متوسط" }); load();
  };

  const closeWo = async (w: any) => {
    const action = prompt("شرح اقدام انجام‌شده:");
    if (action == null) return;
    await supabase.from("maintenance_orders").update({ status: "done", action, done_date: new Date().toISOString().slice(0, 10) }).eq("id", w.id);
    if (w.kind === "pm") await supabase.from("machines").update({ last_pm: new Date().toISOString().slice(0, 10) }).eq("id", w.machine_id);
    logAction(projectId, profile.id, "تکمیل دستور کار نت", `${w.machine_name} — ${action.slice(0, 50)}`);
    load();
  };

  const pmStatus = (m: any) => {
    if (!m.last_pm) return { label: "بدون سابقه PM", cls: "bg-danger/10 text-danger", due: true };
    const passed = daysBetween(m.last_pm, new Date().toISOString().slice(0, 10));
    const remain = (m.pm_interval_days || 30) - passed;
    if (remain <= 0) return { label: `سررسید سرویس (${Math.abs(remain)} روز گذشته)`, cls: "bg-danger/10 text-danger", due: true };
    if (remain <= 7) return { label: `${remain} روز تا سرویس`, cls: "bg-crane/20", due: false };
    return { label: `${remain} روز تا سرویس`, cls: "bg-ok/10 text-ok", due: false };
  };

  const openWos = wos.filter(w => w.status === "open");
  const mtbfInfo = (mid: string) => {
    const fails = wos.filter(w => w.machine_id === mid && w.kind === "cm");
    return fails.length;
  };

  const mPdf = () => {
    const fails = machines.map(m => ({ name: m.name, value: wos.filter(w => w.machine_id === m.id && w.kind === "cm").length }));
    printPdf("گزارش نگهداری و تعمیرات", "شناسنامه ماشین‌آلات، برنامه PM و دستور کارها",
      kpis([["ماشین‌آلات", faN(machines.length)], ["دستور کار باز", faN(openWos.length)],
        ["سرویس سررسیدشده", faN(machines.filter(m => pmStatus(m).due))],
        ["دستور کار انجام‌شده", faN(wos.filter(w => w.status === "done").length)]]) +
      (wos.length ? svgPie("ترکیب دستور کارها", [
        { name: "سرویس دوره‌ای (PM)", value: wos.filter(w => w.kind === "pm").length },
        { name: "تعمیر (CM)", value: wos.filter(w => w.kind === "cm").length }]) : "") +
      (fails.some(f => f.value) ? svgHBars("تعداد خرابی به تفکیک دستگاه",
        fails.sort((a, b) => b.value - a.value).map(f => ({ ...f, color: CH.danger, note: faN(f.value) + " خرابی" }))) : "") +
      "<h2>شناسنامه ماشین‌آلات و وضعیت سرویس</h2>" + tbl(["دستگاه", "کد", "محل", "دوره PM (روز)", "آخرین سرویس", "وضعیت"],
        machines.map(m => [m.name, m.code || "—", m.location || "—", faN(m.pm_interval_days), faD(m.last_pm), pmStatus(m).label])) +
      "<h2>دستور کارها</h2>" + tbl(["دستگاه", "نوع", "شرح", "اولویت", "وضعیت", "اقدام", "تاریخ انجام"],
        wos.map(w => [w.machine_name, w.kind === "pm" ? "PM" : "تعمیر", (w.issue || "").slice(0, 70),
          w.priority || "—", w.status === "open" ? "باز" : "انجام‌شده", (w.action || "—").slice(0, 50), faD(w.done_date)])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 space-y-1">
        <ExcelIO table="machines" projectId={projectId} rows={machines} canEdit={canEdit} profile={profile} onDone={load} pdf={mPdf} />
        <div className="border-t border-line pt-1">
          <ExcelIO table="maintenance_orders" projectId={projectId} rows={wos} canEdit={canEdit} profile={profile} onDone={load} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["ماشین‌آلات ثبت‌شده", machines.length], ["دستور کارهای باز", openWos.length],
          ["سرویس‌های سررسیدشده", machines.filter(m => pmStatus(m).due).length]].map(([l, v]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${l === "سرویس‌های سررسیدشده" && (v as number) > 0 ? "text-danger" : ""}`}>{(v as number).toLocaleString("fa-IR")}</div></div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-black">شناسنامه ماشین‌آلات و برنامه PM</h2>
          {canEdit && (
            <div className="mb-2 grid grid-cols-6 gap-2">
              <input className="input col-span-2" placeholder="نام (اکسترودر، میکسر…)" value={mf.name} onChange={e => setMf({ ...mf, name: e.target.value })} />
              <input className="input" placeholder="کد" value={mf.code} onChange={e => setMf({ ...mf, code: e.target.value })} />
              <input className="input" dir="ltr" placeholder="دوره PM (روز)" value={mf.pm_interval_days} onChange={e => setMf({ ...mf, pm_interval_days: e.target.value })} />
              <DateInput className="input" title="آخرین سرویس" value={mf.last_pm} onChange={v => setMf({ ...mf, last_pm: v })} />
              <button className="btn-primary" onClick={addMachine}>ثبت</button>
            </div>
          )}
          {machines.map(m => {
            const st = pmStatus(m);
            return (
              <div key={m.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
                <span className="flex-1 font-bold">{m.name} <span className="code-chip">{m.code}</span></span>
                <span className="text-xs text-ink/50">آخرین PM: {fmtDate(m.last_pm)}</span>
                <span className="text-xs text-ink/50">خرابی‌ها: {mtbfInfo(m.id)}</span>
                <span className={`chip ${st.cls}`}>{st.label}</span>
              </div>
            );
          })}
          {machines.length === 0 && <p className="text-sm text-ink/40">ماشینی ثبت نشده است.</p>}
        </div>

        <div className="card">
          <h2 className="mb-2 font-black">دستور کار تعمیرات / نت</h2>
          {canEdit && (
            <div className="mb-2 grid grid-cols-6 gap-2">
              <select className="input col-span-2" value={wf.machine_id} onChange={e => setWf({ ...wf, machine_id: e.target.value })}>
                <option value="">دستگاه…</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select className="input" value={wf.kind} onChange={e => setWf({ ...wf, kind: e.target.value })}>
                <option value="cm">تعمیر (EM/CM)</option><option value="pm">سرویس دوره‌ای (PM)</option>
              </select>
              <input className="input col-span-2" placeholder="شرح مشکل / سرویس" value={wf.issue} onChange={e => setWf({ ...wf, issue: e.target.value })} />
              <button className="btn-primary" onClick={addWo}>صدور</button>
            </div>
          )}
          {wos.slice(0, 30).map(w => (
            <div key={w.id} className="mb-1 rounded-lg border border-line p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${w.kind === "pm" ? "bg-blueprint/10 text-blueprint" : "bg-crane/20"}`}>{w.kind === "pm" ? "PM" : "تعمیر"}</span>
                <span className="font-bold">{w.machine_name}</span>
                <span className="flex-1 text-xs text-ink/60">{w.issue}</span>
                {w.status === "open"
                  ? (canEdit && <button className="btn-primary py-0.5 text-xs" onClick={() => closeWo(w)}>انجام شد</button>)
                  : <span className="chip bg-ok/10 text-ok">بسته — {fmtDate(w.done_date)}</span>}
              </div>
              {w.action && <p className="mt-1 text-xs text-ok">اقدام: {w.action}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
