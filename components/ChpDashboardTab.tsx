"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { num } from "@/lib/num";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgBars, svgPie, CH } from "@/lib/export";
import { fuelEnergy } from "@/components/ChpGenerationTab";

const today = () => new Date().toISOString().slice(0, 10);

export default function ChpDashboardTab({ projectId }: any) {
  const [units, setUnits] = useState<any[]>([]);
  const [gen, setGen] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [faults, setFaults] = useState<any[]>([]);

  useEffect(() => {
    const g = (t: string, set: any) => supabase.from(t).select("*").eq("project_id", projectId).then(({ data }: any) => set(data || []));
    g("chp_units", setUnits); g("chp_generation", setGen); g("chp_sales", setSales); g("chp_faults", setFaults);
  }, [projectId]);

  const capElec = useMemo(() => units.reduce((s, u) => s + num(u.elec_capacity_kw), 0), [units]);
  const capHeat = useMemo(() => units.reduce((s, u) => s + num(u.thermal_capacity_kw), 0), [units]);
  const month = today().slice(0, 7);

  const days = useMemo(() => {
    const m: Record<string, { e: number; h: number; f: number }> = {};
    for (const r of gen) { const k = r.log_date; m[k] = m[k] || { e: 0, h: 0, f: 0 }; m[k].e += num(r.elec_kwh); m[k].h += num(r.heat_kwh); m[k].f += fuelEnergy(r); }
    return Object.entries(m).map(([d, v]) => ({ d, ...v })).sort((a, b) => a.d.localeCompare(b.d));
  }, [gen]);

  const k = useMemo(() => {
    const md = days.filter(x => x.d.startsWith(month));
    const elecM = md.reduce((s, x) => s + x.e, 0), heatM = md.reduce((s, x) => s + x.h, 0), feM = md.reduce((s, x) => s + x.f, 0);
    const elecToday = days.find(x => x.d === today())?.e || 0;
    const gasM = gen.filter(r => String(r.log_date).startsWith(month)).reduce((s, r) => s + num(r.fuel_m3), 0);
    const revM = sales.filter(s => String(s.sale_date).startsWith(month)).reduce((s, x) => s + num(x.total), 0);
    const unpaid = sales.filter(s => s.status !== "settled").reduce((s, x) => s + num(x.total), 0);
    return {
      elecToday, elecM, heatM, gasM, revM, unpaid,
      overall: feM ? (elecM + heatM) / feM * 100 : null,
      elecEff: feM ? elecM / feM * 100 : null,
      htp: elecM ? heatM / elecM : null,
      avail: units.length ? (units.filter(u => u.status === "active").length / units.length) * 100 : null,
      openFaults: faults.filter(f => f.status === "open").length,
    };
  }, [days, gen, sales, faults, units]);

  const byUnit = useMemo(() => units.map(u => ({
    name: u.name, cap: num(u.elec_capacity_kw),
    e: gen.filter(r => r.unit_id === u.id && String(r.log_date).startsWith(month)).reduce((s, r) => s + num(r.elec_kwh), 0),
    h: gen.filter(r => r.unit_id === u.id && String(r.log_date).startsWith(month)).reduce((s, r) => s + num(r.heat_kwh), 0),
  })), [units, gen]);

  const dashPdf = () => {
    const last = days.slice(-30);
    printPdf("گزارش مدیریتی نیروگاه سیکل ترکیبی (CHP)",
      `ظرفیت الکتریکی ${faN(Math.round(capElec))} kW · حرارتی ${faN(Math.round(capHeat))} kW · ${faN(units.length)} ژنراتور`,
      kpis([["برق ماه", faN(Math.round(k.elecM)) + " kWh"], ["حرارت ماه", faN(Math.round(k.heatM)) + " kWh"],
        ["راندمان کلی", k.overall == null ? "—" : faN(Math.round(k.overall)) + "٪"],
        ["راندمان الکتریکی", k.elecEff == null ? "—" : faN(Math.round(k.elecEff)) + "٪"]]) +
      kpis([["درآمد ماه", faN(Math.round(k.revM)) + " ریال"], ["گاز مصرفی ماه", faN(Math.round(k.gasM)) + " m³"],
        ["مطالبات تسویه‌نشده", faN(Math.round(k.unpaid)) + " ریال"],
        ["ژنراتور در مدار", `${faN(units.filter(u => u.status === "active").length)} از ${faN(units.length)}`]]) +
      (last.length > 1 ? svgLines("تولید روزانه", last.map(x => faD(x.d)), [
        { name: "برق (kWh)", color: CH.accent, values: last.map(x => Math.round(x.e)) },
        { name: "حرارت (kWh)", color: CH.danger, values: last.map(x => Math.round(x.h)) }]) : "") +
      (byUnit.some(x => x.e) ? svgBars("تولید ماه به تفکیک ژنراتور", byUnit.map(x => x.name), [
        { name: "برق", color: CH.accent, values: byUnit.map(x => Math.round(x.e)) },
        { name: "حرارت", color: CH.danger, values: byUnit.map(x => Math.round(x.h)) }]) : "") +
      (k.elecM || k.heatM ? svgPie("سهم برق و حرارت از تولید", [
        { name: "برق", value: Math.round(k.elecM) }, { name: "حرارت", value: Math.round(k.heatM) }]) : ""));
  };

  const faultsOpen = faults.filter(f => f.status === "open");

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={dashPdf}>خروجی PDF گزارش مدیریتی</button></div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["برق امروز", fmt(Math.round(k.elecToday)) + " kWh", ""],
          ["برق این ماه", fmt(Math.round(k.elecM)) + " kWh", ""],
          ["حرارت این ماه", fmt(Math.round(k.heatM)) + " kWh", ""],
          ["راندمان کلی", k.overall == null ? "—" : Math.round(k.overall).toLocaleString("fa-IR") + "٪", k.overall != null && k.overall < 75 ? "text-danger" : "text-ok"],
          ["نسبت حرارت به برق", k.htp == null ? "—" : k.htp.toLocaleString("fa-IR", { maximumFractionDigits: 2 }), ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-xl font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["درآمد این ماه", fmt(Math.round(k.revM)) + " ریال", ""],
          ["گاز مصرفی ماه", fmt(Math.round(k.gasM)) + " m³", ""],
          ["مطالبات تسویه‌نشده", fmt(Math.round(k.unpaid)) + " ریال", k.unpaid > 0 ? "text-danger" : ""],
          ["ژنراتور در مدار", `${units.filter(u => u.status === "active").length.toLocaleString("fa-IR")} از ${units.length.toLocaleString("fa-IR")}`, k.avail != null && k.avail < 100 ? "text-danger" : "text-ok"],
          ["خرابی باز", fmt(k.openFaults), k.openFaults > 0 ? "text-danger" : "text-ok"]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-xl font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-black">تولید این ماه به تفکیک ژنراتور</h2>
          {byUnit.filter(x => x.e > 0).length ? byUnit.map(x => {
            const max = Math.max(...byUnit.map(y => y.e), 1);
            return (
              <div key={x.name} className="mb-2 flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate font-bold">{x.name}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface"><div className="h-full bg-crane" style={{ width: `${(x.e / max) * 100}%` }} /></div>
                <span className="w-40 shrink-0 text-left text-xs"><b>{fmt(Math.round(x.e))}</b> برق · {fmt(Math.round(x.h))} حرارت</span>
              </div>
            );
          }) : <p className="text-sm text-ink/40">تولیدی برای این ماه ثبت نشده است.</p>}
        </div>

        <div className="card">
          <h2 className="mb-2 font-black">هشدارها</h2>
          <div className="space-y-1.5 text-sm">
            {k.openFaults > 0 && (
              <div className="rounded-lg border border-danger/25 bg-danger/[0.05] p-2">
                <b className="text-danger">{fmt(k.openFaults)} خرابی باز</b>
                {faultsOpen.slice(0, 3).map(f => <div key={f.id} className="mt-0.5 text-xs text-ink/60">{f.unit_name} — {f.kind || f.description}</div>)}
              </div>
            )}
            {k.overall != null && k.overall < 75 && (
              <div className="rounded-lg border border-crane/30 bg-crane/[0.06] p-2 text-xs"><b>راندمان پایین</b> — راندمان کلی {Math.round(k.overall)}٪ (کمتر از ۷۵٪)؛ احتراق/بازیافت حرارت را بررسی کنید.</div>
            )}
            {units.filter(u => u.status !== "active").map(u => (
              <div key={u.id} className="rounded-lg border border-line p-2 text-xs"><b>{u.name}</b> خارج از مدار است ({u.status === "fault" ? "خرابی" : u.status === "maintenance" ? "تعمیرات" : "خاموش"})</div>
            ))}
            {k.unpaid > 0 && <div className="rounded-lg border border-line p-2 text-xs"><b>{fmt(Math.round(k.unpaid))} ریال</b> فروش تسویه‌نشده دارید.</div>}
            {k.openFaults === 0 && k.unpaid === 0 && units.every(u => u.status === "active") && <p className="text-sm text-ok">همه چیز عادی است. ✓</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
