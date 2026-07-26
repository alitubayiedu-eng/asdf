"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import PostToAccounting from "@/components/PostToAccounting";

const today = () => new Date().toISOString().slice(0, 10);
const MARKET_ELEC: Record<string, string> = { bourse: "بورس انرژی", guaranteed: "خرید تضمینی", direct: "دوجانبه" };
const MARKET_HEAT: Record<string, string> = { steam: "فروش بخار", hotwater: "آب گرم / گرمایش", direct: "دوجانبه" };
const marketLabel = (m: string) => MARKET_ELEC[m] || MARKET_HEAT[m] || m;
const SALE_STATUS: Record<string, string> = { open: "تسویه‌نشده", settled: "تسویه‌شده", overdue: "معوق" };

export default function ChpSalesTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [f, setF] = useState<any>({ sale_date: today(), kind: "electricity", market: "bourse", buyer: "", contract_no: "", contract_id: "", quantity: "", unit: "kWh", price_per_unit: "", settlement_date: "", note: "" });

  const load = async () => {
    const { data } = await supabase.from("chp_sales").select("*").eq("project_id", projectId).order("sale_date", { ascending: false }).limit(3000);
    setRows(data || []);
    supabase.from("chp_contracts").select("*").eq("project_id", projectId).eq("status", "active").then(({ data }: any) => setContracts(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const total = num(f.quantity) * num(f.price_per_unit);
  const add = async () => {
    if (!num(f.quantity)) return;
    await supabase.from("chp_sales").insert({
      project_id: projectId, sale_date: f.sale_date, kind: f.kind, market: f.market,
      buyer: f.buyer, contract_no: f.contract_no, quantity: num(f.quantity), unit: f.unit,
      price_per_unit: num(f.price_per_unit), total, settlement_date: f.settlement_date || null,
      status: "open", contract_id: f.contract_id || null, note: f.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, f.kind === "heat" ? "ثبت فروش حرارت" : "ثبت فروش برق",
      `${marketLabel(f.market)} — ${fmt(num(f.quantity))} ${f.unit} = ${fmt(total)} ریال`);
    setF({ ...f, quantity: "", price_per_unit: "", buyer: "", contract_no: "", note: "" });
    load();
  };
  const settle = async (r: any) => {
    await supabase.from("chp_sales").update({ status: "settled", settlement_date: today() }).eq("id", r.id);
    logAction(projectId, profile.id, "تسویه فروش", `${fmt(r.total)} ریال`); load();
  };
  const remove = async (r: any) => {
    if (await deleteRow("chp_sales", r, { projectId, profile, label: "فروش", detail: `${marketLabel(r.market)} — ${fmt(r.total)}` })) load();
  };

  const stat = useMemo(() => {
    const elec = rows.filter(r => r.kind === "electricity").reduce((s, r) => s + num(r.total), 0);
    const heat = rows.filter(r => r.kind === "heat").reduce((s, r) => s + num(r.total), 0);
    const open = rows.filter(r => r.status !== "settled").reduce((s, r) => s + num(r.total), 0);
    return { elec, heat, total: elec + heat, open };
  }, [rows]);

  const markets = f.kind === "heat" ? MARKET_HEAT : MARKET_ELEC;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["درآمد فروش برق", fmt(Math.round(stat.elec)) + " ریال", ""],
          ["درآمد فروش حرارت", fmt(Math.round(stat.heat)) + " ریال", ""],
          ["جمع درآمد", fmt(Math.round(stat.total)) + " ریال", "text-ok"],
          ["تسویه‌نشده", fmt(Math.round(stat.open)) + " ریال", stat.open > 0 ? "text-danger" : ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-8">
          <DateInput className="input" value={f.sale_date} onChange={(v: string) => setF({ ...f, sale_date: v })} />
          <select className="input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value, market: e.target.value === "heat" ? "steam" : "bourse", unit: e.target.value === "heat" ? "GJ" : "kWh" })}>
            <option value="electricity">فروش برق</option><option value="heat">فروش حرارت</option>
          </select>
          <select className="input" value={f.market} onChange={e => setF({ ...f, market: e.target.value })}>
            {Object.entries(markets).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" value={f.contract_id} title="قرارداد بلندمدت"
            onChange={e => { const c = contracts.find(x => x.id === e.target.value); setF({ ...f, contract_id: e.target.value, kind: c?.kind || f.kind, buyer: c?.party || f.buyer, contract_no: c?.contract_no || f.contract_no, price_per_unit: c ? String(c.base_price) : f.price_per_unit, unit: c?.unit || f.unit }); }}>
            <option value="">بدون قرارداد</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <input className="input" placeholder="خریدار" value={f.buyer} onChange={e => setF({ ...f, buyer: e.target.value })} />
          <input className="input" dir="ltr" placeholder={`مقدار (${f.unit})`} value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} />
          <input className="input" dir="ltr" placeholder="نرخ واحد (ریال)" value={f.price_per_unit} onChange={e => setF({ ...f, price_per_unit: e.target.value })} />
          <button className="btn-primary" onClick={add}>ثبت فروش</button>
          {num(f.quantity) > 0 && num(f.price_per_unit) > 0 && (
            <div className="md:col-span-8 rounded-lg bg-primary/[0.06] px-3 py-1.5 text-xs font-bold text-primary">مبلغ کل: {fmt(total)} ریال</div>
          )}
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className="th">تاریخ</th><th className="th">نوع</th><th className="th">بازار/خریدار</th><th className="th">مقدار</th>
            <th className="th">نرخ</th><th className="th">مبلغ کل</th><th className="th">وضعیت</th>{canEdit && <th className="th"></th>}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="td">{fmtDate(r.sale_date)}</td>
                <td className="td"><span className={`chip ${r.kind === "heat" ? "bg-danger/10 text-danger" : "bg-blueprint/10 text-blueprint"}`}>{r.kind === "heat" ? "حرارت" : "برق"}</span></td>
                <td className="td text-xs">{marketLabel(r.market)}{r.buyer ? ` · ${r.buyer}` : ""}</td>
                <td className="td">{fmt(r.quantity)} {r.unit}</td>
                <td className="td">{fmt(r.price_per_unit)}</td>
                <td className="td font-black">{fmt(r.total)}</td>
                <td className="td">
                  <span className="flex flex-wrap items-center gap-1">
                    {r.status === "settled" ? <span className="chip bg-ok/10 text-ok">تسویه‌شده</span>
                      : canEdit ? <button className="btn-primary py-0.5 text-xs" onClick={() => settle(r)}>تسویه شد</button>
                      : <span className="chip bg-crane/15">تسویه‌نشده</span>}
                    {canEdit && <PostToAccounting projectId={projectId} profile={profile} onDone={load} label="درآمد ←"
                      txn={{ type: "income", amount: num(r.total), counterparty: r.buyer || marketLabel(r.market),
                        description: `فروش ${r.kind === "heat" ? "حرارت" : "برق"} — ${marketLabel(r.market)}${r.contract_no ? ` (${r.contract_no})` : ""}`,
                        txn_date: r.sale_date, source_table: "chp_sales", source_id: r.id }} />}
                  </span>
                </td>
                {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => remove(r)}>حذف</button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 8 : 7}>فروشی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
