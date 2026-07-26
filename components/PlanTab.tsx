"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { loadCostData, CostData } from "@/lib/costlink";
import ExcelIO from "@/components/ExcelIO";
import { exportExcel, printPdf, tbl, kpis, faN, faD, svgGantt, svgHBars, CH } from "@/lib/export";

export default function PlanTab({ projectId, profile, canEdit }: any) {
  const [phases, setPhases] = useState<any[]>([]);
  const [cost, setCost] = useState<CostData | null>(null);
  const [calcProgress, setCalcProgress] = useState<Record<string, number>>({});
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [pf, setPf] = useState({ name: "", start_date: "", end_date: "" });
  const [showAdd, setShowAdd] = useState(false);
  const canManage = !!canEdit;

  const load = async () => {
    const { data: ph } = await supabase.from("phases").select("*").eq("project_id", projectId).order("sort");
    setPhases(ph || []);
    const { data: ts } = await supabase.from("tasks").select("phase_id, progress, status").eq("project_id", projectId);
    const c: Record<string, number> = {};
    const agg: Record<string, { sum: number; n: number }> = {};
    for (const t of ts || []) {
      c[t.phase_id] = (c[t.phase_id] || 0) + 1;
      agg[t.phase_id] = agg[t.phase_id] || { sum: 0, n: 0 };
      agg[t.phase_id].sum += num(t.progress ?? (t.status === "done" ? 100 : 0));
      agg[t.phase_id].n += 1;
    }
    setTaskCounts(c);
    setCalcProgress(Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, Math.round(v.sum / v.n)])));
    loadCostData(projectId).then(setCost);
  };
  useEffect(() => { load(); }, [projectId]);

  const savePhase = async (p: any, patch: any, logIt = true) => {
    await supabase.from("phases").update(patch).eq("id", p.id);
    if (logIt) logAction(projectId, profile.id, "ویرایش فاز", `${p.name}: ${Object.keys(patch).join("، ")}`);
    load();
  };

  const addPhase = async () => {
    if (!pf.name.trim()) return;
    const maxSort = phases.reduce((m, p) => Math.max(m, p.sort || 0), 0);
    await supabase.from("phases").insert({
      project_id: projectId, name: pf.name.trim(), sort: maxSort + 1,
      start_date: pf.start_date || null, end_date: pf.end_date || null,
      progress: 0, status: "todo",
    });
    logAction(projectId, profile.id, "افزودن فاز", pf.name.trim());
    setPf({ name: "", start_date: "", end_date: "" }); setShowAdd(false); load();
  };

  const removePhase = async (p: any) => {
    if (!confirm(`فاز «${p.name}» و فعالیت‌های آن حذف شود؟`)) return;
    await supabase.from("tasks").delete().eq("phase_id", p.id);
    await supabase.from("phases").delete().eq("id", p.id);
    logAction(projectId, profile.id, "حذف فاز", p.name);
    load();
  };

  const overall = phases.length ? Math.round(phases.reduce((s, p) => s + (p.progress || 0), 0) / phases.length) : 0;

  const setBaseline = async () => {
    if (!confirm("تاریخ‌های فعلی همه فازها به‌عنوان برنامه مصوب (Baseline) ثبت شود؟")) return;
    for (const p of phases)
      await supabase.from("phases").update({ baseline_start: p.start_date, baseline_end: p.end_date }).eq("id", p.id);
    logAction(projectId, profile.id, "ثبت Baseline", "برنامه مصوب زمانی ذخیره شد");
    load();
  };

  // ---------- محاسبات گانت ----------
  const dated = phases.filter(p => p.start_date && p.end_date);
  const allDates = dated.flatMap(p => [p.start_date, p.end_date, p.baseline_start, p.baseline_end]).filter(Boolean) as string[];
  const min = allDates.length ? Math.min(...allDates.map(d => +new Date(d))) : Date.now();
  const max = allDates.length ? Math.max(...allDates.map(d => +new Date(d))) : Date.now() + 1;
  const span = Math.max(max - min, 86400000);
  const pos = (d: string) => ((+new Date(d) - min) / span) * 100;
  const width = (a: string, b: string) => Math.max(((+new Date(b) - +new Date(a)) / span) * 100, 0.5);
  const todayPos = Date.now() >= min && Date.now() <= max ? ((Date.now() - min) / span) * 100 : null;
  const slack = (i: number) => {
    const cur = dated[i], next = dated[i + 1];
    if (!cur || !next) return null;
    return Math.round((+new Date(next.start_date) - +new Date(cur.end_date)) / 86400000);
  };

  // ---------- خروجی‌های برنامه زمانی ----------
  const schedRows = () => phases.map((p, i) => {
    const di = dated.indexOf(p); const sl = di >= 0 ? slack(di) : null;
    const dev = p.baseline_end && p.end_date ? Math.round((+new Date(p.end_date) - +new Date(p.baseline_end)) / 86400000) : null;
    return [p.name, faD(p.start_date), faD(p.end_date), faD(p.baseline_start), faD(p.baseline_end),
      (p.progress || 0) + "٪", dev == null ? "—" : (dev > 0 ? `${faN(dev)} روز تاخیر` : dev < 0 ? `${faN(-dev)} روز جلوتر` : "طبق برنامه"),
      sl == null ? "—" : sl < 0 ? `تداخل ${faN(-sl)} روز` : `${faN(sl)} روز`];
  });
  const HEAD = ["فاز", "شروع", "پایان", "شروع مصوب", "پایان مصوب", "پیشرفت", "انحراف از Baseline", "شناوری"];

  const exportXlsx = () => exportExcel(`برنامه-زمانی`, [{ name: "برنامه زمانی", rows: [HEAD, ...schedRows()] }]);
  const exportPdf = () => {
    const delayed = phases.filter(p => p.baseline_end && p.end_date && +new Date(p.end_date) > +new Date(p.baseline_end)).length;
    printPdf("گزارش برنامه زمانی پروژه", "وضعیت فازها، Baseline و انحراف‌ها",
      kpis([["پیشرفت کل", faN(overall) + "٪"], ["تعداد فازها", faN(phases.length)],
        ["فازهای دارای تاخیر از برنامه", faN(delayed)], ["فازهای تکمیل‌شده", faN(phases.filter(p => (p.progress || 0) >= 100).length)]]) +
      svgGantt("نمودار گانت فازها", phases.map(p => ({
        name: p.name, start: p.start_date, end: p.end_date,
        bStart: p.baseline_start, bEnd: p.baseline_end, progress: p.progress || 0,
      }))) +
      svgHBars("درصد پیشرفت هر فاز", phases.map(p => ({
        name: p.name, value: p.progress || 0,
        color: (p.progress || 0) >= 100 ? CH.ok : (p.progress || 0) > 0 ? CH.accent : CH.muted,
        note: faN(p.progress || 0) + "٪",
      }))) +
      "<h2>جدول زمان‌بندی فازها</h2>" + tbl(HEAD, schedRows()));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2"><ExcelIO table="phases" projectId={projectId} rows={phases} canEdit={canManage} profile={profile} onDone={load} /></div>
      <div className="card flex items-center gap-4">
        <div className="text-sm font-black">پیشرفت کل پروژه</div>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-crane" style={{ width: `${overall}%` }} />
        </div>
        <div className="text-sm font-black">{overall.toLocaleString("fa-IR")}٪</div>
        <button className="btn-ghost" onClick={exportXlsx}>گزارش اکسل</button>
        <button className="btn-ghost" onClick={exportPdf}>خروجی PDF</button>
        {canManage && <button className="btn-ghost" onClick={setBaseline}>ثبت Baseline</button>}
        {canManage && <button className="btn-accent" onClick={() => setShowAdd(!showAdd)}>+ افزودن فاز</button>}
      </div>

      {dated.length > 0 && (
        <div className="card overflow-auto">
          <h2 className="mb-3 font-black">نمودار گانت فازها <span className="text-xs font-normal text-ink/40">— میله خاکستری: برنامه مصوب (Baseline) · خط قرمز: امروز · شناوری = فاصله تا فاز بعد</span></h2>
          <div className="min-w-[700px]">
            {dated.map((p, i) => {
              const sl = slack(i);
              return (
                <div key={p.id} className="mb-1 flex items-center gap-2">
                  <Link href={`/phase?p=${projectId}&ph=${p.id}`} className="w-64 shrink-0 truncate text-xs font-bold text-blueprint hover:underline">{p.name}</Link>
                  <div className="relative h-7 flex-1 rounded bg-surface">
                    {todayPos != null && <div className="absolute bottom-0 top-0 w-0.5 bg-danger" style={{ right: `${todayPos}%` }} />}
                    {p.baseline_start && p.baseline_end && (
                      <div className="absolute top-0.5 h-2 rounded bg-ink/25"
                        style={{ right: `${pos(p.baseline_start)}%`, width: `${width(p.baseline_start, p.baseline_end)}%` }} />
                    )}
                    <div className="absolute bottom-0.5 h-4 rounded bg-blueprint"
                      style={{ right: `${pos(p.start_date)}%`, width: `${width(p.start_date, p.end_date)}%` }}>
                      <div className="h-full rounded bg-crane" style={{ width: `${p.progress || 0}%` }} />
                    </div>
                  </div>
                  <span className={`w-24 shrink-0 text-[10px] ${sl != null && sl < 0 ? "font-bold text-danger" : "text-ink/40"}`}>
                    {sl == null ? "" : sl < 0 ? `تداخل ${fmt(Math.abs(sl))} روز` : `شناوری ${fmt(sl)} روز`}
                  </span>
                </div>
              );
            })}
            {dated.length === 0 && <p className="text-sm text-ink/40">برای نمایش گانت، تاریخ شروع و پایان فازها را تکمیل کنید.</p>}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="card grid gap-2 md:grid-cols-4">
          <input className="input md:col-span-2" placeholder="نام فاز جدید (مثلاً: فاز ۱۸ - استخر و مشاعات ورزشی)"
            value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} />
          <DateInput className="input" value={pf.start_date} onChange={v => setPf({ ...pf, start_date: v })} />
          <div className="flex gap-2">
            <DateInput className="input" value={pf.end_date} onChange={v => setPf({ ...pf, end_date: v })} />
            <button className="btn-primary" onClick={addPhase}>ثبت</button>
          </div>
        </div>
      )}

      {phases.map(p => (
        <div key={p.id} className="card flex flex-wrap items-center gap-3">
          <Link href={`/phase?p=${projectId}&ph=${p.id}`}
            className="flex-1 text-right font-black text-blueprint hover:underline">
            {p.name}
            <span className="mr-2 text-xs font-normal text-ink/40">
              {taskCounts[p.id] ? `${taskCounts[p.id].toLocaleString("fa-IR")} فعالیت` : "بدون فعالیت"} · مشاهده جزئیات ←
            </span>
            {cost?.byPhase[p.name] && (cost.byPhase[p.name].planned > 0 || cost.byPhase[p.name].actual > 0) && (
              <span className="mt-1 flex flex-wrap gap-2 text-[11px] font-normal">
                <span className="chip bg-surface">بودجه {fmt(Math.round(cost.byPhase[p.name].planned))}</span>
                {cost.byPhase[p.name].committed > 0 &&
                  <span className="chip bg-crane/12 text-crane">تعهد {fmt(Math.round(cost.byPhase[p.name].committed))}</span>}
                {cost.byPhase[p.name].actual > 0 &&
                  <span className={`chip ${cost.byPhase[p.name].actual > cost.byPhase[p.name].planned && cost.byPhase[p.name].planned > 0 ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>
                    هزینه {fmt(Math.round(cost.byPhase[p.name].actual))}
                  </span>}
                {cost.byPhase[p.name].docs > 0 &&
                  <span className="chip bg-surface text-ink/50">{cost.byPhase[p.name].docs.toLocaleString("fa-IR")} سند</span>}
              </span>
            )}
            <span className="hidden">
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs">
            <span>شروع</span>
            <DateInput className="input w-36 py-1" value={p.start_date || ""} disabled={!canManage} onChange={v => savePhase(p, { start_date: v || null })} />
            <span>پایان</span>
            <DateInput className="input w-36 py-1" value={p.end_date || ""} disabled={!canManage} onChange={v => savePhase(p, { end_date: v || null })} />
            <span>پیشرفت</span>
            <input type="number" min={0} max={100} className="input w-20 py-1" defaultValue={p.progress || 0} disabled={!canManage}
              onBlur={e => { const v = Math.min(100, num(e.target.value)); if (v !== p.progress) savePhase(p, { progress: v }); }} />
            <span>٪</span>
            {/* پیشرفت محاسبه‌شده از فعالیت‌های همین فاز */}
            {calcProgress[p.id] != null && calcProgress[p.id] !== (p.progress || 0) && (
              <button
                className="chip border border-crane/40 bg-crane/10 text-[10px] text-crane"
                title={`میانگین پیشرفت ${taskCounts[p.id]} فعالیت این فاز — کلیک کنید تا اعمال شود`}
                disabled={!canManage}
                onClick={() => savePhase(p, { progress: calcProgress[p.id] })}>
                از فعالیت‌ها: {calcProgress[p.id].toLocaleString("fa-IR")}٪ ← اعمال
              </button>
            )}
            {calcProgress[p.id] != null && calcProgress[p.id] === (p.progress || 0) && (
              <span className="chip bg-ok/10 text-[10px] text-ok" title="با میانگین فعالیت‌ها منطبق است">منطبق ✓</span>
            )}
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-blueprint" style={{ width: `${p.progress || 0}%` }} />
          </div>
          {canManage && <button className="text-xs text-danger" onClick={() => removePhase(p)}>حذف</button>}
        </div>
      ))}
    </div>
  );
}
