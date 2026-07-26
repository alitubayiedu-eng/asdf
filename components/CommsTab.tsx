"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, CH } from "@/lib/export";

export default function CommsTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"meetings" | "letters">("meetings");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [phases, setPhases] = useState<any[]>([]);
  const [mf, setMf] = useState({ title: "", meet_date: new Date().toISOString().slice(0, 10), attendees: "", minutes: "", resolutions: [{ text: "", owner: "", due: "" }] });
  const [lf, setLf] = useState({ no: "", direction: "out", subject: "", party: "", letter_date: new Date().toISOString().slice(0, 10) });

  const load = async () => {
    supabase.from("meetings").select("*").eq("project_id", projectId).order("meet_date", { ascending: false })
      .then(({ data }: any) => setMeetings(data || []));
    supabase.from("letters").select("*").eq("project_id", projectId).order("letter_date", { ascending: false })
      .then(({ data }: any) => setLetters(data || []));
    supabase.from("phases").select("id, name").eq("project_id", projectId).order("sort")
      .then(({ data }: any) => setPhases(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const addMeeting = async () => {
    if (!mf.title) return;
    const resolutions = mf.resolutions.filter(r => r.text.trim());
    await supabase.from("meetings").insert({
      project_id: projectId, title: mf.title, meet_date: mf.meet_date, attendees: mf.attendees,
      minutes: mf.minutes, resolutions, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت صورت‌جلسه", `${mf.title} — ${resolutions.length} مصوبه`);
    setMf({ title: "", meet_date: new Date().toISOString().slice(0, 10), attendees: "", minutes: "", resolutions: [{ text: "", owner: "", due: "" }] });
    load();
  };

  const toTask = async (res: any, meeting: any) => {
    const phaseId = phases[0]?.id;
    if (!phaseId) { alert("ابتدا یک فاز در برنامه زمانی تعریف کنید."); return; }
    await supabase.from("tasks").insert({
      project_id: projectId, phase_id: phaseId, title: `[مصوبه جلسه] ${res.text}`,
      due_date: res.due || null, status: "todo", progress: 0, priority: "بالا", created_by: profile.id,
    });
    logAction(projectId, profile.id, "تبدیل مصوبه به وظیفه", res.text.slice(0, 60));
    alert("مصوبه به فهرست فعالیت‌های برنامه زمانی اضافه شد.");
  };

  const addLetter = async () => {
    if (!lf.subject) return;
    await supabase.from("letters").insert({ project_id: projectId, ...lf, created_by_name: profile.full_name });
    logAction(projectId, profile.id, lf.direction === "out" ? "نامه صادره" : "نامه وارده", `${lf.no} — ${lf.subject}`);
    setLf({ no: "", direction: "out", subject: "", party: "", letter_date: new Date().toISOString().slice(0, 10) });
    load();
  };

  const commsPdf = () => {
    const res = meetings.flatMap(m => (m.resolutions || []).map((r: any) => ({ ...r, meeting: m.title, date: m.meet_date })));
    const owners: Record<string, number> = {};
    for (const r of res) owners[r.owner || "بدون مسئول"] = (owners[r.owner || "بدون مسئول"] || 0) + 1;
    printPdf("گزارش جلسات و مکاتبات", "صورت‌جلسات، مصوبات و دفتر نامه‌ها",
      kpis([["صورت‌جلسات", faN(meetings.length)], ["مصوبات", faN(res.length)],
        ["نامه صادره", faN(letters.filter(l => l.direction === "out").length)],
        ["نامه وارده", faN(letters.filter(l => l.direction === "in").length)]]) +
      (letters.length ? svgPie("ترکیب مکاتبات", [
        { name: "صادره", value: letters.filter(l => l.direction === "out").length },
        { name: "وارده", value: letters.filter(l => l.direction === "in").length }]) : "") +
      (Object.keys(owners).length ? svgHBars("مصوبات به تفکیک مسئول",
        Object.entries(owners).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, note: faN(value) + " مصوبه" }))) : "") +
      "<h2>صورت‌جلسات</h2>" + tbl(["عنوان", "تاریخ", "حاضرین", "مصوبات"],
        meetings.map(m => [m.title, faD(m.meet_date), m.attendees || "—", faN((m.resolutions || []).length)])) +
      (res.length ? "<h2>مصوبات</h2>" + tbl(["جلسه", "متن مصوبه", "مسئول", "مهلت"],
        res.map(r => [r.meeting, r.text, r.owner || "—", faD(r.due)])) : "") +
      "<h2>دفتر مکاتبات</h2>" + tbl(["شماره", "نوع", "موضوع", "طرف", "تاریخ"],
        letters.map(l => [l.no || "—", l.direction === "out" ? "صادره" : "وارده", l.subject, l.party || "—", faD(l.letter_date)])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load}
          table={sub === "meetings" ? "meetings" : "letters"} rows={sub === "meetings" ? meetings : letters} pdf={commsPdf} />
      </div>
      <div className="flex gap-2">
        {[["meetings", "صورت‌جلسات"], ["letters", "مکاتبات"]].map(([k, l]) => (
          <button key={k} className={`chip ${sub === k ? "chip-on" : "border border-line bg-card"}`}
            onClick={() => setSub(k as any)}>{l}</button>
        ))}
      </div>

      {sub === "meetings" && (
        <>
          {canEdit && (
            <div className="card space-y-2">
              <div className="grid gap-2 md:grid-cols-4">
                <input className="input md:col-span-2" placeholder="عنوان جلسه" value={mf.title} onChange={e => setMf({ ...mf, title: e.target.value })} />
                <DateInput className="input" value={mf.meet_date} onChange={v => setMf({ ...mf, meet_date: v })} />
                <input className="input" placeholder="حاضرین" value={mf.attendees} onChange={e => setMf({ ...mf, attendees: e.target.value })} />
              </div>
              <textarea className="input" rows={2} placeholder="خلاصه مذاکرات" value={mf.minutes} onChange={e => setMf({ ...mf, minutes: e.target.value })} />
              <label className="label">مصوبات (قابل تبدیل به وظیفه)</label>
              {mf.resolutions.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" placeholder="متن مصوبه" value={r.text}
                    onChange={e => { const a = [...mf.resolutions]; a[i].text = e.target.value; setMf({ ...mf, resolutions: a }); }} />
                  <input className="input w-36" placeholder="مسئول" value={r.owner}
                    onChange={e => { const a = [...mf.resolutions]; a[i].owner = e.target.value; setMf({ ...mf, resolutions: a }); }} />
                  <DateInput className="input w-40" value={r.due} onChange={v => { const a = [...mf.resolutions]; a[i].due = v; setMf({ ...mf, resolutions: a }); }} />
                  <button className="btn-ghost" onClick={() => setMf({ ...mf, resolutions: [...mf.resolutions, { text: "", owner: "", due: "" }] })}>+</button>
                </div>
              ))}
              <button className="btn-primary" onClick={addMeeting}>ثبت صورت‌جلسه</button>
            </div>
          )}
          {meetings.map(m => (
            <div key={m.id} className="card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black">{m.title}</span>
                <span className="text-xs text-ink/50">{fmtDate(m.meet_date)} · حاضرین: {m.attendees || "—"}</span>
              </div>
              {m.minutes && <p className="mt-1 text-sm text-ink/70">{m.minutes}</p>}
              {(m.resolutions || []).map((r: any, i: number) => (
                <div key={i} className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2 text-sm">
                  <span className="flex-1">{r.text}</span>
                  <span className="text-xs text-ink/50">{r.owner && `مسئول: ${r.owner}`} {r.due && `· مهلت: ${fmtDate(r.due)}`}</span>
                  {canEdit && <button className="btn-ghost py-0.5 text-xs" onClick={() => toTask(r, m)}>تبدیل به وظیفه ←</button>}
                </div>
              ))}
            </div>
          ))}
          {meetings.length === 0 && <p className="text-sm text-ink/40">صورت‌جلسه‌ای ثبت نشده است.</p>}
        </>
      )}

      {sub === "letters" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-6">
              <input className="input" placeholder="شماره نامه" value={lf.no} onChange={e => setLf({ ...lf, no: e.target.value })} />
              <select className="input" value={lf.direction} onChange={e => setLf({ ...lf, direction: e.target.value })}>
                <option value="out">صادره</option><option value="in">وارده</option>
              </select>
              <input className="input md:col-span-2" placeholder="موضوع" value={lf.subject} onChange={e => setLf({ ...lf, subject: e.target.value })} />
              <input className="input" placeholder="طرف مکاتبه" value={lf.party} onChange={e => setLf({ ...lf, party: e.target.value })} />
              <button className="btn-primary" onClick={addLetter}>ثبت نامه</button>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr><th className="th">شماره</th><th className="th">نوع</th><th className="th">موضوع</th><th className="th">طرف</th><th className="th">تاریخ</th></tr></thead>
              <tbody>
                {letters.map(l => (
                  <tr key={l.id}>
                    <td className="td"><span className="code-chip">{l.no || "—"}</span></td>
                    <td className="td">{l.direction === "out" ? <span className="chip bg-blueprint/10 text-blueprint">صادره</span> : <span className="chip bg-crane/20">وارده</span>}</td>
                    <td className="td font-bold">{l.subject}</td>
                    <td className="td">{l.party || "—"}</td>
                    <td className="td">{fmtDate(l.letter_date)}</td>
                  </tr>
                ))}
                {letters.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>نامه‌ای ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
