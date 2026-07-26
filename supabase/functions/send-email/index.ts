// ارسال ایمیل اعلان از طریق Resend
import { cors, json, caller } from "../_shared/guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await caller(req);
    if (c.err) return c.err;
    const { db } = c;
    const key = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("MAIL_FROM") || "Vivere <noreply@example.com>";
    if (!key) return json({ ok: false, skipped: "resend-not-configured" });

    const { toUserId, subject, title, body, from: sender } = await req.json();
    const { data: p } = await db.from("profiles").select("email").eq("id", toUserId).single();
    if (!p?.email) return json({ ok: false, skipped: "no-email" });

    const html = `<div dir="rtl" style="font-family:Tahoma,sans-serif;background:#F7F3EC;padding:24px">
      <div style="max-width:560px;margin:auto;background:#FFFDF9;border:1px solid #E7DFD2;border-radius:16px;padding:20px">
        <div style="border-bottom:3px solid #0F5A4E;padding-bottom:10px;margin-bottom:14px">
          <b style="font-size:16px">گروه فنی مهندسی و سرمایه‌گذاری ویــِـره</b></div>
        <h2 style="font-size:15px">${title ?? ""}</h2>
        <p style="font-size:13px;line-height:2;color:#2B2620">${(body ?? "").replace(/</g, "&lt;")}</p>
        <p style="font-size:11px;color:#8a8070">ارسال‌کننده: ${sender ?? "—"}</p>
      </div></div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: p.email, subject: subject || "اعلان ویــِـره", html }),
    });
    return json({ ok: r.ok });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
