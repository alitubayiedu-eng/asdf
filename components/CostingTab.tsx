"use client";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { isoToJalali, FA_MONTHS, jalaliToIso } from "@/lib/jalali";
import { costByName } from "@/lib/inventory";
import { printPdf, tbl, kpis, faN, svgBars, svgHBars, svgPie, CH } from "@/lib/export";

export default function CostingTab({ projectId, profile, canEdit }: any) {
  const [overheads, setOverheads] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const month = new Date().toISOString().slice(0, 7);
  // ۲۴ ماه اخیر به شمسی — مقدار ذخیره‌شده همچنان YYYY-MM میلادی است
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const iso = d.toISOString().slice(0, 7);
    const j = isoToJalali(iso + "-15");
    return { iso, label: j ? `${FA_MONTHS[j.m - 1]} ${String(j.y).replace(/\d/g, x => "۰۱۲۳۴۵۶۷۸۹"[+x])}` : iso };
  });
  const [f, setF] = useState({ month, labor: "", energy: "", maintenance: "", other: "" });

  const load = () => {
    supabase.from("overheads").select("*").eq("project_id", projectId).order("month", { ascending: false }).then(({ data }: any) => setOverheads(data || []));
    supabase.from("products").select("*").eq("project_id", projectId).then(({ data }: any) => setProducts(data || []));
    supabase.from("production_records").select("record_date, product_id, good_qty").eq("project_id", projectId).then(({ data }: any) => setRecords(data || []));
    supabase.from("warehouse_items").select("id, name").eq("project_id", projectId).then(({ data }: any) => setItems(data || []));
    supabase.from("warehouse_txns").select("item_id, type, qty, unit_price").eq("project_id", projectId).limit(20000).then(({ data }: any) => setTxns(data || []));
    supabase.from("sales_orders").select("product_id, qty, unit_price, status").eq("project_id", projectId).then(({ data }: any) => setOrders(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    const exist = overheads.find(o => o.month === f.month);
    const row = { project_id: projectId, month: f.month, labor: num(f.labor) || 0, energy: num(f.energy) || 0, maintenance: num(f.maintenance) || 0, other: num(f.other) || 0 };
    if (exist) await supabase.from("overheads").update(row).eq("id", exist.id);
    else await supabase.from("overheads").insert(row);
    logAction(projectId, profile.id, "ثبت سربار ماهانه", f.month);
    load();
  };

  const table = useMemo(() => {
    const rawCost = costByName(items, txns);   // بهای میانگین موزون واقعی هر ماده
    const ohRow = overheads.find(o => o.month === f.month);
    const totalOh = ohRow ? num(ohRow.labor) + num(ohRow.energy) + num(ohRow.maintenance) + num(ohRow.other) : 0;
    const mRecs = records.filter(r => (r.record_date || "").startsWith(f.month));
    const totalQty = mRecs.reduce((s, r) => s + num(r.good_qty || 0), 0);
    const ohPerUnit = totalQty ? totalOh / totalQty : 0;
    return products.map(p => {
      const matCost = (p.bom || []).reduce((s: number, b: any) => s + num(b.qty) * (rawCost[String(b.material).trim()] ?? num(b.unit_price)), 0);
      const qty = mRecs.filter(r => r.product_id === p.id).reduce((s, r) => s + num(r.good_qty || 0), 0);
      const cost = matCost + ohPerUnit;
      const sale = num(p.sale_price || 0);
      const margin = sale ? Math.round((sale - cost) / sale * 100) : null;
      return { id: p.id, name: p.name, unit: p.unit, qty, matCost, ohPerUnit, cost, sale, margin };
    });
  }, [overheads, products, records, items, txns, f.month]);

  // سودآوری فروش (B2B): درآمد و بهای تمام‌شده کالای فروش‌رفته (COGS)
  const profit = useMemo(() => {
    const costMap: Record<string, number> = Object.fromEntries(table.map(r => [r.id, r.cost]));
    let rev = 0, cogs = 0;
    for (const o of orders) { rev += num(o.qty) * num(o.unit_price); cogs += num(o.qty) * (costMap[o.product_id] || 0); }
    return { rev, cogs, gp: rev - cogs, gm: rev ? Math.round((rev - cogs) / rev * 100) : null };
  }, [table, orders]);

  const oh = overheads.find(o => o.month === f.month);

  const cPdf = () => {
    const o = overheads.find(x => x.month === f.month);
    const parts = o ? [
      { name: "دستمزد", value: num(o.labor) }, { name: "انرژی", value: num(o.energy) },
      { name: "نت و تعمیرات", value: num(o.maintenance) }, { name: "سایر", value: num(o.other) },
    ] : [];
    printPdf("گزارش بهای تمام‌شده", `ماه ${f.month} — مواد بر اساس BOM و سربار سرشکن‌شده`,
      kpis([["محصولات", faN(table.length)],
        ["تولید ماه", faN(table.reduce((s, r) => s + r.qty, 0))],
        ["جمع سربار ماه", faN(parts.reduce((s, p) => s + p.value, 0)) + " ریال"],
        ["محصولات با حاشیه زیر ۱۵٪", faN(table.filter(r => r.margin != null && r.margin < 15).length)]]) +
      (table.length ? svgBars("بهای تمام‌شده در برابر قیمت فروش (هر واحد)", table.map(r => r.name), [
        { name: "بهای تمام‌شده", color: CH.danger, values: table.map(r => Math.round(r.cost)) },
        { name: "قیمت فروش", color: CH.ok, values: table.map(r => r.sale) }], "ریال") : "") +
      (table.length ? svgHBars("حاشیه سود هر محصول (٪)", table.map(r => ({
        name: r.name, value: r.margin ?? 0,
        color: r.margin == null ? CH.muted : r.margin < 15 ? CH.danger : CH.ok,
        note: r.margin == null ? "—" : faN(r.margin) + "٪" }))) : "") +
      (parts.some(p => p.value) ? svgPie("ترکیب سربار ماه", parts) : "") +
      (table.length ? svgBars("ساختار بهای تمام‌شده هر واحد", table.map(r => r.name), [
        { name: "هزینه مواد (BOM)", color: CH.primary, values: table.map(r => Math.round(r.matCost)) },
        { name: "سربار سرشکن‌شده", color: CH.accent, values: table.map(r => Math.round(r.ohPerUnit)) }], "ریال") : "") +
      "<h2>جدول بهای تمام‌شده</h2>" + tbl(["محصول", "تولید ماه", "مواد/واحد", "سربار/واحد", "بهای تمام‌شده/واحد", "قیمت فروش", "حاشیه سود"],
        table.map(r => [r.name, `${faN(r.qty)} ${r.unit || ""}`, faN(Math.round(r.matCost)), faN(Math.round(r.ohPerUnit)),
          faN(Math.round(r.cost)), faN(r.sale), r.margin == null ? "—" : faN(r.margin) + "٪"])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={cPdf}>خروجی PDF</button></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["درآمد فروش", fmt(Math.round(profit.rev)) + " ریال", ""],
          ["بهای تمام‌شده فروش (COGS)", fmt(Math.round(profit.cogs)) + " ریال", "text-danger"],
          ["سود ناخالص", fmt(Math.round(profit.gp)) + " ریال", profit.gp < 0 ? "text-danger" : "text-ok"],
          ["حاشیه سود ناخالص", profit.gm == null ? "—" : profit.gm.toLocaleString("fa-IR") + "٪", profit.gm != null && profit.gm < 15 ? "text-danger" : ""]] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>
      <div className="card grid gap-2 md:grid-cols-7">
        <select className="input" value={f.month} onChange={e => setF({ ...f, month: e.target.value })}>
          {monthOptions.map(o => <option key={o.iso} value={o.iso}>{o.label}</option>)}
        </select>
        <input className="input" dir="ltr" placeholder="دستمزد ماه (ریال)" value={f.labor || (oh?.labor ?? "")} onChange={e => setF({ ...f, labor: e.target.value })} disabled={!canEdit} />
        <input className="input" dir="ltr" placeholder="انرژی (ریال)" value={f.energy || (oh?.energy ?? "")} onChange={e => setF({ ...f, energy: e.target.value })} disabled={!canEdit} />
        <input className="input" dir="ltr" placeholder="نت و تعمیرات (ریال)" value={f.maintenance || (oh?.maintenance ?? "")} onChange={e => setF({ ...f, maintenance: e.target.value })} disabled={!canEdit} />
        <input className="input" dir="ltr" placeholder="سایر سربار (ریال)" value={f.other || (oh?.other ?? "")} onChange={e => setF({ ...f, other: e.target.value })} disabled={!canEdit} />
        {canEdit && <button className="btn-primary" onClick={save}>ثبت سربار ماه</button>}
        <p className="self-center text-[11px] text-ink/40">سربار بر کل تولید ماه سرشکن می‌شود؛ هزینه مواد از BOM محاسبه می‌شود.</p>
      </div>
      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className="th">محصول</th><th className="th">تولید ماه</th><th className="th">مواد / واحد</th>
            <th className="th">سربار / واحد</th><th className="th">بهای تمام‌شده / واحد</th>
            <th className="th">قیمت فروش</th><th className="th">حاشیه سود</th>
          </tr></thead>
          <tbody>
            {table.map(r => (
              <tr key={r.name}>
                <td className="td font-bold">{r.name}</td>
                <td className="td">{fmt(r.qty)} {r.unit}</td>
                <td className="td">{fmt(Math.round(r.matCost))}</td>
                <td className="td">{fmt(Math.round(r.ohPerUnit))}</td>
                <td className="td font-black">{fmt(Math.round(r.cost))}</td>
                <td className="td">{fmt(r.sale)}</td>
                <td className={`td font-black ${r.margin == null ? "" : r.margin < 15 ? "text-danger" : "text-ok"}`}>{r.margin == null ? "—" : r.margin.toLocaleString("fa-IR") + "٪"}</td>
              </tr>
            ))}
            {table.length === 0 && <tr><td className="td text-ink/40" colSpan={7}>ابتدا در تب تولید، محصول و BOM تعریف کنید.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
