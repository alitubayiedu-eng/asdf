"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow, editRow } from "@/lib/crud";

export const ENGINE_TYPES: Record<string, string> = { gas_engine: "موتور گازسوز", gas_turbine: "توربین گازی", steam_turbine: "توربین بخار" };
export const FUEL_TYPES: Record<string, string> = { gas: "گاز طبیعی", diesel: "گازوئیل", biogas: "بیوگاز" };
export const UNIT_STATUS: Record<string, string> = { active: "در مدار", fault: "خرابی", maintenance: "تعمیرات", off: "خاموش" };
const today = () => new Date().toISOString().slice(0, 10);

export default function ChpUnitsTab({ projectId, profile, canEdit }: any) {
  const [units, setUnits] = useState<any[]>([]);
  const [gen, setGen] = useState<any[]>([]);
  const [f, setF] = useState<any>({ name: "", code: "", brand: "", model: "", engine_type: "gas_engine", fuel_type: "gas", elec_capacity_kw: "", thermal_capacity_kw: "", serial: "", install_date: "", overhaul_interval_hours: "8000", last_overhaul: "", note: "" });

  const load = async () => {
    const { data } = await supabase.from("chp_units").select("*").eq("project_id", projectId).order("created_at");
    setUnits(data || []);
    const { data: g } = await supabase.from("chp_generation").select("unit_id, log_date, hours_online").eq("project_id", projectId).limit(50000);
    setGen(g || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.name.trim()) return;
    await supabase.from("chp_units").insert({
      project_id: projectId, name: f.name.trim(), code: f.code, brand: f.brand, model: f.model,
      engine_type: f.engine_type, fuel_type: f.fuel_type,
      elec_capacity_kw: num(f.elec_capacity_kw), thermal_capacity_kw: num(f.thermal_capacity_kw),
      serial: f.serial, install_date: f.install_date || null,
      overhaul_interval_hours: num(f.overhaul_interval_hours) || 8000, last_overhaul: f.last_overhaul || null,
      status: "active", note: f.note,
    });
    logAction(projectId, profile.id, "ثبت ژنراتور CHP", `${f.name} — ${fmt(num(f.elec_capacity_kw))} kW`);
    setF({ ...f, name: "", code: "", brand: "", model: "", elec_capacity_kw: "", thermal_capacity_kw: "", serial: "", install_date: "", note: "" });
    load();
  };
  const setStatus = async (u: any, status: string) => {
    await editRow("chp_units", u, { status }, { projectId, profile, label: "ژنراتور" }); load();
  };
  const doOverhaul = async (u: any) => {
    if (!confirm(`اورهال «${u.name}» با تاریخ امروز ثبت شود؟ (شمارنده‌ی ساعت کارکرد صفر می‌شود)`)) return;
    await supabase.from("chp_units").update({ last_overhaul: today(), status: "active" }).eq("id", u.id);
    logAction(projectId, profile.id, "ثبت اورهال ژنراتور", u.name); load();
  };
  const remove = async (u: any) => {
    if (await deleteRow("chp_units", u, { projectId, profile, label: "ژنراتور", detail: u.name })) load();
  };

  // ساعت کارکرد از آخرین اورهال (از روی گزارش‌های تولید)
  const hoursSince = (u: any) => gen.filter(g => g.unit_id === u.id && (!u.last_overhaul || (g.log_date || "") >= u.last_overhaul))
    .reduce((s, g) => s + num(g.hours_online), 0);

  const totals = useMemo(() => ({
    elec: units.reduce((s, u) => s + num(u.elec_capacity_kw), 0),
    thermal: units.reduce((s, u) => s + num(u.thermal_capacity_kw), 0),
    active: units.filter(u => u.status === "active").length,
  }), [units]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["تعداد ژنراتور", fmt(units.length)], ["ظرفیت الکتریکی کل", fmt(Math.round(totals.elec)) + " kW"],
          ["ظرفیت حرارتی کل", fmt(Math.round(totals.thermal)) + " kW"], ["در مدار", `${fmt(totals.active)} از ${fmt(units.length)}`]].map(([l, v]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className="mt-1.5 text-lg font-black tracking-tight">{v}</div></div>
        ))}
      </div>

      {canEdit && (
        <div className="card space-y-2">
          <h2 className="font-black">افزودن ژنراتور / یونیت</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <div><label className="label">نام</label><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="label">کد</label><input className="input" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></div>
            <div><label className="label">برند</label><input className="input" value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })} /></div>
            <div><label className="label">مدل</label><input className="input" value={f.model} onChange={e => setF({ ...f, model: e.target.value })} /></div>
            <div><label className="label">نوع موتور</label>
              <select className="input" value={f.engine_type} onChange={e => setF({ ...f, engine_type: e.target.value })}>
                {Object.entries(ENGINE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label">سوخت</label>
              <select className="input" value={f.fuel_type} onChange={e => setF({ ...f, fuel_type: e.target.value })}>
                {Object.entries(FUEL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label">ظرفیت الکتریکی (kW)</label><input className="input" dir="ltr" value={f.elec_capacity_kw} onChange={e => setF({ ...f, elec_capacity_kw: e.target.value })} /></div>
            <div><label className="label">ظرفیت حرارتی (kW)</label><input className="input" dir="ltr" value={f.thermal_capacity_kw} onChange={e => setF({ ...f, thermal_capacity_kw: e.target.value })} /></div>
            <div><label className="label">دوره اورهال (ساعت)</label><input className="input" dir="ltr" value={f.overhaul_interval_hours} onChange={e => setF({ ...f, overhaul_interval_hours: e.target.value })} /></div>
            <div><label className="label">آخرین اورهال</label><DateInput className="input" value={f.last_overhaul} onChange={(v: string) => setF({ ...f, last_overhaul: v })} /></div>
            <div><label className="label">سریال</label><input className="input" value={f.serial} onChange={e => setF({ ...f, serial: e.target.value })} /></div>
            <div><label className="label">تاریخ نصب</label><DateInput className="input" value={f.install_date} onChange={(v: string) => setF({ ...f, install_date: v })} /></div>
          </div>
          <button className="btn-primary" onClick={add}>افزودن ژنراتور</button>
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className="th">ژنراتور</th><th className="th">نوع / سوخت</th><th className="th">ظرفیت برق</th><th className="th">ظرفیت حرارت</th>
            <th className="th">ساعت تا اورهال</th><th className="th">وضعیت</th>{canEdit && <th className="th">اقدام</th>}
          </tr></thead>
          <tbody>
            {units.map(u => {
              const hs = hoursSince(u);
              const remain = Math.max(0, num(u.overhaul_interval_hours) - hs);
              const due = remain < 500;
              return (
                <tr key={u.id}>
                  <td className="td font-bold">{u.name} <span className="text-[10px] text-ink/40">{u.brand} {u.model}</span></td>
                  <td className="td text-xs">{ENGINE_TYPES[u.engine_type] || u.engine_type} · {FUEL_TYPES[u.fuel_type] || u.fuel_type}</td>
                  <td className="td">{fmt(u.elec_capacity_kw)} kW</td>
                  <td className="td">{fmt(u.thermal_capacity_kw)} kW</td>
                  <td className={`td ${due ? "font-bold text-danger" : ""}`}>{fmt(Math.round(remain))} ساعت{due ? " (سررسید)" : ""}</td>
                  <td className="td">
                    {canEdit ? (
                      <select className="input w-28 py-0.5 text-[11px]" value={u.status} onChange={e => setStatus(u, e.target.value)}>
                        {Object.entries(UNIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : <span className={`chip ${u.status === "active" ? "bg-ok/10 text-ok" : u.status === "fault" ? "bg-danger/10 text-danger" : "bg-surface"}`}>{UNIT_STATUS[u.status]}</span>}
                  </td>
                  {canEdit && <td className="td"><span className="flex gap-1">
                    <button className="text-[11px] text-blueprint" onClick={() => doOverhaul(u)}>ثبت اورهال</button>
                    <button className="text-[11px] text-danger" onClick={() => remove(u)}>حذف</button>
                  </span></td>}
                </tr>
              );
            })}
            {units.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 7 : 6}>ژنراتوری ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
