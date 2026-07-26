"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, DEMO } from "@/lib/supabase";
import { DEMO_USERS } from "@/lib/mockdb";
import { ROLES } from "@/lib/constants";

export default function Login() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const router = useRouter();
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !pass) { setErr("ایمیل و رمز عبور را وارد کنید."); return; }
    setErr(""); setBusy(true);
    const { data: auth, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) { setErr("ایمیل یا رمز عبور اشتباه است."); setBusy(false); return; }
    const uid = auth?.user?.id || auth?.session?.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("is_active").eq("id", uid).single();
      if (prof && prof.is_active === false) {
        await supabase.auth.signOut();
        setErr("حساب شما توسط مدیر سیستم غیرفعال شده است.");
        setBusy(false); return;
      }
    }
    router.replace("/dashboard");
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* ───── سمت راست: معرفی (فقط دسکتاپ) ───── */}
      <div className="relative hidden flex-col justify-center overflow-hidden p-12 lg:flex"
        style={{ background: "linear-gradient(150deg, rgb(var(--sidebar)) 0%, rgb(var(--sidebar-2)) 100%)" }}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, rgb(var(--sidebar-accent)) 0%, transparent 70%)" }} />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)" }} />
        </div>
        <div className="relative text-white">
          <div className="mb-6 grid h-16 w-16 place-items-center rounded-3xl text-2xl font-black"
            style={{ background: "linear-gradient(135deg, rgb(var(--sidebar-accent)), rgb(var(--accent)))" }}>D</div>
          <h1 className="text-4xl font-black tracking-tight" dir="ltr">Different</h1>
          <p className="mt-1 text-lg font-bold text-white/80">Agency Platform</p>
          <p className="mt-5 max-w-md text-sm leading-8 text-white/60">
            پلتفرم یکپارچه‌ی مدیریت پروژه، تولید و انرژی — همه‌ی بخش‌های سازمان در یک‌جا،
            بدون داده‌ی تکراری و با گزارش‌های آماده.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[["🏗", "پروژه‌های عمرانی"], ["🏭", "کارخانه و تولید"], ["☀️", "نیروگاه خورشیدی"], ["🔥", "سیکل ترکیبی"]].map(([i, t]) => (
              <div key={t} className="flex items-center gap-2.5 rounded-2xl px-3 py-3 text-sm font-bold text-white/85"
                style={{ background: "rgb(255 255 255 / .06)" }}>
                <span className="text-lg">{i}</span>{t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ───── سمت چپ: فرم ورود ───── */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* نشان موبایل */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-xl font-black text-white"
              style={{ background: "linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))" }}>D</div>
            <h1 className="text-2xl font-black tracking-tight" dir="ltr">Different</h1>
            <p className="text-xs text-ink/50">Agency Platform</p>
          </div>

          <h2 className="page-title">خوش آمدید 👋</h2>
          <p className="page-sub mb-6">برای ورود، ایمیل و رمز عبور خود را وارد کنید.</p>

          <div className="space-y-4">
            <div>
              <label className="label">ایمیل</label>
              <input className="input" dir="ltr" autoComplete="username" placeholder="name@company.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            <div>
              <label className="label">رمز عبور</label>
              <div className="relative">
                <input className="input pl-16" dir="ltr" autoComplete="current-password"
                  type={showPass ? "text" : "password"} value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 left-0 px-3 text-xs font-bold text-ink/45 hover:text-primary">
                  {showPass ? "پنهان" : "نمایش"}
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2.5 text-xs font-bold text-danger">
                <span>⚠</span><span>{err}</span>
              </div>
            )}

            <button className="btn-primary w-full py-3" disabled={busy} onClick={submit}>
              {busy ? "در حال ورود…" : "ورود به پلتفرم"}
            </button>

            <p className="hint">
              <span>💡</span>
              <span>حساب کاربری ندارید؟ حساب شما توسط مدیر سیستم در بخش «کاربران و نقش‌ها» ساخته می‌شود.</span>
            </p>
          </div>

          {mounted && DEMO && (
            <div className="card mt-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-black">حالت نمایشی — ورود سریع</span>
                <span className="chip bg-accent/10 text-accent" dir="ltr">Vivere@123</span>
              </div>
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-auto">
                {DEMO_USERS.map(u => (
                  <button key={u.id} className="rounded-xl border border-line p-2.5 text-right text-xs transition hover:border-primary/40 hover:bg-primary-soft"
                    onClick={() => { setEmail(u.email); setPass(u.password); }}>
                    <div className="font-bold">{ROLES[u.role] || u.role}</div>
                    <div dir="ltr" className="truncate text-ink/45">{u.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
