// ساخت کاربر — فقط توسط مدیر سیستم یا مدیر پروژه
import { cors, json, caller } from "../_shared/guard.ts";

const VALID = [
  "admin", "ceo", "board_member", "investor", "pm", "factory_manager", "plant_manager",
  "finance_manager", "accountant", "treasurer", "commerce", "sales_manager", "sales_expert",
  "chief_engineer", "site_manager", "supervisor", "phase_engineer", "hse_officer",
  "production_manager", "production_operator", "qc_manager", "maintenance_manager", "warehouse_keeper",
  "om_technician", "energy_trader", "hr_manager",
];
const ADMIN_ONLY = ["admin", "investor", "ceo", "board_member"]; // فقط مدیر سیستم می‌سازد

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await caller(req, ["admin", "pm"]);
    if (c.err) return c.err;
    const { db, me } = c;

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name || !role) return json({ ok: false, error: "همه فیلدها الزامی است" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "ایمیل نامعتبر" }, 400);
    if (String(password).length < 8) return json({ ok: false, error: "رمز عبور باید حداقل ۸ کاراکتر باشد" }, 400);
    if (!VALID.includes(role)) return json({ ok: false, error: "نقش نامعتبر" }, 400);
    if (ADMIN_ONLY.includes(role) && me.role !== "admin")
      return json({ ok: false, error: "ساخت این نقش فقط توسط مدیر سیستم مجاز است" }, 403);

    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return json({ ok: false, error: error.message }, 400);
    await db.from("profiles").upsert({ id: data.user!.id, full_name, role, email, is_active: true });
    return json({ ok: true, id: data.user!.id });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
