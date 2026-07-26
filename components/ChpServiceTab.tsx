"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";

const today = () => new Date().toISOString().slice(0, 10);
export const SERVICE_KINDS: Record<string, { label: string; h: number }> = {
  oil: { label: "تعویض روغن", h: 2000 }, oil_filter: { label: "فیلتر روغن", h: 2000 },
  air_filter: { label: "فیلتر هوا", h: 4000 }, spark_plug: { label: "شمع‌ها", h: 4000 },
  coolant: { label: "مایع خنک‌کننده", h: 8000 }, top_overhaul: { label: "اورهال جزئی (Top)", h: 30000 },
  major_overhaul: { label: "اورهال کلی (Major)", h: 60000 }, inspection: { label: "بازرسی", h: 1000 }, other: { label: "سایر", h: 2000 },
};

export default function ChpServiceTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"service" | "emissions">("service");
  const [maint, setMaint] = useState<any[]>([]);
  const [emis, setEmis] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [gen, setGen] = useState<any[]>([]);
  const [mf, setMf] = useState<any>({ unit_id: "", kind: "oil", interval_hours: "2000", service_date: today(), cost: "", parts: "", note: "" });
  const [ef, setEf] = useState<any>({ unit_id: "", log_date: today(), nox: "", co: "", co2_ton: "", nox_limit: "500", note: "" });

  const load = async () => {
    const { data: m } = await supabase.from("chp_maintenance").select("*").eq("project_id", projectId).order("service_date", { ascending: false }).limit(3000);
    setMaint(m || []);
    const { data: e } = await supabase.from("chp_emissions").select("*").eq("project_id", projectId).order("log_date", { ascending: false }).limit(3000);
    setEmis(e || []);
    supabase.from("chp_units").select("*").eq("project_id", projectId).then(({ data }: any) => setUnits(data || []));
    supabase.from("chp_generation").select("unit_id, log_date, hours_online").eq("project_id", projectId).limit(50000).then(({ data }: any) => setGen(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  // ساعت کارکرد از تاریخ مشخص (از روی گزارش تولید)
  const hoursSince = (unitId: string, sinceDate?: string) => gen
    .filter(g => g.unit_id === unitId && (!sinceDate || (g.log_date || "") >= sinceDate))
    .reduce((s, g) => s + num(g.hours_online), 0);

  // آخرین سرویس هر (یونیت، نوع) و وضعیت سررسید
  const schedule = useMemo(() => {
    const latest: Record<string, any> = {};
    for (const r of maint) { const key = `${r.unit_id}|${r.kind}`; if (!latest[key]) latest[key] = r; }
    return Object.values(latest).map((r: any) => {
      const hs = hoursSince(r.unit_id, r.service_date);
      const remain = num(r.interval_hours) - hs;
      return { ...r, hs, remain, due: remain <= 0 };
    }).sort((a: any, b: any) => a.remain - b.remain);
  }, [maint, gen]);

  const addService = async () => {
    if (!mf.unit_id) return;
    const u = units.find(x => x.id === mf.unit_id);
    await supabase.from("chp_maintenance").insert({
      project_id: projectId, unit_id: mf.unit_id, unit_name: u?.name || "",
      kind: mf.kind, interval_hours: num(mf.interval_hours) || SERVICE_KINDS[mf.kind].h,
      service_date: mf.service_date, hours_at_service: hoursSince(mf.unit_id),
      cost: num(mf.cost), parts: mf.parts, note: mf.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت سرویس CHP", `${u?.name || ""} — ${SERVICE_KINDS[mf.kind].label}`);
    setMf({ ...mf, cost: "", parts: "", note: "" }); load();
  };
  const addEmission = async () => {
    const u = units.find(x => x.id === ef.unit_id);
    await supabase.from("chp_emissions").insert({
      project_id: projectId, unit_id: ef.unit_id || null, unit_name: u?.name || "کل نیروگاه",
      log_date: ef.log_date, nox: num(ef.nox), co: num(ef.co), co2_ton: num(ef.co2_ton),
      nox_limit: num(ef.nox_limit) || 500, note: ef.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت انتشار CHP", `NOx ${fmt(num(ef.nox))} mg/Nm³`);
    setEf({ ...ef, nox: "", co: "", co2_ton: "", note: "" }); load();
  };
  const rm = async (t: string, r: any, set: any) => {
    if (await deleteRow(t, r, { projectId, profile, label: t === "chp_emissions" ? "رکورد انتشار" : "سرویس" })) load();
  };

  const dueCount = schedule.filter(s => s.due).length;
  const co2Month = emis.filter(e => (e.log_date || "").startsWith(today().slice(0, 7))).reduce((s, e) => s + num(e.co2_ton), 0);
  const overLimit = emis.filter(e => num(e.nox) > num(e.nox_limit)).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={`chip ${sub === "service" ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub("service")}>سرویس دوره‌ای</button>
        <button className={`chip ${sub === "emissions" ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub("emissions")}>انتشار و محیط‌زیست</button>
      </div>

      {sub === "service" && (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[["سرویس‌های سررسیدشده", fmt(dueCount), dueCount > 0 ? "text-danger" : "text-ok"],
            ["جمع هزینه سرویس", fmt(maint.reduce((s, r) => s + num(r.cost), 0)) + " ریال", ""],
            ["تعداد رکورد سرویس", fmt(maint.length), ""]].map(([l, v, c]) => (
            <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
          ))}
        </div>

        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-7">
            <select className="input" value={mf.unit_id} onChange={e => setMf({ ...mf, unit_id: e.target.value })}>
              <option value="">ژنراتور…</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select className="input" value={mf.kind} onChange={e => setMf({ ...mf, kind: e.target.value, interval_hours: String(SERVICE_KINDS[e.target.value].h) })}>
              {Object.entries(SERVICE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input className="input" dir="ltr" placeholder="دوره (ساعت)" value={mf.interval_hours} onChange={e => setMf({ ...mf, interval_hours: e.target.value })} />
            <DateInput className="input" value={mf.service_date} onChange={(v: string) => setMf({ ...mf, service_date: v })} />
            <input className="input" dir="ltr" placeholder="هزینه (ریال)" value={mf.cost} onChange={e => setMf({ ...mf, cost: e.target.value })} />
            <input className="input" placeholder="قطعات مصرفی" value={mf.parts} onChange={e => setMf({ ...mf, parts: e.target.value })} />
            <button className="btn-primary" onClick={addService}>ثبت سرویس</button>
          </div>
        )}

        <div className="card overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 text-sm font-black">برنامه سرویس (بر مبنای ساعت کارکرد)</div>
          <table className="w-full">
            <thead className="bg-surface"><tr><th className="th">ژنراتور</th><th className="th">نوع سرویس</th><th className="th">آخرین سرویس</th><th className="th">ساعت از سرویس</th><th className="th">ساعت تا سرویس بعد</th><th className="th">وضعیت</th></tr></thead>
            <tbody>
              {schedule.map((s: any) => (
                <tr key={`${s.unit_id}|${s.kind}`}>
                  <td className="td font-bold">{s.unit_name}</td>
                  <td className="td">{SERVICE_KINDS[s.kind]?.label || s.kind}</td>
                  <td className="td">{fmtDate(s.service_date)}</td>
                  <td className="td">{fmt(Math.round(s.hs))}</td>
                  <td className={`td font-bold ${s.due ? "text-danger" : s.remain < 200 ? "text-crane" : ""}`}>{fmt(Math.round(s.remain))}</td>
                  <td className="td">{s.due ? <span className="chip bg-danger/10 text-danger">سررسید</span> : <span className="chip bg-ok/10 text-ok">عادی</span>}</td>
                </tr>
              ))}
              {schedule.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>سرویسی ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 text-sm font-black">سوابق سرویس</div>
          <table className="w-full">
            <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">ژنراتور</th><th className="th">نوع</th><th className="th">قطعات</th><th className="th">هزینه</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {maint.map(r => (
                <tr key={r.id}>
                  <td className="td">{fmtDate(r.service_date)}</td><td className="td font-bold">{r.unit_name}</td>
                  <td className="td">{SERVICE_KINDS[r.kind]?.label || r.kind}</td>
                  <td className="td text-xs">{r.parts || "—"}</td><td className="td">{fmt(r.cost)}</td>
                  {canEdit && <td className="td"><button className="text-[11px] text-danger" onClick={() => rm("chp_maintenance", r, setMaint)}>حذف</button></td>}
                </tr>
              ))}
              {maint.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 6 : 5}>سابقه‌ای نیست.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {sub === "emissions" && (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[["آخرین NOx", emis[0] ? fmt(emis[0].nox) + " mg/Nm³" : "—", emis[0] && num(emis[0].nox) > num(emis[0].nox_limit) ? "text-danger" : ""],
            ["CO₂ این ماه", fmt(Math.round(co2Month)) + " تن", ""],
            ["موارد فراتر از حد مجاز", fmt(overLimit), overLimit > 0 ? "text-danger" : "text-ok"]].map(([l, v, c]) => (
            <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
          ))}
        </div>

        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-7">
            <select className="input" value={ef.unit_id} onChange={e => setEf({ ...ef, unit_id: e.target.value })}>
              <option value="">کل نیروگاه</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <DateInput className="input" value={ef.log_date} onChange={(v: string) => setEf({ ...ef, log_date: v })} />
            <input className="input" dir="ltr" placeholder="NOx (mg/Nm³)" value={ef.nox} onChange={e => setEf({ ...ef, nox: e.target.value })} />
            <input className="input" dir="ltr" placeholder="CO (mg/Nm³)" value={ef.co} onChange={e => setEf({ ...ef, co: e.target.value })} />
            <input className="input" dir="ltr" placeholder="CO₂ (تن)" value={ef.co2_ton} onChange={e => setEf({ ...ef, co2_ton: e.target.value })} />
            <input className="input" dir="ltr" placeholder="حد مجاز NOx" value={ef.nox_limit} onChange={e => setEf({ ...ef, nox_limit: e.target.value })} />
            <button className="btn-primary" onClick={addEmission}>ثبت انتشار</button>
          </div>
        )}

        <div className="card overflow-auto p-0">
          <table className="w-full">
            <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">ژنراتور</th><th className="th">NOx</th><th className="th">CO</th><th className="th">CO₂ (تن)</th><th className="th">وضعیت</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {emis.map(r => {
                const over = num(r.nox) > num(r.nox_limit);
                return (
                  <tr key={r.id}>
                    <td className="td">{fmtDate(r.log_date)}</td><td className="td font-bold">{r.unit_name}</td>
                    <td className={`td ${over ? "font-bold text-danger" : ""}`}>{fmt(r.nox)}</td>
                    <td className="td">{fmt(r.co)}</td><td className="td">{fmt(r.co2_ton)}</td>
                    <td className="td">{over ? <span className="chip bg-danger/10 text-danger">فراتر از حد ({fmt(r.nox_limit)})</span> : <span className="chip bg-ok/10 text-ok">مجاز</span>}</td>
                    {canEdit && <td className="td"><button className="text-[11px] text-danger" onClick={() => rm("chp_emissions", r, setEmis)}>حذف</button></td>}
                  </tr>
                );
              })}
              {emis.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 7 : 6}>رکوردی ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}
