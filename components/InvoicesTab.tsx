"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, daysBetween } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import PostToAccounting from "@/components/PostToAccounting";
import { exportExcel, printPdf, tbl, kpis, faN } from "@/lib/export";

const today = () => new Date().toISOString().slice(0, 10);
const STATUS: Record<string, string> = { draft: "پیش‌نویس", issued: "صادرشده", paid: "تسویه‌شده", overdue: "معوق", void: "ابطال" };
const BUCKETS = ["جاری", "۱ تا ۳۰ روز", "۳۱ تا ۶۰ روز", "۶۱ تا ۹۰ روز", "بیش از ۹۰ روز"];
const bucketOf = (due?: string) => {
  if (!due) return "جاری";
  const d = daysBetween(due, today());       // مثبت یعنی از سررسید گذشته
  if (d <= 0) return "جاری";
  if (d <= 30) return "۱ تا ۳۰ روز";
  if (d <= 60) return "۳۱ تا ۶۰ روز";
  if (d <= 90) return "۶۱ تا ۹۰ روز";
  return "بیش از ۹۰ روز";
};

export default function InvoicesTab({ projectId, profile, canEdit }: any) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [nf, setNf] = useState<any>({ customer_id: "", due_date: "", vat_rate: "10", discount: "", payment_terms: "", note: "" });
  const [lines, setLines] = useState<any[]>([{ product: "", qty: "", unit_price: "" }]);

  const load = async () => {
    const { data: inv } = await supabase.from("sales_invoices").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(3000);
    setInvoices(inv || []);
    supabase.from("customers").select("*").eq("project_id", projectId).order("name").then(({ data }: any) => setCustomers(data || []));
    supabase.from("products").select("*").eq("project_id", projectId).then(({ data }: any) => setProducts(data || []));
    supabase.from("sales_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).then(({ data }: any) => setOrders(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const setLine = (i: number, k: string, v: string) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const subtotal = lines.reduce((s, l) => s + num(l.qty) * num(l.unit_price), 0);
  const vat = Math.round((subtotal - num(nf.discount)) * num(nf.vat_rate) / 100);
  const total = subtotal - num(nf.discount) + vat;

  const createInvoice = async (fromOrder?: any) => {
    const cid = fromOrder ? fromOrder.customer_id : nf.customer_id;
    const cust = customers.find(c => c.id === cid);
    const L = fromOrder
      ? [{ product: fromOrder.product_name, qty: num(fromOrder.qty), unit_price: num(fromOrder.unit_price) }]
      : lines.filter(l => l.product && num(l.qty) > 0).map(l => ({ product: l.product, qty: num(l.qty), unit_price: num(l.unit_price) }));
    if (!cust || !L.length) { alert("مشتری و حداقل یک ردیف لازم است."); return; }
    const sub = L.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const disc = fromOrder ? 0 : num(nf.discount);
    const rate = num(nf.vat_rate) || 0;
    const v = Math.round((sub - disc) * rate / 100);
    const inv_no = `INV-${String(invoices.length + 1).padStart(4, "0")}`;
    await supabase.from("sales_invoices").insert({
      project_id: projectId, invoice_no: inv_no, customer_id: cust.id, customer_name: cust.name,
      order_id: fromOrder?.id || null, issue_date: today(), due_date: (fromOrder ? fromOrder.delivery_date : nf.due_date) || null,
      lines: L, subtotal: sub, discount: disc, vat_rate: rate, vat: v, total: sub - disc + v, paid: 0,
      status: "issued", payment_terms: nf.payment_terms || null, note: nf.note || null, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "صدور فاکتور فروش", `${inv_no} — ${cust.name} — ${fmt(sub - disc + v)} ریال`);
    setNf({ customer_id: "", due_date: "", vat_rate: "10", discount: "", payment_terms: "", note: "" });
    setLines([{ product: "", qty: "", unit_price: "" }]);
    load();
  };

  const markPaid = async (inv: any) => {
    await supabase.from("sales_invoices").update({ paid: inv.total, status: "paid" }).eq("id", inv.id);
    load();
  };
  const removeInv = async (inv: any) => {
    if (await deleteRow("sales_invoices", inv, { projectId, profile, label: "فاکتور فروش", detail: `${inv.invoice_no} — ${inv.customer_name}` })) load();
  };

  // ── دفتر معین اشخاص + سنی‌سازی مطالبات ──
  const openInv = invoices.filter(i => i.status !== "paid" && i.status !== "void");
  const aging = useMemo(() => {
    const byCust: Record<string, { name: string; total: number; b: Record<string, number> }> = {};
    for (const i of openInv) {
      const bal = num(i.total) - num(i.paid);
      if (bal <= 0) continue;
      const k = i.customer_name || "—";
      byCust[k] = byCust[k] || { name: k, total: 0, b: Object.fromEntries(BUCKETS.map(b => [b, 0])) };
      byCust[k].total += bal;
      byCust[k].b[bucketOf(i.due_date)] += bal;
    }
    return Object.values(byCust).sort((a, b) => b.total - a.total);
  }, [invoices]);
  const bucketTotals = BUCKETS.map(b => aging.reduce((s, r) => s + r.b[b], 0));
  const totalAR = aging.reduce((s, r) => s + r.total, 0);
  const totalSales = invoices.reduce((s, i) => s + num(i.total), 0);
  const overdue = openInv.filter(i => i.due_date && i.due_date < today()).reduce((s, i) => s + num(i.total) - num(i.paid), 0);

  const agingPdf = () => printPdf("دفتر معین اشخاص و سنی‌سازی مطالبات", "مانده هر مشتری به تفکیک بازه سررسید",
    kpis([["جمع فروش (با مالیات)", faN(Math.round(totalSales)) + " ریال"], ["مطالبات باز", faN(Math.round(totalAR)) + " ریال"],
      ["مطالبات معوق", faN(Math.round(overdue)) + " ریال"], ["تعداد فاکتور باز", faN(openInv.length)]]) +
    "<h2>سنی‌سازی مطالبات</h2>" + tbl(["مشتری", ...BUCKETS, "جمع مانده"],
      aging.map(r => [r.name, ...BUCKETS.map(b => faN(Math.round(r.b[b]))), faN(Math.round(r.total))]).concat([
        ["جمع", ...bucketTotals.map(v => faN(Math.round(v))), faN(Math.round(totalAR))] as any])));

  const xlsx = () => exportExcel("فاکتورها و مطالبات", [
    { name: "فاکتورها", rows: [["شماره", "مشتری", "تاریخ", "سررسید", "جمع کل", "وصول‌شده", "مانده", "وضعیت"],
      ...invoices.map(i => [i.invoice_no, i.customer_name, i.issue_date, i.due_date || "—", num(i.total), num(i.paid), num(i.total) - num(i.paid), STATUS[i.status]])] },
    { name: "سنی‌سازی مطالبات", rows: [["مشتری", ...BUCKETS, "جمع"], ...aging.map(r => [r.name, ...BUCKETS.map(b => Math.round(r.b[b])), Math.round(r.total)])] },
  ]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["جمع فروش (با مالیات)", fmt(Math.round(totalSales)) + " ریال", ""],
          ["مطالبات باز (AR)", fmt(Math.round(totalAR)) + " ریال", ""],
          ["مطالبات معوق", fmt(Math.round(overdue)) + " ریال", overdue > 0 ? "text-danger" : ""],
          ["فاکتورهای باز", fmt(openInv.length), ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="card py-2 flex flex-wrap justify-end gap-2">
        <button className="btn-ghost py-1 text-xs" onClick={xlsx}>خروجی اکسل</button>
        <button className="btn-ghost py-1 text-xs" onClick={agingPdf}>PDF سنی‌سازی مطالبات</button>
      </div>

      {/* صدور فاکتور جدید */}
      {canEdit && (
        <div className="card space-y-2">
          <h2 className="font-black">صدور فاکتور فروش</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <div><label className="label">مشتری</label>
              <select className="input" value={nf.customer_id} onChange={e => setNf({ ...nf, customer_id: e.target.value })}>
                <option value="">انتخاب مشتری…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="label">سررسید پرداخت</label><DateInput className="input" value={nf.due_date} onChange={(v: string) => setNf({ ...nf, due_date: v })} /></div>
            <div><label className="label">شرایط پرداخت</label><input className="input" placeholder="نقدی / ۳۰ روزه / چک" value={nf.payment_terms} onChange={e => setNf({ ...nf, payment_terms: e.target.value })} /></div>
            <div><label className="label">تخفیف (ریال)</label><input className="input" dir="ltr" value={nf.discount} onChange={e => setNf({ ...nf, discount: e.target.value })} /></div>
          </div>
          {/* ردیف‌ها */}
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-8 gap-2">
              <input className="input col-span-4" list="inv-products" placeholder="کالا / خدمت" value={l.product} onChange={e => setLine(i, "product", e.target.value)} />
              <input className="input" dir="ltr" placeholder="تعداد" value={l.qty} onChange={e => setLine(i, "qty", e.target.value)} />
              <input className="input col-span-2" dir="ltr" placeholder="فی (ریال)" value={l.unit_price} onChange={e => setLine(i, "unit_price", e.target.value)}
                onFocus={() => { const p = products.find(x => x.name === l.product); if (p && !l.unit_price) setLine(i, "unit_price", String(p.sale_price || "")); }} />
              <button className="btn-ghost" onClick={() => setLines(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)}>−</button>
            </div>
          ))}
          <datalist id="inv-products">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-ghost py-1 text-xs" onClick={() => setLines(ls => [...ls, { product: "", qty: "", unit_price: "" }])}>+ افزودن ردیف</button>
            <span className="text-xs">جمع: <b>{fmt(subtotal)}</b></span>
            <span className="flex items-center gap-1 text-xs">مالیات
              <input className="input w-14 py-0.5" dir="ltr" value={nf.vat_rate} onChange={e => setNf({ ...nf, vat_rate: e.target.value })} />٪ = <b>{fmt(vat)}</b></span>
            <span className="text-sm font-black text-primary">مبلغ نهایی: {fmt(total)} ریال</span>
            <button className="btn-primary mr-auto" onClick={() => createInvoice()}>صدور فاکتور</button>
          </div>
          {/* صدور سریع از سفارش فروش */}
          {orders.filter(o => !invoices.some(i => i.order_id === o.id)).length > 0 && (
            <div className="rounded-lg border border-line p-2">
              <div className="mb-1 text-[11px] font-bold text-ink/55">صدور سریع فاکتور از سفارش فروش:</div>
              <div className="flex flex-wrap gap-2">
                {orders.filter(o => !invoices.some(i => i.order_id === o.id)).slice(0, 8).map(o => (
                  <button key={o.id} className="chip border border-line hover:bg-surface" onClick={() => createInvoice(o)}>
                    {o.customer_name} · {o.product_name} · {fmt(num(o.qty) * num(o.unit_price))} ←
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* فهرست فاکتورها */}
      <div className="card overflow-auto p-0">
        <div className="border-b border-line px-3 py-2 text-sm font-black">فاکتورهای فروش</div>
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className="th">شماره</th><th className="th">مشتری</th><th className="th">تاریخ</th><th className="th">سررسید</th>
            <th className="th">مبلغ کل</th><th className="th">مانده</th><th className="th">وضعیت</th>{canEdit && <th className="th">اقدام</th>}
          </tr></thead>
          <tbody>
            {invoices.map(i => {
              const bal = num(i.total) - num(i.paid);
              const od = i.status !== "paid" && i.due_date && i.due_date < today();
              return (
                <tr key={i.id}>
                  <td className="td font-bold">{i.invoice_no}</td>
                  <td className="td">{i.customer_name}</td>
                  <td className="td">{fmtDate(i.issue_date)}</td>
                  <td className={`td ${od ? "font-bold text-danger" : ""}`}>{fmtDate(i.due_date)}{od ? " (معوق)" : ""}</td>
                  <td className="td font-bold">{fmt(i.total)}</td>
                  <td className={`td ${bal > 0 ? "text-danger" : "text-ok"}`}>{fmt(bal)}</td>
                  <td className="td"><span className={`chip ${i.status === "paid" ? "bg-ok/10 text-ok" : od ? "bg-danger/10 text-danger" : "bg-surface"}`}>{STATUS[i.status]}</span></td>
                  {canEdit && (
                    <td className="td">
                      <span className="flex flex-wrap items-center gap-1">
                        {i.status !== "paid" && <PostToAccounting projectId={projectId} profile={profile} onDone={() => markPaid(i)} label="دریافت ←"
                          txn={{ type: "income", amount: bal, counterparty: i.customer_name,
                            description: `وصول فاکتور ${i.invoice_no}`, source_table: "sales_invoices", source_id: i.id }} />}
                        <button className="text-[11px] text-danger" onClick={() => removeInv(i)}>حذف</button>
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
            {invoices.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 8 : 7}>فاکتوری صادر نشده است.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* سنی‌سازی مطالبات */}
      {aging.length > 0 && (
        <div className="card overflow-auto p-0">
          <div className="border-b border-line px-3 py-2 text-sm font-black">دفتر معین اشخاص — سنی‌سازی مطالبات</div>
          <table className="w-full">
            <thead className="bg-surface"><tr><th className="th">مشتری</th>{BUCKETS.map(b => <th key={b} className="th">{b}</th>)}<th className="th">جمع مانده</th></tr></thead>
            <tbody>
              {aging.map(r => (
                <tr key={r.name}>
                  <td className="td font-bold">{r.name}</td>
                  {BUCKETS.map(b => <td key={b} className={`td ${b !== "جاری" && r.b[b] > 0 ? "text-danger" : ""}`}>{r.b[b] ? fmt(Math.round(r.b[b])) : "—"}</td>)}
                  <td className="td font-black">{fmt(Math.round(r.total))}</td>
                </tr>
              ))}
              <tr className="bg-surface font-black">
                <td className="td">جمع کل</td>
                {bucketTotals.map((v, i) => <td key={i} className="td">{v ? fmt(Math.round(v)) : "—"}</td>)}
                <td className="td">{fmt(Math.round(totalAR))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
