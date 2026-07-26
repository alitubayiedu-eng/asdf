"use client";
import { supabase } from "./supabase";
import { num } from "./num";
import { fmt } from "./constants";
import { accessibleProjects } from "./scope";

/**
 * ════════════════════════════════════════════════════════════
 *   اعلان‌های بحرانی هلدینگ — رویدادهایی که باید دیده شوند
 * ════════════════════════════════════════════════════════════
 * برخلاف تب «سلامت داده» که درون یک پروژه ناسازگاری می‌یابد،
 * این پویش روی همه پروژه‌های قابل‌دسترسی کاربر اجرا می‌شود و
 * رویدادهای زمان‌مند و بحرانی را زنده در زنگ اعلان‌ها نشان می‌دهد.
 * محاسبه‌ای است (persist نمی‌شود) تا هرگز تکراری یا کهنه نماند.
 */
export type Alert = {
  id: string;
  severity: "high" | "mid" | "low";
  icon: string;
  title: string;
  body: string;
  projectId: string;
  projectName: string;
  tab?: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const t = new Date(d); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10);
};
const arr = (d: any): any[] => (Array.isArray(d) ? d : []);

export async function criticalAlerts(profile: any): Promise<Alert[]> {
  const projects = await accessibleProjects(profile);
  if (!projects.length) return [];
  const pmap: Record<string, any> = Object.fromEntries(projects.map(p => [p.id, p]));
  const ids = projects.map(p => p.id);
  const T = today();

  const [claims, txns, wItems, wTxns, machines, maint, faults, phases, sales, prs, crmActs, chpFaults] = await Promise.all([
    supabase.from("progress_claims").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("transactions").select("project_id, source_table, source_id").in("project_id", ids).limit(50000).then((r: any) => arr(r.data)),
    supabase.from("warehouse_items").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("warehouse_txns").select("*").in("project_id", ids).limit(50000).then((r: any) => arr(r.data)),
    supabase.from("machines").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("maintenance_orders").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("solar_faults").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("phases").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("solar_sales").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("purchase_requests").select("*").in("project_id", ids).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("crm_activities").select("*").in("project_id", ids).eq("done", false).limit(20000).then((r: any) => arr(r.data)),
    supabase.from("chp_faults").select("*").in("project_id", ids).eq("status", "open").limit(20000).then((r: any) => arr(r.data)),
  ]);

  const pname = (pid: string) => pmap[pid]?.name || "";
  const kindOf = (pid: string) => pmap[pid]?.kind || "construction";
  const paid = new Set(txns.filter(t => t.source_table && t.source_id).map(t => `${t.source_table}:${t.source_id}`));
  const out: Alert[] = [];

  // ۱) صورت‌وضعیت تاییدشده بدون پرداخت
  for (const c of claims) {
    if (c.status !== "approved") continue;
    if (paid.has(`progress_claims:${c.id}`)) continue;
    out.push({ id: `claim-${c.id}`, severity: "mid", icon: "🧾",
      title: `صورت‌وضعیت ${c.no || ""} تایید شده و در انتظار پرداخت`,
      body: `${c.contract_title || ""} — خالص ${fmt(num(c.net_amount))} ریال`,
      projectId: c.project_id, projectName: pname(c.project_id), tab: "contracts" });
  }

  // ۲) موجودی انبار: منفی یا زیر نقطه سفارش
  const stock: Record<string, number> = {};
  for (const w of wTxns) stock[w.item_id] = (stock[w.item_id] || 0) + (w.type === "in" ? 1 : -1) * num(w.qty);
  for (const it of wItems) {
    const q = stock[it.id] || 0;
    if (q < 0) out.push({ id: `stock-neg-${it.id}`, severity: "high", icon: "📦",
      title: `موجودی منفی: ${it.name}`, body: `موجودی ${fmt(q)} ${it.unit || ""} در ${pname(it.project_id)}`,
      projectId: it.project_id, projectName: pname(it.project_id), tab: "warehouse" });
    else if (num(it.min_stock) > 0 && q < num(it.min_stock))
      out.push({ id: `stock-low-${it.id}`, severity: "mid", icon: "📦",
        title: `زیر نقطه سفارش: ${it.name}`, body: `موجودی ${fmt(q)} از حداقل ${fmt(it.min_stock)} ${it.unit || ""}`,
        projectId: it.project_id, projectName: pname(it.project_id), tab: "warehouse" });
  }

  // ۳) سررسید سرویس دوره‌ای (PM) ماشین‌آلات
  for (const m of machines) {
    if (!m.last_pm || !num(m.pm_interval_days)) continue;
    const due = addDays(m.last_pm, num(m.pm_interval_days));
    if (due <= T) out.push({ id: `pm-${m.id}`, severity: "mid", icon: "⚙️",
      title: `سرویس دوره‌ای «${m.name}» سررسید شده`, body: `آخرین PM ${m.last_pm} — دوره ${fmt(m.pm_interval_days)} روز · ${pname(m.project_id)}`,
      projectId: m.project_id, projectName: pname(m.project_id), tab: "maintenance" });
  }
  for (const o of maint) {
    if (o.status === "open" && o.kind === "cm")
      out.push({ id: `cm-${o.id}`, severity: "mid", icon: "🔧",
        title: `تعمیر اضطراری باز: ${o.machine_name || ""}`, body: `${o.issue || ""} · ${pname(o.project_id)}`,
        projectId: o.project_id, projectName: pname(o.project_id), tab: "maintenance" });
  }

  // ۴) خرابی نیروگاه (اینورتر) باز
  for (const f of faults) {
    if (f.status !== "open") continue;
    out.push({ id: `fault-${f.id}`, severity: "high", icon: "☀️",
      title: `خرابی باز: ${f.inverter_name || ""} — ${f.kind || ""}`,
      body: `افت تولید ${fmt(num(f.lost_kwh))} kWh · ${pname(f.project_id)}`,
      projectId: f.project_id, projectName: pname(f.project_id), tab: "faults" });
  }

  // ۵) تاخیر فاز — پایان برنامه گذشته ولی پیشرفت < ۱۰۰٪ (فقط عمرانی)
  for (const ph of phases) {
    if (kindOf(ph.project_id) !== "construction") continue;
    if (ph.end_date && ph.end_date < T && num(ph.progress) < 100)
      out.push({ id: `phase-late-${ph.id}`, severity: "mid", icon: "⏳",
        title: `تاخیر فاز: ${ph.name}`, body: `پایان برنامه ${ph.end_date} گذشته — پیشرفت ${fmt(ph.progress)}٪ · ${pname(ph.project_id)}`,
        projectId: ph.project_id, projectName: pname(ph.project_id), tab: "plan" });
  }

  // ۶) تسویه فروش برق معوق
  for (const s of sales) {
    const overdue = s.status === "overdue" || (s.status === "open" && s.settlement_date && s.settlement_date < T);
    if (!overdue) continue;
    out.push({ id: `settle-${s.id}`, severity: "mid", icon: "🔌",
      title: `تسویه فروش برق معوق: ${s.buyer || ""}`, body: `${fmt(num(s.total))} ریال — سررسید ${s.settlement_date || "—"} · ${pname(s.project_id)}`,
      projectId: s.project_id, projectName: pname(s.project_id), tab: "solarsales" });
  }

  // ۷) درخواست خرید از تاریخ نیاز گذشته
  for (const p of prs) {
    if (p.status === "open" && p.needed_date && p.needed_date < T)
      out.push({ id: `pr-${p.id}`, severity: "low", icon: "🛒",
        title: `درخواست خرید معوق: ${p.item || ""}`, body: `تاریخ نیاز ${p.needed_date} گذشته · ${pname(p.project_id)}`,
        projectId: p.project_id, projectName: pname(p.project_id), tab: "procurement" });
  }

  // ۸) پیگیری فروش (CRM) سررسیدشده
  for (const a of crmActs) {
    if (a.due_date && a.due_date <= T)
      out.push({ id: `crm-${a.id}`, severity: "low", icon: "📞",
        title: `پیگیری فروش سررسید شد: ${a.subject || ""}`,
        body: `${a.owner_name ? a.owner_name + " · " : ""}${pname(a.project_id)}`,
        projectId: a.project_id, projectName: pname(a.project_id), tab: "crm" });
  }

  // ۹) خرابی نیروگاه سیکل ترکیبی (CHP) باز
  for (const f of chpFaults) {
    out.push({ id: `chpfault-${f.id}`, severity: "high", icon: "🔥",
      title: `خرابی باز CHP: ${f.unit_name || ""} — ${f.kind || ""}`,
      body: `افت تولید ${fmt(num(f.lost_kwh))} kWh · ${pname(f.project_id)}`,
      projectId: f.project_id, projectName: pname(f.project_id), tab: "chpfaults" });
  }

  const rank = { high: 0, mid: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
