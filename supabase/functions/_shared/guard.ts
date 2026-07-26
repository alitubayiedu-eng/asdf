import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
export const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** فراخواننده باید کاربر فعالِ احرازشده باشد؛ در صورت تعیین roles، نقشش هم بررسی می‌شود */
export async function caller(req: Request, roles?: string[]) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return { err: json({ ok: false, error: "unauthorized" }, 401) };
  const db = admin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return { err: json({ ok: false, error: "unauthorized" }, 401) };
  const { data: me } = await db.from("profiles").select("role, is_active").eq("id", data.user.id).single();
  if (!me || me.is_active === false) return { err: json({ ok: false, error: "حساب غیرفعال است" }, 403) };
  if (roles && !roles.includes(me.role)) return { err: json({ ok: false, error: "forbidden" }, 403) };
  return { db, user: data.user, me };
}
