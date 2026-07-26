"use client";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { exportExcel, printPdf, tbl, kpis, faN, svgLines, svgBars, svgPie, svgHBars, CH } from "@/lib/export";
import { fmt } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

const COLORS = ["#00563C", "#002366", "#12A97A", "#BE2E2E", "#2F6BD8", "#0A7C63", "#5B95F2", "#7A8794"];
const short = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(1) + " میلیارد" : n >= 1e6 ? (n / 1e6).toFixed(0) + " میلیون" : String(n);

export default function AnalysisTab({ projectId, project }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [phaseDates, setPhaseDates] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("cbs_items").select("phase_name, category, quantity, unit_rate, waste_pct, actual_total")
      .eq("project_id", projectId).limit(5000).then(({ data }) => setItems(data || []));
    supabase.from("phases").select("name, progress, start_date, end_date").eq("project_id", projectId).order("sort")
      .then(({ data }: any) => { setPhases(data || []); setPhaseDates((data || []).filter((p: any) => p.start_date && p.end_date)); });
    supabase.from("transactions").select("type, amount, txn_date").eq("project_id", projectId)
      .then(({ data }) => setTxns(data || []));
  }, [projectId]);

  const planned = (it: any) => num(it.quantity || 0) * num(it.unit_rate || 0) * (1 + num(it.waste_pct || 0));

  const byPhase = useMemo(() => {
    const m: Record<string, { name: string; planned: number; actual: number }> = {};
    for (const it of items) {
      const k = it.phase_name || "نامشخص";
      m[k] = m[k] || { name: k.replace("فاز ", "").split(" - ")[0], planned: 0, actual: 0 };
      m[k].planned += planned(it); m[k].actual += num(it.actual_total || 0);
    }
    return Object.values(m);
  }, [items]);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.category || "سایر"] = (m[it.category || "سایر"] || 0) + planned(it);
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [items]);

  const cashflow = useMemo(() => {
    const m: Record<string, { month: string; in: number; out: number }> = {};
    for (const t of txns) {
      const k = (t.txn_date || "").slice(0, 7);
      if (!k) continue;
      m[k] = m[k] || { month: k, in: 0, out: 0 };
      if (["receipt", "income"].includes(t.type)) m[k].in += num(t.amount);
      else m[k].out += num(t.amount);
    }
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [txns]);

  // ---------- منحنی S: توزیع بودجه هر فاز روی بازه زمانی آن ----------
  const scurve = useMemo(() => {
    if (!phaseDates.length || !items.length) return [];
    const phaseBudget: Record<string, number> = {};
    for (const it of items) phaseBudget[it.phase_name] = (phaseBudget[it.phase_name] || 0) + planned(it);
    const months: Record<string, { month: string; pv: number; ac: number }> = {};
    const addMonth = (k: string) => (months[k] = months[k] || { month: k, pv: 0, ac: 0 });
    for (const p of phaseDates) {
      const b = phaseBudget[p.name] || 0; if (!b) continue;
      const s = new Date(p.start_date), e = new Date(p.end_date);
      const n = Math.max((e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() + 1, 1);
      const d = new Date(s);
      for (let i = 0; i < n; i++) {
        addMonth(d.toISOString().slice(0, 7)).pv += b / n;
        d.setMonth(d.getMonth() + 1);
      }
    }
    for (const t of txns) {
      if (!["payment", "expense"].includes(t.type)) continue;
      const k = (t.txn_date || "").slice(0, 7); if (!k) continue;
      addMonth(k).ac += num(t.amount);
    }
    const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
    let cpv = 0, cac = 0;
    return sorted.map(m => ({ month: m.month, pv: Math.round(cpv += m.pv), ac: Math.round(cac += m.ac) }));
  }, [phaseDates, items, txns]);

  const nowKey = new Date().toISOString().slice(0, 7);
  const pvNow = scurve.filter(m => m.month <= nowKey).slice(-1)[0]?.pv || 0;

  const totPlanned = items.reduce((s, i) => s + planned(i), 0);
  const totActual = items.reduce((s, i) => s + num(i.actual_total || 0), 0);
  // ارزش کسب‌شده: بودجه هر فاز × درصد پیشرفت همان فاز
  const ev = byPhase.reduce((s, p) => {
    const ph = phases.find(x => (x.name || "").includes(p.name));
    return s + p.planned * ((ph?.progress || 0) / 100);
  }, 0);
  const cpi = totActual > 0 ? ev / totActual : 0;
  const spi = pvNow > 0 ? ev / pvNow : 0;
  const eac = cpi > 0 ? totPlanned / cpi : 0;

  const kpiPairs: [string, string][] = [
    ["بودجه CBS (BAC)", faN(Math.round(totPlanned)) + " ریال"],
    ["هزینه واقعی (AC)", faN(Math.round(totActual)) + " ریال"],
    ["ارزش کسب‌شده (EV)", faN(Math.round(ev)) + " ریال"],
    ["CPI", totActual ? cpi.toFixed(2) : "—"],
    ["SPI", pvNow ? spi.toFixed(2) : "—"],
    ["پیش‌بینی نهایی (EAC)", totActual ? faN(Math.round(eac)) + " ریال" : "—"],
  ];
  const phaseRows = byPhase.map((v: any) =>
    [v.name, faN(Math.round(v.planned)), faN(Math.round(v.actual)), faN(Math.round(v.planned - v.actual))]);
  const exportXlsx = () => exportExcel("تحلیل-هزینه", [
    { name: "شاخص‌ها", rows: kpiPairs.map(p => [p[0], p[1]]) },
    { name: "به تفکیک فاز", rows: [["فاز", "برنامه‌ای", "واقعی", "انحراف"], ...phaseRows] },
    { name: "منحنی S", rows: [["ماه", "PV تجمعی", "AC تجمعی"], ...scurve.map(m => [m.month, m.pv, m.ac])] },
  ]);
  const exportPdf = () => printPdf("گزارش تحلیل هزینه و EVM", "شاخص‌های عملکرد، انحراف فازها، منحنی S و جریان نقدی",
    kpis(kpiPairs.slice(0, 4)) + kpis(kpiPairs.slice(4).concat([["انحراف EAC از بودجه", faN(Math.round(eac - totPlanned)) + " ریال"]])) +
    svgLines("منحنی S — ارزش برنامه‌ای تجمعی در برابر هزینه واقعی تجمعی", scurve.map(m => m.month), [
      { name: "برنامه‌ای تجمعی (PV)", color: CH.primary, values: scurve.map(m => m.pv) },
      { name: "واقعی تجمعی (AC)", color: CH.accent, values: scurve.map(m => m.ac) },
    ], "ریال") +
    svgBars("هزینه برنامه‌ای در برابر واقعی به تفکیک فاز", byPhase.map((p: any) => p.name), [
      { name: "برنامه‌ای", color: CH.primary, values: byPhase.map((p: any) => Math.round(p.planned)) },
      { name: "واقعی", color: CH.accent, values: byPhase.map((p: any) => Math.round(p.actual)) },
    ], "ریال") +
    svgHBars("انحراف هزینه هر فاز (مثبت = صرفه‌جویی)", byPhase.map((p: any) => ({
      name: p.name, value: Math.round(p.planned - p.actual),
      color: p.planned - p.actual < 0 ? CH.danger : CH.ok,
      note: faN(Math.round(p.planned - p.actual)) + " ریال",
    }))) +
    svgPie("سهم دسته‌های هزینه از بودجه", byCategory) +
    svgLines("جریان نقدی ماهانه", cashflow.map(c => c.month), [
      { name: "ورودی", color: CH.ok, values: cashflow.map(c => c.in) },
      { name: "خروجی", color: CH.danger, values: cashflow.map(c => c.out) },
    ], "ریال") +
    "<h2>هزینه برنامه‌ای و واقعی به تفکیک فاز</h2>" + tbl(["فاز", "برنامه‌ای (ریال)", "واقعی (ریال)", "انحراف"], phaseRows) +
    "<h2>منحنی S (تجمعی ماهانه)</h2>" + tbl(["ماه", "PV تجمعی", "AC تجمعی"], scurve.map(m => [m.month, faN(m.pv), faN(m.ac)])));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={exportXlsx}>خروجی اکسل</button>
        <button className="btn-ghost" onClick={exportPdf}>خروجی PDF</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
        {[
          ["بودجه برنامه‌ای CBS", fmt(totPlanned) + " ریال"],
          ["هزینه واقعی تاکنون", fmt(totActual) + " ریال"],
          ["ارزش کسب‌شده (EV)", fmt(Math.round(ev)) + " ریال"],
          ["شاخص عملکرد هزینه (CPI)", totActual ? cpi.toFixed(2) : "—"],
          ["شاخص عملکرد زمانی (SPI)", pvNow ? spi.toFixed(2) : "—"],
          ["پیش‌بینی هزینه نهایی (EAC)", totActual ? fmt(Math.round(eac)) + " ریال" : "—"],
          ["انحراف پیش‌بینی از بودجه", totActual ? fmt(Math.round(eac - totPlanned)) + " ریال" : "—"],
          ["بودجه در برابر واقعی", totPlanned ? Math.round(totActual / totPlanned * 100).toLocaleString("fa-IR") + "٪ مصرف" : "—"],
        ].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1 text-base font-black ${l === "شاخص عملکرد هزینه (CPI)" && totActual ? (cpi >= 1 ? "text-ok" : "text-danger") : ""}`}>{v}</div>
          </div>
        ))}
      </div>
      {scurve.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-black">منحنی S — ارزش برنامه‌ای تجمعی (PV) در برابر هزینه واقعی تجمعی (AC)</h2>
          <div style={{ height: 320, direction: "ltr" }}>
            <ResponsiveContainer>
              <LineChart data={scurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.25)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={short as any} tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: any) => fmt(v) + " ریال"} />
                <Legend />
                <Line dataKey="pv" name="برنامه‌ای تجمعی (PV)" stroke="#00563C" strokeWidth={2} dot={false} />
                <Line dataKey="ac" name="واقعی تجمعی (AC)" stroke="#2F6BD8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="card">
        <h2 className="mb-2 font-black">هزینه برنامه‌ای در برابر واقعی به تفکیک فاز</h2>
        <div style={{ height: 340, direction: "ltr" }}>
          <ResponsiveContainer>
            <BarChart data={byPhase}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.25)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={short as any} tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v: any) => fmt(v) + " ریال"} />
              <Legend />
              <Bar dataKey="planned" name="برنامه‌ای" fill="#00563C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="واقعی" fill="#002366" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-black">ترکیب هزینه به تفکیک دسته (۸ دسته اصلی)</h2>
          <div style={{ height: 300, direction: "ltr" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={100} label={(e: any) => e.name}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v) + " ریال"} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="mb-2 font-black">جریان نقدی ماهانه (بر مبنای اسناد حسابداری)</h2>
          <div style={{ height: 300, direction: "ltr" }}>
            <ResponsiveContainer>
              <LineChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.25)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={short as any} tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v: any) => fmt(v) + " ریال"} />
                <Legend />
                <Line dataKey="in" name="ورودی" stroke="#00563C" strokeWidth={2} />
                <Line dataKey="out" name="خروجی" stroke="#C75B44" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {items.length === 0 && <p className="text-sm text-ink/40">برای فعال شدن تحلیل‌ها، ابتدا فایل اکسل CBS را در تب «ساختار هزینه» وارد کنید.</p>}
    </div>
  );
}
