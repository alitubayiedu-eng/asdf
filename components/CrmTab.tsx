"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import { exportExcel } from "@/lib/export";

// قیف فروش کارخانه — الگوی دیدار: سرنخ/فرصت، مراحل، پیش‌بینی وزنی، فعالیت و یادآوری
const STAGES: [string, string][] = [
  ["new", "سرنخ جدید"], ["contacted", "در تماس"], ["quoted", "پیش‌فاکتور/استعلام"],
  ["negotiation", "مذاکره"], ["won", "موفق"], ["lost", "ناموفق"],
];
const STAGE_LABEL = Object.fromEntries(STAGES);
const OPEN_STAGES = ["new", "contacted", "quoted", "negotiation"];
const ACT_KINDS: Record<string, string> = { call: "تماس", meeting: "جلسه", email: "ایمیل", sms: "پیامک", task: "وظیفه", note: "یادداشت" };
const today = () => new Date().toISOString().slice(0, 10);

export default function CrmTab({ projectId, profile, canEdit }: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [acts, setActs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orderLeadIds, setOrderLeadIds] = useState<string[]>([]);   // فرصت‌هایی که سفارش دارند
  const [nl, setNl] = useState<any>({ title: "", customer_name: "", product_name: "", value: "", probability: "30", source: "", owner_name: "", next_action_date: "", note: "" });
  const [af, setAf] = useState<any>({ lead_id: "", kind: "call", subject: "", due_date: "", owner_name: "" });

  const load = async () => {
    const { data: l } = await supabase.from("crm_leads").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(2000);
    setLeads(l || []);
    const { data: a } = await supabase.from("crm_activities").select("*").eq("project_id", projectId).order("due_date").limit(2000);
    setActs(a || []);
    const { data: so } = await supabase.from("sales_orders").select("lead_id").eq("project_id", projectId);
    setOrderLeadIds((so || []).map((x: any) => x.lead_id).filter(Boolean));
  };
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => {
    supabase.from("customers").select("*").eq("project_id", projectId).then(({ data }: any) => setCustomers(data || []));
    supabase.from("products").select("*").eq("project_id", projectId).then(({ data }: any) => setProducts(data || []));
  }, [projectId]);

  // ── شاخص‌های قیف ──
  const open = leads.filter(l => OPEN_STAGES.includes(l.stage));
  const openValue = open.reduce((s, l) => s + num(l.value), 0);
  const weighted = open.reduce((s, l) => s + num(l.value) * num(l.probability) / 100, 0);
  const won = leads.filter(l => l.stage === "won");
  const lost = leads.filter(l => l.stage === "lost");
  const convRate = won.length + lost.length > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0;
  const wonValue = won.reduce((s, l) => s + num(l.value), 0);

  const byStage = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const [k] of STAGES) m[k] = [];
    for (const l of leads) (m[l.stage] || (m[l.stage] = [])).push(l);
    return m;
  }, [leads]);

  const addLead = async () => {
    if (!nl.title.trim()) return;
    const cust = customers.find(c => String(c.name).trim() === String(nl.customer_name).trim());
    const prod = products.find(p => String(p.name).trim() === String(nl.product_name).trim());
    await supabase.from("crm_leads").insert({
      project_id: projectId, title: nl.title.trim(),
      customer_id: cust?.id || null, customer_name: nl.customer_name || null,
      product_id: prod?.id || null, product_name: nl.product_name || null,
      stage: "new", value: num(nl.value), probability: num(nl.probability) || 0,
      source: nl.source || null, owner_name: nl.owner_name || profile.full_name,
      next_action_date: nl.next_action_date || null, note: nl.note || null,
      created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت فرصت فروش", `${nl.title} — ${fmt(num(nl.value))} ریال`);
    setNl({ title: "", customer_name: "", product_name: "", value: "", probability: "30", source: "", owner_name: "", next_action_date: "", note: "" });
    load();
  };

  const moveStage = async (l: any, stage: string) => {
    const patch: any = { stage };
    if (stage === "lost") { const r = prompt("علت ناموفق‌شدن؟"); patch.lost_reason = r || l.lost_reason || ""; }
    await supabase.from("crm_leads").update(patch).eq("id", l.id);
    logAction(projectId, profile.id, "تغییر مرحله فرصت", `${l.title} ← ${STAGE_LABEL[stage]}`);
    load();
  };

  const convertToCustomer = async (l: any) => {
    if (l.customer_id) { alert("این فرصت قبلاً به مشتری وصل است."); return; }
    const name = (l.customer_name || "").trim();
    if (!name) { alert("نام مشتری خالی است."); return; }
    let cid = customers.find(c => String(c.name).trim() === name)?.id;
    if (!cid) {
      const { data } = await supabase.from("customers").insert({ project_id: projectId, name, phone: l.phone || "" }).select().single();
      cid = data?.id;
      const { data: cs } = await supabase.from("customers").select("*").eq("project_id", projectId);
      setCustomers(cs || []);
    }
    await supabase.from("crm_leads").update({ customer_id: cid }).eq("id", l.id);
    logAction(projectId, profile.id, "تبدیل سرنخ به مشتری", name);
    load();
  };

  const removeLead = async (l: any) => {
    if (await deleteRow("crm_leads", l, { projectId, profile, label: "فرصت فروش", detail: l.title })) load();
  };

  // ── پیوستگی: فرصت موفق → مشتری + سفارش فروش + پیگیری تولید/انبار ──
  const toOrder = async (l: any) => {
    let cid = l.customer_id;
    const cname = (l.customer_name || "").trim();
    if (!cid && cname) {
      cid = customers.find(c => String(c.name).trim() === cname)?.id;
      if (!cid) {
        const { data } = await supabase.from("customers").insert({ project_id: projectId, name: cname, phone: l.phone || "" }).select().single();
        cid = data?.id;
      }
    }
    if (!cid) { alert("مشتری مشخص نیست؛ ابتدا نام مشتری را روی فرصت بگذارید یا آن را به مشتری تبدیل کنید."); return; }
    const { data: exist } = await supabase.from("sales_orders").select("id").eq("project_id", projectId).eq("lead_id", l.id);
    if ((exist || []).length) { alert("برای این فرصت قبلاً سفارش فروش ساخته شده است."); return; }

    const prod = products.find(p => p.id === l.product_id) || products.find(p => String(p.name).trim() === String(l.product_name).trim());
    const price = num(prod?.sale_price);
    const qty = price > 0 ? Math.max(1, Math.round(num(l.value) / price)) : 1;
    const unit = price > 0 ? price : num(l.value);
    const { data: so } = await supabase.from("sales_orders").insert({
      project_id: projectId, customer_id: cid, customer_name: cname || customers.find(c => c.id === cid)?.name,
      product_id: prod?.id || null, product_name: prod?.name || l.product_name || "",
      qty, unit_price: unit, delivery_date: l.next_action_date || null,
      status: "open", lead_id: l.id, created_by_name: profile.full_name,
    }).select().single();

    // پیگیری انبار → اگر موجودی محصول نهایی کافی نیست، دستور تولیدِ کسری صادر می‌شود
    let follow = "";
    if (prod) {
      const { data: items } = await supabase.from("warehouse_items").select("*").eq("project_id", projectId);
      const fin = (items || []).find((i: any) => i.name === prod.name && (i.store_type || "") === "finished");
      let stock = 0;
      if (fin) {
        const { data: tx } = await supabase.from("warehouse_txns").select("type, qty").eq("item_id", fin.id);
        stock = (tx || []).reduce((s: number, w: any) => s + (w.type === "in" ? 1 : -1) * num(w.qty), 0);
      }
      const short = qty - stock;
      if (short > 0) {
        await supabase.from("production_orders").insert({
          project_id: projectId, product_id: prod.id, product_name: prod.name,
          target_qty: short, line: "خط ۱", start_date: today(), status: "open",
          sales_order_id: so?.id || null, created_by_name: profile.full_name,
        });
        follow = ` — کسری ${fmt(short)} ${prod.unit || ""}: دستور تولید صادر شد`;
      } else follow = " — موجودی انبار کافی است";
    }
    if (l.stage !== "won") await supabase.from("crm_leads").update({ stage: "won" }).eq("id", l.id);
    logAction(projectId, profile.id, "تبدیل فرصت به سفارش فروش", `${cname} — ${prod?.name || l.product_name || ""} × ${fmt(qty)}${follow}`);
    alert(`سفارش فروش در تب «فروش و مشتریان» ساخته شد${follow}.`);
    load();
  };

  const addActivity = async () => {
    if (!af.subject.trim()) return;
    const lead = leads.find(l => l.id === af.lead_id);
    await supabase.from("crm_activities").insert({
      project_id: projectId, lead_id: af.lead_id || null, customer_id: lead?.customer_id || null,
      kind: af.kind, subject: af.subject.trim(), due_date: af.due_date || null,
      owner_name: af.owner_name || profile.full_name, done: false, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت پیگیری CRM", `${ACT_KINDS[af.kind]} — ${af.subject}`);
    setAf({ lead_id: "", kind: "call", subject: "", due_date: "", owner_name: "" });
    load();
  };
  const toggleDone = async (a: any) => {
    await supabase.from("crm_activities").update({ done: !a.done }).eq("id", a.id); load();
  };

  const exportXlsx = () => exportExcel("قیف فروش CRM", [
    { name: "فرصت‌ها", rows: [["عنوان", "مشتری", "محصول", "مرحله", "ارزش", "احتمال٪", "مسئول", "اقدام بعدی"],
      ...leads.map(l => [l.title, l.customer_name || "—", l.product_name || "—", STAGE_LABEL[l.stage], num(l.value), num(l.probability), l.owner_name || "—", l.next_action_date || "—"])] },
    { name: "فعالیت‌ها", rows: [["نوع", "موضوع", "سررسید", "وضعیت", "مسئول"],
      ...acts.map(a => [ACT_KINDS[a.kind], a.subject, a.due_date || "—", a.done ? "انجام‌شده" : "باز", a.owner_name || "—"])] },
  ]);

  const openActs = acts.filter(a => !a.done);

  return (
    <div className="space-y-3">
      {/* شاخص‌ها */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["فرصت‌های باز", fmt(open.length)], ["ارزش باز کل (ریال)", fmt(Math.round(openValue))],
          ["پیش‌بینی وزنی (ریال)", fmt(Math.round(weighted))], ["نرخ تبدیل", convRate.toLocaleString("fa-IR") + "٪"]].map(([l, v]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className="mt-1.5 text-lg font-black tracking-tight">{v}</div>
          </div>
        ))}
      </div>

      {/* افزودن فرصت */}
      {canEdit && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-black">ثبت فرصت فروش جدید</h2>
            <button className="btn-ghost py-1 text-xs" onClick={exportXlsx}>خروجی اکسل</button>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div><label className="label">عنوان فرصت *</label><input className="input" value={nl.title} onChange={e => setNl({ ...nl, title: e.target.value })} /></div>
            <div><label className="label">مشتری / سرنخ</label>
              <input className="input" list="crm-customers" value={nl.customer_name} onChange={e => setNl({ ...nl, customer_name: e.target.value })} />
              <datalist id="crm-customers">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>
            <div><label className="label">محصول</label>
              <input className="input" list="crm-products" value={nl.product_name} onChange={e => setNl({ ...nl, product_name: e.target.value })} />
              <datalist id="crm-products">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
            </div>
            <div><label className="label">ارزش برآوردی (ریال)</label><input className="input" dir="ltr" value={nl.value} onChange={e => setNl({ ...nl, value: e.target.value })} /></div>
            <div><label className="label">احتمال (٪)</label><input className="input" dir="ltr" value={nl.probability} onChange={e => setNl({ ...nl, probability: e.target.value })} /></div>
            <div><label className="label">منبع سرنخ</label><input className="input" placeholder="نمایشگاه، معرفی، سایت…" value={nl.source} onChange={e => setNl({ ...nl, source: e.target.value })} /></div>
            <div><label className="label">کارشناس فروش</label><input className="input" value={nl.owner_name} onChange={e => setNl({ ...nl, owner_name: e.target.value })} /></div>
            <div><label className="label">اقدام بعدی (تاریخ)</label><DateInput className="input" value={nl.next_action_date} onChange={(v: string) => setNl({ ...nl, next_action_date: v })} /></div>
          </div>
          <button className="btn-primary mt-2" onClick={addLead}>افزودن به قیف</button>
        </div>
      )}

      {/* برد قیف */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map(([k, l]) => {
          const list = byStage[k] || [];
          const sum = list.reduce((s, x) => s + num(x.value), 0);
          return (
            <div key={k} className="min-w-[240px] flex-1 rounded-xl border border-line bg-surface/40">
              <div className={`flex items-center justify-between rounded-t-xl px-3 py-2 text-sm font-black ${k === "won" ? "bg-ok/10 text-ok" : k === "lost" ? "bg-danger/10 text-danger" : "bg-card"}`}>
                <span>{l}</span><span className="chip bg-ink/5">{fmt(list.length)}</span>
              </div>
              <div className="px-2 py-1 text-[11px] text-ink/50">جمع ارزش: {fmt(Math.round(sum))}</div>
              <div className="max-h-[460px] space-y-2 overflow-auto p-2">
                {list.map(x => {
                  const overdue = x.next_action_date && OPEN_STAGES.includes(x.stage) && x.next_action_date < today();
                  return (
                    <div key={x.id} className="rounded-lg border border-line bg-card p-2 text-xs">
                      <div className="font-bold">{x.title}</div>
                      <div className="mt-0.5 text-ink/55">{x.customer_name || "—"}{x.product_name ? ` · ${x.product_name}` : ""}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="chip bg-primary/10 text-primary">{fmt(num(x.value))}</span>
                        <span className="chip bg-ink/5">{num(x.probability).toLocaleString("fa-IR")}٪</span>
                        {x.owner_name && <span className="chip bg-ink/5">{x.owner_name}</span>}
                        {x.customer_id ? <span className="chip bg-ok/10 text-ok">مشتری ✓</span> : x.customer_name && <span className="chip bg-crane/15">سرنخ</span>}
                      </div>
                      {x.next_action_date && <div className={`mt-1 ${overdue ? "font-bold text-danger" : "text-ink/50"}`}>اقدام بعدی: {fmtDate(x.next_action_date)}{overdue ? " (معوق)" : ""}</div>}
                      {canEdit && (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <select className="input w-auto py-0.5 text-[11px]" value={x.stage} onChange={e => moveStage(x, e.target.value)}>
                            {STAGES.map(([sk, sl]) => <option key={sk} value={sk}>{sl}</option>)}
                          </select>
                          {!x.customer_id && x.customer_name && <button className="text-[11px] text-blueprint" onClick={() => convertToCustomer(x)}>+مشتری</button>}
                          <button className="text-[11px] text-crane" onClick={() => setAf({ ...af, lead_id: x.id, subject: "" })}>+پیگیری</button>
                          {x.stage === "won" && (orderLeadIds.includes(x.id)
                            ? <span className="chip bg-ok/10 text-[10px] text-ok">✓ سفارش</span>
                            : <button className="text-[11px] font-bold text-primary" onClick={() => toOrder(x)}>سفارش فروش ←</button>)}
                          <button className="text-[11px] text-danger" onClick={() => removeLead(x)}>حذف</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {list.length === 0 && <div className="p-2 text-center text-[11px] text-ink/30">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* پیگیری‌ها */}
      <div className="grid gap-3 lg:grid-cols-3">
        {canEdit && (
          <div className="card">
            <h2 className="mb-2 font-black">ثبت پیگیری / یادآوری</h2>
            <div className="space-y-2">
              <div><label className="label">فرصت مرتبط</label>
                <select className="input" value={af.lead_id} onChange={e => setAf({ ...af, lead_id: e.target.value })}>
                  <option value="">— بدون فرصت —</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">نوع</label>
                  <select className="input" value={af.kind} onChange={e => setAf({ ...af, kind: e.target.value })}>
                    {Object.entries(ACT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div><label className="label">سررسید</label><DateInput className="input" value={af.due_date} onChange={(v: string) => setAf({ ...af, due_date: v })} /></div>
              </div>
              <div><label className="label">موضوع</label><input className="input" value={af.subject} onChange={e => setAf({ ...af, subject: e.target.value })} /></div>
              <button className="btn-primary w-full justify-center" onClick={addActivity}>ثبت پیگیری</button>
            </div>
          </div>
        )}
        <div className="card lg:col-span-2">
          <h2 className="mb-2 font-black">پیگیری‌های پیش‌رو ({fmt(openActs.length)})</h2>
          {openActs.length === 0 && <p className="text-sm text-ink/40">پیگیری بازی نیست.</p>}
          <div className="max-h-96 space-y-1 overflow-auto">
            {openActs.map(a => {
              const overdue = a.due_date && a.due_date < today();
              const lead = leads.find(l => l.id === a.lead_id);
              return (
                <div key={a.id} className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${overdue ? "border-danger/30 bg-danger/[0.05]" : "border-line"}`}>
                  <span className="chip bg-ink/5">{ACT_KINDS[a.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{a.subject}</div>
                    <div className="truncate text-ink/50">{lead?.title || "—"}{a.owner_name ? ` · ${a.owner_name}` : ""}</div>
                  </div>
                  {a.due_date && <span className={`shrink-0 ${overdue ? "font-bold text-danger" : "text-ink/50"}`}>{fmtDate(a.due_date)}</span>}
                  {canEdit && <button className="shrink-0 text-[11px] text-ok" onClick={() => toggleDone(a)}>انجام شد ✓</button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
