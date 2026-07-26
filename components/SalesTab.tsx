"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import PostToAccounting from "@/components/PostToAccounting";
import { printPdf, tbl, kpis, faN, faD, svgHBars, svgPie, svgLines, CH } from "@/lib/export";

export default function SalesTab({ projectId, profile, canEdit }: any) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cf, setCf] = useState({ name: "", city: "", phone: "" });
  const [of_, setOf] = useState({ customer_id: "", product_id: "", qty: "", unit_price: "", delivery_date: "" });

  const load = async () => {
    supabase.from("customers").select("*").eq("project_id", projectId).order("name").then(({ data }: any) => setCustomers(data || []));
    supabase.from("sales_orders").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).then(({ data }: any) => setOrders(data || []));
    supabase.from("products").select("*").eq("project_id", projectId).then(({ data }: any) => setProducts(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const addCustomer = async () => {
    if (!cf.name) return;
    await supabase.from("customers").insert({ project_id: projectId, ...cf });
    logAction(projectId, profile.id, "ثبت مشتری", cf.name);
    setCf({ name: "", city: "", phone: "" }); load();
  };

  const addOrder = async () => {
    const c = customers.find(x => x.id === of_.customer_id);
    const p = products.find(x => x.id === of_.product_id);
    if (!c || !p || !of_.qty) return;
    await supabase.from("sales_orders").insert({
      project_id: projectId, customer_id: c.id, customer_name: c.name,
      product_id: p.id, product_name: p.name, qty: num(of_.qty),
      unit_price: num(of_.unit_price) || p.sale_price || 0,
      delivery_date: of_.delivery_date || null, status: "open", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "سفارش فروش", `${c.name}: ${p.name} × ${fmt(num(of_.qty))}`);
    setOf({ customer_id: "", product_id: "", qty: "", unit_price: "", delivery_date: "" }); load();
  };

  // تحویل ← حواله خروج از انبار محصول نهایی
  const deliver = async (o: any) => {
    const { data: items } = await supabase.from("warehouse_items").select("*").eq("project_id", projectId);
    const fin = (items || []).find((i: any) => i.name === o.product_name && (i.store_type || "") === "finished");
    if (!fin) { alert("این محصول در انبار محصول نهایی موجود نیست."); return; }
    await supabase.from("warehouse_txns").insert({
      project_id: projectId, item_id: fin.id, type: "out", qty: o.qty, unit_price: o.unit_price,
      ref: `فروش به ${o.customer_name}`, note: "", created_by: profile.id,
    });
    await supabase.from("sales_orders").update({ status: "delivered" }).eq("id", o.id);
    logAction(projectId, profile.id, "تحویل سفارش فروش", `${o.customer_name} — ${o.product_name} × ${fmt(o.qty)}`);
    load();
  };
  const markPaid = async (o: any) => {
    await supabase.from("sales_orders").update({ status: "paid" }).eq("id", o.id);
    logAction(projectId, profile.id, "وصول سفارش فروش", `${o.customer_name} — ${fmt(o.qty * o.unit_price)} ریال`);
    load();
  };

  const totOpen = orders.filter(o => o.status !== "paid").reduce((s, o) => s + o.qty * o.unit_price, 0);
  const totSold = orders.reduce((s, o) => s + o.qty * o.unit_price, 0);

  const salesPdf = () => {
    const byCust: Record<string, number> = {}, byProd: Record<string, number> = {}, byMonth: Record<string, number> = {};
    for (const o of orders) {
      const amt = num(o.qty) * num(o.unit_price);
      byCust[o.customer_name] = (byCust[o.customer_name] || 0) + amt;
      byProd[o.product_name] = (byProd[o.product_name] || 0) + amt;
      const m = String(o.created_at || o.delivery_date || "").slice(0, 7);
      if (m) byMonth[m] = (byMonth[m] || 0) + amt;
    }
    const ms = Object.keys(byMonth).sort();
    printPdf("گزارش فروش و مشتریان", "سفارش‌ها، تحویل و مطالبات",
      kpis([["جمع فروش", faN(totSold) + " ریال"], ["مطالبات وصول‌نشده", faN(totOpen) + " ریال"],
        ["مشتریان", faN(customers.length)], ["سفارش‌های باز", faN(orders.filter(o => o.status === "open").length)]]) +
      (Object.keys(byCust).length ? svgHBars("فروش به تفکیک مشتری", Object.entries(byCust)
        .sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, note: faN(value) + " ریال" }))) : "") +
      (Object.keys(byProd).length ? svgPie("سهم محصولات از فروش",
        Object.entries(byProd).map(([name, value]) => ({ name, value }))) : "") +
      (ms.length > 1 ? svgLines("روند فروش ماهانه", ms,
        [{ name: "فروش", color: CH.primary, values: ms.map(m => byMonth[m]) }], "ریال") : "") +
      "<h2>سفارش‌های فروش</h2>" + tbl(["مشتری", "محصول", "مقدار", "فی", "مبلغ کل", "تحویل", "وضعیت"],
        orders.map(o => [o.customer_name, o.product_name, faN(o.qty), faN(o.unit_price),
          faN(num(o.qty) * num(o.unit_price)), faD(o.delivery_date),
          o.status === "paid" ? "تسویه‌شده" : o.status === "delivered" ? "تحویل‌شده" : "باز"])) +
      "<h2>مشتریان</h2>" + tbl(["نام", "شهر", "تلفن"], customers.map(c => [c.name, c.city || "—", c.phone || "—"])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 space-y-1">
        <ExcelIO table="customers" projectId={projectId} rows={customers} canEdit={canEdit} profile={profile} onDone={load} pdf={salesPdf} />
        <div className="border-t border-line pt-1">
          <ExcelIO table="sales_orders" projectId={projectId} rows={orders} canEdit={canEdit} profile={profile} onDone={load} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["جمع فروش ثبت‌شده", fmt(totSold) + " ریال"], ["مطالبات وصول‌نشده", fmt(totOpen) + " ریال"],
          ["مشتریان", customers.length.toLocaleString("fa-IR")]].map(([l, v]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className="mt-1.5 text-xl font-black tracking-tight">{v}</div></div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 font-black">مشتریان</h2>
          {canEdit && (
            <div className="mb-2 grid grid-cols-4 gap-2">
              <input className="input col-span-2" placeholder="نام مشتری" value={cf.name} onChange={e => setCf({ ...cf, name: e.target.value })} />
              <input className="input" placeholder="شهر" value={cf.city} onChange={e => setCf({ ...cf, city: e.target.value })} />
              <button className="btn-primary" onClick={addCustomer}>+</button>
            </div>
          )}
          {customers.map(c => (
            <div key={c.id} className="mb-1 rounded-lg border border-line p-2 text-sm">
              <b>{c.name}</b> <span className="text-xs text-ink/50">{c.city}</span>
            </div>
          ))}
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-2 font-black">سفارش‌های فروش</h2>
          {canEdit && (
            <div className="mb-2 grid grid-cols-6 gap-2">
              <select className="input" value={of_.customer_id} onChange={e => setOf({ ...of_, customer_id: e.target.value })}>
                <option value="">مشتری…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input" value={of_.product_id} onChange={e => setOf({ ...of_, product_id: e.target.value })}>
                <option value="">محصول…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="input" dir="ltr" placeholder="مقدار" value={of_.qty} onChange={e => setOf({ ...of_, qty: e.target.value })} />
              <input className="input" dir="ltr" placeholder="فی (ریال)" value={of_.unit_price} onChange={e => setOf({ ...of_, unit_price: e.target.value })} />
              <DateInput className="input" title="تاریخ تحویل" value={of_.delivery_date} onChange={v => setOf({ ...of_, delivery_date: v })} />
              <button className="btn-primary" onClick={addOrder}>ثبت سفارش</button>
            </div>
          )}
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead className="bg-surface"><tr><th className="th">مشتری</th><th className="th">محصول</th><th className="th">مقدار</th><th className="th">مبلغ کل</th><th className="th">تحویل</th><th className="th">وضعیت</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="td font-bold">{o.customer_name}</td><td className="td">{o.product_name}</td>
                    <td className="td">{fmt(o.qty)}</td><td className="td font-bold">{fmt(o.qty * o.unit_price)}</td>
                    <td className="td">{fmtDate(o.delivery_date)}</td>
                    <td className="td">
                      {o.status === "open" && (canEdit ? <button className="btn-accent py-0.5 text-xs" onClick={() => deliver(o)}>بارگیری ← حواله انبار</button> : <span className="chip bg-crane/20">باز</span>)}
                      {o.status === "delivered" && (canEdit
                        ? <PostToAccounting projectId={projectId} profile={profile} label="دریافت وجه ←" onDone={() => markPaid(o)}
                            txn={{ type: "income", amount: num(o.qty) * num(o.unit_price), counterparty: o.customer_name,
                              description: `فروش ${o.product_name} به ${o.customer_name}`, txn_date: o.delivery_date || undefined,
                              source_table: "sales_orders", source_id: o.id }} />
                        : <span className="chip chip-on">تحویل‌شده</span>)}
                      {o.status === "paid" && <span className="chip bg-ok/10 text-ok">تسویه‌شده</span>}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>سفارشی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
