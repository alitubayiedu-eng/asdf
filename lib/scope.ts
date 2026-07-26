"use client";
import { supabase } from "./supabase";

/**
 * ════════════════════════════════════════════════════════════
 *   دامنه دسترسی هلدینگ — پروژه‌هایی که کاربر می‌بیند
 * ════════════════════════════════════════════════════════════
 * مدیر سیستم / مدیر پروژه / سرمایه‌گذار → همه پروژه‌ها
 * سایر نقش‌ها → فقط پروژه‌هایی که عضو آن‌ها هستند
 * این تابع مبنای مشترک داشبورد هلدینگ، جستجوی سراسری،
 * گزارش تجمیعی و اعلان‌های بحرانی است تا همه یک دامنه ببینند.
 */
export const GLOBAL_ROLES = ["admin", "pm", "investor", "ceo", "board_member"];

export async function accessibleProjects(profile: any): Promise<any[]> {
  if (!profile) return [];
  if (GLOBAL_ROLES.includes(profile.role)) {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    return data || [];
  }
  const { data: mem } = await supabase.from("project_members").select("project_id").eq("user_id", profile.id);
  const ids = (mem || []).map((m: any) => m.project_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("projects").select("*").in("id", ids).order("created_at", { ascending: false });
  return data || [];
}

/** فقط شناسه پروژه‌های قابل‌دسترسی — برای کوئری‌های سبک */
export async function accessibleProjectIds(profile: any): Promise<string[]> {
  return (await accessibleProjects(profile)).map(p => p.id);
}

/** برچسب و نماد هر نوع پروژه */
export const KIND_META: Record<string, { label: string; icon: string; href: string }> = {
  construction: { label: "عمران", icon: "🏗", href: "/projects?kind=construction" },
  factory: { label: "کارخانه", icon: "🏭", href: "/projects?kind=factory" },
  solar: { label: "نیروگاه", icon: "☀️", href: "/projects?kind=solar" },
  chp: { label: "سیکل ترکیبی", icon: "🔥", href: "/projects?kind=chp" },
};
export const kindMeta = (k?: string) => KIND_META[k || "construction"] || KIND_META.construction;
