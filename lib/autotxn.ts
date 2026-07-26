"use client";
import { supabase } from "./supabase";
import { num } from "./num";
import { logAction } from "./log";
import { fmt } from "./constants";

/**
 * ════════════════════════════════════════════════════════
 *   تولید سند مالی از اسناد عملیاتی — بدون تایپ مجدد
 * ════════════════════════════════════════════════════════
 * صورت‌وضعیت تاییدشده، دریافت سفارش خرید و فروش برق
 * همگی می‌توانند با یک کلیک به سند مالی تبدیل شوند.
 * کد هزینه، فاز، طرف حساب و مبلغ خودکار منتقل می‌شود.
 */

export type AutoTxn = {
  type: "payment" | "receipt" | "expense" | "income";
  amount: number;
  counterparty?: string;
  description: string;
  txn_date?: string;
  cbs_item_id?: string | null;
  cbs_code?: string | null;
  phase_name?: string | null;
  source_table: string;   // جدول مبدأ — برای جلوگیری از تکرار
  source_id: string;
};

/** آیا قبلاً برای این سند، سند مالی ساخته شده؟ */
export async function alreadyPosted(projectId: string, sourceTable: string, sourceId: string) {
  const { data } = await supabase.from("transactions").select("id, amount")
    .eq("project_id", projectId).eq("source_table", sourceTable).eq("source_id", sourceId);
  return (data || [])[0] || null;
}

/** فهرست حساب‌های پروژه برای انتخاب */
export async function loadAccounts(projectId: string) {
  const { data } = await supabase.from("accounts").select("*").eq("project_id", projectId);
  return data || [];
}

/**
 * ثبت سند مالی از یک سند عملیاتی.
 * اگر قبلاً ثبت شده باشد، دوباره ثبت نمی‌شود (جلوگیری از دوباره‌شماری).
 */
export async function postTxn(projectId: string, profile: any, accountId: string, t: AutoTxn) {
  const dup = await alreadyPosted(projectId, t.source_table, t.source_id);
  if (dup) {
    alert(`برای این سند قبلاً سند مالی به مبلغ ${fmt(num(dup.amount))} ریال ثبت شده است.`);
    return false;
  }
  const { error } = await supabase.from("transactions").insert({
    project_id: projectId, account_id: accountId, type: t.type,
    amount: Math.round(t.amount), counterparty: t.counterparty || null,
    description: t.description,
    txn_date: t.txn_date || new Date().toISOString().slice(0, 10),
    cbs_item_id: t.cbs_item_id || null, cbs_code: t.cbs_code || null,
    phase_name: t.phase_name || null,
    source_table: t.source_table, source_id: t.source_id,
    created_by: profile.id,
  });
  if (error) { alert("خطا در ثبت سند: " + error.message); return false; }
  logAction(projectId, profile.id, "سند مالی خودکار",
    `${t.description} — ${fmt(Math.round(t.amount))} ریال`);
  return true;
}
