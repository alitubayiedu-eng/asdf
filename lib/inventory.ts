"use client";
import { num } from "./num";

/**
 * ════════════════════════════════════════════════════════════
 *   ارزش‌گذاری انبار — میانگین موزون (Weighted Average)
 * ════════════════════════════════════════════════════════════
 * بهای هر قلم از ورودی‌های قیمت‌دار (رسیدها) محاسبه می‌شود؛ همین بها
 * برای ارزش موجودی، بهای مصرف مواد و بهای تمام‌شده محصول به‌کار می‌رود.
 * txns = رکوردهای warehouse_txns با فیلدهای item_id, type('in'|'out'), qty, unit_price
 */
export function itemAvgCosts(txns: any[]): Record<string, number> {
  const q: Record<string, number> = {}, v: Record<string, number> = {};
  for (const t of txns) {
    if (t.type !== "in") continue;
    const qq = num(t.qty);
    q[t.item_id] = (q[t.item_id] || 0) + qq;
    v[t.item_id] = (v[t.item_id] || 0) + qq * num(t.unit_price);
  }
  const c: Record<string, number> = {};
  for (const id in q) c[id] = q[id] ? v[id] / q[id] : 0;
  return c;
}

/** موجودی هر قلم = ورود − خروج */
export function itemStock(txns: any[]): Record<string, number> {
  const s: Record<string, number> = {};
  for (const t of txns) s[t.item_id] = (s[t.item_id] || 0) + (t.type === "in" ? 1 : -1) * num(t.qty);
  return s;
}

/** بهای میانگین به تفکیک «نام کالا» (برای اتصال BOM به انبار) */
export function costByName(items: any[], txns: any[]): Record<string, number> {
  const byId = itemAvgCosts(txns);
  const m: Record<string, number> = {};
  for (const it of items) if (byId[it.id] != null) m[String(it.name).trim()] = byId[it.id];
  return m;
}
