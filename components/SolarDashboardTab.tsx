"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, daysBetween } from "@/lib/constants";
import { num } from "@/lib/num";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgBars, svgPie, svgHBars, CH } from "@/lib/export";
import { MARKETS } from "@/components/SolarSalesTab";

const today = () => new Date().toISOString().slice(0, 10);

export default function SolarDashboardTab({ projectId }: any) {
  const [arrays, setArrays] = useState<any[]>([]);
  const [invs, setInvs] = useState<any[]>([]);
  const [gen, setGen] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [clean, setClean] = useState<any[]>([]);
  const [faults, setFaults] = useState<any[]>([]);

  useEffect(() => {
    const g = (t: string, set: any) => supabase.from(t).select("*").eq("project_id", projectId).then(({ data }: any) => set(data || []));
    g("solar_arrays", setArrays); g("solar_inverters", setInvs); g("solar_generation", setGen);
    g("solar_sales", setSales); g("solar_cleaning", setClean); g("solar_faults", setFaults);
  }, [projectId]);

  const kwp = useMemo(() => arrays.reduce((s, a) => s + num(a.panel_watt) * num(a.panel_count) / 1000, 0), [arrays]);
  const month = today().slice(0, 7);

  const days = useMemo(() => {
    const m: Record<string, { kwh: number; irr: number }> = {};
    for (const r of gen) {
      const k = r.log_date;
      m[k] = m[k] || { kwh: 0, irr: 0 };
      m[k].kwh += num(r.kwh);
      if (r.irradiance) m[k].irr = num(r.irradiance);
    }
    return Object.entries(m).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  }, [gen]);

  const k = useMemo(() => {
    const md = days.filter(x => x.date.startsWith(month));
    const kwhM = md.reduce((s, x) => s + x.kwh, 0);
    const kwhToday = days.find(x => x.date === today())?.kwh || 0;
    const irrSum = md.reduce((s, x) => s + x.irr, 0);
    const pr = kwp && irrSum ? (kwhM / (kwp * irrSum)) * 100 : null;
    const revM = sales.filter(s => String(s.sale_date).startsWith(month)).reduce((s, x) => s + num(x.total), 0);
    const revAll = sales.reduce((s, x) => s + num(x.total), 0);
    const unpaid = sales.filter(s => s.status !== "settled").reduce((s, x) => s + num(x.total), 0);
    const soldKwh = sales.reduce((s, x) => s + num(x.kwh), 0);
    const producedAll = days.reduce((s, x) => s + x.kwh, 0);
    const lastClean = clean[0]?.clean_date || [...clean].sort((a, b) => String(b.clean_date).localeCompare(String(a.clean_date)))[0]?.clean_date;
    return {
      kwhToday, kwhM, pr, revM, revAll, unpaid, soldKwh, producedAll,
      yieldSp: kwp ? kwhM / kwp : 0,
      avail: invs.length ? (invs.filter(i => i.status === "active").length / invs.length) * 100 : null,
      sinceClean: lastClean ? daysBetween(lastClean, today()) : null,
      openFaults: faults.filter(f => f.status === "open").length,
      lostKwh: faults.reduce((s, f) => s + num(f.lost_kwh), 0),
    };
  }, [days, sales, clean, faults, invs, kwp]);

  const byInvMonth = useMemo(() => invs.map(i => ({
    name: i.name, cap: num(i.capacity_kw),
    kwh: gen.filter(r => r.inverter_id === i.id && String(r.log_date).startsWith(month)).reduce((s, r) => s + num(r.kwh), 0),
  })), [invs, gen]);

  const revByMonth = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sales) { const kk = String(s.sale_date).slice(0, 7); m[kk] = (m[kk] || 0) + num(s.total); }
    return Object.entries(m).map(([mo, v]) => ({ mo, v })).sort((a, b) => a.mo.localeCompare(b.mo));
  }, [sales]);

  const dashPdf = () => {
    const last = days.slice(-30);
    const byMarket = Object.keys(MARKETS).map(mk => ({
      name: MARKETS[mk], value: Math.round(sales.filter(s => s.market === mk).reduce((s, x) => s + num(x.total), 0)),
    })).filter(x => x.value > 0);
    printPdf("گزارش مدیریتی نیروگاه خورشیدی",
      `ظرفیت ${faN(Math.round(kwp))} کیلووات‌پیک · ${faN(invs.length)} اینورتر · دوره ${month}`,
      kpis([["تولید امروز", faN(Math.round(k.kwhToday)) + " kWh"], ["تولید ماه", faN(Math.round(k.kwhM)) + " kWh"],
        ["ضریب عملکرد", k.pr == null ? "—" : faN(Math.round(k.pr)) + "٪"],
        ["بازده ویژه ماه", faN(Math.round(k.yieldSp)) + " kWh/kWp"]]) +
      kpis([["درآمد ماه", faN(Math.round(k.revM)) + " ریال"], ["درآمد کل", faN(Math.round(k.revAll)) + " ریال"],
        ["مطالبات تسویه‌نشده", faN(Math.round(k.unpaid)) + " ریال"],
        ["اینورتر در مدار", `${faN(invs.filter(i => i.status === "active").length)} از ${faN(invs.length)}`]]) +
      (last.length > 1 ? svgLines("تولید روزانه", last.map(x => faD(x.date)),
        [{ name: "تولید (kWh)", color: CH.primary, values: last.map(x => Math.round(x.kwh)) }], "kWh") : "") +
      (byInvMonth.some(x => x.kwh) ? svgBars("تولید ماه به تفکیک اینورتر", byInvMonth.map(x => x.name),
        [{ name: "تولید", color: CH.primary, values: byInvMonth.map(x => Math.round(x.kwh)) }], "kWh") : "") +
      (revByMonth.length > 1 ? svgLines("روند درآمد ماهانه", revByMonth.map(x => x.mo),
        [{ name: "درآمد", color: CH.accent, values: revByMonth.map(x => Math.round(x.v)) }], "ریال") : "") +
      (byMarket.length ? svgPie("سهم بازارها از درآمد", byMarket) : "") +
      (arrays.length ? svgPie("سهم آرایه‌ها از ظرفیت",
        arrays.map(a => ({ name: a.name, value: Math.round(num(a.panel_watt) * num(a.panel_count) / 1000) }))) : "") +
      (faults.length ? svgHBars("انرژی ازدست‌رفته بر اثر خرابی", faults.filter(f => num(f.lost_kwh) > 0).slice(0, 12).map(f => ({
        name: `${f.inverter_name} — ${faD(f.fault_date)}`, value: num(f.lost_kwh), color: CH.danger,
        note: faN(f.lost_kwh) + " kWh" }))) : "") +
      "<h2>خلاصه تولید روزانه</h2>" + tbl(["تاریخ", "تولید (kWh)", "تابش", "بازده ویژه"],
        days.slice(-30).reverse().map(x => [faD(x.date), faN(Math.round(x.kwh)), x.irr || "—",
          kwp ? (x.kwh / kwp).toFixed(1) : "—"])) +
      (sales.length ? "<h2>آخرین معاملات فروش</h2>" + tbl(["تاریخ", "بازار", "انرژی", "نرخ", "مبلغ", "وضعیت"],
        sales.slice(0, 20).map(s => [faD(s.sale_date), MARKETS[s.market], faN(s.kwh), faN(s.price_per_kwh),
          faN(s.total), s.status === "settled" ? "تسویه‌شده" : "تسویه‌نشده"])) : ""));
  };

  const faultsOpen = faults.filter(f => f.status === "open");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-ghost py-1 text-xs" onClick={dashPdf}>خروجی PDF گزارش مدیریتی</button>
      </div>

      {/* شاخص‌های تولید */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["تولید امروز", fmt(Math.round(k.kwhToday)) + " kWh", ""],
          ["تولید این ماه", fmt(Math.round(k.kwhM)) + " kWh", ""],
          ["ضریب عملکرد (PR)", k.pr == null ? "—" : Math.round(k.pr).toLocaleString("fa-IR") + "٪", k.pr != null && k.pr < 75 ? "text-danger" : "text-ok"],
          ["بازده ویژه ماه", fmt(Math.round(k.yieldSp)) + " kWh/kWp", ""],
          ["ظرفیت نصب", fmt(Math.round(kwp)) + " kWp", ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* شاخص‌های مالی و عملیاتی */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["درآمد این ماه", fmt(Math.round(k.revM)) + " ریال", ""],
          ["مطالبات تسویه‌نشده", fmt(Math.round(k.unpaid)) + " ریال", k.unpaid > 0 ? "text-danger" : ""],
          ["اینورتر در مدار", `${invs.filter(i => i.status === "active").length.toLocaleString("fa-IR")} از ${invs.length.toLocaleString("fa-IR")}`,
            k.avail != null && k.avail < 100 ? "text-danger" : "text-ok"],
          ["از آخرین شست‌وشو", k.sinceClean == null ? "—" : fmt(k.sinceClean) + " روز",
            k.sinceClean != null && k.sinceClean > 45 ? "text-danger" : ""],
          ["خرابی باز", fmt(k.openFaults), k.openFaults > 0 ? "text-danger" : "text-ok"]].map(([l, v, c]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* تولید اینورترها */}
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-black">تولید این ماه به تفکیک اینورتر</h2>
          {byInvMonth.filter(x => x.kwh > 0).length ? byInvMonth.map(x => {
            const max = Math.max(...byInvMonth.map(y => y.kwh), 1);
            return (
              <div key={x.name} className="mb-2 flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate font-bold">{x.name}</span>
                <div className="bar flex-1"><span style={{ width: `${(x.kwh / max) * 100}%` }} /></div>
                <span className="w-32 shrink-0 text-left text-xs">
                  <b>{fmt(Math.round(x.kwh))}</b> kWh
                  {x.cap > 0 && <span className="text-ink/40"> · {Math.round(x.kwh / x.cap)} kWh/kW</span>}
                </span>
              </div>
            );
          }) : <p className="text-sm text-ink/40">تولیدی برای این ماه ثبت نشده است.</p>}
        </div>

        {/* هشدارها */}
        <div className="card">
          <h2 className="mb-2 font-black">هشدارها</h2>
          <div className="space-y-1.5 text-sm">
            {k.openFaults > 0 && (
              <div className="rounded-lg border border-danger/25 bg-danger/[0.05] p-2">
                <b className="text-danger">{fmt(k.openFaults)} خرابی باز</b>
                {faultsOpen.slice(0, 3).map(f => (
                  <div key={f.id} className="mt-0.5 text-xs text-ink/60">{f.inverter_name} — {f.kind || f.description}</div>
                ))}
              </div>
            )}
            {k.sinceClean != null && k.sinceClean > 45 && (
              <div className="rounded-lg border border-crane/30 bg-crane/[0.06] p-2 text-xs">
                <b>شست‌وشو عقب افتاده</b> — {fmt(k.sinceClean)} روز از آخرین نظافت پنل‌ها گذشته است.
              </div>
            )}
            {invs.filter(i => i.status !== "active").map(i => (
              <div key={i.id} className="rounded-lg border border-line p-2 text-xs">
                <b>{i.name}</b> خارج از مدار است
              </div>
            ))}
            {k.unpaid > 0 && (
              <div className="rounded-lg border border-line p-2 text-xs">
                <b>{fmt(Math.round(k.unpaid))} ریال</b> فروش تسویه‌نشده دارید.
              </div>
            )}
            {k.openFaults === 0 && (k.sinceClean == null || k.sinceClean <= 45) && k.unpaid === 0 &&
              invs.every(i => i.status === "active") && (
              <p className="text-sm text-ok">همه چیز عادی است. ✓</p>
            )}
          </div>
        </div>
      </div>

      {/* تولید روزانه */}
      <div className="card overflow-auto p-0">
        <div className="p-3 font-black">تولید روزهای اخیر</div>
        <table className="w-full">
          <thead><tr><th className="th">تاریخ</th><th className="th">تولید (kWh)</th><th className="th">تابش</th>
            <th className="th">بازده ویژه</th><th className="th">نسبت به میانگین</th></tr></thead>
          <tbody>
            {days.slice(-14).reverse().map(x => {
              const avg = days.length ? days.reduce((s, y) => s + y.kwh, 0) / days.length : 0;
              const rel = avg ? ((x.kwh - avg) / avg) * 100 : 0;
              return (
                <tr key={x.date}>
                  <td className="td">{fmtDate(x.date)}</td>
                  <td className="td font-black text-ok">{fmt(Math.round(x.kwh))}</td>
                  <td className="td">{x.irr || "—"}</td>
                  <td className="td">{kwp ? (x.kwh / kwp).toFixed(1).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]) : "—"}</td>
                  <td className={`td font-bold ${rel >= 0 ? "text-ok" : "text-danger"}`}>
                    {rel >= 0 ? "+" : ""}{Math.round(rel).toLocaleString("fa-IR")}٪
                  </td>
                </tr>
              );
            })}
            {days.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>هنوز تولیدی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
