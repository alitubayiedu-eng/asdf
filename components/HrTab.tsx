"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, CH } from "@/lib/export";

export default function HrTab({ projectId, profile, canEdit }: any) {
  const [people, setPeople] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [pf, setPf] = useState({ name: "", role: "اپراتور خط", shift: "صبح", phone: "" });
  const [tf, setTf] = useState({ person_name: "", role: "", work_date: today, hours: "8", note: "" });

  const load = () => {
    supabase.from("personnel").select("*").eq("project_id", projectId).order("name").then(({ data }: any) => setPeople(data || []));
    supabase.from("timesheets").select("*").eq("project_id", projectId).order("work_date", { ascending: false }).limit(100)
      .then(({ data }: any) => setSheets(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const addPerson = async () => {
    if (!pf.name) return;
    await supabase.from("personnel").insert({ project_id: projectId, ...pf });
    logAction(projectId, profile.id, "ثبت پرسنل", `${pf.name} — ${pf.role}`);
    setPf({ name: "", role: "اپراتور خط", shift: "صبح", phone: "" }); load();
  };
  const addSheet = async () => {
    if (!tf.person_name) return;
    await supabase.from("timesheets").insert({ project_id: projectId, ...tf, hours: num(tf.hours) || 0,
      personnel_id: people.find((x: any) => String(x.name).trim() === String(tf.person_name).trim())?.id || null });
    logAction(projectId, profile.id, "ثبت حضور پرسنل", `${tf.person_name} — ${tf.hours} ساعت`);
    setTf({ person_name: "", role: "", work_date: today, hours: "8", note: "" }); load();
  };

  const monthHours = sheets.filter(s => (s.work_date || "").startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, x) => s + num(x.hours || 0), 0);

  const hrPdf = () => {
    const byShift: Record<string, number> = {}, byRole: Record<string, number> = {}, hoursBy: Record<string, number> = {};
    for (const p of people) { byShift[p.shift || "—"] = (byShift[p.shift || "—"] || 0) + 1; byRole[p.role || "—"] = (byRole[p.role || "—"] || 0) + 1; }
    for (const s2 of sheets) hoursBy[s2.person_name] = (hoursBy[s2.person_name] || 0) + num(s2.hours || 0);
    printPdf("گزارش منابع انسانی کارخانه", "پرسنل، شیفت‌ها و حضور و غیاب",
      kpis([["پرسنل", faN(people.length)], ["نفر-ساعت این ماه", faN(monthHours)],
        ["رکورد حضور", faN(sheets.length)],
        ["میانگین ساعت هر نفر", people.length ? faN(Math.round(monthHours / people.length)) : "—"]]) +
      (people.length ? svgPie("پراکندگی شیفت‌ها", Object.entries(byShift).map(([name, value]) => ({ name: "شیفت " + name, value }))) : "") +
      (people.length ? svgPie("ترکیب سمت‌ها", Object.entries(byRole).map(([name, value]) => ({ name, value }))) : "") +
      (Object.keys(hoursBy).length ? svgHBars("نفر-ساعت به تفکیک فرد", Object.entries(hoursBy)
        .sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, value]) => ({ name, value, note: faN(value) + " ساعت" }))) : "") +
      "<h2>پرسنل</h2>" + tbl(["نام", "سمت", "شیفت", "تلفن"], people.map(p => [p.name, p.role || "—", p.shift || "—", p.phone || "—"])) +
      "<h2>حضور و غیاب</h2>" + tbl(["تاریخ", "نام", "سمت", "ساعت", "توضیح"],
        sheets.slice(0, 60).map(s2 => [faD(s2.work_date), s2.person_name, s2.role || "—", faN(s2.hours), s2.note || "—"])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 space-y-1">
        <ExcelIO table="personnel" projectId={projectId} rows={people} canEdit={canEdit} profile={profile} onDone={load} pdf={hrPdf} />
        <div className="border-t border-line pt-1">
          <ExcelIO table="timesheets" projectId={projectId} rows={sheets} canEdit={canEdit} profile={profile} onDone={load} label="حضور و غیاب" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["پرسنل ثبت‌شده", people.length.toLocaleString("fa-IR")],
          ["نفر-ساعت این ماه", fmt(monthHours)],
          ["شیفت‌ها", "صبح / عصر / شب"]].map(([l, v]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className="mt-1.5 text-xl font-black tracking-tight">{v}</div></div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-black">پرسنل کارخانه</h2>
          {canEdit && (
            <div className="mb-2 grid grid-cols-5 gap-2">
              <input className="input col-span-2" placeholder="نام" value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} />
              <input className="input" placeholder="سمت" value={pf.role} onChange={e => setPf({ ...pf, role: e.target.value })} />
              <select className="input" value={pf.shift} onChange={e => setPf({ ...pf, shift: e.target.value })}>
                <option>صبح</option><option>عصر</option><option>شب</option><option>گردشی</option>
              </select>
              <button className="btn-primary" onClick={addPerson}>+</button>
            </div>
          )}
          {people.map(p => (
            <div key={p.id} className="mb-1 flex justify-between rounded-lg border border-line p-2 text-sm">
              <span><b>{p.name}</b> <span className="text-xs text-ink/50">{p.role}</span></span>
              <span className="chip bg-surface">شیفت {p.shift}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="mb-2 font-black">حضور و غیاب / اضافه‌کاری</h2>
          {canEdit && (
            <div className="mb-2 grid grid-cols-6 gap-2">
              <span className="col-span-2 contents">
                <input className="input col-span-2" placeholder="نام فرد" list="hr-people" value={tf.person_name}
                  onChange={e => { const p = people.find(x => x.name === e.target.value); setTf({ ...tf, person_name: e.target.value, role: p?.role || tf.role }); }} />
                <datalist id="hr-people">{people.map(p => <option key={p.id} value={p.name}>{p.role || ""}</option>)}</datalist>
              </span>
              <DateInput className="input" value={tf.work_date} onChange={v => setTf({ ...tf, work_date: v })} />
              <input className="input" dir="ltr" placeholder="ساعت" value={tf.hours} onChange={e => setTf({ ...tf, hours: e.target.value })} />
              <input className="input" placeholder="توضیح" value={tf.note} onChange={e => setTf({ ...tf, note: e.target.value })} />
              <button className="btn-primary" onClick={addSheet}>ثبت</button>
            </div>
          )}
          <div className="max-h-72 overflow-auto">
            {sheets.map(s => (
              <div key={s.id} className="mb-1 flex gap-3 rounded-lg border border-line p-2 text-xs">
                <span>{fmtDate(s.work_date)}</span><b>{s.person_name}</b><span>{s.role}</span>
                <span className="mr-auto">{fmt(s.hours)} ساعت</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
