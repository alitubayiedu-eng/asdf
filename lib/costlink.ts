"use client";
import { supabase } from "./supabase";
import { num } from "./num";

/**
 * ════════════════════════════════════════════════════════════
 *  موتور کنترل هزینه — اتصال همه اسناد به ساختار شکست هزینه
 * ════════════════════════════════════════════════════════════
 *  مدل بدون دوباره‌شماری:
 *    بودجه       ← از CBS (مقدار × فی × ضریب پرت)
 *    تعهد        ← قرارداد + سفارش خرید
 *    هزینه واقعی ← سند مالی (پرداخت/هزینه)   ← تنها منبع «پول خارج‌شده»
 *    کارکرد      ← صورت‌وضعیت تاییدشده
 *
 *  چرا سفارش خرید در «هزینه واقعی» شمرده نمی‌شود؟
 *  چون وقتی آن را پرداخت می‌کنید یک سند مالی ثبت می‌شود؛
 *  اگر هر دو را جمع می‌زدیم، هزینه دو برابر نمایش داده می‌شد.
 */

export type CbsOption = {
  id: string; cost_code: string; item_name?: string;
  phase_name?: string; work_package?: string; category?: string;
  planned: number;
};

export const plannedOf = (i: any) =>
  num(i.quantity) * num(i.unit_rate) * (1 + num(i.waste_pct));

/** فهرست کدهای هزینه پروژه برای انتخاب در فرم‌ها */
export async function loadCbsOptions(projectId: string): Promise<CbsOption[]> {
  const { data } = await supabase.from("cbs_items").select("*").eq("project_id", projectId);
  return (data || []).map((i: any) => ({
    id: i.id, cost_code: i.cost_code, item_name: i.item_name,
    phase_name: i.phase_name, work_package: i.work_package, category: i.category,
    planned: plannedOf(i),
  })).sort((a, b) => String(a.cost_code).localeCompare(String(b.cost_code), "fa"));
}

/**
 * یافتن یا ساخت آیتم CBS با کد داده‌شده.
 * اگر کاربر کد جدیدی تایپ کند، همین‌جا در CBS ساخته می‌شود
 * تا از این پس در همه فرم‌ها قابل انتخاب باشد.
 */
export async function ensureCbsItem(
  projectId: string,
  code: string,
  extra: { item_name?: string; phase_name?: string; category?: string; unit?: string } = {}
): Promise<{ id: string; cost_code: string } | null> {
  const c = String(code || "").trim();
  if (!c) return null;
  const { data: found } = await supabase.from("cbs_items")
    .select("id, cost_code").eq("project_id", projectId).eq("cost_code", c);
  if (found && found.length) return found[0];

  const { data, error } = await supabase.from("cbs_items").insert({
    project_id: projectId, cost_code: c,
    item_name: extra.item_name || c,
    phase_name: extra.phase_name || null,
    category: extra.category || null,
    unit: extra.unit || null,
    quantity: 0, unit_rate: 0, waste_pct: 0, actual_total: 0,
  }).select("id, cost_code").single();
  if (error) return null;
  return data as any;
}

/** خروجی: آیتم‌های CBS که فرم می‌خواهد ذخیره کند */
export async function cbsFields(
  projectId: string,
  code: string,
  extra: { item_name?: string; phase_name?: string; category?: string; unit?: string } = {}
) {
  if (!code?.trim()) return { cbs_item_id: null, cbs_code: null };
  const it = await ensureCbsItem(projectId, code, extra);
  return { cbs_item_id: it?.id || null, cbs_code: it?.cost_code || code.trim() };
}

/* ──────────────── جمع‌بندی هزینه ──────────────── */

export type Rollup = {
  planned: number;        // بودجه
  committed: number;      // تعهد (قرارداد + سفارش خرید)
  actual: number;         // هزینه واقعی (اسناد مالی)
  certified: number;      // کارکرد تاییدشده (صورت‌وضعیت)
  materialOut: number;    // مصرف انبار (اطلاعاتی — در هزینه شمرده نمی‌شود)
  docs: number;           // تعداد اسناد متصل
};

export type CostData = {
  items: any[];
  byItem: Record<string, Rollup>;
  byPhase: Record<string, Rollup>;
  raw: {
    txns: any[]; pos: any[]; contracts: any[]; claims: any[]; wtxns: any[];
  };
  totals: Rollup;
};

const empty = (): Rollup => ({ planned: 0, committed: 0, actual: 0, certified: 0, materialOut: 0, docs: 0 });
const addTo = (m: Record<string, Rollup>, k: string | null | undefined, f: keyof Rollup, v: number, doc = true) => {
  if (!k) return;
  m[k] = m[k] || empty();
  (m[k][f] as number) += v;
  if (doc) m[k].docs += 1;
};

/** بارگذاری و محاسبه کامل هزینه پروژه از همه منابع */
export async function loadCostData(projectId: string): Promise<CostData> {
  // ترتیبی خوانده می‌شود چون کلاینت نمایشی thenable ساده است، نه Promise کامل
  const g = async (t: string): Promise<any[]> => {
    const { data } = await supabase.from(t).select("*").eq("project_id", projectId);
    return Array.isArray(data) ? data : [];
  };
  const items = await g("cbs_items");
  const txns = await g("transactions");
  const pos = await g("purchase_orders");
  const contracts = await g("contracts");
  const claims = await g("progress_claims");
  const wtxns = await g("warehouse_txns");

  const byItem: Record<string, Rollup> = {};
  const byPhase: Record<string, Rollup> = {};
  const codeToPhase: Record<string, string> = {};
  for (const i of items) {
    byItem[i.id] = { ...empty(), planned: plannedOf(i), docs: 0 };
    if (i.phase_name) {
      codeToPhase[i.id] = i.phase_name;
      byPhase[i.phase_name] = byPhase[i.phase_name] || empty();
      byPhase[i.phase_name].planned += plannedOf(i);
    }
  }
  const ph = (r: any) => r.phase_name || codeToPhase[r.cbs_item_id] || null;

  // ① هزینه واقعی ← اسناد مالی از نوع پرداخت / هزینه
  for (const t of txns) {
    if (!["payment", "expense"].includes(t.type)) continue;
    const v = num(t.amount);
    addTo(byItem, t.cbs_item_id, "actual", v);
    addTo(byPhase, ph(t), "actual", v);
  }
  // ② تعهد ← سفارش خرید
  for (const p of pos) {
    const v = num(p.qty) * num(p.unit_price);
    addTo(byItem, p.cbs_item_id, "committed", v);
    addTo(byPhase, ph(p), "committed", v);
  }
  // ③ تعهد ← قرارداد
  for (const c of contracts) {
    const v = num(c.amount);
    addTo(byItem, c.cbs_item_id, "committed", v);
    addTo(byPhase, ph(c), "committed", v);
  }
  // ④ کارکرد تاییدشده ← صورت‌وضعیت (از طریق قرارداد)
  const cById: Record<string, any> = Object.fromEntries(contracts.map((c: any) => [c.id, c]));
  for (const cl of claims) {
    if (cl.status !== "approved") continue;
    const c = cById[cl.contract_id];
    if (!c?.cbs_item_id) continue;
    const v = num(cl.period_amount);
    addTo(byItem, c.cbs_item_id, "certified", v);
    addTo(byPhase, ph(c), "certified", v);
  }
  // ⑤ مصرف انبار ← اطلاعاتی (هزینه‌اش قبلاً در خرید ثبت شده)
  for (const w of wtxns) {
    if (w.type !== "out") continue;
    const v = num(w.qty) * num(w.unit_price);
    addTo(byItem, w.cbs_item_id, "materialOut", v, false);
    addTo(byPhase, ph(w), "materialOut", v, false);
  }

  const totals = empty();
  for (const r of Object.values(byItem)) {
    totals.planned += r.planned; totals.committed += r.committed;
    totals.actual += r.actual; totals.certified += r.certified;
    totals.materialOut += r.materialOut; totals.docs += r.docs;
  }
  return { items, byItem, byPhase, totals, raw: { txns, pos, contracts, claims, wtxns } };
}

/** فهرست همه اسناد متصل به یک کد هزینه — برای ردیابی */
export function sourcesFor(data: CostData, cbsItemId: string) {
  const { txns, pos, contracts, claims, wtxns } = data.raw;
  const out: { kind: string; label: string; date?: string; amount: number; tone: string }[] = [];

  for (const t of txns.filter(x => x.cbs_item_id === cbsItemId && ["payment", "expense"].includes(x.type)))
    out.push({ kind: "سند مالی", label: t.description || t.counterparty || "—", date: t.txn_date, amount: num(t.amount), tone: "actual" });

  for (const p of pos.filter(x => x.cbs_item_id === cbsItemId))
    out.push({ kind: "سفارش خرید", label: `${p.item} — ${p.vendor_name || ""}`, date: p.order_date, amount: num(p.qty) * num(p.unit_price), tone: "committed" });

  for (const c of contracts.filter(x => x.cbs_item_id === cbsItemId))
    out.push({ kind: "قرارداد", label: `${c.title} — ${c.contractor || ""}`, date: c.start_date, amount: num(c.amount), tone: "committed" });

  const cIds = contracts.filter(x => x.cbs_item_id === cbsItemId).map(x => x.id);
  for (const cl of claims.filter(x => cIds.includes(x.contract_id) && x.status === "approved"))
    out.push({ kind: "صورت‌وضعیت", label: `شماره ${cl.no} — ${cl.period || ""}`, date: cl.created_at, amount: num(cl.period_amount), tone: "certified" });

  for (const w of wtxns.filter(x => x.cbs_item_id === cbsItemId && x.type === "out"))
    out.push({ kind: "مصرف انبار", label: w.ref || w.note || "—", date: w.created_at, amount: num(w.qty) * num(w.unit_price), tone: "material" });

  return out.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

/**
 * هزینه واقعی نمایشی یک آیتم:
 *   اگر سندی به کد متصل باشد → مجموع اسناد (خودکار و قابل ردیابی)
 *   وگرنه → مقدار ثبت‌شده در CBS (مثلاً از ایمپورت اکسل)
 * این‌طور داده‌های قدیمی یا دستی از بین نمی‌رود.
 */
export function actualOf(item: any, r?: Rollup) {
  if (r && r.docs > 0) return r.actual;
  return num(item.actual_total);
}
export const isLinked = (r?: Rollup) => !!r && r.docs > 0;

/** ذخیره تعهد محاسبه‌شده در CBS — actual_total دست‌نخورده می‌ماند */
export async function syncActuals(projectId: string, data?: CostData) {
  const d = data || await loadCostData(projectId);
  for (const it of d.items) {
    const r = d.byItem[it.id];
    if (!r) continue;
    const patch: any = {};
    if (num(it.committed_total) !== Math.round(r.committed)) patch.committed_total = Math.round(r.committed);
    // فقط وقتی سند متصل هست، مقدار محاسبه‌شده را می‌نویسیم
    if (r.docs > 0 && num(it.actual_total) !== Math.round(r.actual)) patch.actual_total = Math.round(r.actual);
    if (Object.keys(patch).length) await supabase.from("cbs_items").update(patch).eq("id", it.id);
  }
}
