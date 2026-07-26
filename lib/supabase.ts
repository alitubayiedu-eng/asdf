"use client";
import { createClient } from "@supabase/supabase-js";
import { mockClient } from "./mockdb";

/**
 * اولویت خواندن تنظیمات:
 *  ۱) فایل public/config.js روی هاست  ← بدون نیاز به build؛ روش پیشنهادی برای استقرار
 *  ۲) متغیرهای .env.local هنگام build   ← برای توسعه محلی
 *  ۳) هیچ‌کدام → حالت نمایشی (داده در مرورگر)
 */
const cfg: any = (typeof window !== "undefined" && (window as any).__VIVERE_CONFIG__) || {};
const filled = (v?: string) =>
  !!v && v.trim() !== "" && !v.startsWith("REPLACE_WITH") && !v.includes("xxxx");

const url = filled(cfg.SUPABASE_URL) ? cfg.SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = filled(cfg.SUPABASE_ANON_KEY) ? cfg.SUPABASE_ANON_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const CONFIGURED = filled(url) && filled(key);
export const DEMO = !CONFIGURED || cfg.DEMO === true || process.env.NEXT_PUBLIC_DEMO === "1";
export const SUPABASE_URL = url;

export const supabase: any = DEMO
  ? mockClient
  : createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
