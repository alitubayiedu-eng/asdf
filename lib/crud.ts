"use client";
import { supabase } from "./supabase";
import { logAction } from "./log";

/**
 * ویرایش و حذف امن رکوردها — با ثبت در گزارش تغییرات
 * هر اصلاح یا حذف در Audit Log ثبت می‌شود تا قابل پیگیری بماند.
 */
export async function editRow(
  table: string, row: any, patch: Record<string, any>,
  ctx: { projectId: string; profile: any; label: string }
) {
  // مقادیر تصویر/داده‌ی طولانی در گزارش تغییرات کوتاه می‌شوند تا لاگ خوانا بماند
  const short = (x: any) => {
    const s = String(x ?? "—");
    return s.startsWith("data:") ? "[تصویر]" : s.length > 60 ? s.slice(0, 57) + "…" : s;
  };
  const changed = Object.entries(patch)
    .filter(([k, v]) => String(row[k] ?? "") !== String(v ?? ""))
    .map(([k, v]) => `${k}: ${short(row[k])} ← ${short(v)}`);
  const { error } = await supabase.from(table).update(patch).eq("id", row.id);
  if (error) { alert("خطا در ذخیره: " + error.message); return false; }
  logAction(ctx.projectId, ctx.profile.id, `ویرایش ${ctx.label}`,
    changed.length ? changed.slice(0, 4).join(" · ") : ctx.label);
  return true;
}

export async function deleteRow(
  table: string, row: any,
  ctx: { projectId: string; profile: any; label: string; detail?: string }
) {
  if (!confirm(`«${ctx.detail || ctx.label}» حذف شود؟\nاین کار در گزارش تغییرات ثبت می‌شود.`)) return false;
  const { error } = await supabase.from(table).delete().eq("id", row.id);
  if (error) { alert("خطا در حذف: " + error.message); return false; }
  logAction(ctx.projectId, ctx.profile.id, `حذف ${ctx.label}`, ctx.detail || "");
  return true;
}
