// ارسال پیامک از طریق کاوه‌نگار
import { cors, json, caller } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await caller(req);
    if (c.err) return c.err;
    const { db } = c;
    const key = Deno.env.get("KAVENEGAR_API_KEY");
    if (!key) return json({ ok: false, skipped: "sms-not-configured" });

    const { toUserId, message } = await req.json();
    const { data: p } = await db.from("profiles").select("phone").eq("id", toUserId).single();
    if (!p?.phone) return json({ ok: false, skipped: "no-phone" });

    const q = new URLSearchParams({ receptor: String(p.phone), message: String(message || "").slice(0, 400) });
    const r = await fetch(`https://api.kavenegar.com/v1/${key}/sms/send.json?${q}`);
    return json({ ok: r.ok });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
