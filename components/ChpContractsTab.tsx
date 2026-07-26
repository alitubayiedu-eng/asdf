"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, daysBetween } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";

const today = () => new Date().toISOString().slice(0, 10);
const STATUS: Record<string, string> = { active: "فعال", expired: "منقضی", draft: "پیش‌نویس" };

export default function ChpContractsTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState<any>({ title: "", kind: "electricity", party: "", contract_no: "", start_date: today(), end_date: "", base_price: "", unit: "kWh", adjustment_pct: "", min_qty: "", max_qty: "", note: "" });

  const load = async () => {
    const { data } = await supabase.from("chp_contracts").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(2000);
    setRows(data || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.title.trim()) return;
    await supabase.from("chp_contracts").insert({
      project_id: projectId, title: f.title.trim(), kind: f.kind, party: f.party, contract_no: f.contract_no,
      start_date: f.start_date || null, end_date: f.end_date || null,
      base_price: num(f.base_price), unit: f.kind === "heat" ? "GJ" : "kWh",
      adjustment_pct: num(f.adjustment_pct), min_qty: num(f.min_qty), max_qty: num(f.max_qty),
      status: "active", note: f.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت قرارداد فروش انرژی", `${f.title} — ${f.party}`);
    setF({ ...f, title: "", party: "", contract_no: "", end_date: "", base_price: "", adjustment_pct: "", min_qty: "", max_qty: "", note: "" });
    load();
  };
  const setStatus = async (r: any, status: string) => {
    await supabase.from("chp_contracts").update({ status }).eq("id", r.id); load();
  };
  const remove = async (r: any) => {
    if (await deleteRow("chp_contracts", r, { projectId, profile, label: "قرارداد", detail: r.title })) load();
  };

  const stat = useMemo(() => ({
    active: rows.filter(r => r.status === "active").length,
    elec: rows.filter(r => r.kind === "electricity" && r.status === "active").length,
    heat: rows.filter(r => r.kind === "heat" && r.status === "active").length,
    expiring: rows.filter(r => r.status === "active" && r.end_date && daysBetween(today(), r.end_date) >= 0 && daysBetween(today(), r.end_date) <= 60).length,
  }), [rows]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["قراردادهای فعال", fmt(stat.active), ""], ["فروش برق", fmt(stat.elec), ""],
          ["فروش حرارت", fmt(stat.heat), ""], ["نزدیک انقضا (۶۰ روز)", fmt(stat.expiring), stat.expiring > 0 ? "text-crane" : ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      {canEdit && (
        <div className="card space-y-2">
          <h2 className="font-black">ثبت قرارداد فروش بلندمدت</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <div><label className="label">عنوان قرارداد</label><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></div>
            <div><label className="label">نوع</label>
              <select className="input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
                <option value="electricity">فروش برق</option><option value="heat">فروش حرارت/بخار</option>
              </select></div>
            <div><label className="label">طرف قرارداد</label><input className="input" value={f.party} onChange={e => setF({ ...f, party: e.target.value })} /></div>
            <div><label className="label">شماره قرارداد</label><input className="input" value={f.contract_no} onChange={e => setF({ ...f, contract_no: e.target.value })} /></div>
            <div><label className="label">تاریخ شروع</label><DateInput className="input" value={f.start_date} onChange={(v: string) => setF({ ...f, start_date: v })} /></div>
            <div><label className="label">تاریخ پایان</label><DateInput className="input" value={f.end_date} onChange={(v: string) => setF({ ...f, end_date: v })} /></div>
            <div><label className="label">نرخ پایه (ریال/{f.kind === "heat" ? "GJ" : "kWh"})</label><input className="input" dir="ltr" value={f.base_price} onChange={e => setF({ ...f, base_price: e.target.value })} /></div>
            <div><label className="label">تعدیل سالانه (٪)</label><input className="input" dir="ltr" value={f.adjustment_pct} onChange={e => setF({ ...f, adjustment_pct: e.target.value })} /></div>
            <div><label className="label">حداقل تعهد (سالانه)</label><input className="input" dir="ltr" value={f.min_qty} onChange={e => setF({ ...f, min_qty: e.target.value })} /></div>
            <div><label className="label">حداکثر (سالانه)</label><input className="input" dir="ltr" value={f.max_qty} onChange={e => setF({ ...f, max_qty: e.target.value })} /></div>
          </div>
          <button className="btn-primary" onClick={add}>ثبت قرارداد</button>
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className="th">عنوان</th><th className="th">نوع</th><th className="th">طرف</th><th className="th">بازه</th>
            <th className="th">نرخ پایه</th><th className="th">تعدیل</th><th className="th">وضعیت</th>{canEdit && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const exp = r.status === "active" && r.end_date && daysBetween(today(), r.end_date) <= 60;
              return (
                <tr key={r.id}>
                  <td className="td font-bold">{r.title} {r.contract_no && <span className="code-chip">{r.contract_no}</span>}</td>
                  <td className="td"><span className={`chip ${r.kind === "heat" ? "bg-danger/10 text-danger" : "bg-blueprint/10 text-blueprint"}`}>{r.kind === "heat" ? "حرارت" : "برق"}</span></td>
                  <td className="td">{r.party || "—"}</td>
                  <td className={`td text-xs ${exp ? "font-bold text-crane" : ""}`}>{fmtDate(r.start_date)} — {fmtDate(r.end_date)}</td>
                  <td className="td">{fmt(r.base_price)} /{r.unit}</td>
                  <td className="td">{r.adjustment_pct ? fmt(r.adjustment_pct) + "٪" : "—"}</td>
                  <td className="td">
                    {canEdit ? (
                      <select className="input w-28 py-0.5 text-[11px]" value={r.status} onChange={e => setStatus(r, e.target.value)}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : <span className={`chip ${r.status === "active" ? "bg-ok/10 text-ok" : "bg-surface"}`}>{STATUS[r.status]}</span>}
                  </td>
                  {canEdit && <td className="td"><button className="text-[11px] text-danger" onClick={() => remove(r)}>حذف</button></td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 8 : 7}>قراردادی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
