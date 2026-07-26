"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import CostCodeField from "@/components/CostCodeField";
import PostToAccounting from "@/components/PostToAccounting";
import { cbsFields } from "@/lib/costlink";
import { printPdf, tbl, kpis, faN, faD, svgHBars, svgPie, CH } from "@/lib/export";

const PR_STATUS: Record<string, string> = { open: "در انتظار خرید", ordered: "سفارش‌شده", received: "دریافت‌شده" };

export default function ProcurementTab({ projectId, profile, canEdit }: any) {
  const [sub, setSub] = useState<"pr" | "po" | "vendors">("pr");
  const [prs, setPrs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [prf, setPrf] = useState({ item: "", qty: "", unit: "", needed_date: "", note: "" });
  const [prCost, setPrCost] = useState({ code: "", phase: "" });
  const [pof, setPof] = useState({ pr_id: "", vendor_name: "", unit_price: "" });
  const [poCost, setPoCost] = useState({ code: "", phase: "" });
  const [vf, setVf] = useState({ name: "", field: "", phone: "", rating: "3", is_global: true });

  // تامین‌کننده‌های سراسری هلدینگ + مختص همین پروژه
  const loadVendors = async () => {
    const { data: all } = await supabase.from("vendors").select("*");
    setVendors((all || []).filter((v: any) => v.is_global || v.project_id === projectId));
  };

  const load = async () => {
    const g = (t: string, set: any) => supabase.from(t).select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false }).then(({ data }: any) => set(data || []));
    await Promise.all([g("purchase_requests", setPrs), g("purchase_orders", setPos), loadVendors()]);
  };
  useEffect(() => { load(); }, [projectId]);

  const addPr = async () => {
    if (!prf.item || !prf.qty) return;
    const cbs = await cbsFields(projectId, prCost.code, { item_name: prf.item, phase_name: prCost.phase, unit: prf.unit });
    await supabase.from("purchase_requests").insert({
      project_id: projectId, item: prf.item, qty: num(prf.qty), unit: prf.unit,
      needed_date: prf.needed_date || null, note: prf.note, status: "open", requester_name: profile.full_name,
      ...cbs, phase_name: prCost.phase || null,
    });
    logAction(projectId, profile.id, "درخواست خرید (PR)", `${prf.item} — ${prf.qty} ${prf.unit}`);
    setPrf({ item: "", qty: "", unit: "", needed_date: "", note: "" }); setPrCost({ code: "", phase: "" }); load();
  };

  const addPo = async () => {
    const pr = prs.find(p => p.id === pof.pr_id);
    if (!pr || !pof.vendor_name) return;
    // کد هزینه از درخواست خرید به ارث می‌رسد؛ اگر نداشت می‌توان اینجا تعیین کرد
    const cbs = pr.cbs_item_id
      ? { cbs_item_id: pr.cbs_item_id, cbs_code: pr.cbs_code }
      : await cbsFields(projectId, poCost.code, { item_name: pr.item, phase_name: poCost.phase });
    await supabase.from("purchase_orders").insert({
      project_id: projectId, pr_id: pr.id, item: pr.item, qty: pr.qty, unit: pr.unit,
      vendor_name: pof.vendor_name,
      vendor_id: vendors.find((v: any) => String(v.name).trim() === String(pof.vendor_name).trim())?.id || null,
      unit_price: num(pof.unit_price) || 0,
      status: "ordered", order_date: new Date().toISOString().slice(0, 10), created_by_name: profile.full_name,
      ...cbs, phase_name: pr.phase_name || poCost.phase || null,
    });
    await supabase.from("purchase_requests").update({ status: "ordered" }).eq("id", pr.id);
    logAction(projectId, profile.id, "سفارش خرید (PO)", `${pr.item} از ${pof.vendor_name} — ${fmt(num(pof.unit_price) * pr.qty)} ریال`);
    setPof({ pr_id: "", vendor_name: "", unit_price: "" }); setPoCost({ code: "", phase: "" }); load();
  };

  // دریافت PO ← رسید خودکار در انبار
  const receivePo = async (po: any) => {
    let { data: items } = await supabase.from("warehouse_items").select("*").eq("project_id", projectId);
    let item = (items || []).find((i: any) => i.name === po.item);
    if (!item) {
      const { data: created } = await supabase.from("warehouse_items")
        .insert({ project_id: projectId, name: po.item, unit: po.unit, category: "خرید تدارکات", min_stock: 0 }).select().single();
      item = created;
    }
    await supabase.from("warehouse_txns").insert({
      project_id: projectId, item_id: item.id, type: "in", qty: po.qty, unit_price: po.unit_price,
      ref: `PO-${(po.id || "").slice(0, 6)}`, note: `دریافت از ${po.vendor_name}`, created_by: profile.id,
    });
    await supabase.from("purchase_orders").update({ status: "received" }).eq("id", po.id);
    if (po.pr_id) await supabase.from("purchase_requests").update({ status: "received" }).eq("id", po.pr_id);
    logAction(projectId, profile.id, "دریافت سفارش و رسید انبار", `${po.item} — ${po.qty} ${po.unit}`);
    load();
  };

  const addVendor = async () => {
    if (!vf.name) return;
    await supabase.from("vendors").insert({
      project_id: vf.is_global ? null : projectId, is_global: vf.is_global,
      name: vf.name, field: vf.field, phone: vf.phone, rating: num(vf.rating),
    });
    logAction(projectId, profile.id, "ثبت تامین‌کننده", `${vf.name}${vf.is_global ? " — سراسری هلدینگ" : " — مختص این پروژه"}`);
    setVf({ name: "", field: "", phone: "", rating: "3", is_global: true }); load();
  };

  return (
    <div className="space-y-3">
      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load}
          table={sub === "pr" ? "purchase_requests" : sub === "po" ? "purchase_orders" : "vendors"}
          rows={sub === "pr" ? prs : sub === "po" ? pos : vendors} />
      </div>
      <div className="flex gap-2">
        {[["pr", "درخواست‌های خرید"], ["po", "سفارش‌های خرید"], ["vendors", "تامین‌کنندگان"]].map(([k, l]) => (
          <button key={k} className={`chip ${sub === k ? "chip-on" : "border border-line bg-card"}`}
            onClick={() => setSub(k as any)}>{l}</button>
        ))}
        <button className="btn-ghost mr-auto" onClick={() => {
          const poTotal = pos.reduce((s, p) => s + num(p.qty) * num(p.unit_price), 0);
          const byVendor: Record<string, number> = {};
          for (const p of pos) byVendor[p.vendor_name || "—"] = (byVendor[p.vendor_name || "—"] || 0) + num(p.qty) * num(p.unit_price);
          const st: Record<string, number> = {};
          for (const p of prs) st[PR_STATUS[p.status]] = (st[PR_STATUS[p.status]] || 0) + 1;
          printPdf("گزارش تدارکات و خرید", "درخواست‌ها، سفارش‌ها و تامین‌کنندگان",
            kpis([["درخواست‌های باز", faN(prs.filter(p => p.status === "open").length)],
              ["سفارش‌های در راه", faN(pos.filter(p => p.status === "ordered").length)],
              ["جمع مبلغ سفارش‌ها", faN(poTotal) + " ریال"], ["تامین‌کنندگان", faN(vendors.length)]]) +
            (Object.keys(byVendor).length ? svgHBars("مبلغ خرید به تفکیک تامین‌کننده", Object.entries(byVendor)
              .sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, note: faN(value) + " ریال" }))) : "") +
            (Object.keys(st).length ? svgPie("وضعیت درخواست‌های خرید", Object.entries(st).map(([name, value]) => ({ name, value }))) : "") +
            "<h2>درخواست‌های خرید (PR)</h2>" + tbl(["کالا", "مقدار", "تاریخ نیاز", "درخواست‌کننده", "وضعیت"],
              prs.map(p => [p.item, `${faN(p.qty)} ${p.unit || ""}`, faD(p.needed_date), p.requester_name, PR_STATUS[p.status]])) +
            "<h2>سفارش‌های خرید (PO)</h2>" + tbl(["کالا", "تامین‌کننده", "مقدار", "فی", "مبلغ کل", "وضعیت"],
              pos.map(p => [p.item, p.vendor_name, faN(p.qty), faN(p.unit_price), faN(num(p.qty) * num(p.unit_price)), p.status === "received" ? "دریافت‌شده" : "سفارش‌شده"])) +
            "<h2>تامین‌کنندگان</h2>" + tbl(["نام", "زمینه", "تلفن", "امتیاز"],
              vendors.map(v => [v.name, v.field, v.phone, "★".repeat(v.rating || 0)])));
        }}>خروجی PDF</button>
        <span className="self-center text-[11px] text-ink/40">چرخه: PR ← PO ← دریافت = رسید خودکار انبار</span>
      </div>

      {sub === "pr" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-6">
              <input className="input md:col-span-2" placeholder="شرح کالا / خدمت" value={prf.item} onChange={e => setPrf({ ...prf, item: e.target.value })} />
              <input className="input" dir="ltr" placeholder="مقدار" value={prf.qty} onChange={e => setPrf({ ...prf, qty: e.target.value })} />
              <input className="input" placeholder="واحد" value={prf.unit} onChange={e => setPrf({ ...prf, unit: e.target.value })} />
              <DateInput className="input" title="تاریخ نیاز" value={prf.needed_date} onChange={v => setPrf({ ...prf, needed_date: v })} />
              <CostCodeField projectId={projectId} value={prCost} onChange={setPrCost} compact />
              <button className="btn-primary" onClick={addPr}>ثبت درخواست</button>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr><th className="th">کالا</th><th className="th">مقدار</th><th className="th">تاریخ نیاز</th><th className="th">درخواست‌کننده</th><th className="th">وضعیت</th></tr></thead>
              <tbody>
                {prs.map(p => (
                  <tr key={p.id}>
                    <td className="td font-bold">{p.item}</td>
                    <td className="td">{fmt(p.qty)} {p.unit}</td>
                    <td className="td">{fmtDate(p.needed_date)}</td>
                    <td className="td text-xs">{p.requester_name}</td>
                    <td className="td"><span className={`chip ${p.status === "received" ? "bg-ok/10 text-ok" : p.status === "ordered" ? "bg-crane/20" : "bg-danger/10 text-danger"}`}>{PR_STATUS[p.status]}</span></td>
                  </tr>
                ))}
                {prs.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>درخواستی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "po" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-5">
              <select className="input md:col-span-2" value={pof.pr_id} onChange={e => setPof({ ...pof, pr_id: e.target.value })}>
                <option value="">درخواست خرید باز…</option>
                {prs.filter(p => p.status === "open").map(p => <option key={p.id} value={p.id}>{p.item} — {fmt(p.qty)} {p.unit}</option>)}
              </select>
              <input className="input" list="vendor-list" placeholder="تامین‌کننده" value={pof.vendor_name} onChange={e => setPof({ ...pof, vendor_name: e.target.value })} />
              <datalist id="vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
              <input className="input" dir="ltr" placeholder="فی (ریال)" value={pof.unit_price} onChange={e => setPof({ ...pof, unit_price: e.target.value })} />
              {!prs.find(p => p.id === pof.pr_id)?.cbs_code &&
                <CostCodeField projectId={projectId} value={poCost} onChange={setPoCost} compact />}
              <button className="btn-primary" onClick={addPo}>صدور سفارش</button>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr><th className="th">کالا</th><th className="th">تامین‌کننده</th><th className="th">مقدار</th><th className="th">مبلغ کل</th><th className="th">تاریخ سفارش</th><th className="th">وضعیت</th></tr></thead>
              <tbody>
                {pos.map(p => (
                  <tr key={p.id}>
                    <td className="td font-bold">{p.item}</td><td className="td">{p.vendor_name}</td>
                    <td className="td">{fmt(p.qty)} {p.unit}</td>
                    <td className="td font-bold">{fmt(num(p.qty) * num(p.unit_price))}</td>
                    <td className="td">{fmtDate(p.order_date)}</td>
                    <td className="td">
                      {p.status === "received" ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <span className="chip bg-ok/10 text-ok">دریافت‌شده</span>
                          {canEdit && <PostToAccounting projectId={projectId} profile={profile} onDone={load}
                            label="پرداخت ←" txn={{
                              type: "payment", amount: num(p.qty) * num(p.unit_price),
                              counterparty: p.vendor_name,
                              description: `پرداخت خرید ${p.item}`,
                              cbs_item_id: p.cbs_item_id, cbs_code: p.cbs_code, phase_name: p.phase_name,
                              source_table: "purchase_orders", source_id: p.id,
                            }} />}
                        </span>
                      ) :
                        canEdit ? <button className="btn-accent py-0.5 text-xs" onClick={() => receivePo(p)}>دریافت شد ← رسید انبار</button> :
                        <span className="chip bg-crane/20">سفارش‌شده</span>}
                    </td>
                  </tr>
                ))}
                {pos.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>سفارشی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "vendors" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-5">
              <input className="input" placeholder="نام تامین‌کننده" value={vf.name} onChange={e => setVf({ ...vf, name: e.target.value })} />
              <input className="input" placeholder="زمینه (مصالح، تجهیزات…)" value={vf.field} onChange={e => setVf({ ...vf, field: e.target.value })} />
              <input className="input" dir="ltr" placeholder="تلفن" value={vf.phone} onChange={e => setVf({ ...vf, phone: e.target.value })} />
              <select className="input" value={vf.rating} onChange={e => setVf({ ...vf, rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
              <button className="btn-primary" onClick={addVendor}>ثبت</button>
              <label className="col-span-full flex items-center gap-2 text-xs">
                <input type="checkbox" checked={vf.is_global} onChange={e => setVf({ ...vf, is_global: e.target.checked })} />
                <b>تامین‌کننده سراسری هلدینگ</b>
                <span className="text-ink/45">— در همه پروژه‌ها و کارخانه‌ها و نیروگاه‌ها در دسترس باشد (یک بار تعریف، همه‌جا قابل انتخاب)</span>
              </label>
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-3">
            {vendors.map(v => (
              <div key={v.id} className="card">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black">{v.name}</span>
                  {v.is_global && <span className="chip bg-primary/10 text-[9px] text-primary" title="در همه پروژه‌های هلدینگ">سراسری</span>}
                  <span className="mr-auto text-crane">{"★".repeat(v.rating || 0)}</span>
                </div>
                <div className="mt-1 text-xs text-ink/50">{v.field || "—"} · <span dir="ltr">{v.phone || ""}</span></div>
              </div>
            ))}
            {vendors.length === 0 && <p className="text-sm text-ink/40">تامین‌کننده‌ای ثبت نشده است.</p>}
          </div>
        </>
      )}
    </div>
  );
}
