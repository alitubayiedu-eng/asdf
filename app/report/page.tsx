"use client";
import { Suspense, useEffect, useState } from "react";
import { num } from "@/lib/num";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";

// گزارش ماهانه مدیریتی — نسخه چاپی (Print → Save as PDF)
function ReportInner() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
      const { data: phases } = await supabase.from("phases").select("*").eq("project_id", id).order("sort");
      const { data: items } = await supabase.from("cbs_items").select("phase_name, quantity, unit_rate, waste_pct, actual_total").eq("project_id", id).limit(5000);
      const { data: claims } = await supabase.from("progress_claims").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(10);
      const { data: quality } = await supabase.from("quality_records").select("*").eq("project_id", id).eq("status", "open");
      const { data: reports } = await supabase.from("daily_reports").select("report_date, works, created_by_name").eq("project_id", id).order("report_date", { ascending: false }).limit(5);
      setD({ project, phases: phases || [], items: items || [], claims: claims || [], quality: quality || [], reports: reports || [] });
    })();
  }, [id]);

  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "light");
    return () => { document.documentElement.setAttribute("data-theme", prev || "light"); };
  }, []);

  if (!d?.project) return <div className="p-10 text-center text-ink/40">در حال آماده‌سازی گزارش…</div>;

  const planned = (it: any) => num(it.quantity || 0) * num(it.unit_rate || 0) * (1 + num(it.waste_pct || 0));
  const byPhase: Record<string, { p: number; a: number }> = {};
  for (const it of d.items) {
    byPhase[it.phase_name] = byPhase[it.phase_name] || { p: 0, a: 0 };
    byPhase[it.phase_name].p += planned(it); byPhase[it.phase_name].a += num(it.actual_total || 0);
  }
  const totP = Object.values(byPhase).reduce((s, x) => s + x.p, 0);
  const totA = Object.values(byPhase).reduce((s, x) => s + x.a, 0);
  const progress = d.phases.length ? Math.round(d.phases.reduce((s: number, p: any) => s + (p.progress || 0), 0) / d.phases.length) : 0;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-[#0F1A16]" dir="rtl">
      <style>{`@media print { .no-print { display: none } body { background: white } }`}</style>
      <div className="no-print mb-4 flex gap-2">
        <button className="btn-primary" onClick={() => window.print()}>چاپ / ذخیره PDF</button>
        <button className="btn-ghost" onClick={() => history.back()}>بازگشت</button>
      </div>

      <div className="mb-6 flex items-center justify-between border-b-4 border-blueprint pb-4">
        <div>
          <h1 className="text-2xl font-black">گزارش مدیریتی پروژه</h1>
          <p className="mt-1 text-sm text-ink/60">{d.project.name} — {d.project.location}</p>
        </div>
        <div className="text-left text-xs text-ink/50">
          <div className="mb-1 grid h-10 w-10 place-items-center rounded-xl accent-solid font-black">V</div>
          Different Agency Platform<br />تاریخ گزارش: {fmtDate(new Date().toISOString())}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3 text-center">
        {[["پیشرفت کل", progress.toLocaleString("fa-IR") + "٪"], ["بودجه CBS (ریال)", fmt(Math.round(totP))],
          ["هزینه واقعی (ریال)", fmt(Math.round(totA))], ["انحراف (ریال)", fmt(Math.round(totP - totA))]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-line p-3">
            <div className="text-xs text-ink/50">{l}</div>
            <div className="mt-1 text-base font-black">{v}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 border-r-4 border-crane pr-2 font-black">وضعیت فازها و هزینه‌ها</h2>
      <table className="mb-6 w-full text-sm">
        <thead><tr className="bg-surface">
          <th className="th">فاز</th><th className="th">بازه</th><th className="th">پیشرفت</th>
          <th className="th">بودجه</th><th className="th">واقعی</th>
        </tr></thead>
        <tbody>
          {d.phases.map((p: any) => (
            <tr key={p.id}>
              <td className="td">{p.name}</td>
              <td className="td text-xs">{fmtDate(p.start_date)} — {fmtDate(p.end_date)}</td>
              <td className="td">{(p.progress || 0).toLocaleString("fa-IR")}٪</td>
              <td className="td">{fmt(Math.round(byPhase[p.name]?.p || 0))}</td>
              <td className="td">{fmt(Math.round(byPhase[p.name]?.a || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {d.claims.length > 0 && (<>
        <h2 className="mb-2 border-r-4 border-crane pr-2 font-black">آخرین صورت‌وضعیت‌ها</h2>
        <table className="mb-6 w-full text-sm">
          <thead><tr className="bg-surface"><th className="th">قرارداد</th><th className="th">شماره</th><th className="th">دوره</th><th className="th">خالص</th><th className="th">وضعیت</th></tr></thead>
          <tbody>{d.claims.map((c: any) => (
            <tr key={c.id}><td className="td">{c.contract_title}</td><td className="td">{c.no}</td>
              <td className="td">{c.period}</td><td className="td">{fmt(c.net_amount)}</td><td className="td">{c.status}</td></tr>
          ))}</tbody>
        </table>
      </>)}

      {d.quality.length > 0 && (<>
        <h2 className="mb-2 border-r-4 border-danger pr-2 font-black">موارد باز کیفیت و HSE ({d.quality.length.toLocaleString("fa-IR")})</h2>
        <ul className="mb-6 list-inside list-disc text-sm">
          {d.quality.slice(0, 10).map((q: any) => <li key={q.id}>{q.title} — {q.location} (شدت: {q.severity})</li>)}
        </ul>
      </>)}

      {d.reports.length > 0 && (<>
        <h2 className="mb-2 border-r-4 border-crane pr-2 font-black">آخرین گزارش‌های روزانه</h2>
        {d.reports.map((r: any, i: number) => (
          <p key={i} className="mb-1 text-sm"><b>{fmtDate(r.report_date)}:</b> {r.works} <span className="text-xs text-ink/40">({r.created_by_name})</span></p>
        ))}
      </>)}

      <div className="mt-10 grid grid-cols-3 gap-8 border-t border-line pt-6 text-center text-sm">
        <div>تهیه‌کننده<br /><br />______________</div>
        <div>ناظر<br /><br />______________</div>
        <div>مدیر پروژه<br /><br />______________</div>
      </div>
    </div>
  );
}


export default function ReportPage() {
  return <Suspense fallback={null}><ReportInner /></Suspense>;
}
