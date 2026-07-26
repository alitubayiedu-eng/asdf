"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { num } from "@/lib/num";
import { logAction } from "@/lib/log";
import DateInput from "@/components/DateInput";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, CH } from "@/lib/export";

const INV_STATUS: Record<string, string> = {
  active: "در مدار", fault: "خطا", maintenance: "در تعمیر", off: "خارج از مدار",
};

export default function SolarAssetsTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"arrays" | "inverters">("arrays");
  const [arrays, setArrays] = useState<any[]>([]);
  const [invs, setInvs] = useState<any[]>([]);
  const [gen, setGen] = useState<any[]>([]);
  const [af, setAf] = useState({ name: "", panel_brand: "", panel_model: "", panel_watt: "", panel_count: "", tilt: "", azimuth: "", install_date: "", warranty_years: "", note: "" });
  const [inf, setInf] = useState({ name: "", code: "", brand: "", model: "", capacity_kw: "", serial: "", array_id: "", install_date: "", status: "active", note: "" });

  const load = () => {
    supabase.from("solar_arrays").select("*").eq("project_id", projectId).order("name").then(({ data }: any) => setArrays(data || []));
    supabase.from("solar_inverters").select("*").eq("project_id", projectId).order("name").then(({ data }: any) => setInvs(data || []));
    supabase.from("solar_generation").select("inverter_id, kwh").eq("project_id", projectId).then(({ data }: any) => setGen(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const kwpOf = (a: any) => num(a.panel_watt) * num(a.panel_count) / 1000;
  const totalKwp = useMemo(() => arrays.reduce((s, a) => s + kwpOf(a), 0), [arrays]);
  const totalPanels = useMemo(() => arrays.reduce((s, a) => s + num(a.panel_count), 0), [arrays]);
  const invKw = useMemo(() => invs.reduce((s, i) => s + num(i.capacity_kw), 0), [invs]);
  const genOf = (id: string) => gen.filter(g => g.inverter_id === id).reduce((s, g) => s + num(g.kwh), 0);

  const addArray = async () => {
    if (!af.name) return;
    await supabase.from("solar_arrays").insert({
      project_id: projectId, name: af.name, panel_brand: af.panel_brand, panel_model: af.panel_model,
      panel_watt: num(af.panel_watt), panel_count: num(af.panel_count),
      tilt: num(af.tilt) || null, azimuth: num(af.azimuth) || null,
      install_date: af.install_date || null, warranty_years: num(af.warranty_years) || null, note: af.note,
    });
    logAction(projectId, profile.id, "ثبت آرایه پنل", `${af.name} — ${af.panel_count} پنل ${af.panel_watt}W`);
    setAf({ name: "", panel_brand: "", panel_model: "", panel_watt: "", panel_count: "", tilt: "", azimuth: "", install_date: "", warranty_years: "", note: "" });
    load();
  };

  const addInv = async () => {
    if (!inf.name) return;
    await supabase.from("solar_inverters").insert({
      project_id: projectId, name: inf.name, code: inf.code, brand: inf.brand, model: inf.model,
      capacity_kw: num(inf.capacity_kw), serial: inf.serial,
      array_id: inf.array_id || null, install_date: inf.install_date || null,
      status: inf.status, note: inf.note,
    });
    logAction(projectId, profile.id, "ثبت اینورتر", `${inf.name} — ${inf.capacity_kw} kW`);
    setInf({ name: "", code: "", brand: "", model: "", capacity_kw: "", serial: "", array_id: "", install_date: "", status: "active", note: "" });
    load();
  };

  const setStatus = async (i: any, status: string) => {
    await supabase.from("solar_inverters").update({ status }).eq("id", i.id);
    logAction(projectId, profile.id, "تغییر وضعیت اینورتر", `${i.name} → ${INV_STATUS[status]}`);
    load();
  };
  const del = async (t: string, r: any, label: string) => {
    if (!confirm(`«${label}» حذف شود؟`)) return;
    await supabase.from(t).delete().eq("id", r.id); load();
  };

  const assetPdf = () => {
    const st: Record<string, number> = {};
    for (const i of invs) st[INV_STATUS[i.status] || "—"] = (st[INV_STATUS[i.status] || "—"] || 0) + 1;
    printPdf("شناسنامه تجهیزات نیروگاه", "آرایه‌های پنل و اینورترها",
      kpis([["ظرفیت نصب‌شده", faN(Math.round(totalKwp)) + " kWp"], ["تعداد پنل", faN(totalPanels)],
        ["اینورترها", faN(invs.length)], ["ظرفیت اینورتر", faN(Math.round(invKw)) + " kW"]]) +
      (arrays.length ? svgPie("سهم آرایه‌ها از ظرفیت نصب",
        arrays.map(a => ({ name: a.name, value: Math.round(kwpOf(a)) }))) : "") +
      (invs.length ? svgPie("وضعیت اینورترها", Object.entries(st).map(([name, value]) => ({ name, value }))) : "") +
      (invs.some(i => genOf(i.id)) ? svgHBars("تولید تجمعی هر اینورتر", invs.map(i => ({
        name: i.name, value: Math.round(genOf(i.id)), note: faN(Math.round(genOf(i.id))) + " kWh" }))) : "") +
      "<h2>آرایه‌های پنل</h2>" + tbl(["آرایه", "برند / مدل", "توان پنل", "تعداد", "ظرفیت (kWp)", "شیب", "نصب", "گارانتی"],
        arrays.map(a => [a.name, `${a.panel_brand || "—"} ${a.panel_model || ""}`, faN(a.panel_watt) + "W",
          faN(a.panel_count), faN(Math.round(kwpOf(a))), a.tilt ? faN(a.tilt) + "°" : "—",
          faD(a.install_date), a.warranty_years ? faN(a.warranty_years) + " سال" : "—"])) +
      "<h2>اینورترها</h2>" + tbl(["اینورتر", "کد", "برند / مدل", "ظرفیت (kW)", "سریال", "آرایه", "وضعیت", "تولید تجمعی"],
        invs.map(i => [i.name, i.code || "—", `${i.brand || "—"} ${i.model || ""}`, faN(i.capacity_kw),
          i.serial || "—", arrays.find(a => a.id === i.array_id)?.name || "—",
          INV_STATUS[i.status], faN(Math.round(genOf(i.id))) + " kWh"])));
  };

  const dcac = invKw ? totalKwp / invKw : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["ظرفیت نصب‌شده", fmt(Math.round(totalKwp)) + " kWp"],
          ["تعداد پنل", fmt(totalPanels)],
          ["اینورترها", fmt(invs.length)],
          ["ظرفیت اینورتر", fmt(Math.round(invKw)) + " kW"],
          ["نسبت DC/AC", dcac ? dcac.toFixed(2).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]) : "—"]].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className="mt-1.5 text-xl font-black tracking-tight">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={`chip ${sub === "arrays" ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub("arrays")}>
          آرایه‌های پنل ({arrays.length.toLocaleString("fa-IR")})
        </button>
        <button className={`chip ${sub === "inverters" ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub("inverters")}>
          اینورترها ({invs.length.toLocaleString("fa-IR")})
        </button>
      </div>

      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load} pdf={assetPdf}
          table={sub === "arrays" ? "solar_arrays" : "solar_inverters"} rows={sub === "arrays" ? arrays : invs} />
      </div>

      {/* ───────── آرایه‌های پنل ───────── */}
      {sub === "arrays" && (<>
        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-6">
            <input className="input md:col-span-2" placeholder="نام آرایه (مثلاً بلوک A)" value={af.name} onChange={e => setAf({ ...af, name: e.target.value })} />
            <input className="input" placeholder="برند پنل" value={af.panel_brand} onChange={e => setAf({ ...af, panel_brand: e.target.value })} />
            <input className="input" placeholder="مدل پنل" value={af.panel_model} onChange={e => setAf({ ...af, panel_model: e.target.value })} />
            <input className="input" dir="ltr" placeholder="توان هر پنل (W)" value={af.panel_watt} onChange={e => setAf({ ...af, panel_watt: e.target.value })} />
            <input className="input" dir="ltr" placeholder="تعداد پنل" value={af.panel_count} onChange={e => setAf({ ...af, panel_count: e.target.value })} />
            <input className="input" dir="ltr" placeholder="زاویه شیب (°)" value={af.tilt} onChange={e => setAf({ ...af, tilt: e.target.value })} />
            <input className="input" dir="ltr" placeholder="آزیموت (°)" value={af.azimuth} onChange={e => setAf({ ...af, azimuth: e.target.value })} />
            <DateInput value={af.install_date} onChange={(v: string) => setAf({ ...af, install_date: v })} placeholder="تاریخ نصب" />
            <input className="input" dir="ltr" placeholder="گارانتی (سال)" value={af.warranty_years} onChange={e => setAf({ ...af, warranty_years: e.target.value })} />
            <button className="btn-primary md:col-span-2" onClick={addArray}>ثبت آرایه</button>
          </div>
        )}
        <div className="card overflow-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">آرایه</th><th className="th">برند / مدل</th><th className="th">توان پنل</th>
              <th className="th">تعداد</th><th className="th">ظرفیت</th><th className="th">شیب / آزیموت</th>
              <th className="th">نصب</th><th className="th">گارانتی</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {arrays.map(a => (
                <tr key={a.id}>
                  <td className="td font-black">{a.name}</td>
                  <td className="td text-xs">{a.panel_brand} {a.panel_model}</td>
                  <td className="td">{fmt(a.panel_watt)} W</td>
                  <td className="td">{fmt(a.panel_count)}</td>
                  <td className="td font-bold text-primary">{fmt(Math.round(kwpOf(a)))} kWp</td>
                  <td className="td text-xs">{a.tilt ? `${fmt(a.tilt)}° / ${fmt(a.azimuth)}°` : "—"}</td>
                  <td className="td">{fmtDate(a.install_date)}</td>
                  <td className="td">{a.warranty_years ? fmt(a.warranty_years) + " سال" : "—"}</td>
                  {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => del("solar_arrays", a, a.name)}>حذف</button></td>}
                </tr>
              ))}
              {arrays.length === 0 && <tr><td className="td text-ink/40" colSpan={9}>آرایه‌ای ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {/* ───────── اینورترها ───────── */}
      {sub === "inverters" && (<>
        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-6">
            <input className="input" placeholder="نام اینورتر" value={inf.name} onChange={e => setInf({ ...inf, name: e.target.value })} />
            <input className="input" placeholder="کد" value={inf.code} onChange={e => setInf({ ...inf, code: e.target.value })} />
            <input className="input" placeholder="برند" value={inf.brand} onChange={e => setInf({ ...inf, brand: e.target.value })} />
            <input className="input" placeholder="مدل" value={inf.model} onChange={e => setInf({ ...inf, model: e.target.value })} />
            <input className="input" dir="ltr" placeholder="ظرفیت (kW)" value={inf.capacity_kw} onChange={e => setInf({ ...inf, capacity_kw: e.target.value })} />
            <input className="input" dir="ltr" placeholder="سریال" value={inf.serial} onChange={e => setInf({ ...inf, serial: e.target.value })} />
            <select className="input" value={inf.array_id} onChange={e => setInf({ ...inf, array_id: e.target.value })}>
              <option value="">آرایه متصل…</option>
              {arrays.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <DateInput value={inf.install_date} onChange={(v: string) => setInf({ ...inf, install_date: v })} placeholder="تاریخ نصب" />
            <select className="input" value={inf.status} onChange={e => setInf({ ...inf, status: e.target.value })}>
              {Object.entries(INV_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn-primary" onClick={addInv}>ثبت اینورتر</button>
          </div>
        )}
        <div className="card overflow-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">اینورتر</th><th className="th">برند / مدل</th><th className="th">ظرفیت</th>
              <th className="th">سریال</th><th className="th">آرایه</th><th className="th">تولید تجمعی</th>
              <th className="th">وضعیت</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {invs.map(i => (
                <tr key={i.id}>
                  <td className="td font-black">{i.name} {i.code && <span className="code-chip">{i.code}</span>}</td>
                  <td className="td text-xs">{i.brand} {i.model}</td>
                  <td className="td font-bold">{fmt(i.capacity_kw)} kW</td>
                  <td className="td text-xs" dir="ltr">{i.serial || "—"}</td>
                  <td className="td text-xs">{arrays.find(a => a.id === i.array_id)?.name || "—"}</td>
                  <td className="td text-ok">{fmt(Math.round(genOf(i.id)))} kWh</td>
                  <td className="td">
                    {canEdit ? (
                      <select className="input w-32 py-0.5 text-xs" value={i.status} onChange={e => setStatus(i, e.target.value)}>
                        {Object.entries(INV_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span className={`chip ${i.status === "active" ? "bg-ok/10 text-ok" : i.status === "fault" ? "bg-danger/10 text-danger" : "bg-surface"}`}>
                        {INV_STATUS[i.status]}
                      </span>
                    )}
                  </td>
                  {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => del("solar_inverters", i, i.name)}>حذف</button></td>}
                </tr>
              ))}
              {invs.length === 0 && <tr><td className="td text-ink/40" colSpan={8}>اینورتری ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}
