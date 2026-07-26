"use client";
import { supabase } from "./supabase";
import { num } from "./num";
import { fmt } from "./constants";
import { logAction } from "./log";

/**
 * ════════════════════════════════════════════════════════════
 *   بازرس داده — یافتن ناسازگاری‌ها پیش از آنکه به گزارش برسند
 * ════════════════════════════════════════════════════════════
 * هر یافته یا اصلاح خودکار دارد (fix) یا فقط هشدار است.
 * کاربر می‌تواند همه را یکجا اصلاح کند، یا موردی را «تایید» کند
 * تا دیگر به‌عنوان مشکل نشان داده نشود.
 */

export type Finding = {
  id: string;              // شناسه یکتا برای تایید/نادیده‌گرفتن
  severity: "high" | "mid" | "low";
  group: string;           // دسته
  title: string;
  detail: string;
  table?: string;
  rowId?: string;
  fixLabel?: string;       // اگر قابل اصلاح خودکار است
  fix?: () => Promise<void>;
};

const ACK_KEY = (pid: string) => `vivere-ack-${pid}`;

export function loadAcks(projectId: string): string[] {
  try { return JSON.parse(localStorage.getItem(ACK_KEY(projectId)) || "[]"); } catch { return []; }
}
export function saveAck(projectId: string, id: string) {
  const a = new Set(loadAcks(projectId)); a.add(id);
  localStorage.setItem(ACK_KEY(projectId), JSON.stringify([...a]));
}
export function clearAck(projectId: string, id: string) {
  localStorage.setItem(ACK_KEY(projectId),
    JSON.stringify(loadAcks(projectId).filter(x => x !== id)));
}

const g = async (t: string, pid: string): Promise<any[]> => {
  const { data } = await supabase.from(t).select("*").eq("project_id", pid);
  return Array.isArray(data) ? data : [];
};

/** پیمایش کامل داده پروژه و یافتن ناسازگاری‌ها */
export async function inspect(projectId: string, kind = "construction"): Promise<Finding[]> {
  const out: Finding[] = [];
  const [
    cbs, txns, pos, prs, contracts, claims, wItems, wTxns,
    phases, tasks, vendors, personnel, sheets, shareholders,
  ] = [
    await g("cbs_items", projectId), await g("transactions", projectId),
    await g("purchase_orders", projectId), await g("purchase_requests", projectId),
    await g("contracts", projectId), await g("progress_claims", projectId),
    await g("warehouse_items", projectId), await g("warehouse_txns", projectId),
    await g("phases", projectId), await g("tasks", projectId),
    await g("vendors", projectId), await g("personnel", projectId),
    await g("timesheets", projectId), await g("shareholders", projectId),
  ];

  const codeSet = new Set(cbs.map(c => c.cost_code));
  const nameSet = (arr: any[], k = "name") => new Set(arr.map(x => String(x[k] || "").trim()));

  // ─── ۱) اسناد مالی بدون کد هزینه ───
  const noCode = txns.filter(t => ["payment", "expense"].includes(t.type) && !t.cbs_item_id);
  if (noCode.length) out.push({
    id: `txn-nocode`, severity: "mid", group: "کد هزینه",
    title: `${fmt(noCode.length)} سند هزینه بدون کد هزینه`,
    detail: `جمع ${fmt(noCode.reduce((s, t) => s + num(t.amount), 0))} ریال در CBS دیده نمی‌شود. برای کنترل بودجه، کد هزینه هر سند را مشخص کنید.`,
  });

  // ─── ۲) کد هزینه‌ای که در CBS نیست ───
  for (const t of txns.filter(t => t.cbs_code && !codeSet.has(t.cbs_code))) {
    out.push({
      id: `txn-badcode-${t.id}`, severity: "high", group: "کد هزینه",
      title: `کد «${t.cbs_code}» در CBS وجود ندارد`,
      detail: `سند ${fmt(num(t.amount))} ریال — ${t.description || t.counterparty || ""}`,
      table: "transactions", rowId: t.id,
    });
  }

  // ─── ۳) هزینه بیش از بودجه ───
  for (const c of cbs) {
    const pl = num(c.quantity) * num(c.unit_rate) * (1 + num(c.waste_pct));
    const ac = txns.filter(t => t.cbs_item_id === c.id && ["payment", "expense"].includes(t.type))
      .reduce((s, t) => s + num(t.amount), 0);
    if (pl > 0 && ac > pl * 1.05) out.push({
      id: `cbs-over-${c.id}`, severity: "high", group: "بودجه",
      title: `کد ${c.cost_code}: هزینه از بودجه گذشته`,
      detail: `بودجه ${fmt(Math.round(pl))} — هزینه ${fmt(Math.round(ac))} (${Math.round((ac / pl - 1) * 100)}٪ بیشتر)`,
    });
  }

  // ─── ۴) موجودی منفی انبار ───
  const stock: Record<string, number> = {};
  for (const w of wTxns) stock[w.item_id] = (stock[w.item_id] || 0) + (w.type === "in" ? 1 : -1) * num(w.qty);
  for (const it of wItems) {
    if ((stock[it.id] || 0) < 0) out.push({
      id: `stock-neg-${it.id}`, severity: "high", group: "انبار",
      title: `موجودی منفی: ${it.name}`,
      detail: `موجودی ${fmt(stock[it.id])} ${it.unit || ""} — خروج بیش از ورود ثبت شده است.`,
    });
    else if (num(it.min_stock) > 0 && (stock[it.id] || 0) < num(it.min_stock)) out.push({
      id: `stock-low-${it.id}`, severity: "mid", group: "انبار",
      title: `زیر نقطه سفارش: ${it.name}`,
      detail: `موجودی ${fmt(stock[it.id] || 0)} از حداقل ${fmt(it.min_stock)} ${it.unit || ""}`,
    });
  }

  // ─── ۵) نام تامین‌کننده خارج از بانک ───
  const vSet = nameSet(vendors);
  for (const p of pos.filter(p => p.vendor_name && !vSet.has(String(p.vendor_name).trim()))) {
    out.push({
      id: `po-vendor-${p.id}`, severity: "low", group: "تامین‌کننده",
      title: `«${p.vendor_name}» در بانک تامین‌کنندگان نیست`,
      detail: `سفارش ${p.item} — با ثبت در بانک، سوابق خرید و امتیازش یکجا جمع می‌شود.`,
      fixLabel: "افزودن به بانک",
      fix: async () => {
        await supabase.from("vendors").insert({
          project_id: projectId, name: String(p.vendor_name).trim(),
          field: p.item, rating: 3, is_global: false,
        });
      },
    });
  }
  for (const c of contracts.filter(c => c.contractor && !vSet.has(String(c.contractor).trim()))) {
    out.push({
      id: `ct-vendor-${c.id}`, severity: "low", group: "تامین‌کننده",
      title: `پیمانکار «${c.contractor}» در بانک نیست`,
      detail: `قرارداد ${c.title}`,
      fixLabel: "افزودن به بانک",
      fix: async () => {
        await supabase.from("vendors").insert({
          project_id: projectId, name: String(c.contractor).trim(),
          field: "پیمانکار", rating: 3, is_global: false,
        });
      },
    });
  }

  // ─── ۶) نام فرد در حضور و غیاب که در پرسنل نیست ───
  const pSet = nameSet(personnel);
  const orphanNames = [...new Set(sheets.map(s => String(s.person_name || "").trim()))]
    .filter(n => n && !pSet.has(n));
  for (const n of orphanNames) {
    const role = sheets.find(s => String(s.person_name).trim() === n)?.role || "";
    out.push({
      id: `person-${n}`, severity: "low", group: "پرسنل",
      title: `«${n}» در فهرست پرسنل نیست`,
      detail: `در حضور و غیاب ثبت شده ولی پرونده پرسنلی ندارد.`,
      fixLabel: "ساخت پرونده پرسنلی",
      fix: async () => {
        await supabase.from("personnel").insert({ project_id: projectId, name: n, role, shift: "صبح" });
      },
    });
  }

  // ─── ۷) صورت‌وضعیت تاییدشده بدون پرداخت ───
  for (const cl of claims.filter(c => c.status === "approved")) {
    const paid = txns.some(t => t.source_table === "progress_claims" && t.source_id === cl.id);
    if (!paid) out.push({
      id: `claim-unpaid-${cl.id}`, severity: "mid", group: "مالی",
      title: `صورت‌وضعیت ${cl.no} تایید شده ولی پرداخت ثبت نشده`,
      detail: `${cl.contract_title} — خالص ${fmt(num(cl.net_amount))} ریال. از دکمه «پرداخت ←» در تب قراردادها ثبت کنید.`,
    });
  }

  // ─── ۸) خرید دریافت‌شده بدون پرداخت ───
  for (const p of pos.filter(p => p.status === "received")) {
    const paid = txns.some(t => t.source_table === "purchase_orders" && t.source_id === p.id);
    if (!paid) out.push({
      id: `po-unpaid-${p.id}`, severity: "low", group: "مالی",
      title: `خرید «${p.item}» دریافت شده ولی پرداخت ثبت نشده`,
      detail: `${p.vendor_name || ""} — ${fmt(num(p.qty) * num(p.unit_price))} ریال`,
    });
  }

  // ─── ۹) مجموع درصد سهامداران ───
  if (shareholders.length) {
    const tot = shareholders.reduce((s, x) => s + num(x.share_pct), 0);
    if (Math.abs(tot - 100) > 0.01) out.push({
      id: "sh-sum", severity: "mid", group: "سهامداران",
      title: `مجموع درصد سهام ${fmt(tot)}٪ است، نه ۱۰۰٪`,
      detail: `${shareholders.map(s => `${s.name} ${fmt(s.share_pct)}٪`).join(" · ")}`,
    });
  }

  // ─── ۱۰) فاز: پیشرفت با فعالیت‌ها نمی‌خواند ───
  if (kind === "construction") {
    for (const ph of phases) {
      const ts = tasks.filter(t => t.phase_id === ph.id);
      if (ts.length < 2) continue;
      const avg = Math.round(ts.reduce((s, t) => s + num(t.progress ?? (t.status === "done" ? 100 : 0)), 0) / ts.length);
      if (Math.abs(avg - num(ph.progress)) >= 15) out.push({
        id: `phase-prog-${ph.id}`, severity: "low", group: "برنامه زمانی",
        title: `${ph.name}: پیشرفت ثبت‌شده ${fmt(ph.progress)}٪ ولی میانگین فعالیت‌ها ${fmt(avg)}٪`,
        detail: `اختلاف ${fmt(Math.abs(avg - num(ph.progress)))} درصد در ${fmt(ts.length)} فعالیت`,
        fixLabel: `اعمال ${fmt(avg)}٪`,
        fix: async () => { await supabase.from("phases").update({ progress: avg }).eq("id", ph.id); },
      });
    }
    // ─── ۱۱) فاز با تاریخ پایان پیش از شروع ───
    for (const ph of phases.filter(p => p.start_date && p.end_date && p.end_date < p.start_date)) {
      out.push({
        id: `phase-date-${ph.id}`, severity: "high", group: "برنامه زمانی",
        title: `${ph.name}: تاریخ پایان پیش از شروع است`,
        detail: `شروع ${ph.start_date} — پایان ${ph.end_date}`,
      });
    }
  }

  // ─── ۱۲) درخواست خرید معطل ───
  const oldPr = prs.filter(p => p.status === "open" && p.needed_date && p.needed_date < new Date().toISOString().slice(0, 10));
  if (oldPr.length) out.push({
    id: "pr-overdue", severity: "mid", group: "تدارکات",
    title: `${fmt(oldPr.length)} درخواست خرید از تاریخ نیاز گذشته`,
    detail: oldPr.slice(0, 4).map(p => p.item).join("، "),
  });

  const rank = { high: 0, mid: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** اصلاح دسته‌ای همه یافته‌های قابل اصلاح */
export async function fixAll(projectId: string, profile: any, list: Finding[]) {
  let n = 0;
  for (const f of list) {
    if (!f.fix) continue;
    try { await f.fix(); n++; } catch { /* ادامه */ }
  }
  if (n) logAction(projectId, profile.id, "اصلاح دسته‌ای ناسازگاری", `${n} مورد اصلاح شد`);
  return n;
}
