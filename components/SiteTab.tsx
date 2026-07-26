"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgHBars, svgPie, CH } from "@/lib/export";
import { fileToDataUrl } from "@/lib/img";

export default function SiteTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"daily" | "attendance" | "equipment">("daily");
  const [reports, setReports] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [eqs, setEqs] = useState<any[]>([]);
  const [eqLogs, setEqLogs] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [rf, setRf] = useState({ report_date: today, weather: "آفتابی", temp: "", works: "", blockers: "", manpower: [{ role: "کارگر ساده", count: "" }], photos: [] as string[] });
  const [tf, setTf] = useState({ person_name: "", role: "", work_date: today, hours: "8", note: "" });
  const [ef, setEf] = useState({ name: "", plate: "", owner: "استیجاری" });
  const [elf, setElf] = useState({ equipment_id: "", log_date: today, hours: "", fuel: "", service_note: "" });

  const load = async () => {
    const g = (t: string, set: any, ord = "created_at") => supabase.from(t).select("*").eq("project_id", projectId)
      .order(ord, { ascending: false }).then(({ data }: any) => set(data || []));
    await Promise.all([g("daily_reports", setReports, "report_date"), g("timesheets", setSheets, "work_date"),
      g("equipment", setEqs), g("equipment_logs", setEqLogs, "log_date")]);
    supabase.from("personnel").select("*").eq("project_id", projectId).order("name")
      .then(({ data }: any) => setPeople(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const addReport = async () => {
    if (!rf.works.trim()) { alert("شرح کارهای انجام‌شده الزامی است."); return; }
    const manpower = rf.manpower.filter(m => m.role && num(m.count) > 0)
      .map(m => ({ role: m.role, count: num(m.count) }));
    await supabase.from("daily_reports").insert({
      project_id: projectId, report_date: rf.report_date, weather: rf.weather, temp: rf.temp,
      works: rf.works, blockers: rf.blockers, manpower, photos: rf.photos, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "گزارش روزانه کارگاه", `${fmtDate(rf.report_date)} — ${manpower.reduce((s, m) => s + m.count, 0)} نفر`);
    setRf({ report_date: today, weather: "آفتابی", temp: "", works: "", blockers: "", manpower: [{ role: "کارگر ساده", count: "" }], photos: [] });
    load();
  };

  const addSheet = async () => {
    if (!tf.person_name) return;
    await supabase.from("timesheets").insert({ project_id: projectId, ...tf, hours: num(tf.hours) || 0,
      personnel_id: people.find((x: any) => String(x.name).trim() === String(tf.person_name).trim())?.id || null });
    logAction(projectId, profile.id, "ثبت حضور", `${tf.person_name} — ${tf.hours} ساعت`);
    setTf({ person_name: "", role: "", work_date: today, hours: "8", note: "" }); load();
  };

  const addEq = async () => {
    if (!ef.name) return;
    await supabase.from("equipment").insert({ project_id: projectId, ...ef, status: "فعال" });
    logAction(projectId, profile.id, "ثبت ماشین‌آلات", ef.name);
    setEf({ name: "", plate: "", owner: "استیجاری" }); load();
  };
  const addEqLog = async () => {
    const eq = eqs.find(e => e.id === elf.equipment_id);
    if (!eq) return;
    await supabase.from("equipment_logs").insert({
      project_id: projectId, equipment_id: elf.equipment_id, equipment_name: eq.name,
      log_date: elf.log_date, hours: num(elf.hours) || 0, fuel: num(elf.fuel) || 0, service_note: elf.service_note,
    });
    logAction(projectId, profile.id, "کارکرد ماشین‌آلات", `${eq.name} — ${elf.hours} ساعت`);
    setElf({ equipment_id: "", log_date: today, hours: "", fuel: "", service_note: "" }); load();
  };

  const monthSheets = sheets.slice(0, 100);

  // ---------- گزارش PDF کارگاه ----------
  const sitePdf = () => {
    const asc = [...reports].sort((a, b) => String(a.report_date).localeCompare(String(b.report_date)));
    const men = asc.map(r => (r.manpower || []).reduce((s: number, m: any) => s + num(m.count || 0), 0));
    const roles: Record<string, number> = {};
    for (const r of reports) for (const m of r.manpower || []) roles[m.role] = (roles[m.role] || 0) + num(m.count || 0);
    const eqHours = eqs.map(e0 => ({
      name: e0.name, value: eqLogs.filter(l => l.equipment_id === e0.id).reduce((s, l) => s + num(l.hours || 0), 0),
    }));
    const totalHours = sheets.reduce((s, x) => s + num(x.hours || 0), 0);
    printPdf("گزارش کارگاه", "گزارش‌های روزانه، نیروی انسانی و ماشین‌آلات",
      kpis([["گزارش‌های ثبت‌شده", faN(reports.length)], ["نفر-ساعت ثبت‌شده", faN(totalHours)],
        ["دستگاه‌ها", faN(eqs.length)], ["روزهای دارای مانع", faN(reports.filter(r => r.blockers).length)]]) +
      (asc.length > 1 ? svgLines("روند نیروی انسانی حاضر در کارگاه", asc.map(r => faD(r.report_date)),
        [{ name: "نفر حاضر", color: CH.primary, values: men }], "نفر") : "") +
      (Object.keys(roles).length ? svgPie("ترکیب رده‌های شغلی (مجموع نفر-روز)",
        Object.entries(roles).map(([name, value]) => ({ name, value }))) : "") +
      (eqHours.some(e => e.value) ? svgHBars("کارکرد ماشین‌آلات (ساعت)", eqHours.map(e => ({ ...e, note: faN(e.value) + " ساعت" }))) : "") +
      "<h2>گزارش‌های روزانه</h2>" + tbl(["تاریخ", "آب‌وهوا", "نیرو", "کارهای انجام‌شده", "موانع"],
        reports.slice(0, 40).map(r => [faD(r.report_date), r.weather || "—",
          faN((r.manpower || []).reduce((s: number, m: any) => s + num(m.count || 0), 0)),
          (r.works || "").slice(0, 90), r.blockers || "—"])) +
      "<h2>ناوگان ماشین‌آلات</h2>" + tbl(["دستگاه", "پلاک", "مالکیت", "کارکرد (ساعت)"],
        eqs.map(e0 => [e0.name, e0.plate || "—", e0.owner || "—",
          faN(eqLogs.filter(l => l.equipment_id === e0.id).reduce((s, l) => s + num(l.hours || 0), 0))])));
  };

  const del = async (table: string, row: any, label: string, detail: string) => {
    if (await deleteRow(table, row, { projectId, profile, label, detail })) load();
  };

  return (
    <div className="space-y-3">
      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load}
          table={sub === "daily" ? "daily_reports" : sub === "attendance" ? "timesheets" : "equipment"}
          rows={sub === "daily" ? reports : sub === "attendance" ? sheets : eqs} pdf={sitePdf} />
        {sub === "equipment" && <div className="mt-1 border-t border-line pt-1">
          <ExcelIO table="equipment_logs" projectId={projectId} rows={eqLogs} canEdit={canEdit} profile={profile} onDone={load} /></div>}
      </div>
      <div className="flex gap-2">
        {[["daily", "گزارش روزانه"], ["attendance", "حضور و غیاب"], ["equipment", "ماشین‌آلات"]].map(([k, l]) => (
          <button key={k} className={`chip ${sub === k ? "chip-on" : "border border-line bg-card"}`}
            onClick={() => setSub(k as any)}>{l}</button>
        ))}
      </div>

      {sub === "daily" && (
        <>
          {canEdit && (
            <div className="card space-y-2">
              <h2 className="font-black">گزارش روزانه جدید</h2>
              <div className="grid gap-2 md:grid-cols-4">
                <DateInput className="input" value={rf.report_date} onChange={v => setRf({ ...rf, report_date: v })} />
                <select className="input" value={rf.weather} onChange={e => setRf({ ...rf, weather: e.target.value })}>
                  {["آفتابی", "ابری", "بارانی", "برفی", "بادی", "یخبندان"].map(w => <option key={w}>{w}</option>)}
                </select>
                <input className="input" dir="ltr" placeholder="دما (°C)" value={rf.temp} onChange={e => setRf({ ...rf, temp: e.target.value })} />
                <label className="btn-ghost cursor-pointer justify-center">
                  {rf.photos.length ? `${rf.photos.length.toLocaleString("fa-IR")} عکس پیوست شد` : "پیوست عکس کارگاه"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
                    const arr = [...rf.photos];
                    for (const f of Array.from(e.target.files || [])) arr.push(await fileToDataUrl(f, 900, 0.65));
                    setRf({ ...rf, photos: arr });
                  }} />
                </label>
              </div>
              <div>
                <label className="label">نیروی انسانی حاضر</label>
                {rf.manpower.map((m, i) => (
                  <div key={i} className="mb-1 flex gap-2">
                    <input className="input" placeholder="رده (بنّا، آرماتوربند…)" value={m.role}
                      onChange={e => { const a = [...rf.manpower]; a[i].role = e.target.value; setRf({ ...rf, manpower: a }); }} />
                    <input className="input w-28" dir="ltr" placeholder="تعداد" value={m.count}
                      onChange={e => { const a = [...rf.manpower]; a[i].count = e.target.value; setRf({ ...rf, manpower: a }); }} />
                    <button className="btn-ghost" onClick={() => setRf({ ...rf, manpower: [...rf.manpower, { role: "", count: "" }] })}>+</button>
                  </div>
                ))}
              </div>
              <textarea className="input" rows={2} placeholder="کارهای انجام‌شده امروز (احجام، جبهه‌های کاری…)" value={rf.works} onChange={e => setRf({ ...rf, works: e.target.value })} />
              <textarea className="input" rows={1} placeholder="موانع و تاخیرها (اختیاری)" value={rf.blockers} onChange={e => setRf({ ...rf, blockers: e.target.value })} />
              <button className="btn-primary" onClick={addReport}>ثبت گزارش روزانه</button>
            </div>
          )}
          {reports.map(r => {
            const total = (r.manpower || []).reduce((s: number, m: any) => s + num(m.count || 0), 0);
            const isOpen = open === r.id;
            return (
              <div key={r.id} className="card">
                <button className="flex w-full flex-wrap items-center gap-3 text-right" onClick={() => setOpen(isOpen ? null : r.id)}>
                  <span className="font-black">{fmtDate(r.report_date)}</span>
                  <span className="chip bg-surface">{r.weather}{r.temp ? ` · ${r.temp}°` : ""}</span>
                  <span className="text-xs text-ink/50">{total.toLocaleString("fa-IR")} نفر نیرو</span>
                  {r.blockers && <span className="chip bg-danger/10 text-danger">دارای مانع</span>}
                  <span className="mr-auto text-xs text-ink/40">{r.created_by_name}</span>
                </button>
                {canEdit && (
                  <button className="mt-1 text-[11px] text-danger"
                    onClick={() => del("daily_reports", r, "گزارش روزانه", fmtDate(r.report_date))}>حذف گزارش</button>
                )}
                {isOpen && (
                  <div className="mt-2 space-y-2 border-t border-line pt-2 text-sm">
                    <p><b>کارها:</b> {r.works}</p>
                    {r.blockers && <p className="text-danger"><b>موانع:</b> {r.blockers}</p>}
                    {(r.manpower || []).length > 0 && (
                      <p className="text-xs text-ink/60">{(r.manpower || []).map((m: any) => `${m.role}: ${m.count}`).join(" · ")}</p>
                    )}
                    {(r.photos || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(r.photos || []).map((p: string, i: number) =>
                          <img key={i} src={p} alt="کارگاه" className="h-24 rounded-lg border border-line" />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {reports.length === 0 && <p className="text-sm text-ink/40">گزارش روزانه‌ای ثبت نشده است.</p>}
        </>
      )}

      {sub === "attendance" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-6">
              <span className="contents">
                <input className="input" placeholder="نام فرد" list="site-people" value={tf.person_name}
                  onChange={e => {
                    const p = people.find(x => x.name === e.target.value);
                    setTf({ ...tf, person_name: e.target.value, role: p?.role || tf.role });
                  }} />
                <datalist id="site-people">{people.map(p => <option key={p.id} value={p.name}>{p.role || ""}</option>)}</datalist>
              </span>
              <input className="input" placeholder="رده شغلی" value={tf.role} onChange={e => setTf({ ...tf, role: e.target.value })} />
              <DateInput className="input" value={tf.work_date} onChange={v => setTf({ ...tf, work_date: v })} />
              <input className="input" dir="ltr" placeholder="ساعت کار" value={tf.hours} onChange={e => setTf({ ...tf, hours: e.target.value })} />
              <input className="input" placeholder="توضیح" value={tf.note} onChange={e => setTf({ ...tf, note: e.target.value })} />
              <button className="btn-primary" onClick={addSheet}>ثبت</button>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">نام</th><th className="th">رده</th><th className="th">ساعت</th><th className="th">توضیح</th></tr></thead>
              <tbody>
                {monthSheets.map(s => (
                  <tr key={s.id}>
                    <td className="td">{fmtDate(s.work_date)}</td><td className="td font-bold">{s.person_name}</td>
                    <td className="td">{s.role}</td><td className="td">{fmt(s.hours)}</td><td className="td text-xs">{s.note || "—"}</td>
                    {canEdit && <td className="td"><button className="text-[11px] text-danger"
                      onClick={() => del("timesheets", s, "حضور و غیاب", `${s.person_name} — ${fmtDate(s.work_date)}`)}>حذف</button></td>}
                  </tr>
                ))}
                {sheets.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>رکوردی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "equipment" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-2 font-black">ناوگان ماشین‌آلات</h2>
            {canEdit && (
              <div className="mb-2 grid grid-cols-4 gap-2">
                <input className="input" placeholder="نام دستگاه" value={ef.name} onChange={e => setEf({ ...ef, name: e.target.value })} />
                <input className="input" placeholder="پلاک / سریال" value={ef.plate} onChange={e => setEf({ ...ef, plate: e.target.value })} />
                <select className="input" value={ef.owner} onChange={e => setEf({ ...ef, owner: e.target.value })}>
                  <option>استیجاری</option><option>ملکی</option>
                </select>
                <button className="btn-primary" onClick={addEq}>ثبت</button>
              </div>
            )}
            {eqs.map(e0 => {
              const hrs = eqLogs.filter(l => l.equipment_id === e0.id).reduce((s, l) => s + num(l.hours || 0), 0);
              const fuel = eqLogs.filter(l => l.equipment_id === e0.id).reduce((s, l) => s + num(l.fuel || 0), 0);
              return (
                <div key={e0.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
                  <span className="flex-1 font-bold">{e0.name} <span className="text-xs text-ink/40">{e0.plate}</span></span>
                  <span className="chip bg-surface">{e0.owner}</span>
                  <span className="text-xs">کارکرد: <b>{fmt(hrs)}</b> ساعت</span>
                  <span className="text-xs">سوخت: <b>{fmt(fuel)}</b> لیتر</span>
                </div>
              );
            })}
            {eqs.length === 0 && <p className="text-sm text-ink/40">دستگاهی ثبت نشده است.</p>}
          </div>
          <div className="card">
            <h2 className="mb-2 font-black">ثبت کارکرد روزانه / سرویس</h2>
            {canEdit && (
              <div className="mb-2 grid grid-cols-6 gap-2">
                <select className="input col-span-2" value={elf.equipment_id} onChange={e => setElf({ ...elf, equipment_id: e.target.value })}>
                  <option value="">دستگاه…</option>
                  {eqs.map(e0 => <option key={e0.id} value={e0.id}>{e0.name}</option>)}
                </select>
                <DateInput className="input" value={elf.log_date} onChange={v => setElf({ ...elf, log_date: v })} />
                <input className="input" dir="ltr" placeholder="ساعت" value={elf.hours} onChange={e => setElf({ ...elf, hours: e.target.value })} />
                <input className="input" dir="ltr" placeholder="سوخت (ل)" value={elf.fuel} onChange={e => setElf({ ...elf, fuel: e.target.value })} />
                <button className="btn-primary" onClick={addEqLog}>ثبت</button>
                <input className="input col-span-6" placeholder="یادداشت سرویس / تعمیر (اختیاری)" value={elf.service_note} onChange={e => setElf({ ...elf, service_note: e.target.value })} />
              </div>
            )}
            <div className="max-h-72 overflow-auto">
              {eqLogs.slice(0, 60).map(l => (
                <div key={l.id} className="mb-1 flex gap-3 rounded-lg border border-line p-2 text-xs">
                  <span>{fmtDate(l.log_date)}</span><span className="font-bold">{l.equipment_name}</span>
                  <span>{fmt(l.hours)} ساعت</span><span>{fmt(l.fuel)} لیتر</span>
                  {l.service_note && <span className="text-crane">🔧 {l.service_note}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
