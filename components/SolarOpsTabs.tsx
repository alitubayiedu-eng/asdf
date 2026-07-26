"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, daysBetween } from "@/lib/constants";
import { num } from "@/lib/num";
import { logAction } from "@/lib/log";
import DateInput from "@/components/DateInput";
import ExcelIO from "@/components/ExcelIO";
import PostToAccounting from "@/components/PostToAccounting";
import { printPdf, tbl, kpis, faN, faD, svgHBars, svgPie, svgLines, CH } from "@/lib/export";

const METHODS: Record<string, string> = { wet: "شست‌وشوی تر", dry: "تمیزکاری خشک", robot: "ربات شست‌وشو" };
const today = () => new Date().toISOString().slice(0, 10);

/** شست‌وشو و نظافت پنل‌ها */
export function SolarCleaningTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [arrays, setArrays] = useState<any[]>([]);
  const [f, setF] = useState({ array_id: "", clean_date: today(), method: "wet", crew: "", workers: "", hours: "", water_liters: "", cost: "", before_kwh: "", after_kwh: "", note: "" });

  const load = () => {
    supabase.from("solar_cleaning").select("*").eq("project_id", projectId).order("clean_date", { ascending: false })
      .then(({ data }: any) => setRows(data || []));
    supabase.from("solar_arrays").select("*").eq("project_id", projectId).then(({ data }: any) => setArrays(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    const a = arrays.find(x => x.id === f.array_id);
    await supabase.from("solar_cleaning").insert({
      project_id: projectId, array_id: f.array_id || null, array_name: a?.name || "کل نیروگاه",
      clean_date: f.clean_date, method: f.method, crew: f.crew,
      workers: num(f.workers), hours: num(f.hours), water_liters: num(f.water_liters), cost: num(f.cost),
      before_kwh: num(f.before_kwh) || null, after_kwh: num(f.after_kwh) || null,
      note: f.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت شست‌وشوی پنل",
      `${a?.name || "کل نیروگاه"} — ${METHODS[f.method]}، ${f.hours || 0} ساعت`);
    setF({ ...f, crew: "", workers: "", hours: "", water_liters: "", cost: "", before_kwh: "", after_kwh: "", note: "" });
    load();
  };
  const del = async (r: any) => {
    if (!confirm("این رکورد حذف شود؟")) return;
    await supabase.from("solar_cleaning").delete().eq("id", r.id); load();
  };

  const gain = (r: any) => (r.before_kwh && r.after_kwh && num(r.before_kwh) > 0)
    ? ((num(r.after_kwh) - num(r.before_kwh)) / num(r.before_kwh)) * 100 : null;

  const stat = useMemo(() => {
    const cost = rows.reduce((s, r) => s + num(r.cost), 0);
    const hours = rows.reduce((s, r) => s + num(r.hours), 0);
    const water = rows.reduce((s, r) => s + num(r.water_liters), 0);
    const gains = rows.map(gain).filter(x => x != null) as number[];
    const avgGain = gains.length ? gains.reduce((s, x) => s + x, 0) / gains.length : null;
    const last = rows[0]?.clean_date;
    const since = last ? daysBetween(last, today()) : null;
    return { cost, hours, water, avgGain, since, count: rows.length };
  }, [rows]);

  // آخرین شست‌وشوی هر آرایه
  const perArray = useMemo(() => arrays.map(a => {
    const last = rows.find(r => r.array_id === a.id);
    return { name: a.name, last: last?.clean_date, days: last ? daysBetween(last.clean_date, today()) : null };
  }), [arrays, rows]);

  const cleanPdf = () => {
    const byMethod: Record<string, number> = {};
    for (const r of rows) byMethod[METHODS[r.method] || "—"] = (byMethod[METHODS[r.method] || "—"] || 0) + 1;
    printPdf("گزارش شست‌وشو و نظافت پنل‌ها", "برنامه، هزینه و اثر بر تولید",
      kpis([["دفعات شست‌وشو", faN(stat.count)], ["جمع نفر-ساعت", faN(stat.hours)],
        ["جمع هزینه", faN(Math.round(stat.cost)) + " ریال"],
        ["میانگین افزایش تولید", stat.avgGain == null ? "—" : faN(Math.round(stat.avgGain)) + "٪"]]) +
      (rows.length ? svgPie("روش‌های شست‌وشو", Object.entries(byMethod).map(([name, value]) => ({ name, value }))) : "") +
      (perArray.some(x => x.days != null) ? svgHBars("روزهای گذشته از آخرین شست‌وشوی هر آرایه",
        perArray.filter(x => x.days != null).map(x => ({
          name: x.name, value: x.days!, color: x.days! > 45 ? CH.danger : x.days! > 25 ? CH.accent : CH.ok,
          note: faN(x.days) + " روز پیش" }))) : "") +
      (rows.filter(r => gain(r) != null).length > 1 ? svgLines("اثر شست‌وشو بر تولید (٪ افزایش)",
        rows.filter(r => gain(r) != null).reverse().map(r => faD(r.clean_date)),
        [{ name: "افزایش تولید", color: CH.ok, values: rows.filter(r => gain(r) != null).reverse().map(r => Math.round(gain(r)!)) }], "درصد") : "") +
      "<h2>سوابق شست‌وشو</h2>" + tbl(["تاریخ", "آرایه", "روش", "اکیپ", "نفر", "ساعت", "آب (لیتر)", "هزینه", "اثر بر تولید"],
        rows.map(r => [faD(r.clean_date), r.array_name || "—", METHODS[r.method], r.crew || "—",
          faN(r.workers), faN(r.hours), faN(r.water_liters), faN(r.cost),
          gain(r) == null ? "—" : (gain(r)! > 0 ? "+" : "") + faN(Math.round(gain(r)!)) + "٪"])));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["دفعات شست‌وشو", fmt(stat.count)],
          ["از آخرین شست‌وشو", stat.since == null ? "—" : fmt(stat.since) + " روز"],
          ["جمع نفر-ساعت", fmt(stat.hours)],
          ["جمع هزینه", fmt(Math.round(stat.cost)) + " ریال"],
          ["میانگین افزایش تولید", stat.avgGain == null ? "—" : "+" + Math.round(stat.avgGain).toLocaleString("fa-IR") + "٪"]].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${l === "از آخرین شست‌وشو" && stat.since != null && stat.since > 45 ? "text-danger" : l === "میانگین افزایش تولید" && stat.avgGain ? "text-ok" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* وضعیت هر آرایه */}
      {perArray.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-black">وضعیت شست‌وشوی آرایه‌ها</h2>
          <div className="grid gap-2 md:grid-cols-4">
            {perArray.map(x => (
              <div key={x.name} className={`rounded-lg border p-2 text-sm ${x.days == null || x.days > 45 ? "border-danger/30 bg-danger/[0.04]" : x.days > 25 ? "border-crane/30 bg-crane/[0.04]" : "border-line"}`}>
                <div className="font-bold">{x.name}</div>
                <div className="mt-0.5 text-xs text-ink/55">
                  {x.last ? `${fmtDate(x.last)} · ${fmt(x.days)} روز پیش` : "بدون سابقه شست‌وشو"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card py-2">
        <ExcelIO table="solar_cleaning" projectId={projectId} rows={rows} canEdit={canEdit} profile={profile} onDone={load} pdf={cleanPdf} />
      </div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-6">
          <select className="input" value={f.array_id} onChange={e => setF({ ...f, array_id: e.target.value })}>
            <option value="">کل نیروگاه</option>
            {arrays.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <DateInput value={f.clean_date} onChange={(v: string) => setF({ ...f, clean_date: v })} />
          <select className="input" value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>
            {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" placeholder="اکیپ / پیمانکار" value={f.crew} onChange={e => setF({ ...f, crew: e.target.value })} />
          <input className="input" dir="ltr" placeholder="تعداد نفرات" value={f.workers} onChange={e => setF({ ...f, workers: e.target.value })} />
          <input className="input" dir="ltr" placeholder="ساعت کار" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} />
          <input className="input" dir="ltr" placeholder="آب مصرفی (لیتر)" value={f.water_liters} onChange={e => setF({ ...f, water_liters: e.target.value })} />
          <input className="input" dir="ltr" placeholder="هزینه (ریال)" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} />
          <input className="input" dir="ltr" placeholder="تولید روز قبل (kWh)" value={f.before_kwh} onChange={e => setF({ ...f, before_kwh: e.target.value })} />
          <input className="input" dir="ltr" placeholder="تولید روز بعد (kWh)" value={f.after_kwh} onChange={e => setF({ ...f, after_kwh: e.target.value })} />
          <input className="input" placeholder="توضیح" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
          <button className="btn-primary" onClick={add}>ثبت شست‌وشو</button>
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">تاریخ</th><th className="th">آرایه</th><th className="th">روش</th>
            <th className="th">اکیپ</th><th className="th">نفر / ساعت</th><th className="th">آب</th>
            <th className="th">هزینه</th><th className="th">اثر بر تولید</th>{canEdit && <th className="th"></th>}</tr></thead>
          <tbody>
            {rows.map(r => {
              const g = gain(r);
              return (
                <tr key={r.id}>
                  <td className="td">{fmtDate(r.clean_date)}</td>
                  <td className="td font-bold">{r.array_name || "—"}</td>
                  <td className="td"><span className="chip bg-surface">{METHODS[r.method]}</span></td>
                  <td className="td text-xs">{r.crew || "—"}</td>
                  <td className="td">{fmt(r.workers)} / {fmt(r.hours)}</td>
                  <td className="td">{r.water_liters ? fmt(r.water_liters) + " ل" : "—"}</td>
                  <td className="td">{r.cost ? fmt(r.cost) : "—"}</td>
                  <td className={`td font-bold ${g == null ? "" : g > 0 ? "text-ok" : "text-danger"}`}>
                    {g == null ? "—" : (g > 0 ? "+" : "") + Math.round(g).toLocaleString("fa-IR") + "٪"}
                  </td>
                  {canEdit && <td className="td">
                    <span className="flex items-center gap-1">
                      {num(r.cost) > 0 && <PostToAccounting projectId={projectId} profile={profile} onDone={load} label="هزینه ←"
                        txn={{ type: "expense", amount: num(r.cost), counterparty: r.crew || "پیمانکار نظافت",
                          description: `شست‌وشوی پنل — ${r.array_name || "کل نیروگاه"}`, txn_date: r.clean_date,
                          source_table: "solar_cleaning", source_id: r.id }} />}
                      <button className="text-xs text-danger" onClick={() => del(r)}>حذف</button>
                    </span>
                  </td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-ink/40" colSpan={9}>شست‌وشویی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** خرابی و آلارم اینورترها */
export function SolarFaultsTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [invs, setInvs] = useState<any[]>([]);
  const [f, setF] = useState({ inverter_id: "", fault_date: today(), kind: "", severity: "متوسط", description: "", downtime_hours: "", lost_kwh: "" });

  const load = () => {
    supabase.from("solar_faults").select("*").eq("project_id", projectId).order("fault_date", { ascending: false })
      .then(({ data }: any) => setRows(data || []));
    supabase.from("solar_inverters").select("*").eq("project_id", projectId).then(({ data }: any) => setInvs(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.description && !f.kind) return;
    const i = invs.find(x => x.id === f.inverter_id);
    await supabase.from("solar_faults").insert({
      project_id: projectId, inverter_id: f.inverter_id || null, inverter_name: i?.name || "کل نیروگاه",
      fault_date: f.fault_date, kind: f.kind, severity: f.severity, description: f.description,
      downtime_hours: num(f.downtime_hours), lost_kwh: num(f.lost_kwh), status: "open",
      created_by_name: profile.full_name,
    });
    if (i) await supabase.from("solar_inverters").update({ status: "fault" }).eq("id", i.id);
    logAction(projectId, profile.id, "ثبت خرابی نیروگاه", `${i?.name || "کل نیروگاه"} — ${f.kind || f.description}`);
    setF({ ...f, kind: "", description: "", downtime_hours: "", lost_kwh: "" }); load();
  };

  const close = async (r: any) => {
    const action = prompt("اقدام انجام‌شده برای رفع خرابی:");
    if (action == null) return;
    await supabase.from("solar_faults").update({ status: "closed", action, resolved_date: today() }).eq("id", r.id);
    if (r.inverter_id) await supabase.from("solar_inverters").update({ status: "active" }).eq("id", r.inverter_id);
    logAction(projectId, profile.id, "رفع خرابی نیروگاه", `${r.inverter_name} — ${action.slice(0, 50)}`);
    load();
  };
  const del = async (r: any) => {
    if (!confirm("این رکورد حذف شود؟")) return;
    await supabase.from("solar_faults").delete().eq("id", r.id); load();
  };

  const stat = useMemo(() => ({
    open: rows.filter(r => r.status === "open").length,
    downtime: rows.reduce((s, r) => s + num(r.downtime_hours), 0),
    lost: rows.reduce((s, r) => s + num(r.lost_kwh), 0),
    total: rows.length,
  }), [rows]);

  const byInv = useMemo(() => invs.map(i => ({
    name: i.name, value: rows.filter(r => r.inverter_id === i.id).length,
  })).filter(x => x.value > 0), [invs, rows]);

  const faultPdf = () => {
    const byKind: Record<string, number> = {};
    for (const r of rows) byKind[r.kind || "نامشخص"] = (byKind[r.kind || "نامشخص"] || 0) + 1;
    printPdf("گزارش خرابی و آلارم نیروگاه", "خطاها، زمان توقف و انرژی ازدست‌رفته",
      kpis([["کل خرابی‌ها", faN(stat.total)], ["خرابی باز", faN(stat.open)],
        ["جمع ساعت توقف", faN(stat.downtime)], ["انرژی ازدست‌رفته", faN(Math.round(stat.lost)) + " kWh"]]) +
      (byInv.length ? svgHBars("تعداد خرابی به تفکیک اینورتر",
        byInv.sort((a, b) => b.value - a.value).map(x => ({ ...x, color: CH.danger, note: faN(x.value) + " مورد" }))) : "") +
      (Object.keys(byKind).length ? svgPie("انواع خرابی",
        Object.entries(byKind).map(([name, value]) => ({ name, value }))) : "") +
      "<h2>فهرست خرابی‌ها</h2>" + tbl(["تاریخ", "اینورتر", "نوع", "شدت", "شرح", "توقف (ساعت)", "ازدست‌رفته (kWh)", "وضعیت", "اقدام"],
        rows.map(r => [faD(r.fault_date), r.inverter_name, r.kind || "—", r.severity,
          (r.description || "—").slice(0, 50), faN(r.downtime_hours), faN(r.lost_kwh),
          r.status === "open" ? "باز" : "رفع‌شده", (r.action || "—").slice(0, 40)])));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["کل خرابی‌ها", fmt(stat.total)], ["خرابی باز", fmt(stat.open)],
          ["جمع ساعت توقف", fmt(stat.downtime)], ["انرژی ازدست‌رفته", fmt(Math.round(stat.lost)) + " kWh"]].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${(l === "خرابی باز" && stat.open > 0) || l === "انرژی ازدست‌رفته" ? "text-danger" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card py-2">
        <ExcelIO table="solar_faults" projectId={projectId} rows={rows} canEdit={canEdit} profile={profile} onDone={load} pdf={faultPdf} />
      </div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-6">
          <select className="input" value={f.inverter_id} onChange={e => setF({ ...f, inverter_id: e.target.value })}>
            <option value="">کل نیروگاه</option>
            {invs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <DateInput value={f.fault_date} onChange={(v: string) => setF({ ...f, fault_date: v })} />
          <input className="input" placeholder="نوع خطا (قطع DC، اضافه دما…)" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} />
          <select className="input" value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}>
            <option>کم</option><option>متوسط</option><option>زیاد</option><option>بحرانی</option>
          </select>
          <input className="input" dir="ltr" placeholder="ساعت توقف" value={f.downtime_hours} onChange={e => setF({ ...f, downtime_hours: e.target.value })} />
          <input className="input" dir="ltr" placeholder="انرژی ازدست‌رفته (kWh)" value={f.lost_kwh} onChange={e => setF({ ...f, lost_kwh: e.target.value })} />
          <input className="input md:col-span-5" placeholder="شرح خرابی" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <button className="btn-primary" onClick={add}>ثبت خرابی</button>
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead><tr><th className="th">تاریخ</th><th className="th">اینورتر</th><th className="th">نوع</th>
            <th className="th">شدت</th><th className="th">شرح</th><th className="th">توقف</th>
            <th className="th">ازدست‌رفته</th><th className="th">وضعیت</th>{canEdit && <th className="th"></th>}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="td">{fmtDate(r.fault_date)}</td>
                <td className="td font-bold">{r.inverter_name}</td>
                <td className="td">{r.kind || "—"}</td>
                <td className="td"><span className={`chip ${["بحرانی", "زیاد"].includes(r.severity) ? "bg-danger/10 text-danger" : "bg-surface"}`}>{r.severity}</span></td>
                <td className="td max-w-56 truncate text-xs" title={r.description}>{r.description || "—"}</td>
                <td className="td">{r.downtime_hours ? fmt(r.downtime_hours) + " س" : "—"}</td>
                <td className="td text-danger">{r.lost_kwh ? fmt(r.lost_kwh) : "—"}</td>
                <td className="td">
                  {r.status === "open"
                    ? (canEdit ? <button className="btn-primary py-0.5 text-xs" onClick={() => close(r)}>رفع شد</button> : <span className="chip bg-danger/10 text-danger">باز</span>)
                    : <span className="chip bg-ok/10 text-ok" title={r.action}>رفع‌شده {fmtDate(r.resolved_date)}</span>}
                </td>
                {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => del(r)}>حذف</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-ok" colSpan={9}>خرابی‌ای ثبت نشده است. ✓</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
