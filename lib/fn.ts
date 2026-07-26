"use client";
import { supabase, DEMO, SUPABASE_URL } from "./supabase";

const cfg: any = (typeof window !== "undefined" && (window as any).__VIVERE_CONFIG__) || {};
const BASE = SUPABASE_URL;
const ANON = cfg.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * فراخوانی Supabase Edge Function.
 * در حالت نمایشی یا وقتی سرویس تنظیم نشده، بی‌صدا رد می‌شود تا جریان کار قطع نشود.
 */
export async function callFn(name: string, body: any): Promise<any> {
  if (DEMO || !BASE) return { ok: false, skipped: "demo" };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const res = await fetch(`${BASE}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON || "",
        Authorization: `Bearer ${token || ANON}`,
      },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || "network" };
  }
}
