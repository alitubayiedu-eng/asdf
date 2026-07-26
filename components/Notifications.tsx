"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/constants";
import { criticalAlerts, type Alert } from "@/lib/alerts";

const SEV_STYLE: Record<string, string> = {
  high: "border-danger/30 bg-danger/[0.06]",
  mid: "border-crane/40 bg-crane/[0.08]",
  low: "border-line bg-surface",
};
const SEV_LABEL: Record<string, string> = { high: "بحرانی", mid: "مهم", low: "یادآوری" };

export default function Notifications({ profile }: { profile: any }) {
  const userId = profile?.id;
  const [items, setItems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter(i => !i.read).length;
  const badge = unread + alerts.length;

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setItems(data || []);
  };
  const scan = async () => {
    try { setAlerts(await criticalAlerts(profile)); } catch { /* پویش نباید UI را متوقف کند */ }
  };
  useEffect(() => {
    if (!userId) return;
    load(); scan();
    const t = setInterval(() => { load(); scan(); }, 60000);
    return () => clearInterval(t);
  }, [userId]);

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    load();
  };

  return (
    <div className="relative">
      <button className="relative rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-bold"
        onClick={() => setOpen(!open)}>
        اعلان‌ها
        {badge > 0 && <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] text-cream">{badge.toLocaleString("fa-IR")}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-20 w-96 max-w-[92vw] rounded-xl border border-line bg-card p-2 shadow-lg">
          {/* رویدادهای بحرانی زنده */}
          {alerts.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-black text-danger">رویدادهای بحرانی ({alerts.length.toLocaleString("fa-IR")})</span>
                <span className="text-[10px] text-ink/40">به‌روزرسانی زنده</span>
              </div>
              <div className="max-h-64 space-y-1 overflow-auto">
                {alerts.map(a => (
                  <Link key={a.id} onClick={() => setOpen(false)}
                    href={a.projectId ? `/project?id=${a.projectId}${a.tab ? `&tab=${a.tab}` : ""}` : "/dashboard"}
                    className={`block rounded-lg border p-2 text-xs hover:brightness-95 ${SEV_STYLE[a.severity]}`}>
                    <div className="flex items-center gap-1 font-bold">
                      <span>{a.icon}</span>
                      <span className="flex-1">{a.title}</span>
                      <span className="chip shrink-0 bg-ink/5 text-[9px]">{SEV_LABEL[a.severity]}</span>
                    </div>
                    <div className="mt-0.5 text-ink/60">{a.body}</div>
                    <div className="mt-0.5 text-[10px] text-blueprint">{a.projectName} ←</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line px-2 py-1 pt-2">
            <span className="text-xs font-bold">آخرین اعلان‌ها</span>
            <button className="text-xs text-blueprint" onClick={markAll}>علامت‌گذاری همه</button>
          </div>
          <div className="max-h-64 overflow-auto">
            {items.length === 0 && alerts.length === 0 && <p className="p-3 text-center text-xs text-ink/40">اعلانی وجود ندارد.</p>}
            {items.map(n => (
              <div key={n.id} className={`rounded-lg p-2 text-xs ${n.read ? "" : "bg-crane/10"}`}>
                <div className="font-bold">{n.title}</div>
                <div className="mt-0.5 text-ink/60">{n.body}</div>
                <div className="mt-0.5 text-[10px] text-ink/40">{fmtDate(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
