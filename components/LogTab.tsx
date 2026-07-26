"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/constants";
import { printPdf, tbl, kpis, faN, faD, svgHBars, svgPie, CH } from "@/lib/export";

export default function LogTab({ projectId }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("activity_log").select("*, profiles:user_id(full_name)")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(400)
      .then(({ data }: any) => setLogs(data || []));
  }, [projectId]);

  const shown = logs.filter(l => !q ||
    `${l.action} ${l.detail} ${l.profiles?.full_name}`.includes(q));

  const logPdf = () => {
    const byUser: Record<string, number> = {}, byAction: Record<string, number> = {};
    for (const l of logs) {
      const u = l.profiles?.full_name || "—";
      byUser[u] = (byUser[u] || 0) + 1;
      byAction[l.action] = (byAction[l.action] || 0) + 1;
    }
    printPdf("گزارش تغییرات (Audit Log)", "سابقه کامل فعالیت کاربران — سند ممیزی",
      kpis([["کل رویدادها", faN(logs.length)], ["کاربران فعال", faN(Object.keys(byUser).length)],
        ["انواع اقدام", faN(Object.keys(byAction).length)],
        ["آخرین رویداد", logs[0] ? faD(logs[0].created_at) : "—"]]) +
      (Object.keys(byUser).length ? svgHBars("تعداد فعالیت به تفکیک کاربر", Object.entries(byUser)
        .sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, note: faN(value) + " رویداد" }))) : "") +
      (Object.keys(byAction).length ? svgPie("پرتکرارترین اقدام‌ها", Object.entries(byAction)
        .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))) : "") +
      "<h2>ریز رویدادها</h2>" + tbl(["تاریخ", "کاربر", "اقدام", "جزئیات"],
        logs.slice(0, 150).map(l => [faD(l.created_at), l.profiles?.full_name || "—", l.action, (l.detail || "—").slice(0, 80)])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={logPdf}>خروجی PDF ممیزی</button></div>
      <div className="card flex items-center gap-3">
        <h2 className="font-black">گزارش تغییرات پروژه</h2>
        <input className="input max-w-xs" placeholder="جستجو در رخدادها…" value={q} onChange={e => setQ(e.target.value)} />
        <span className="text-xs text-ink/40">{shown.length.toLocaleString("fa-IR")} رخداد</span>
      </div>
      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface">
            <tr><th className="th">زمان</th><th className="th">کاربر</th><th className="th">اقدام</th><th className="th">جزئیات</th></tr>
          </thead>
          <tbody>
            {shown.map(l => (
              <tr key={l.id}>
                <td className="td text-xs text-ink/60">
                  {fmtDate(l.created_at)} — {new Date(l.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="td font-bold">{l.profiles?.full_name || "—"}</td>
                <td className="td"><span className="chip bg-blueprint/10 text-blueprint">{l.action}</span></td>
                <td className="td max-w-96 truncate" title={l.detail}>{l.detail || "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td className="td text-center text-ink/40" colSpan={4}>رخدادی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
