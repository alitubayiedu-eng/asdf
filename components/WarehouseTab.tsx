"use client";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import CostCodeField from "@/components/CostCodeField";
import { cbsFields } from "@/lib/costlink";
import { itemAvgCosts } from "@/lib/inventory";
import { printPdf, tbl, kpis, faN, svgBars, svgHBars, svgPie, CH } from "@/lib/export";

export default function WarehouseTab({ projectId, profile, canEdit }: any) {
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [ni, setNi] = useState({ name: "", unit: "", category: "", min_stock: "", store_type: "raw" });
  const [storeF, setStoreF] = useState("");
  const [wCost, setWCost] = useState({ code: "", phase: "" });
  const STORES: Record<string, string> = { raw: "مواد اولیه", wip: "نیمه‌ساخته", finished: "محصول نهایی", "": "عمومی" };
  const [nt, setNt] = useState({ item_id: "", type: "in", qty: "", unit_price: "", ref: "", note: "" });

  const load = async () => {
    const { data: i } = await supabase.from("warehouse_items").select("*").eq("project_id", projectId).order("name");
    setItemsList(i || []);
    const { data: t } = await supabase.from("warehouse_txns").select("*, warehouse_items(name, unit)")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(5000);
    setTxns(t || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const stock = useMemo(() => {
    const s: Record<string, number> = {};
    for (const t of txns) s[t.item_id] = (s[t.item_id] || 0) + (t.type === "in" ? 1 : -1) * num(t.qty);
    return s;
  }, [txns]);
  // بهای میانگین موزون و ارزش موجودی
  const avgCost = useMemo(() => itemAvgCosts(txns), [txns]);
  const totalByStore = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of itemsList) { const k = i.store_type || ""; m[k] = (m[k] || 0) + (stock[i.id] || 0) * (avgCost[i.id] || 0); }
    return m;
  }, [itemsList, stock, avgCost]);
  const totalValue = Object.values(totalByStore).reduce((s, v) => s + v, 0);

  const addItem = async () => {
    if (!ni.name) return;
    await supabase.from("warehouse_items").insert({ project_id: projectId, name: ni.name, unit: ni.unit, category: ni.category, min_stock: num(ni.min_stock) || 0, store_type: ni.store_type });
    logAction(projectId, profile.id, "تعریف کالای انبار", ni.name);
    setNi({ name: "", unit: "", category: "", min_stock: "", store_type: ni.store_type }); load();
  };
  const addTxn = async () => {
    if (!nt.item_id || !nt.qty) return;
    // حواله خروج: کد هزینه نشان می‌دهد مصرف برای کدام بخش کار بوده
    const itName = itemsList.find(i => i.id === nt.item_id)?.name || "";
    const cbs = await cbsFields(projectId, wCost.code, { item_name: itName, phase_name: wCost.phase });
    await supabase.from("warehouse_txns").insert({
      project_id: projectId, item_id: nt.item_id, type: nt.type, qty: num(nt.qty),
      unit_price: num(nt.unit_price) || 0, ref: nt.ref, note: nt.note, created_by: profile.id,
      ...cbs, phase_name: wCost.phase || null,
    });
    const itemName = itemsList.find(i => i.id === nt.item_id)?.name || "";
    logAction(projectId, profile.id, nt.type === "in" ? "رسید انبار" : "حواله انبار", `${itemName} — مقدار ${nt.qty}`);
    setNt({ item_id: "", type: "in", qty: "", unit_price: "", ref: "", note: "" }); setWCost({ code: "", phase: "" }); load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([["ارزش کل انبار", totalValue], ["ارزش مواد اولیه", totalByStore["raw"] || 0], ["ارزش محصول نهایی", totalByStore["finished"] || 0], ["ارزش نیمه‌ساخته", totalByStore["wip"] || 0]] as [string, number][]).map(([l, v]) => (
          <div key={l} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className="mt-1.5 text-lg font-black tracking-tight">{fmt(Math.round(v))} <span className="text-xs font-normal">ریال</span></div>
          </div>
        ))}
      </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-black">موجودی انبار</h2>
          <span className="flex gap-2"><ExcelIO table="warehouse_items" projectId={projectId} rows={itemsList} canEdit={canEdit} profile={profile} onDone={load} label="اقلام" />
          <button className="btn-ghost py-1 text-xs" onClick={() => {
            const low = itemsList.filter(i => num(i.min_stock) > 0 && (stock[i.id] || 0) < num(i.min_stock));
            const top = [...itemsList].sort((a, b) => (stock[b.id] || 0) - (stock[a.id] || 0)).slice(0, 14);
            const byStore: Record<string, number> = {};
            for (const i of itemsList) { const k = STORES[i.store_type || ""]; byStore[k] = (byStore[k] || 0) + 1; }
            printPdf("گزارش موجودی انبار", "به تفکیک انبار مواد اولیه / نیمه‌ساخته / محصول نهایی",
              kpis([["اقلام تعریف‌شده", faN(itemsList.length)], ["اقلام زیر نقطه سفارش", faN(low.length)]]) +
              svgBars("موجودی فعلی در برابر حداقل موجودی (۱۴ قلم برتر)", top.map(i => i.name), [
                { name: "موجودی فعلی", color: CH.primary, values: top.map(i => stock[i.id] || 0) },
                { name: "حداقل موجودی", color: CH.accent, values: top.map(i => num(i.min_stock) || 0) },
              ]) +
              (low.length ? svgHBars("اقلام زیر نقطه سفارش — نیازمند خرید", low.map(i => ({
                name: i.name, value: num(i.min_stock) - (stock[i.id] || 0), color: CH.danger,
                note: `کسری ${faN(num(i.min_stock) - (stock[i.id] || 0))} ${i.unit || ""}`,
              }))) : "") +
              svgPie("پراکندگی اقلام بین انبارها", Object.entries(byStore).map(([name, value]) => ({ name, value }))) +
              tbl(["کالا", "انبار", "دسته", "واحد", "موجودی فعلی", "حداقل", "وضعیت"],
                itemsList.map(i => [i.name, STORES[i.store_type || ""], i.category || "—", i.unit,
                  faN(stock[i.id] || 0), faN(i.min_stock),
                  num(i.min_stock) > 0 && (stock[i.id] || 0) < num(i.min_stock) ? "⚠ کمبود" : "نرمال"])));
          }}>خروجی PDF</button></span>
        </div>
        <div className="mb-2 flex gap-2">
          {["", "raw", "wip", "finished"].map(k => (
            <button key={k} className={`chip ${storeF === k && (k !== "" || storeF === "") && storeF === k ? "chip-on" : "border border-line bg-card"}`}
              onClick={() => setStoreF(k)}>{k === "" ? "همه" : STORES[k]}</button>
          ))}
        </div>
        {canEdit && <div className="mb-3 grid grid-cols-5 gap-2">
          <input className="input col-span-2" placeholder="نام کالا" value={ni.name} onChange={e => setNi({ ...ni, name: e.target.value })} />
          <input className="input" placeholder="واحد" value={ni.unit} onChange={e => setNi({ ...ni, unit: e.target.value })} />
          <input className="input" placeholder="حداقل موجودی" dir="ltr" value={ni.min_stock} onChange={e => setNi({ ...ni, min_stock: e.target.value })} />
          <select className="input" value={ni.store_type} onChange={e => setNi({ ...ni, store_type: e.target.value })}>
            <option value="raw">مواد اولیه</option><option value="wip">نیمه‌ساخته</option>
            <option value="finished">محصول نهایی</option><option value="">عمومی</option>
          </select>
          <button className="btn-primary" onClick={addItem}>افزودن کالا</button>
        </div>}
        <div className="overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">کالا</th><th className="th">واحد</th><th className="th">موجودی فعلی</th><th className="th">بهای میانگین</th><th className="th">ارزش موجودی</th><th className="th">وضعیت</th></tr></thead>
            <tbody>
              {itemsList.filter(i => !storeF || (i.store_type || "") === storeF).map(i => {
                const s = stock[i.id] || 0;
                const low = i.min_stock && s < i.min_stock;
                const c = avgCost[i.id] || 0;
                return (
                  <tr key={i.id}>
                    <td className="td font-bold">{i.name} <span className="text-[10px] text-ink/40">{STORES[i.store_type || ""]}</span></td><td className="td">{i.unit}</td>
                    <td className="td">{fmt(s)}</td>
                    <td className="td">{c ? fmt(Math.round(c)) : "—"}</td>
                    <td className="td font-bold">{c ? fmt(Math.round(s * c)) : "—"}</td>
                    <td className="td">{low ? <span className="chip bg-danger/10 text-danger">کمبود موجودی</span> : <span className="chip bg-ok/10 text-ok">عادی</span>}</td>
                  </tr>
                );
              })}
              {itemsList.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>کالایی ثبت نشده است. اولین کالا را اضافه کنید.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 className="mb-2 font-black">ثبت ورود / خروج (حواله و رسید)</h2>
        {canEdit && <div className="mb-3 grid grid-cols-6 gap-2">
          <select className="input col-span-2" value={nt.item_id} onChange={e => setNt({ ...nt, item_id: e.target.value })}>
            <option value="">کالا…</option>
            {itemsList.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select className="input" value={nt.type} onChange={e => setNt({ ...nt, type: e.target.value })}>
            <option value="in">ورود (رسید)</option><option value="out">خروج (حواله)</option>
          </select>
          <input className="input" placeholder="مقدار" dir="ltr" value={nt.qty} onChange={e => setNt({ ...nt, qty: e.target.value })} />
          <input className="input" placeholder="فی (ریال)" dir="ltr" value={nt.unit_price} onChange={e => setNt({ ...nt, unit_price: e.target.value })} />
          {nt.type === "out" && <CostCodeField projectId={projectId} value={wCost} onChange={setWCost} compact />}
          <button className="btn-primary" onClick={addTxn}>ثبت</button>
          <input className="input col-span-3" placeholder="شماره فاکتور / حواله" value={nt.ref} onChange={e => setNt({ ...nt, ref: e.target.value })} />
          <input className="input col-span-3" placeholder="توضیح" value={nt.note} onChange={e => setNt({ ...nt, note: e.target.value })} />
        </div>}
        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <thead><tr><th className="th">تاریخ</th><th className="th">کالا</th><th className="th">نوع</th><th className="th">مقدار</th><th className="th">مبلغ کل</th></tr></thead>
            <tbody>
              {txns.slice(0, 200).map(t => (
                <tr key={t.id}>
                  <td className="td">{fmtDate(t.created_at)}</td>
                  <td className="td">{t.warehouse_items?.name}</td>
                  <td className="td">{t.type === "in" ? <span className="chip bg-ok/10 text-ok">ورود</span> : <span className="chip bg-danger/10 text-danger">خروج</span>}</td>
                  <td className="td">{fmt(t.qty)} {t.warehouse_items?.unit}</td>
                  <td className="td">{fmt(num(t.qty) * num(t.unit_price || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
}
