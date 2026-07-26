"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import { printPdf, tbl, kpis, faN, faD, svgLines, CH } from "@/lib/export";

// ارزش حرارتی گاز طبیعی (kWh به ازای هر مترمکعب) — برای برآورد انرژی سوخت
export const GAS_KWH_PER_M3 = 10.5;
const today = () => new Date().toISOString().slice(0, 10);
export const fuelEnergy = (r: any) => num(r.fuel_kwh) > 0 ? num(r.fuel_kwh) : num(r.fuel_m3) * GAS_KWH_PER_M3;

export default function ChpGenerationTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [f, setF] = useState<any>({ log_date: today(), unit_id: "", elec_kwh: "", heat_kwh: "", fuel_m3: "", fuel_kwh: "", hours_online: "", note: "" });

  const load = async () => {
    const { data } = await supabase.from("chp_generation").select("*").eq("project_id", projectId).order("log_date", { ascending: false }).limit(3000);
    setRows(data || []);
    supabase.from("chp_units").select("*").eq("project_id", projectId).then(({ data }: any) => setUnits(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.unit_id || !num(f.elec_kwh)) return;
    const u = units.find(x => x.id === f.unit_id);
    await supabase.from("chp_generation").insert({
      project_id: projectId, unit_id: f.unit_id, unit_name: u?.name || "",
      log_date: f.log_date, elec_kwh: num(f.elec_kwh), heat_kwh: num(f.heat_kwh),
      fuel_m3: num(f.fuel_m3), fuel_kwh: num(f.fuel_kwh), hours_online: num(f.hours_online),
      note: f.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت تولید CHP", `${u?.name || ""} — برق ${fmt(num(f.elec_kwh))} · حرارت ${fmt(num(f.heat_kwh))} kWh`);
    setF({ ...f, elec_kwh: "", heat_kwh: "", fuel_m3: "", fuel_kwh: "", hours_online: "", note: "" });
    load();
  };
  const remove = async (r: any) => {
    if (await deleteRow("chp_generation", r, { projectId, profile, label: "رکورد تولید", detail: `${r.unit_name} — ${r.log_date}` })) load();
  };

  const eff = (r: any) => { const fe = fuelEnergy(r); return fe ? (num(r.elec_kwh) + num(r.heat_kwh)) / fe * 100 : null; };
  const elecEff = (r: any) => { const fe = fuelEnergy(r); return fe ? num(r.elec_kwh) / fe * 100 : null; };

  const stat = useMemo(() => {
    const elec = rows.reduce((s, r) => s + num(r.elec_kwh), 0);
    const heat = rows.reduce((s, r) => s + num(r.heat_kwh), 0);
    const fe = rows.reduce((s, r) => s + fuelEnergy(r), 0);
    const gas = rows.reduce((s, r) => s + num(r.fuel_m3), 0);
    return { elec, heat, gas, overall: fe ? (elec + heat) / fe * 100 : 0, elecEff: fe ? elec / fe * 100 : 0, htp: elec ? heat / elec : 0 };
  }, [rows]);

  const byDay = useMemo(() => {
    const m: Record<string, { e: number; h: number }> = {};
    for (const r of rows) { const k = r.log_date; m[k] = m[k] || { e: 0, h: 0 }; m[k].e += num(r.elec_kwh); m[k].h += num(r.heat_kwh); }
    return Object.entries(m).map(([d, v]) => ({ d, ...v })).sort((a, b) => a.d.localeCompare(b.d));
  }, [rows]);

  const genPdf = () => {
    const last = byDay.slice(-30);
    printPdf("گزارش تولید نیروگاه سیکل ترکیبی", "برق، حرارت، سوخت و راندمان",
      kpis([["برق تولیدی کل", faN(Math.round(stat.elec)) + " kWh"], ["حرارت تولیدی کل", faN(Math.round(stat.heat)) + " kWh"],
        ["راندمان کلی", faN(Math.round(stat.overall)) + "٪"], ["راندمان الکتریکی", faN(Math.round(stat.elecEff)) + "٪"]]) +
      (last.length > 1 ? svgLines("تولید روزانه", last.map(x => faD(x.d)), [
        { name: "برق (kWh)", color: CH.accent, values: last.map(x => Math.round(x.e)) },
        { name: "حرارت (kWh)", color: CH.danger, values: last.map(x => Math.round(x.h)) }]) : "") +
      "<h2>رکوردهای تولید</h2>" + tbl(["تاریخ", "ژنراتور", "برق (kWh)", "حرارت (kWh)", "گاز (m³)", "ساعت", "راندمان کلی"],
        rows.slice(0, 60).map(r => [faD(r.log_date), r.unit_name, faN(r.elec_kwh), faN(r.heat_kwh), faN(r.fuel_m3),
          faN(r.hours_online), eff(r) == null ? "—" : faN(Math.round(eff(r)!)) + "٪"])));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["برق تولیدی", fmt(Math.round(stat.elec)) + " kWh", ""],
          ["حرارت تولیدی", fmt(Math.round(stat.heat)) + " kWh", ""],
          ["راندمان کلی", stat.overall ? Math.round(stat.overall).toLocaleString("fa-IR") + "٪" : "—", stat.overall && stat.overall < 75 ? "text-danger" : "text-ok"],
          ["راندمان الکتریکی", stat.elecEff ? Math.round(stat.elecEff).toLocaleString("fa-IR") + "٪" : "—", ""],
          ["نسبت حرارت به برق", stat.htp ? stat.htp.toLocaleString("fa-IR", { maximumFractionDigits: 2 }) : "—", ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={genPdf}>خروجی PDF</button></div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-7">
          <DateInput className="input" value={f.log_date} onChange={(v: string) => setF({ ...f, log_date: v })} />
          <select className="input" value={f.unit_id} onChange={e => setF({ ...f, unit_id: e.target.value })}>
            <option value="">ژنراتور…</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="input" dir="ltr" placeholder="برق (kWh)" value={f.elec_kwh} onChange={e => setF({ ...f, elec_kwh: e.target.value })} />
          <input className="input" dir="ltr" placeholder="حرارت (kWh)" value={f.heat_kwh} onChange={e => setF({ ...f, heat_kwh: e.target.value })} />
          <input className="input" dir="ltr" placeholder="گاز (m³)" value={f.fuel_m3} onChange={e => setF({ ...f, fuel_m3: e.target.value })} />
          <input className="input" dir="ltr" placeholder="ساعت کارکرد" value={f.hours_online} onChange={e => setF({ ...f, hours_online: e.target.value })} />
          <button className="btn-primary" onClick={add}>ثبت تولید</button>
          {num(f.elec_kwh) > 0 && (num(f.fuel_m3) > 0 || num(f.fuel_kwh) > 0) && (
            <div className="md:col-span-7 rounded-lg bg-primary/[0.06] px-3 py-1.5 text-xs font-bold text-primary">
              راندمان کلی این رکورد: {fmt(Math.round((num(f.elec_kwh) + num(f.heat_kwh)) / (num(f.fuel_kwh) > 0 ? num(f.fuel_kwh) : num(f.fuel_m3) * GAS_KWH_PER_M3) * 100))}٪
            </div>
          )}
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className="th">تاریخ</th><th className="th">ژنراتور</th><th className="th">برق</th><th className="th">حرارت</th>
            <th className="th">گاز (m³)</th><th className="th">ساعت</th><th className="th">راندمان کلی</th>{canEdit && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {rows.slice(0, 200).map(r => {
              const e = eff(r);
              return (
                <tr key={r.id}>
                  <td className="td">{fmtDate(r.log_date)}</td>
                  <td className="td font-bold">{r.unit_name}</td>
                  <td className="td text-ok font-bold">{fmt(r.elec_kwh)}</td>
                  <td className="td text-danger">{fmt(r.heat_kwh)}</td>
                  <td className="td">{fmt(r.fuel_m3)}</td>
                  <td className="td">{fmt(r.hours_online)}</td>
                  <td className={`td font-bold ${e != null && e < 75 ? "text-danger" : ""}`}>{e == null ? "—" : Math.round(e).toLocaleString("fa-IR") + "٪"}</td>
                  {canEdit && <td className="td"><button className="text-[11px] text-danger" onClick={() => remove(r)}>حذف</button></td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 8 : 7}>تولیدی ثبت نشده است. ابتدا در «ژنراتورها» یونیت تعریف کنید.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
