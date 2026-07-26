"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { num } from "@/lib/num";
import { logAction } from "@/lib/log";
import DateInput from "@/components/DateInput";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgBars, svgHBars, svgPie, CH } from "@/lib/export";

const today = () => new Date().toISOString().slice(0, 10);

export default function SolarGenerationTab({ projectId, profile, canEdit }: any) {
  const [invs, setInvs] = useState<any[]>([]);
  const [arrays, setArrays] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<"bulk" | "single">("bulk");
  const [d, setD] = useState(today());
  const [irr, setIrr] = useState("");
  const [temp, setTemp] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [f, setF] = useState({ inverter_id: "", log_date: today(), kwh: "", peak_kw: "", hours_online: "", irradiance: "", temp_c: "", note: "" });

  const load = () => {
    supabase.from("solar_inverters").select("*").eq("project_id", projectId).order("name")
      .then(({ data }: any) => setInvs(data || []));
    supabase.from("solar_arrays").select("*").eq("project_id", projectId)
      .then(({ data }: any) => setArrays(data || []));
    supabase.from("solar_generation").select("*").eq("project_id", projectId)
      .order("log_date", { ascending: false }).limit(600)
      .then(({ data }: any) => setRows(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const kwp = useMemo(() => arrays.reduce((s, a) => s + num(a.panel_watt) * num(a.panel_count) / 1000, 0), [arrays]);

  /** ثبت گروهی: یک ردیف برای هر اینورتر در یک روز */
  const saveBulk = async () => {
    const list = invs.filter(i => num(vals[i.id]) > 0).map(i => ({
      project_id: projectId, inverter_id: i.id, inverter_name: i.name, log_date: d,
      kwh: num(vals[i.id]), irradiance: num(irr) || null, temp_c: num(temp) || null,
      created_by_name: profile.full_name,
    }));
    if (!list.length) { alert("برای حداقل یک اینورتر مقدار وارد کنید."); return; }
    await supabase.from("solar_generation").insert(list);
    logAction(projectId, profile.id, "ثبت تولید نیروگاه",
      `${fmtDate(d)} — ${list.length} اینورتر، ${fmt(list.reduce((s, x) => s + x.kwh, 0))} kWh`);
    setVals({}); setIrr(""); setTemp(""); load();
  };

  const saveSingle = async () => {
    const i = invs.find(x => x.id === f.inverter_id);
    if (!i || !num(f.kwh)) return;
    await supabase.from("solar_generation").insert({
      project_id: projectId, inverter_id: i.id, inverter_name: i.name, log_date: f.log_date,
      kwh: num(f.kwh), peak_kw: num(f.peak_kw), hours_online: num(f.hours_online),
      irradiance: num(f.irradiance) || null, temp_c: num(f.temp_c) || null, note: f.note,
      created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت تولید اینورتر", `${i.name} — ${f.kwh} kWh`);
    setF({ ...f, kwh: "", peak_kw: "", hours_online: "", note: "" }); load();
  };

  const del = async (r: any) => {
    if (!confirm("این رکورد حذف شود؟")) return;
    await supabase.from("solar_generation").delete().eq("id", r.id); load();
  };

  // ---------- تحلیل ----------
  const days = useMemo(() => {
    const m: Record<string, { kwh: number; irr: number; n: number }> = {};
    for (const r of rows) {
      const k = r.log_date;
      m[k] = m[k] || { kwh: 0, irr: 0, n: 0 };
      m[k].kwh += num(r.kwh);
      if (r.irradiance) { m[k].irr = num(r.irradiance); }
      m[k].n++;
    }
    return Object.entries(m).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const month = today().slice(0, 7);
  const stat = useMemo(() => {
    const md = days.filter(x => x.date.startsWith(month));
    const kwh = md.reduce((s, x) => s + x.kwh, 0);
    const tdy = days.find(x => x.date === today())?.kwh || 0;
    const irrSum = md.reduce((s, x) => s + x.irr, 0);
    // ضریب عملکرد: تولید واقعی ÷ (ظرفیت × تابش)
    const pr = kwp && irrSum ? (kwh / (kwp * irrSum)) * 100 : null;
    // بازده ویژه kWh بر هر کیلووات‌پیک
    const yieldSp = kwp ? kwh / kwp : 0;
    const cuf = kwp && md.length ? (kwh / (kwp * 24 * md.length)) * 100 : null;
    return { kwh, tdy, pr, yieldSp, cuf, days: md.length };
  }, [days, kwp]);

  const byInv = useMemo(() => invs.map(i => ({
    name: i.name,
    kwh: rows.filter(r => r.inverter_id === i.id && String(r.log_date).startsWith(month)).reduce((s, r) => s + num(r.kwh), 0),
    cap: num(i.capacity_kw),
  })), [invs, rows]);

  const genPdf = () => {
    const last = days.slice(-30);
    printPdf("گزارش تولید نیروگاه خورشیدی", `ظرفیت نصب‌شده ${faN(Math.round(kwp))} کیلووات‌پیک`,
      kpis([["تولید امروز", faN(Math.round(stat.tdy)) + " kWh"], ["تولید ماه", faN(Math.round(stat.kwh)) + " kWh"],
        ["ضریب عملکرد (PR)", stat.pr ? faN(Math.round(stat.pr)) + "٪" : "—"],
        ["بازده ویژه", faN(Math.round(stat.yieldSp)) + " kWh/kWp"]]) +
      (last.length > 1 ? svgLines("روند تولید روزانه", last.map(x => faD(x.date)),
        [{ name: "تولید (kWh)", color: CH.primary, values: last.map(x => Math.round(x.kwh)) }], "kWh") : "") +
      (last.some(x => x.irr) ? svgLines("تابش خورشید روزانه", last.map(x => faD(x.date)),
        [{ name: "تابش (kWh/m²)", color: CH.accent, values: last.map(x => x.irr) }]) : "") +
      (byInv.some(x => x.kwh) ? svgBars("تولید ماه به تفکیک اینورتر", byInv.map(x => x.name),
        [{ name: "تولید (kWh)", color: CH.primary, values: byInv.map(x => Math.round(x.kwh)) }]) : "") +
      (byInv.some(x => x.cap) ? svgHBars("بازده ویژه هر اینورتر (kWh بر kW ظرفیت)", byInv.filter(x => x.cap).map(x => ({
        name: x.name, value: Math.round(x.kwh / x.cap), note: faN(Math.round(x.kwh / x.cap)) + " kWh/kW" }))) : "") +
      "<h2>ریز تولید روزانه</h2>" + tbl(["تاریخ", "تولید (kWh)", "تابش (kWh/m²)", "تعداد اینورتر"],
        days.slice(-45).reverse().map(x => [faD(x.date), faN(Math.round(x.kwh)), x.irr || "—", faN(x.n)])));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["تولید امروز", fmt(Math.round(stat.tdy)) + " kWh"],
          ["تولید این ماه", fmt(Math.round(stat.kwh)) + " kWh"],
          ["ضریب عملکرد (PR)", stat.pr == null ? "—" : Math.round(stat.pr).toLocaleString("fa-IR") + "٪"],
          ["بازده ویژه", fmt(Math.round(stat.yieldSp)) + " kWh/kWp"],
          ["ضریب ظرفیت (CUF)", stat.cuf == null ? "—" : Math.round(stat.cuf).toLocaleString("fa-IR") + "٪"]].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${l === "ضریب عملکرد (PR)" && stat.pr != null ? (stat.pr >= 75 ? "text-ok" : "text-danger") : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card py-2">
        <ExcelIO table="solar_generation" projectId={projectId} rows={rows} canEdit={canEdit} profile={profile} onDone={load} pdf={genPdf} />
      </div>

      {canEdit && invs.length > 0 && (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black">ثبت تولید</h2>
            <button className={`chip ${mode === "bulk" ? "chip-on" : "border border-line"}`} onClick={() => setMode("bulk")}>
              ثبت گروهی همه اینورترها
            </button>
            <button className={`chip ${mode === "single" ? "chip-on" : "border border-line"}`} onClick={() => setMode("single")}>
              ثبت تکی با جزئیات
            </button>
          </div>

          {mode === "bulk" ? (
            <>
              <div className="grid gap-2 md:grid-cols-4">
                <div><label className="label">تاریخ</label><DateInput value={d} onChange={setD} /></div>
                <div><label className="label">تابش روز (kWh/m²)</label>
                  <input className="input" dir="ltr" placeholder="۵٫۲" value={irr} onChange={e => setIrr(e.target.value)} /></div>
                <div><label className="label">میانگین دما (°C)</label>
                  <input className="input" dir="ltr" value={temp} onChange={e => setTemp(e.target.value)} /></div>
                <div className="self-end"><button className="btn-primary w-full justify-center" onClick={saveBulk}>ثبت تولید روز</button></div>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {invs.map(i => (
                  <label key={i.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                    <span className="flex-1 truncate text-xs font-bold">{i.name}
                      <span className="mr-1 text-[10px] font-normal text-ink/40">{fmt(i.capacity_kw)} kW</span></span>
                    <input className="input w-24 py-1 text-xs" dir="ltr" placeholder="kWh"
                      value={vals[i.id] || ""} onChange={e => setVals({ ...vals, [i.id]: e.target.value })} />
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="grid gap-2 md:grid-cols-7">
              <select className="input md:col-span-2" value={f.inverter_id} onChange={e => setF({ ...f, inverter_id: e.target.value })}>
                <option value="">اینورتر…</option>
                {invs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <DateInput value={f.log_date} onChange={(v: string) => setF({ ...f, log_date: v })} />
              <input className="input" dir="ltr" placeholder="تولید (kWh)" value={f.kwh} onChange={e => setF({ ...f, kwh: e.target.value })} />
              <input className="input" dir="ltr" placeholder="اوج توان (kW)" value={f.peak_kw} onChange={e => setF({ ...f, peak_kw: e.target.value })} />
              <input className="input" dir="ltr" placeholder="ساعت کارکرد" value={f.hours_online} onChange={e => setF({ ...f, hours_online: e.target.value })} />
              <button className="btn-primary" onClick={saveSingle}>ثبت</button>
              <input className="input md:col-span-3" placeholder="توضیح" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
              <input className="input" dir="ltr" placeholder="تابش" value={f.irradiance} onChange={e => setF({ ...f, irradiance: e.target.value })} />
              <input className="input" dir="ltr" placeholder="دما °C" value={f.temp_c} onChange={e => setF({ ...f, temp_c: e.target.value })} />
            </div>
          )}
        </div>
      )}
      {invs.length === 0 && <p className="card text-sm text-ink/40">ابتدا در تب «پنل‌ها و اینورترها» اینورتر تعریف کنید.</p>}

      {/* خلاصه روزانه */}
      <div className="card overflow-auto p-0">
        <div className="p-3 font-black">تولید روزانه (جمع همه اینورترها)</div>
        <table className="w-full">
          <thead><tr><th className="th">تاریخ</th><th className="th">تولید (kWh)</th><th className="th">تابش</th>
            <th className="th">بازده ویژه</th><th className="th">اینورتر ثبت‌شده</th></tr></thead>
          <tbody>
            {days.slice().reverse().slice(0, 30).map(x => (
              <tr key={x.date}>
                <td className="td">{fmtDate(x.date)}</td>
                <td className="td font-black text-ok">{fmt(Math.round(x.kwh))}</td>
                <td className="td">{x.irr || "—"}</td>
                <td className="td">{kwp ? (x.kwh / kwp).toFixed(1).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]) : "—"}</td>
                <td className="td">{fmt(x.n)}</td>
              </tr>
            ))}
            {days.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>تولیدی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ریز رکوردها */}
      <div className="card overflow-auto p-0">
        <div className="p-3 font-black">ریز رکوردهای اینورترها</div>
        <table className="w-full">
          <thead><tr><th className="th">تاریخ</th><th className="th">اینورتر</th><th className="th">kWh</th>
            <th className="th">اوج (kW)</th><th className="th">ساعت</th><th className="th">ثبت</th>{canEdit && <th className="th"></th>}</tr></thead>
          <tbody>
            {rows.slice(0, 60).map(r => (
              <tr key={r.id}>
                <td className="td">{fmtDate(r.log_date)}</td>
                <td className="td font-bold">{r.inverter_name}</td>
                <td className="td font-black">{fmt(r.kwh)}</td>
                <td className="td">{r.peak_kw ? fmt(r.peak_kw) : "—"}</td>
                <td className="td">{r.hours_online ? fmt(r.hours_online) : "—"}</td>
                <td className="td text-xs text-ink/50">{r.created_by_name}</td>
                {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => del(r)}>حذف</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
