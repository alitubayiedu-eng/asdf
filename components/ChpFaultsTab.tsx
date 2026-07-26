"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";

const today = () => new Date().toISOString().slice(0, 10);

export default function ChpFaultsTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [f, setF] = useState<any>({ unit_id: "", fault_date: today(), kind: "", severity: "متوسط", description: "", downtime_hours: "", lost_kwh: "" });

  const load = async () => {
    const { data } = await supabase.from("chp_faults").select("*").eq("project_id", projectId).order("fault_date", { ascending: false }).limit(3000);
    setRows(data || []);
    supabase.from("chp_units").select("*").eq("project_id", projectId).then(({ data }: any) => setUnits(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.description && !f.kind) return;
    const u = units.find(x => x.id === f.unit_id);
    await supabase.from("chp_faults").insert({
      project_id: projectId, unit_id: f.unit_id || null, unit_name: u?.name || "کل نیروگاه",
      fault_date: f.fault_date, kind: f.kind, severity: f.severity, description: f.description,
      downtime_hours: num(f.downtime_hours), lost_kwh: num(f.lost_kwh), status: "open",
      created_by_name: profile.full_name,
    });
    if (u) await supabase.from("chp_units").update({ status: "fault" }).eq("id", u.id);
    logAction(projectId, profile.id, "ثبت خرابی CHP", `${u?.name || "کل نیروگاه"} — ${f.kind || f.description}`);
    setF({ ...f, kind: "", description: "", downtime_hours: "", lost_kwh: "" }); load();
  };
  const close = async (r: any) => {
    const action = prompt("اقدام انجام‌شده برای رفع خرابی:");
    if (action == null) return;
    await supabase.from("chp_faults").update({ status: "closed", action, resolved_date: today() }).eq("id", r.id);
    if (r.unit_id) await supabase.from("chp_units").update({ status: "active" }).eq("id", r.unit_id);
    logAction(projectId, profile.id, "رفع خرابی CHP", `${r.unit_name} — ${action.slice(0, 50)}`); load();
  };
  const remove = async (r: any) => {
    if (await deleteRow("chp_faults", r, { projectId, profile, label: "خرابی", detail: r.unit_name })) load();
  };

  const stat = useMemo(() => ({
    open: rows.filter(r => r.status === "open").length,
    downtime: rows.reduce((s, r) => s + num(r.downtime_hours), 0),
    lost: rows.reduce((s, r) => s + num(r.lost_kwh), 0),
    total: rows.length,
  }), [rows]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["کل خرابی‌ها", fmt(stat.total), ""], ["خرابی باز", fmt(stat.open), stat.open > 0 ? "text-danger" : "text-ok"],
          ["جمع ساعت توقف", fmt(stat.downtime), ""], ["انرژی ازدست‌رفته", fmt(Math.round(stat.lost)) + " kWh", stat.lost > 0 ? "text-danger" : ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-6">
          <select className="input" value={f.unit_id} onChange={e => setF({ ...f, unit_id: e.target.value })}>
            <option value="">کل نیروگاه</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <DateInput className="input" value={f.fault_date} onChange={(v: string) => setF({ ...f, fault_date: v })} />
          <input className="input" placeholder="نوع خطا (نشتی، دما بالا، لرزش…)" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} />
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
          <thead className="bg-surface"><tr>
            <th className="th">تاریخ</th><th className="th">ژنراتور</th><th className="th">نوع</th><th className="th">شدت</th>
            <th className="th">شرح</th><th className="th">توقف</th><th className="th">ازدست‌رفته</th><th className="th">وضعیت</th>{canEdit && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="td">{fmtDate(r.fault_date)}</td>
                <td className="td font-bold">{r.unit_name}</td>
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
                {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => remove(r)}>حذف</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-ok" colSpan={canEdit ? 9 : 8}>خرابی‌ای ثبت نشده است. ✓</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
