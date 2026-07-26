"use client";
import { useEffect, useState } from "react";
import { num } from "@/lib/num";
import Link from "next/link";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fmt, fmtDate, TASK_STATUS, MANAGER_ROLES } from "@/lib/constants";
import { accessibleProjects } from "@/lib/scope";

const d30ago = () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

export default function Dashboard() {
  const { profile } = useSession();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [directives, setDirectives] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);   // ردیف غنی هر پروژه با شاخص متناسب نوع

  useEffect(() => {
    if (!profile) return;
    (async () => setProjects(await accessibleProjects(profile)))();
    supabase.from("tasks").select("*, projects(name)").eq("assignee", profile.id)
      .neq("status", "done").order("due_date").limit(8)
      .then(({ data }) => setTasks(data || []));
    supabase.from("directives").select("*, projects(name)").eq("to_user", profile.id)
      .eq("status", "open").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setDirectives(data || []));
  }, [profile]);

  const isManager = profile && (MANAGER_ROLES.includes(profile.role) || profile.role === "investor");

  // ---------- شاخص متناسب هر نوع پروژه ----------
  useEffect(() => {
    if (!isManager || !projects.length) { setRows([]); return; }
    (async () => {
      const D30 = d30ago();
      const out: any[] = [];
      for (const p of projects.slice(0, 24)) {
        const kind = p.kind || "construction";
        const { data: tx } = await supabase.from("transactions").select("type, amount").eq("project_id", p.id).limit(20000);
        const cashIn = (tx || []).filter((t: any) => ["receipt", "income"].includes(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0);
        const cashOut = (tx || []).filter((t: any) => ["payment", "expense"].includes(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0);
        const base: any = { ...p, kind, cashIn, cashOut, net: cashIn - cashOut };

        if (kind === "factory") {
          const { data: pr } = await supabase.from("production_records").select("*").eq("project_id", p.id).limit(20000);
          const recent = (pr || []).filter((r: any) => (r.record_date || "") >= D30);
          const good = recent.reduce((s: number, r: any) => s + num(r.good_qty), 0);
          const scrap = recent.reduce((s: number, r: any) => s + num(r.scrap_qty), 0);
          const down = recent.reduce((s: number, r: any) => s + num(r.downtime_min), 0);
          const { data: so } = await supabase.from("sales_orders").select("*").eq("project_id", p.id).limit(20000);
          const salesOpen = (so || []).filter((o: any) => o.status !== "paid").reduce((s: number, o: any) => s + num(o.qty) * num(o.unit_price), 0);
          out.push({ ...base, good, scrapPct: good + scrap > 0 ? (scrap / (good + scrap)) * 100 : 0, down, salesOpen });
        } else if (kind === "solar") {
          const { data: gen } = await supabase.from("solar_generation").select("*").eq("project_id", p.id).limit(50000);
          const kwh30 = (gen || []).filter((g: any) => (g.log_date || "") >= D30).reduce((s: number, g: any) => s + num(g.kwh), 0);
          const { data: ss } = await supabase.from("solar_sales").select("*").eq("project_id", p.id).limit(20000);
          const revenue = (ss || []).reduce((s: number, x: any) => s + num(x.total), 0);
          const unsettled = (ss || []).filter((x: any) => x.status !== "settled").reduce((s: number, x: any) => s + num(x.total), 0);
          const { data: fa } = await supabase.from("solar_faults").select("status").eq("project_id", p.id).limit(20000);
          const faultsOpen = (fa || []).filter((f: any) => f.status === "open").length;
          out.push({ ...base, kwh30, revenue, unsettled, faultsOpen });
        } else if (kind === "chp") {
          const { data: g } = await supabase.from("chp_generation").select("*").eq("project_id", p.id).limit(20000);
          const recent = (g || []).filter((r: any) => (r.log_date || "") >= D30);
          const elec = recent.reduce((s: number, r: any) => s + num(r.elec_kwh), 0);
          const heat = recent.reduce((s: number, r: any) => s + num(r.heat_kwh), 0);
          const fe = recent.reduce((s: number, r: any) => s + (num(r.fuel_kwh) > 0 ? num(r.fuel_kwh) : num(r.fuel_m3) * 10.5), 0);
          const overall = fe ? (elec + heat) / fe * 100 : 0;
          const { data: cs } = await supabase.from("chp_sales").select("total, status").eq("project_id", p.id).limit(20000);
          const revenue = (cs || []).reduce((s: number, x: any) => s + num(x.total), 0);
          const { data: cf } = await supabase.from("chp_faults").select("status").eq("project_id", p.id).limit(20000);
          const faultsOpen = (cf || []).filter((f: any) => f.status === "open").length;
          out.push({ ...base, elec, heat, overall, revenue, faultsOpen });
        } else {
          const { data: ph } = await supabase.from("phases").select("progress").eq("project_id", p.id).limit(5000);
          const { data: ci } = await supabase.from("cbs_items").select("quantity, unit_rate, waste_pct, actual_total").eq("project_id", p.id).limit(5000);
          const progress = ph?.length ? Math.round(ph.reduce((s: number, x: any) => s + (x.progress || 0), 0) / ph.length) : 0;
          const plannedSum = (ci || []).reduce((s: number, i: any) => s + num(i.quantity || 0) * num(i.unit_rate || 0) * (1 + num(i.waste_pct || 0)), 0);
          const actual = (ci || []).reduce((s: number, i: any) => s + num(i.actual_total || 0), 0);
          out.push({ ...base, progress, plannedSum, actual });
        }
      }
      setRows(out);
    })();
  }, [projects, isManager]);

  const totalBudget = projects.reduce((s, p) => s + num(p.budget || 0), 0);
  const bySection = (k: string) => rows.filter(r => r.kind === k);
  const holdingNet = rows.reduce((s, r) => s + r.net, 0);
  const kByKind = (k: string) => projects.filter(p => (p.kind || "construction") === k).length;

  const progBar = (v: number) => (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-line"><div className="h-full bg-crane" style={{ width: `${Math.min(100, v)}%` }} /></div>
      <span className="text-xs font-bold">{v.toLocaleString("fa-IR")}٪</span>
    </div>
  );
  const nameCell = (p: any) => (
    <td className="td"><Link href={`/project?id=${p.id}`} className="font-bold text-blueprint hover:underline">{p.name}</Link></td>
  );
  const reportCell = (p: any) => (
    <td className="td"><Link href={`/report?id=${p.id}`} className="text-xs text-blueprint hover:underline">گزارش ←</Link></td>
  );

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-black">داشبورد هلدینگ</h1>
        {isManager && <Link href="/portfolio" className="chip mr-auto bg-primary/10 text-primary hover:brightness-95">گزارش تجمیعی همه پروژه‌ها ←</Link>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[
          ["پروژه‌های فعال", projects.filter(p => p.status === "active").length],
          ["🏗 عمران", kByKind("construction")],
          ["🏭 کارخانه", kByKind("factory")],
          ["☀️ نیروگاه", kByKind("solar")],
          ["🔥 سیکل ترکیبی", kByKind("chp")],
          ["بودجه کل (ریال)", fmt(totalBudget)],
          ["وظایف باز من", tasks.length],
        ].map(([l, v]) => (
          <div key={l as string} className="card">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className="mt-1.5 text-xl font-black tracking-tight">{v as any}</div>
          </div>
        ))}
      </div>

      {/* ---------- بخش عمران ---------- */}
      {bySection("construction").length > 0 && (
        <div className="card mb-4 overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 font-black">🏗 بخش عمران — پیشرفت و کنترل هزینه</div>
          <table className="w-full">
            <thead className="bg-surface"><tr>
              <th className="th">پروژه</th><th className="th">پیشرفت</th><th className="th">بودجه CBS</th>
              <th className="th">هزینه واقعی</th><th className="th">انحراف</th><th className="th">نقدینگی خالص</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {bySection("construction").map(p => {
                const dev = p.plannedSum - p.actual;
                return (
                  <tr key={p.id}>
                    {nameCell(p)}
                    <td className="td">{progBar(p.progress)}</td>
                    <td className="td">{fmt(Math.round(p.plannedSum))}</td>
                    <td className="td">{fmt(Math.round(p.actual))}</td>
                    <td className={`td font-bold ${dev < 0 ? "text-danger" : "text-ok"}`}>{fmt(Math.round(dev))}</td>
                    <td className={`td font-bold ${p.net < 0 ? "text-danger" : ""}`}>{fmt(p.net)}</td>
                    {reportCell(p)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- بخش کارخانه ---------- */}
      {bySection("factory").length > 0 && (
        <div className="card mb-4 overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 font-black">🏭 بخش کارخانه — تولید و فروش (۳۰ روز اخیر)</div>
          <table className="w-full">
            <thead className="bg-surface"><tr>
              <th className="th">کارخانه</th><th className="th">تولید سالم</th><th className="th">ضایعات</th>
              <th className="th">توقف (دقیقه)</th><th className="th">فروش باز</th><th className="th">نقدینگی خالص</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {bySection("factory").map(p => (
                <tr key={p.id}>
                  {nameCell(p)}
                  <td className="td font-bold">{fmt(Math.round(p.good))}</td>
                  <td className={`td ${p.scrapPct > 5 ? "text-danger font-bold" : ""}`}>{p.scrapPct.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪</td>
                  <td className="td">{fmt(p.down)}</td>
                  <td className="td">{fmt(Math.round(p.salesOpen))}</td>
                  <td className={`td font-bold ${p.net < 0 ? "text-danger" : ""}`}>{fmt(p.net)}</td>
                  {reportCell(p)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- بخش نیروگاه ---------- */}
      {bySection("solar").length > 0 && (
        <div className="card mb-4 overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 font-black">☀️ بخش نیروگاه — تولید برق و فروش (۳۰ روز اخیر)</div>
          <table className="w-full">
            <thead className="bg-surface"><tr>
              <th className="th">نیروگاه</th><th className="th">انرژی ۳۰ روز (kWh)</th><th className="th">درآمد فروش برق</th>
              <th className="th">تسویه‌نشده</th><th className="th">خرابی باز</th><th className="th">نقدینگی خالص</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {bySection("solar").map(p => (
                <tr key={p.id}>
                  {nameCell(p)}
                  <td className="td font-bold">{fmt(Math.round(p.kwh30))}</td>
                  <td className="td text-ok">{fmt(Math.round(p.revenue))}</td>
                  <td className={`td ${p.unsettled > 0 ? "text-crane font-bold" : ""}`}>{fmt(Math.round(p.unsettled))}</td>
                  <td className={`td font-bold ${p.faultsOpen > 0 ? "text-danger" : "text-ok"}`}>{p.faultsOpen.toLocaleString("fa-IR")}</td>
                  <td className={`td font-bold ${p.net < 0 ? "text-danger" : ""}`}>{fmt(p.net)}</td>
                  {reportCell(p)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- بخش سیکل ترکیبی (CHP) ---------- */}
      {bySection("chp").length > 0 && (
        <div className="card mb-4 overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 font-black">🔥 بخش سیکل ترکیبی — تولید برق/حرارت و راندمان (۳۰ روز اخیر)</div>
          <table className="w-full">
            <thead className="bg-surface"><tr>
              <th className="th">نیروگاه</th><th className="th">برق ۳۰روز (kWh)</th><th className="th">حرارت ۳۰روز (kWh)</th>
              <th className="th">راندمان کلی</th><th className="th">درآمد فروش</th><th className="th">خرابی باز</th><th className="th">نقدینگی خالص</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {bySection("chp").map(p => (
                <tr key={p.id}>
                  {nameCell(p)}
                  <td className="td font-bold">{fmt(Math.round(p.elec))}</td>
                  <td className="td">{fmt(Math.round(p.heat))}</td>
                  <td className={`td font-bold ${p.overall && p.overall < 75 ? "text-danger" : "text-ok"}`}>{p.overall ? Math.round(p.overall).toLocaleString("fa-IR") + "٪" : "—"}</td>
                  <td className="td text-ok">{fmt(Math.round(p.revenue))}</td>
                  <td className={`td font-bold ${p.faultsOpen > 0 ? "text-danger" : "text-ok"}`}>{p.faultsOpen.toLocaleString("fa-IR")}</td>
                  <td className={`td font-bold ${p.net < 0 ? "text-danger" : ""}`}>{fmt(p.net)}</td>
                  {reportCell(p)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isManager && rows.length > 0 && (
        <div className="mb-4 stat">
          <div className="text-xs font-bold text-ink/50">نقدینگی خالص کل هلدینگ (همه بخش‌ها)</div>
          <div className={`mt-1.5 text-xl font-black ${holdingNet < 0 ? "text-danger" : "text-ok"}`}>{fmt(holdingNet)} ریال</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-black">وظایف من</h2>
          {tasks.length === 0 && <p className="text-sm text-ink/40">وظیفه بازی ندارید.</p>}
          {tasks.map(t => (
            <Link key={t.id} href={`/project?id=${t.project_id}&tab=plan`} className="mb-2 block rounded-lg border border-line p-2 text-sm hover:bg-surface">
              <div className="font-bold">{t.title}</div>
              <div className="mt-0.5 flex justify-between text-xs text-ink/50">
                <span>{t.projects?.name}</span>
                <span>سررسید: {fmtDate(t.due_date)} · {TASK_STATUS[t.status]}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="card">
          <h2 className="mb-2 font-black">دستورهای دریافتی باز</h2>
          {directives.length === 0 && <p className="text-sm text-ink/40">دستور بازی ندارید.</p>}
          {directives.map(d => (
            <Link key={d.id} href={`/project?id=${d.project_id}&tab=orders`} className="mb-2 block rounded-lg border border-line p-2 text-sm hover:bg-surface">
              <div className="font-bold">{d.title}</div>
              <div className="mt-0.5 flex justify-between text-xs text-ink/50">
                <span>{d.projects?.name}</span><span>مهلت: {fmtDate(d.due_date)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
