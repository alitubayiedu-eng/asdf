"use client";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgBars, svgPie, svgHBars, CH } from "@/lib/export";

export default function FactoryDashboardTab({ projectId }: any) {
  const [records, setRecords] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [wos, setWos] = useState<any[]>([]);

  useEffect(() => {
    const g = (t: string, set: any) => supabase.from(t).select("*").eq("project_id", projectId).then(({ data }: any) => set(data || []));
    g("production_records", setRecords); g("products", setProducts);
    g("warehouse_items", setItems); g("warehouse_txns", setTxns);
    g("sales_orders", setOrders); g("maintenance_orders", setWos);
  }, [projectId]);

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const kpi = useMemo(() => {
    const tRecs = records.filter(r => r.record_date === today);
    const mRecs = records.filter(r => (r.record_date || "").startsWith(month));
    const prodToday = tRecs.reduce((s, r) => s + num(r.good_qty || 0), 0);
    const prodMonth = mRecs.reduce((s, r) => s + num(r.good_qty || 0), 0);
    const scrapMonth = mRecs.reduce((s, r) => s + num(r.scrap_qty || 0), 0);
    const dtMonth = mRecs.reduce((s, r) => s + num(r.downtime_min || 0), 0);
    // OEE ماه: میانگین رکوردها (شیفت ۴۸۰ دقیقه)
    let oeeSum = 0, oeeN = 0;
    for (const r of mRecs) {
      const p = products.find(x => x.id === r.product_id);
      const avail = Math.max(480 - num(r.downtime_min || 0), 0) / 480;
      const cap = num(p?.capacity_per_hour || 0);
      const perf = cap ? Math.min(num(r.good_qty) / (cap * (480 - num(r.downtime_min || 0)) / 60 || 1), 1) : null;
      const tot = num(r.good_qty) + num(r.scrap_qty || 0);
      const qual = tot ? num(r.good_qty) / tot : 1;
      if (perf != null) { oeeSum += avail * perf * qual; oeeN++; }
    }
    return { prodToday, prodMonth, scrapMonth, dtMonth, oee: oeeN ? Math.round(oeeSum / oeeN * 100) : null };
  }, [records, products]);

  const stock = useMemo(() => {
    const s: Record<string, number> = {};
    for (const t of txns) s[t.item_id] = (s[t.item_id] || 0) + (t.type === "in" ? 1 : -1) * num(t.qty);
    return s;
  }, [txns]);
  const critical = items.filter(i => num(i.min_stock) > 0 && (stock[i.id] || 0) < num(i.min_stock));
  const openSales = orders.filter(o => o.status === "open");
  const openWos = wos.filter(w => w.status === "open");

  const STORES: Record<string, string> = { raw: "مواد اولیه", wip: "نیمه‌ساخته", finished: "محصول نهایی" };

  const dashPdf = () => {
    const mRecs = records.filter(r => (r.record_date || "").startsWith(month))
      .sort((a, b) => String(a.record_date).localeCompare(String(b.record_date)));
    const days = [...new Set(mRecs.map(r => r.record_date))];
    const daily = days.map(d => mRecs.filter(r => r.record_date === d).reduce((s, r) => s + num(r.good_qty || 0), 0));
    const dt: Record<string, number> = {};
    for (const r of mRecs) for (const d of r.downtimes || []) dt[d.reason] = (dt[d.reason] || 0) + num(d.minutes || 0);
    const byProd = products.map(p => ({ name: p.name, v: mRecs.filter(r => r.product_id === p.id).reduce((s, r) => s + num(r.good_qty || 0), 0) }));
    printPdf("گزارش مدیریتی کارخانه", `دوره ${month} — تولید، OEE، موجودی و سفارش‌ها`,
      kpis([["تولید امروز", faN(kpi.prodToday)], ["تولید این ماه", faN(kpi.prodMonth)],
        ["OEE ماه", kpi.oee == null ? "—" : faN(kpi.oee) + "٪"], ["ضایعات ماه", faN(kpi.scrapMonth)]]) +
      kpis([["توقفات ماه (دقیقه)", faN(kpi.dtMonth)], ["اقلام زیر نقطه سفارش", faN(critical.length)],
        ["سفارش فروش باز", faN(openSales.length)], ["دستور کار نت باز", faN(openWos.length)]]) +
      (days.length > 1 ? svgLines("تولید روزانه این ماه", days.map(d => faD(d)),
        [{ name: "تولید سالم", color: CH.primary, values: daily }]) : "") +
      (byProd.some(p => p.v) ? svgPie("سهم محصولات از تولید ماه", byProd.map(p => ({ name: p.name, value: p.v }))) : "") +
      (Object.keys(dt).length ? svgHBars("علل توقف این ماه", Object.entries(dt).sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value, color: CH.danger, note: faN(value) + " دقیقه" }))) : "") +
      (critical.length ? svgHBars("اقلام بحرانی — کسری تا نقطه سفارش", critical.map(i => ({
        name: i.name, value: num(i.min_stock) - (stock[i.id] || 0), color: CH.danger,
        note: `موجودی ${faN(stock[i.id] || 0)} از حداقل ${faN(i.min_stock)}` }))) : "") +
      "<h2>رکوردهای تولید ماه</h2>" + tbl(["تاریخ", "شیفت", "محصول", "سالم", "ضایعات", "توقف"],
        mRecs.slice(-40).reverse().map(r => [faD(r.record_date), r.shift, r.product_name,
          faN(r.good_qty), faN(r.scrap_qty), r.downtime_min ? faN(r.downtime_min) + " د" : "—"])) +
      (openSales.length ? "<h2>سفارش‌های فروش باز</h2>" + tbl(["مشتری", "محصول", "مقدار", "تاریخ تحویل"],
        openSales.map(o => [o.customer_name, o.product_name, faN(o.qty), faD(o.delivery_date)])) : "") +
      (openWos.length ? "<h2>دستور کارهای نت باز</h2>" + tbl(["دستگاه", "نوع", "شرح"],
        openWos.map(w => [w.machine_name, w.kind === "pm" ? "PM" : "تعمیر", w.issue])) : ""));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={dashPdf}>خروجی PDF گزارش مدیریتی</button></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["تولید امروز", fmt(kpi.prodToday)],
          ["تولید این ماه", fmt(kpi.prodMonth)],
          ["OEE ماه", kpi.oee == null ? "—" : kpi.oee.toLocaleString("fa-IR") + "٪"],
          ["توقفات ماه (دقیقه)", fmt(kpi.dtMonth)],
          ["ضایعات ماه", fmt(kpi.scrapMonth)],
        ].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${l === "OEE ماه" && kpi.oee != null ? (kpi.oee >= 65 ? "text-ok" : "text-danger") : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 font-black">موجودی بحرانی <span className="text-xs font-normal text-danger">{critical.length ? `${critical.length.toLocaleString("fa-IR")} قلم زیر نقطه سفارش` : ""}</span></h2>
          {critical.map(i => (
            <div key={i.id} className="mb-1 flex justify-between rounded-lg border border-danger/30 bg-danger/5 p-2 text-sm">
              <span className="font-bold">{i.name} <span className="text-[10px] text-ink/40">({STORES[i.store_type] || "عمومی"})</span></span>
              <span className="text-danger">{fmt(stock[i.id] || 0)} / حداقل {fmt(i.min_stock)}</span>
            </div>
          ))}
          {critical.length === 0 && <p className="text-sm text-ok">همه اقلام بالای نقطه سفارش هستند. ✓</p>}
        </div>

        <div className="card">
          <h2 className="mb-2 font-black">سفارش‌های فروش باز ({openSales.length.toLocaleString("fa-IR")})</h2>
          {openSales.slice(0, 6).map(o => (
            <div key={o.id} className="mb-1 flex justify-between rounded-lg border border-line p-2 text-sm">
              <span><b>{o.customer_name}</b> — {o.product_name}</span>
              <span className="text-xs text-ink/50">{fmt(o.qty)} · تحویل {fmtDate(o.delivery_date)}</span>
            </div>
          ))}
          {openSales.length === 0 && <p className="text-sm text-ink/40">سفارش بازی نیست.</p>}
        </div>

        <div className="card">
          <h2 className="mb-2 font-black">دستور کارهای نت باز ({openWos.length.toLocaleString("fa-IR")})</h2>
          {openWos.slice(0, 6).map(w => (
            <div key={w.id} className="mb-1 flex justify-between rounded-lg border border-line p-2 text-sm">
              <span><b>{w.machine_name}</b></span>
              <span className="max-w-40 truncate text-xs text-ink/50">{w.issue}</span>
            </div>
          ))}
          {openWos.length === 0 && <p className="text-sm text-ok">دستور کار بازی نیست. ✓</p>}
        </div>
      </div>

      <div className="card overflow-auto p-0">
        <div className="p-3 font-black">آخرین رکوردهای تولید</div>
        <table className="w-full">
          <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">شیفت</th><th className="th">محصول</th><th className="th">سالم</th><th className="th">ضایعات</th><th className="th">توقف</th></tr></thead>
          <tbody>
            {records.slice().sort((a, b) => (a.record_date < b.record_date ? 1 : -1)).slice(0, 8).map(r => (
              <tr key={r.id}>
                <td className="td">{fmtDate(r.record_date)}</td><td className="td">{r.shift}</td>
                <td className="td font-bold">{r.product_name}</td>
                <td className="td text-ok">{fmt(r.good_qty)}</td>
                <td className="td text-danger">{fmt(r.scrap_qty)}</td>
                <td className="td">{r.downtime_min ? fmt(r.downtime_min) + " د" : "—"}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>تولیدی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
