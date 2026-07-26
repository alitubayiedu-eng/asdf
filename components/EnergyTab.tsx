"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgPie, CH } from "@/lib/export";

export default function EnergyTab({ projectId, profile, canEdit }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ log_date: today, kwh: "", gas: "", water: "", solar_kwh: "" });

  const load = () => {
    supabase.from("energy_logs").select("*").eq("project_id", projectId).order("log_date", { ascending: false }).limit(120)
      .then(({ data }: any) => setLogs(data || []));
    supabase.from("production_records").select("record_date, good_qty").eq("project_id", projectId)
      .then(({ data }: any) => setRecords(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.kwh && !f.gas) return;
    await supabase.from("energy_logs").insert({
      project_id: projectId, log_date: f.log_date,
      kwh: num(f.kwh) || 0, gas: num(f.gas) || 0, water: num(f.water) || 0, solar_kwh: num(f.solar_kwh) || 0,
    });
    logAction(projectId, profile.id, "ثبت مصرف انرژی", `${fmtDate(f.log_date)} — برق ${f.kwh} kWh`);
    setF({ log_date: today, kwh: "", gas: "", water: "", solar_kwh: "" }); load();
  };

  const month = new Date().toISOString().slice(0, 7);
  const stats = useMemo(() => {
    const ml = logs.filter(l => (l.log_date || "").startsWith(month));
    const kwh = ml.reduce((s, l) => s + num(l.kwh || 0), 0);
    const solar = ml.reduce((s, l) => s + num(l.solar_kwh || 0), 0);
    const gas = ml.reduce((s, l) => s + num(l.gas || 0), 0);
    const prod = records.filter(r => (r.record_date || "").startsWith(month)).reduce((s, r) => s + num(r.good_qty || 0), 0);
    return { kwh, solar, gas, prod, perUnit: prod ? kwh / prod : 0, solarPct: kwh ? Math.round(solar / kwh * 100) : 0 };
  }, [logs, records]);

  const ePdf = () => {
    const asc = [...logs].sort((a, b) => String(a.log_date).localeCompare(String(b.log_date)));
    printPdf("گزارش انرژی و یوتیلیتی", "مصرف برق، گاز، آب و تولید نیروگاه خورشیدی",
      kpis([["برق این ماه (kWh)", faN(stats.kwh)], ["تولید خورشیدی (kWh)", faN(stats.solar)],
        ["پوشش خورشیدی", faN(stats.solarPct) + "٪"],
        ["شاخص انرژی (kWh بر واحد)", stats.perUnit ? stats.perUnit.toFixed(2) : "—"]]) +
      (asc.length > 1 ? svgLines("مصرف برق در برابر تولید خورشیدی", asc.map(l => faD(l.log_date)), [
        { name: "مصرف برق", color: CH.danger, values: asc.map(l => num(l.kwh || 0)) },
        { name: "تولید خورشیدی", color: CH.ok, values: asc.map(l => num(l.solar_kwh || 0)) }], "kWh") : "") +
      (stats.kwh ? svgPie("ترکیب تامین برق این ماه", [
        { name: "خورشیدی (خودتولید)", value: stats.solar },
        { name: "شبکه سراسری", value: Math.max(0, stats.kwh - stats.solar) }]) : "") +
      (asc.length > 1 ? svgLines("مصرف گاز و آب", asc.map(l => faD(l.log_date)), [
        { name: "گاز (m³)", color: CH.accent, values: asc.map(l => num(l.gas || 0)) },
        { name: "آب (m³)", color: CH.primary, values: asc.map(l => num(l.water || 0)) }]) : "") +
      "<h2>ثبت روزانه</h2>" + tbl(["تاریخ", "برق (kWh)", "خورشیدی (kWh)", "گاز (m³)", "آب (m³)"],
        logs.map(l => [faD(l.log_date), faN(l.kwh), faN(l.solar_kwh), faN(l.gas), faN(l.water)])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2"><ExcelIO table="energy_logs" projectId={projectId} rows={logs} canEdit={canEdit} profile={profile} onDone={load} pdf={ePdf} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["برق این ماه (kWh)", fmt(stats.kwh)], ["تولید خورشیدی (kWh)", fmt(stats.solar)],
          ["پوشش خورشیدی", stats.solarPct.toLocaleString("fa-IR") + "٪"],
          ["گاز این ماه (m³)", fmt(stats.gas)],
          ["شاخص انرژی (kWh بر واحد تولید)", stats.perUnit ? stats.perUnit.toFixed(2) : "—"]].map(([l, v]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className="mt-1.5 text-xl font-black tracking-tight">{v}</div></div>
        ))}
      </div>
      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-6">
          <DateInput className="input" value={f.log_date} onChange={v => setF({ ...f, log_date: v })} />
          <input className="input" dir="ltr" placeholder="برق (kWh)" value={f.kwh} onChange={e => setF({ ...f, kwh: e.target.value })} />
          <input className="input" dir="ltr" placeholder="خورشیدی (kWh)" value={f.solar_kwh} onChange={e => setF({ ...f, solar_kwh: e.target.value })} />
          <input className="input" dir="ltr" placeholder="گاز (m³)" value={f.gas} onChange={e => setF({ ...f, gas: e.target.value })} />
          <input className="input" dir="ltr" placeholder="آب (m³)" value={f.water} onChange={e => setF({ ...f, water: e.target.value })} />
          <button className="btn-primary" onClick={add}>ثبت روزانه</button>
        </div>
      )}
      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">برق (kWh)</th><th className="th">خورشیدی (kWh)</th><th className="th">گاز (m³)</th><th className="th">آب (m³)</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td className="td">{fmtDate(l.log_date)}</td>
                <td className="td font-bold">{fmt(l.kwh)}</td>
                <td className="td text-ok">{fmt(l.solar_kwh)}</td>
                <td className="td">{fmt(l.gas)}</td><td className="td">{fmt(l.water)}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>مصرفی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
