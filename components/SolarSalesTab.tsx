"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { num } from "@/lib/num";
import { logAction } from "@/lib/log";
import DateInput from "@/components/DateInput";
import ExcelIO from "@/components/ExcelIO";
import PostToAccounting from "@/components/PostToAccounting";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgPie, svgHBars, svgBars, CH } from "@/lib/export";

export const MARKETS: Record<string, string> = {
  bourse: "بورس انرژی", guaranteed: "خرید تضمینی", direct: "قرارداد دوجانبه",
};
const SALE_STATUS: Record<string, string> = { open: "تسویه‌نشده", settled: "تسویه‌شده", overdue: "معوق" };
const today = () => new Date().toISOString().slice(0, 10);

export default function SolarSalesTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"sales" | "prices">("sales");
  const [rows, setRows] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [gen, setGen] = useState<any[]>([]);
  const [f, setF] = useState({ sale_date: today(), market: "bourse", buyer: "", contract_no: "", kwh: "", price_per_kwh: "", settlement_date: "", note: "" });
  const [pf, setPf] = useState({ price_date: today(), market: "bourse", price_per_kwh: "", note: "" });

  const load = () => {
    supabase.from("solar_sales").select("*").eq("project_id", projectId).order("sale_date", { ascending: false })
      .then(({ data }: any) => setRows(data || []));
    supabase.from("solar_prices").select("*").eq("project_id", projectId).order("price_date", { ascending: false }).limit(200)
      .then(({ data }: any) => setPrices(data || []));
    supabase.from("solar_generation").select("log_date, kwh").eq("project_id", projectId)
      .then(({ data }: any) => setGen(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!num(f.kwh)) return;
    const total = num(f.kwh) * num(f.price_per_kwh);
    await supabase.from("solar_sales").insert({
      project_id: projectId, sale_date: f.sale_date, market: f.market, buyer: f.buyer,
      contract_no: f.contract_no, kwh: num(f.kwh), price_per_kwh: num(f.price_per_kwh),
      total, settlement_date: f.settlement_date || null, status: "open", note: f.note,
      created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت فروش برق",
      `${MARKETS[f.market]} — ${fmt(num(f.kwh))} kWh × ${fmt(num(f.price_per_kwh))} = ${fmt(total)} ریال`);
    setF({ ...f, kwh: "", price_per_kwh: "", buyer: "", contract_no: "", note: "" }); load();
  };

  const addPrice = async () => {
    if (!num(pf.price_per_kwh)) return;
    await supabase.from("solar_prices").insert({
      project_id: projectId, price_date: pf.price_date, market: pf.market,
      price_per_kwh: num(pf.price_per_kwh), note: pf.note,
    });
    setPf({ ...pf, price_per_kwh: "", note: "" }); load();
  };

  const settle = async (r: any) => {
    await supabase.from("solar_sales").update({ status: "settled", settlement_date: today() }).eq("id", r.id);
    logAction(projectId, profile.id, "تسویه فروش برق", `${fmt(r.total)} ریال — ${r.buyer || MARKETS[r.market]}`);
    load();
  };
  const del = async (t: string, r: any) => {
    if (!confirm("این رکورد حذف شود؟")) return;
    await supabase.from(t).delete().eq("id", r.id); load();
  };

  // ---------- تحلیل ----------
  const stat = useMemo(() => {
    const kwh = rows.reduce((s, r) => s + num(r.kwh), 0);
    const total = rows.reduce((s, r) => s + num(r.total), 0);
    const open = rows.filter(r => r.status !== "settled").reduce((s, r) => s + num(r.total), 0);
    const avg = kwh ? total / kwh : 0;
    const produced = gen.reduce((s, g) => s + num(g.kwh), 0);
    return { kwh, total, open, avg, produced, soldPct: produced ? (kwh / produced) * 100 : 0 };
  }, [rows, gen]);

  const byMonth = useMemo(() => {
    const m: Record<string, { kwh: number; total: number }> = {};
    for (const r of rows) {
      const k = String(r.sale_date).slice(0, 7);
      m[k] = m[k] || { kwh: 0, total: 0 };
      m[k].kwh += num(r.kwh); m[k].total += num(r.total);
    }
    return Object.entries(m).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  const byMarket = useMemo(() => Object.keys(MARKETS).map(k => ({
    name: MARKETS[k],
    kwh: rows.filter(r => r.market === k).reduce((s, r) => s + num(r.kwh), 0),
    total: rows.filter(r => r.market === k).reduce((s, r) => s + num(r.total), 0),
  })).filter(x => x.kwh > 0), [rows]);

  const priceTrend = useMemo(() => [...prices].sort((a, b) => String(a.price_date).localeCompare(String(b.price_date))), [prices]);

  const salesPdf = () => printPdf("گزارش فروش برق و بورس انرژی", "معاملات، قیمت‌ها و تسویه",
    kpis([["جمع انرژی فروخته‌شده", faN(Math.round(stat.kwh)) + " kWh"],
      ["جمع درآمد", faN(Math.round(stat.total)) + " ریال"],
      ["میانگین نرخ فروش", faN(Math.round(stat.avg)) + " ریال/kWh"],
      ["مطالبات تسویه‌نشده", faN(Math.round(stat.open)) + " ریال"]]) +
    (byMonth.length > 1 ? svgLines("روند درآمد ماهانه", byMonth.map(x => x.month),
      [{ name: "درآمد", color: CH.primary, values: byMonth.map(x => Math.round(x.total)) }], "ریال") : "") +
    (byMonth.length > 1 ? svgBars("انرژی فروخته‌شده در برابر درآمد (ماهانه)", byMonth.map(x => x.month), [
      { name: "انرژی (kWh)", color: CH.palette[2], values: byMonth.map(x => Math.round(x.kwh)) }]) : "") +
    (byMarket.length ? svgPie("سهم بازارها از درآمد", byMarket.map(x => ({ name: x.name, value: Math.round(x.total) }))) : "") +
    (priceTrend.length > 1 ? svgLines("روند قیمت بازار", priceTrend.map(p => faD(p.price_date)),
      [{ name: "نرخ (ریال/kWh)", color: CH.accent, values: priceTrend.map(p => num(p.price_per_kwh)) }]) : "") +
    (byMarket.length ? svgHBars("میانگین نرخ فروش هر بازار", byMarket.map(x => ({
      name: x.name, value: Math.round(x.total / x.kwh), note: faN(Math.round(x.total / x.kwh)) + " ریال/kWh" }))) : "") +
    "<h2>معاملات</h2>" + tbl(["تاریخ", "بازار", "خریدار", "قرارداد", "انرژی (kWh)", "نرخ", "مبلغ کل", "وضعیت"],
      rows.map(r => [faD(r.sale_date), MARKETS[r.market], r.buyer || "—", r.contract_no || "—",
        faN(r.kwh), faN(r.price_per_kwh), faN(r.total), SALE_STATUS[r.status]])));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["انرژی فروخته‌شده", fmt(Math.round(stat.kwh)) + " kWh"],
          ["جمع درآمد", fmt(Math.round(stat.total)) + " ریال"],
          ["میانگین نرخ", fmt(Math.round(stat.avg)) + " ریال/kWh"],
          ["تسویه‌نشده", fmt(Math.round(stat.open)) + " ریال"],
          ["نسبت فروش به تولید", stat.soldPct ? Math.round(stat.soldPct).toLocaleString("fa-IR") + "٪" : "—"]].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${l === "تسویه‌نشده" && stat.open > 0 ? "text-danger" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className={`chip ${sub === "sales" ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub("sales")}>معاملات فروش</button>
        <button className={`chip ${sub === "prices" ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub("prices")}>نرخ‌های بازار</button>
      </div>

      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load} pdf={salesPdf}
          table={sub === "sales" ? "solar_sales" : "solar_prices"} rows={sub === "sales" ? rows : prices} />
      </div>

      {sub === "sales" && (<>
        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-7">
            <DateInput value={f.sale_date} onChange={(v: string) => setF({ ...f, sale_date: v })} />
            <select className="input" value={f.market} onChange={e => setF({ ...f, market: e.target.value })}>
              {Object.entries(MARKETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input" placeholder="خریدار" value={f.buyer} onChange={e => setF({ ...f, buyer: e.target.value })} />
            <input className="input" placeholder="شماره قرارداد" value={f.contract_no} onChange={e => setF({ ...f, contract_no: e.target.value })} />
            <input className="input" dir="ltr" placeholder="انرژی (kWh)" value={f.kwh} onChange={e => setF({ ...f, kwh: e.target.value })} />
            <input className="input" dir="ltr" placeholder="نرخ (ریال/kWh)" value={f.price_per_kwh} onChange={e => setF({ ...f, price_per_kwh: e.target.value })} />
            <button className="btn-primary" onClick={add}>ثبت فروش</button>
            {num(f.kwh) > 0 && num(f.price_per_kwh) > 0 && (
              <div className="md:col-span-7 rounded-lg bg-primary/[0.06] px-3 py-1.5 text-xs font-bold text-primary">
                مبلغ کل: {fmt(num(f.kwh) * num(f.price_per_kwh))} ریال
              </div>
            )}
          </div>
        )}
        <div className="card overflow-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">تاریخ</th><th className="th">بازار</th><th className="th">خریدار</th>
              <th className="th">انرژی</th><th className="th">نرخ</th><th className="th">مبلغ کل</th>
              <th className="th">وضعیت</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="td">{fmtDate(r.sale_date)}</td>
                  <td className="td"><span className="chip bg-surface">{MARKETS[r.market]}</span></td>
                  <td className="td">{r.buyer || "—"}{r.contract_no && <span className="mr-1 code-chip">{r.contract_no}</span>}</td>
                  <td className="td">{fmt(r.kwh)}</td>
                  <td className="td">{fmt(r.price_per_kwh)}</td>
                  <td className="td font-black">{fmt(r.total)}</td>
                  <td className="td">
                    <span className="flex flex-wrap items-center gap-1">
                      {r.status === "settled"
                        ? <span className="chip bg-ok/10 text-ok">تسویه‌شده {fmtDate(r.settlement_date)}</span>
                        : canEdit
                          ? <button className="btn-primary py-0.5 text-xs" onClick={() => settle(r)}>تسویه شد</button>
                          : <span className="chip bg-crane/15">تسویه‌نشده</span>}
                      {canEdit && <PostToAccounting projectId={projectId} profile={profile} onDone={load}
                        label="درآمد ←" txn={{
                          type: "income", amount: num(r.total),
                          counterparty: r.buyer || MARKETS[r.market],
                          description: `فروش برق — ${MARKETS[r.market]}${r.contract_no ? ` (${r.contract_no})` : ""}`,
                          txn_date: r.sale_date,
                          source_table: "solar_sales", source_id: r.id,
                        }} />}
                    </span>
                  </td>
                  {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => del("solar_sales", r)}>حذف</button></td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="td text-ink/40" colSpan={8}>فروشی ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {sub === "prices" && (<>
        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-5">
            <DateInput value={pf.price_date} onChange={(v: string) => setPf({ ...pf, price_date: v })} />
            <select className="input" value={pf.market} onChange={e => setPf({ ...pf, market: e.target.value })}>
              {Object.entries(MARKETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="input" dir="ltr" placeholder="نرخ (ریال/kWh)" value={pf.price_per_kwh} onChange={e => setPf({ ...pf, price_per_kwh: e.target.value })} />
            <input className="input" placeholder="توضیح" value={pf.note} onChange={e => setPf({ ...pf, note: e.target.value })} />
            <button className="btn-primary" onClick={addPrice}>ثبت نرخ</button>
          </div>
        )}
        <div className="card overflow-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">تاریخ</th><th className="th">بازار</th><th className="th">نرخ (ریال/kWh)</th>
              <th className="th">توضیح</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>
              {prices.map(p => (
                <tr key={p.id}>
                  <td className="td">{fmtDate(p.price_date)}</td>
                  <td className="td">{MARKETS[p.market] || p.market}</td>
                  <td className="td font-black">{fmt(p.price_per_kwh)}</td>
                  <td className="td text-xs text-ink/60">{p.note || "—"}</td>
                  {canEdit && <td className="td"><button className="text-xs text-danger" onClick={() => del("solar_prices", p)}>حذف</button></td>}
                </tr>
              ))}
              {prices.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>نرخی ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}
