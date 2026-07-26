"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { itemAvgCosts } from "@/lib/inventory";
import { printPdf, tbl, kpis, faN, faD, svgLines, svgBars, svgPie, svgHBars, CH } from "@/lib/export";

const SHIFTS = ["صبح", "عصر", "شب"];
const DT_REASONS = ["خرابی مکانیکی", "خرابی برقی", "کمبود مواد اولیه", "قطع برق", "تعویض قالب/گرید", "تنظیمات و راه‌اندازی", "نبود اپراتور", "سایر"];

export default function ProductionTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"record" | "orders" | "bom" | "downtime">("record");
  const [products, setProducts] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const [pf, setPf] = useState({ name: "", unit: "کیلوگرم", capacity_per_hour: "", sale_price: "", bom: [{ material: "", qty: "", unit: "کیلوگرم", unit_price: "" }] });
  const [rf, setRf] = useState({ record_date: today, shift: "صبح", line: "خط ۱", product_id: "", good_qty: "", scrap_qty: "0", downtimes: [] as any[], note: "" });
  const [dtf, setDtf] = useState({ reason: DT_REASONS[0], minutes: "" });
  const [of_, setOf] = useState({ product_id: "", target_qty: "", line: "خط ۱", start_date: today, end_date: "" });

  const load = async () => {
    const g = (t: string, set: any, ord = "created_at") => supabase.from(t).select("*").eq("project_id", projectId)
      .order(ord, { ascending: false }).then(({ data }: any) => set(data || []));
    await Promise.all([g("products", setProducts), g("production_records", setRecords, "record_date"), g("production_orders", setOrders)]);
    supabase.from("warehouse_items").select("*").eq("project_id", projectId).order("name")
      .then(({ data }: any) => setStockItems(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  // ---------- تعریف محصول و BOM ----------
  const addProduct = async () => {
    if (!pf.name) return;
    const bom = pf.bom.filter(b => b.material && num(b.qty) > 0)
      .map(b => ({ material: b.material, qty: num(b.qty), unit: b.unit, unit_price: num(b.unit_price) || 0 }));
    await supabase.from("products").insert({
      project_id: projectId, name: pf.name, unit: pf.unit,
      capacity_per_hour: num(pf.capacity_per_hour) || 0, sale_price: num(pf.sale_price) || 0, bom,
    });
    logAction(projectId, profile.id, "تعریف محصول و BOM", `${pf.name} — ${bom.length} ماده`);
    setPf({ name: "", unit: "کیلوگرم", capacity_per_hour: "", sale_price: "", bom: [{ material: "", qty: "", unit: "کیلوگرم", unit_price: "" }] });
    load();
  };

  // ---------- ثبت تولید: رسید محصول + کسر مواد طبق BOM ----------
  const wh = async (name: string, unit: string, store: string) => {
    const { data: items } = await supabase.from("warehouse_items").select("*").eq("project_id", projectId);
    let it = (items || []).find((i: any) => i.name === name && (i.store_type || "raw") === store);
    if (!it) {
      const { data } = await supabase.from("warehouse_items")
        .insert({ project_id: projectId, name, unit, category: "تولید", min_stock: 0, store_type: store }).select().single();
      it = data;
    }
    return it;
  };

  const addRecord = async () => {
    const prod = products.find(p => p.id === rf.product_id);
    if (!prod || !num(rf.good_qty)) return;
    const good = num(rf.good_qty), scrap = num(rf.scrap_qty) || 0;
    const dtMin = rf.downtimes.reduce((s, d) => s + num(d.minutes || 0), 0);
    await supabase.from("production_records").insert({
      project_id: projectId, record_date: rf.record_date, shift: rf.shift, line: rf.line,
      product_id: prod.id, product_name: prod.name, good_qty: good, scrap_qty: scrap,
      downtime_min: dtMin, downtimes: rf.downtimes, note: rf.note, created_by_name: profile.full_name,
    });
    // بهای میانگین موزون فعلی برای ارزش‌گذاری مصرف مواد و رسید محصول
    const { data: allTx } = await supabase.from("warehouse_txns").select("item_id, type, qty, unit_price").eq("project_id", projectId);
    const cost = itemAvgCosts(allTx || []);
    // کسر مواد اولیه طبق BOM — با بهای واقعی؛ و محاسبه بهای مواد هر واحد محصول
    let matPerUnit = 0;
    for (const b of prod.bom || []) {
      const raw = await wh(b.material, b.unit, "raw");
      const c = cost[raw.id] || num(b.unit_price);   // بهای واقعی انبار، وگرنه بهای استاندارد BOM
      matPerUnit += num(b.qty) * c;
      await supabase.from("warehouse_txns").insert({
        project_id: projectId, item_id: raw.id, type: "out", qty: num(b.qty) * (good + scrap), unit_price: Math.round(c),
        ref: "مصرف تولید", note: `${prod.name} — ${fmtDate(rf.record_date)}`, created_by: profile.id,
      });
    }
    // رسید محصول نهایی — با بهای مواد هر واحد (سربار جداگانه در تب بهای تمام‌شده اضافه می‌شود)
    const fin = await wh(prod.name, prod.unit, "finished");
    await supabase.from("warehouse_txns").insert({
      project_id: projectId, item_id: fin.id, type: "in", qty: good, unit_price: Math.round(matPerUnit),
      ref: `تولید ${rf.shift}`, note: `${rf.line} — ${fmtDate(rf.record_date)}`, created_by: profile.id,
    });
    logAction(projectId, profile.id, "ثبت تولید", `${prod.name} — ${fmt(good)} ${prod.unit} (${rf.shift}، ${rf.line})${dtMin ? ` — توقف ${dtMin} دقیقه` : ""}`);
    setRf({ record_date: today, shift: "صبح", line: "خط ۱", product_id: "", good_qty: "", scrap_qty: "0", downtimes: [], note: "" });
    load();
  };

  const addOrder = async () => {
    const prod = products.find(p => p.id === of_.product_id);
    if (!prod || !of_.target_qty) return;
    await supabase.from("production_orders").insert({
      project_id: projectId, product_id: prod.id, product_name: prod.name,
      target_qty: num(of_.target_qty), line: of_.line, start_date: of_.start_date,
      end_date: of_.end_date || null, status: "open", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "دستور کار تولید", `${prod.name} — ${fmt(num(of_.target_qty))} ${prod.unit}`);
    setOf({ product_id: "", target_qty: "", line: "خط ۱", start_date: today, end_date: "" }); load();
  };

  const producedFor = (o: any) => records.filter(r => r.product_id === o.product_id && r.record_date >= o.start_date)
    .reduce((s, r) => s + num(r.good_qty), 0);

  // ---------- آنالیز توقفات (پارتو) ----------
  const pareto = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of records) for (const d of r.downtimes || []) m[d.reason] = (m[d.reason] || 0) + num(d.minutes || 0);
    const total = Object.values(m).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(m).map(([reason, min]) => ({ reason, min, pct: Math.round(min / total * 100) }))
      .sort((a, b) => b.min - a.min);
  }, [records]);

  const prodPdf = () => {
    const asc = [...records].sort((a, b) => String(a.record_date).localeCompare(String(b.record_date)));
    const days = [...new Set(asc.map(r => r.record_date))];
    const good = days.map(d => asc.filter(r => r.record_date === d).reduce((s, r) => s + num(r.good_qty || 0), 0));
    const scrap = days.map(d => asc.filter(r => r.record_date === d).reduce((s, r) => s + num(r.scrap_qty || 0), 0));
    const byProd = products.map(p => ({
      name: p.name, g: records.filter(r => r.product_id === p.id).reduce((s, r) => s + num(r.good_qty || 0), 0),
      s: records.filter(r => r.product_id === p.id).reduce((s, r) => s + num(r.scrap_qty || 0), 0),
    }));
    const byShift: Record<string, number> = {};
    for (const r of records) byShift[r.shift || "—"] = (byShift[r.shift || "—"] || 0) + num(r.good_qty || 0);
    const totG = records.reduce((s, r) => s + num(r.good_qty || 0), 0);
    const totS = records.reduce((s, r) => s + num(r.scrap_qty || 0), 0);
    printPdf("گزارش تولید", "رکوردهای شیفت، محصولات و آنالیز توقفات",
      kpis([["تولید سالم کل", faN(totG)], ["ضایعات کل", faN(totS)],
        ["نرخ ضایعات", totG + totS ? faN(Math.round(totS / (totG + totS) * 1000) / 10) + "٪" : "—"],
        ["توقف کل (دقیقه)", faN(records.reduce((s, r) => s + num(r.downtime_min || 0), 0))]]) +
      (days.length > 1 ? svgLines("روند تولید روزانه", days.map(d => faD(d)), [
        { name: "تولید سالم", color: CH.ok, values: good },
        { name: "ضایعات", color: CH.danger, values: scrap }]) : "") +
      (byProd.length ? svgBars("تولید به تفکیک محصول", byProd.map(p => p.name), [
        { name: "سالم", color: CH.primary, values: byProd.map(p => p.g) },
        { name: "ضایعات", color: CH.danger, values: byProd.map(p => p.s) }]) : "") +
      (Object.keys(byShift).length ? svgPie("سهم شیفت‌ها از تولید",
        Object.entries(byShift).map(([name, value]) => ({ name: "شیفت " + name, value }))) : "") +
      (pareto.length ? svgHBars("پارتوی علل توقف خطوط",
        pareto.map(p => ({ name: p.reason, value: p.min, color: CH.danger, note: `${faN(p.min)} دقیقه (${faN(p.pct)}٪)` }))) : "") +
      (orders.length ? svgHBars("پیشرفت دستور کارهای تولید", orders.map(o => {
        const d = producedFor(o), pct = Math.min(100, Math.round(d / num(o.target_qty) * 100));
        return { name: o.product_name, value: pct, color: pct >= 100 ? CH.ok : CH.accent, note: `${faN(d)} از ${faN(o.target_qty)} (${faN(pct)}٪)` };
      })) : "") +
      "<h2>رکوردهای تولید</h2>" + tbl(["تاریخ", "شیفت", "خط", "محصول", "سالم", "ضایعات", "توقف (دقیقه)"],
        records.slice(0, 60).map(r => [faD(r.record_date), r.shift, r.line, r.product_name,
          faN(r.good_qty), faN(r.scrap_qty), faN(r.downtime_min)])) +
      "<h2>محصولات و فرمول ساخت (BOM)</h2>" + tbl(["محصول", "واحد", "ظرفیت/ساعت", "قیمت فروش", "هزینه مواد هر واحد", "مواد"],
        products.map(p => [p.name, p.unit, faN(p.capacity_per_hour), faN(p.sale_price),
          faN((p.bom || []).reduce((s: number, b: any) => s + b.qty * b.unit_price, 0)),
          (p.bom || []).map((b: any) => `${b.material}: ${b.qty}`).join("، ")])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load}
          table={sub === "orders" ? "production_orders" : sub === "bom" ? "products" : "production_records"}
          rows={sub === "orders" ? orders : sub === "bom" ? products : records} pdf={prodPdf} />
      </div>
      <div className="flex gap-2">
        {[["record", "ثبت تولید"], ["orders", "دستور کار"], ["bom", "محصولات و BOM"], ["downtime", "آنالیز توقفات"]].map(([k, l]) => (
          <button key={k} className={`chip ${sub === k ? "chip-on" : "border border-line bg-card"}`} onClick={() => setSub(k as any)}>{l}</button>
        ))}
      </div>

      {sub === "record" && (<>
        {canEdit && (
          <div className="card space-y-2">
            <h2 className="font-black">ثبت تولید شیفت</h2>
            <div className="grid gap-2 md:grid-cols-6">
              <DateInput className="input" value={rf.record_date} onChange={v => setRf({ ...rf, record_date: v })} />
              <select className="input" value={rf.shift} onChange={e => setRf({ ...rf, shift: e.target.value })}>{SHIFTS.map(s => <option key={s}>{s}</option>)}</select>
              <input className="input" placeholder="خط تولید" value={rf.line} onChange={e => setRf({ ...rf, line: e.target.value })} />
              <select className="input" value={rf.product_id} onChange={e => setRf({ ...rf, product_id: e.target.value })}>
                <option value="">محصول…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="input" dir="ltr" placeholder="تولید سالم" value={rf.good_qty} onChange={e => setRf({ ...rf, good_qty: e.target.value })} />
              <input className="input" dir="ltr" placeholder="ضایعات" value={rf.scrap_qty} onChange={e => setRf({ ...rf, scrap_qty: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold">توقفات این شیفت:</span>
              {rf.downtimes.map((d, i) => (
                <span key={i} className="chip bg-danger/10 text-danger">{d.reason} — {d.minutes} دقیقه</span>
              ))}
              <select className="input w-44 py-1" value={dtf.reason} onChange={e => setDtf({ ...dtf, reason: e.target.value })}>
                {DT_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
              <input className="input w-24 py-1" dir="ltr" placeholder="دقیقه" value={dtf.minutes} onChange={e => setDtf({ ...dtf, minutes: e.target.value })} />
              <button className="btn-ghost py-1" onClick={() => { if (num(dtf.minutes)) { setRf({ ...rf, downtimes: [...rf.downtimes, { ...dtf, minutes: num(dtf.minutes) }] }); setDtf({ reason: DT_REASONS[0], minutes: "" }); } }}>+ توقف</button>
              <button className="btn-primary mr-auto" onClick={addRecord}>ثبت تولید (رسید محصول + کسر مواد BOM)</button>
            </div>
          </div>
        )}
        <div className="card overflow-auto p-0">
          <table className="w-full">
            <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">شیفت</th><th className="th">خط</th><th className="th">محصول</th><th className="th">سالم</th><th className="th">ضایعات</th><th className="th">توقف</th><th className="th">ثبت</th></tr></thead>
            <tbody>
              {records.slice(0, 40).map(r => (
                <tr key={r.id}>
                  <td className="td">{fmtDate(r.record_date)}</td><td className="td">{r.shift}</td><td className="td">{r.line}</td>
                  <td className="td font-bold">{r.product_name}</td>
                  <td className="td text-ok font-bold">{fmt(r.good_qty)}</td>
                  <td className="td text-danger">{fmt(r.scrap_qty)}</td>
                  <td className="td">{r.downtime_min ? `${fmt(r.downtime_min)} دقیقه` : "—"}</td>
                  <td className="td text-xs">{r.created_by_name}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td className="td text-ink/40" colSpan={8}>تولیدی ثبت نشده است. ابتدا در «محصولات و BOM» محصول تعریف کنید.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {sub === "orders" && (<>
        {canEdit && (
          <div className="card grid gap-2 md:grid-cols-6">
            <select className="input md:col-span-2" value={of_.product_id} onChange={e => setOf({ ...of_, product_id: e.target.value })}>
              <option value="">محصول…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="input" dir="ltr" placeholder="هدف تولید" value={of_.target_qty} onChange={e => setOf({ ...of_, target_qty: e.target.value })} />
            <input className="input" placeholder="خط" value={of_.line} onChange={e => setOf({ ...of_, line: e.target.value })} />
            <DateInput className="input" value={of_.start_date} onChange={v => setOf({ ...of_, start_date: v })} />
            <button className="btn-primary" onClick={addOrder}>صدور دستور کار</button>
          </div>
        )}
        {orders.map(o => {
          const done = producedFor(o);
          const pct = Math.min(100, Math.round(done / num(o.target_qty) * 100));
          return (
            <div key={o.id} className="card flex flex-wrap items-center gap-3">
              <span className="font-black">{o.product_name}</span>
              <span className="text-xs text-ink/50">{o.line} · از {fmtDate(o.start_date)}</span>
              <div className="h-3 w-48 overflow-hidden rounded-full bg-surface"><div className="h-full bg-crane" style={{ width: `${pct}%` }} /></div>
              <span className="text-sm">{fmt(done)} از {fmt(o.target_qty)} ({pct}٪)</span>
              <span className={`chip mr-auto ${pct >= 100 ? "bg-ok/10 text-ok" : "chip-on"}`}>{pct >= 100 ? "تکمیل‌شده" : "در حال تولید"}</span>
            </div>
          );
        })}
        {orders.length === 0 && <p className="text-sm text-ink/40">دستور کاری صادر نشده است.</p>}
      </>)}

      {sub === "bom" && (<>
        {canEdit && (
          <div className="card space-y-2">
            <h2 className="font-black">تعریف محصول جدید + فرمول ساخت (BOM به‌ازای هر واحد)</h2>
            <div className="grid gap-2 md:grid-cols-5">
              <input className="input" placeholder="نام محصول" value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} />
              <input className="input" placeholder="واحد" value={pf.unit} onChange={e => setPf({ ...pf, unit: e.target.value })} />
              <input className="input" dir="ltr" placeholder="ظرفیت اسمی در ساعت" value={pf.capacity_per_hour} onChange={e => setPf({ ...pf, capacity_per_hour: e.target.value })} />
              <input className="input" dir="ltr" placeholder="قیمت فروش واحد (ریال)" value={pf.sale_price} onChange={e => setPf({ ...pf, sale_price: e.target.value })} />
              <button className="btn-primary" onClick={addProduct}>ثبت محصول</button>
            </div>
            {pf.bom.map((b, i) => (
              <div key={i} className="flex gap-2">
                <span className="flex flex-1 flex-col">
                  <input className="input" placeholder="ماده اولیه — از انبار انتخاب یا تایپ کنید" list="stock-list" value={b.material}
                    onChange={e => {
                      const a = [...pf.bom];
                      a[i].material = e.target.value;
                      const it = stockItems.find(x => x.name === e.target.value);
                      if (it) a[i].unit = it.unit || a[i].unit;
                      setPf({ ...pf, bom: a });
                    }} />
                  {b.material && !stockItems.some(x => x.name === b.material) && (
                    <span className="mt-0.5 text-[10px] text-crane">در انبار نیست — هنگام تولید ساخته می‌شود</span>
                  )}
                </span>
                <datalist id="stock-list">
                  {stockItems.filter(x => (x.store_type || "raw") === "raw" || !x.store_type)
                    .map(x => <option key={x.id} value={x.name}>{x.unit || ""}</option>)}
                </datalist>
                <input className="input w-28" dir="ltr" placeholder="مقدار/واحد محصول" value={b.qty}
                  onChange={e => { const a = [...pf.bom]; a[i].qty = e.target.value; setPf({ ...pf, bom: a }); }} />
                <input className="input w-24" placeholder="واحد" value={b.unit}
                  onChange={e => { const a = [...pf.bom]; a[i].unit = e.target.value; setPf({ ...pf, bom: a }); }} />
                <input className="input w-36" dir="ltr" placeholder="فی ماده (ریال)" value={b.unit_price}
                  onChange={e => { const a = [...pf.bom]; a[i].unit_price = e.target.value; setPf({ ...pf, bom: a }); }} />
                <button className="btn-ghost" onClick={() => setPf({ ...pf, bom: [...pf.bom, { material: "", qty: "", unit: "کیلوگرم", unit_price: "" }] })}>+</button>
              </div>
            ))}
          </div>
        )}
        {products.map(p => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-black">{p.name}</span>
              <span className="text-xs text-ink/50">واحد: {p.unit} · ظرفیت: {fmt(p.capacity_per_hour)}/ساعت · قیمت فروش: {fmt(p.sale_price)} ریال</span>
              <span className="chip mr-auto bg-surface">هزینه مواد هر واحد: {fmt((p.bom || []).reduce((s: number, b: any) => s + b.qty * b.unit_price, 0))} ریال</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(p.bom || []).map((b: any, i: number) => (
                <span key={i} className="chip bg-blueprint/10 text-blueprint">{b.material}: {b.qty} {b.unit} × {fmt(b.unit_price)}</span>
              ))}
            </div>
          </div>
        ))}
      </>)}

      {sub === "downtime" && (
        <div className="card">
          <h2 className="mb-3 font-black">پارتوی علل توقف خطوط (کل دوره)</h2>
          {pareto.map(p => (
            <div key={p.reason} className="mb-2 flex items-center gap-3">
              <span className="w-44 text-sm font-bold">{p.reason}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-lg bg-surface">
                <div className="h-full bg-danger/70" style={{ width: `${p.pct}%` }} />
              </div>
              <span className="w-32 text-xs">{fmt(p.min)} دقیقه ({p.pct}٪)</span>
            </div>
          ))}
          {pareto.length === 0 && <p className="text-sm text-ink/40">توقفی ثبت نشده است.</p>}
        </div>
      )}
    </div>
  );
}
