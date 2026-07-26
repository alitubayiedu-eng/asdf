"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { num } from "@/lib/num";
import { fmt } from "@/lib/constants";
import { accessibleProjects, kindMeta } from "@/lib/scope";
import { exportExcel, printPdf, tbl, kpis, faN, svgHBars, svgPie, CH } from "@/lib/export";

// گزارش تجمیعی چندپروژه‌ای — نمای مالی کل هلدینگ روی همه پروژه‌ها
export default function PortfolioPage() {
  const { profile } = useSession();
  const [projects, setProjects] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);      // همه اسناد مالی همه پروژه‌ها
  const [pos, setPos] = useState<any[]>([]);        // سفارش‌های خرید (تعهد تدارکاتی)
  const [year, setYear] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const prj = await accessibleProjects(profile);
      setProjects(prj);
      const ids = prj.map(p => p.id);
      if (ids.length) {
        const { data: t } = await supabase.from("transactions").select("*").in("project_id", ids).limit(20000);
        const { data: p } = await supabase.from("purchase_orders").select("*").in("project_id", ids).limit(20000);
        setTxns(t || []); setPos(p || []);
      }
      setLoading(false);
    })();
  }, [profile]);

  const pmap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const years = useMemo(() => {
    const s = new Set<string>();
    for (const t of txns) { const y = (t.txn_date || "").slice(0, 4); if (y) s.add(y); }
    return [...s].sort().reverse();
  }, [txns]);

  const inYear = (d?: string) => year === "all" || (d || "").slice(0, 4) === year;
  const ftx = useMemo(() => txns.filter(t => inYear(t.txn_date)), [txns, year]);
  const fpo = useMemo(() => pos.filter(p => inYear(p.order_date || p.created_at)), [pos, year]);

  const isIn = (t: any) => ["receipt", "income"].includes(t.type);
  const isOut = (t: any) => ["payment", "expense"].includes(t.type);
  const totalIn = ftx.filter(isIn).reduce((s, t) => s + num(t.amount), 0);
  const totalOut = ftx.filter(isOut).reduce((s, t) => s + num(t.amount), 0);

  // خرج به تفکیک طرف حساب (پاسخ به «کل پرداخت به فلان تامین‌کننده»)
  const byParty = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of ftx.filter(isOut)) {
      const k = (t.counterparty || "بدون طرف حساب").trim();
      m[k] = (m[k] || 0) + num(t.amount);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [ftx]);

  // خرید تدارکاتی به تفکیک تامین‌کننده (تعهد — نه لزوماً پرداخت‌شده)
  const byVendor = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of fpo) {
      const k = (p.vendor_name || "نامشخص").trim();
      m[k] = (m[k] || 0) + num(p.qty) * num(p.unit_price);
    }
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [fpo]);

  // خلاصه هر پروژه
  const perProject = useMemo(() => projects.map(p => {
    const rows = ftx.filter(t => t.project_id === p.id);
    const cin = rows.filter(isIn).reduce((s, t) => s + num(t.amount), 0);
    const cout = rows.filter(isOut).reduce((s, t) => s + num(t.amount), 0);
    return { ...p, cin, cout, net: cin - cout, count: rows.length };
  }).sort((a, b) => b.cout - a.cout), [projects, ftx]);

  const kindTotals = useMemo(() => {
    const m: Record<string, { cin: number; cout: number }> = {};
    for (const p of perProject) {
      const k = p.kind || "construction";
      m[k] = m[k] || { cin: 0, cout: 0 };
      m[k].cin += p.cin; m[k].cout += p.cout;
    }
    return m;
  }, [perProject]);

  const yLabel = year === "all" ? "همه سال‌ها" : `سال ${year}`;

  const exportXlsx = () => {
    exportExcel(`گزارش تجمیعی هلدینگ — ${yLabel}`, [
      { name: "خلاصه پروژه‌ها", rows: [["پروژه", "نوع", "دریافت/درآمد", "پرداخت/هزینه", "خالص", "تعداد سند"],
        ...perProject.map(p => [p.name, kindMeta(p.kind).label, p.cin, p.cout, p.net, p.count])] },
      { name: "خرج به تفکیک طرف حساب", rows: [["طرف حساب", "جمع پرداخت (ریال)"], ...byParty.map(v => [v.name, v.value])] },
      { name: "خرید تدارکاتی تامین‌کننده", rows: [["تامین‌کننده", "جمع خرید (ریال)"], ...byVendor.map(v => [v.name, v.value])] },
    ]);
  };
  const exportPdf = () => {
    printPdf("گزارش تجمیعی هلدینگ", `نمای مالی همه پروژه‌ها — ${yLabel}`,
      kpis([["جمع دریافت/درآمد", faN(totalIn) + " ریال"], ["جمع پرداخت/هزینه", faN(totalOut) + " ریال"],
        ["خالص نقدینگی", faN(totalIn - totalOut) + " ریال"], ["تعداد پروژه", faN(projects.length)]]) +
      svgPie("سهم پرداخت هر بخش", Object.entries(kindTotals).map(([k, v]) => ({ name: kindMeta(k).label, value: v.cout }))) +
      svgHBars("خرج به تفکیک طرف حساب (۱۵ مورد نخست)", byParty.slice(0, 15).map(v => ({ name: v.name, value: v.value, note: faN(v.value) + " ریال" }))) +
      "<h2>خلاصه هر پروژه</h2>" + tbl(["پروژه", "نوع", "دریافت/درآمد", "پرداخت/هزینه", "خالص"],
        perProject.map(p => [p.name, kindMeta(p.kind).label, faN(p.cin), faN(p.cout), faN(p.net)])) +
      (byVendor.length ? "<h2>خرید تدارکاتی به تفکیک تامین‌کننده</h2>" + tbl(["تامین‌کننده", "جمع خرید (ریال)"],
        byVendor.slice(0, 20).map(v => [v.name, faN(v.value)])) : ""));
  };

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-black">گزارش تجمیعی هلدینگ</h1>
        <span className="chip bg-primary/10 text-primary">{fmt(projects.length)} پروژه</span>
        <select className="input w-auto py-1 text-sm" value={year} onChange={e => setYear(e.target.value)}>
          <option value="all">همه سال‌ها</option>
          {years.map(y => <option key={y} value={y}>سال {y} میلادی</option>)}
        </select>
        <span className="mr-auto flex gap-2">
          <button className="btn-ghost py-1 text-xs" onClick={exportXlsx} disabled={loading}>خروجی اکسل</button>
          <button className="btn-ghost py-1 text-xs" onClick={exportPdf} disabled={loading}>خروجی PDF</button>
        </span>
      </div>

      {loading && <p className="text-sm text-ink/50">در حال جمع‌بندی همه پروژه‌ها…</p>}
      {!loading && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["جمع دریافت/درآمد", totalIn, "text-ok"], ["جمع پرداخت/هزینه", totalOut, "text-danger"],
              ["خالص نقدینگی", totalIn - totalOut, ""], ["تعداد سند مالی", ftx.length, ""]].map(([l, v, c]) => (
              <div key={l as string} className="stat">
                <div className="text-xs font-bold text-ink/50">{l}</div>
                <div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{l === "تعداد سند مالی" ? fmt(v as number) : fmt(v as number) + " ریال"}</div>
              </div>
            ))}
          </div>

          {/* جمع هر بخش */}
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {Object.entries(kindTotals).map(([k, v]) => (
              <Link key={k} href={kindMeta(k).href} className="card card-hover">
                <div className="flex items-center gap-2 font-black">{kindMeta(k).icon} بخش {kindMeta(k).label}</div>
                <div className="mt-2 flex justify-between text-xs"><span className="text-ink/50">دریافت/درآمد</span><b className="text-ok">{fmt(v.cin)}</b></div>
                <div className="mt-1 flex justify-between text-xs"><span className="text-ink/50">پرداخت/هزینه</span><b className="text-danger">{fmt(v.cout)}</b></div>
                <div className="mt-1 flex justify-between text-xs"><span className="text-ink/50">خالص</span><b className={v.cin - v.cout < 0 ? "text-danger" : ""}>{fmt(v.cin - v.cout)}</b></div>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* خرج به تفکیک طرف حساب */}
            <div className="card p-0">
              <div className="border-b border-line px-3 py-2 text-sm font-black">خرج به تفکیک طرف حساب</div>
              {byParty.length === 0 && <p className="p-3 text-sm text-ink/40">سند پرداختی در این بازه نیست.</p>}
              {byParty.slice(0, 20).map((v, i) => {
                const max = byParty[0]?.value || 1;
                return (
                  <div key={i} className="px-3 py-1.5 text-sm">
                    <div className="flex justify-between"><span className="truncate font-bold">{v.name}</span><b className="shrink-0">{fmt(v.value)}</b></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line"><div className="h-full bg-danger/70" style={{ width: `${(v.value / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>

            {/* خرید تدارکاتی به تفکیک تامین‌کننده */}
            <div className="card p-0">
              <div className="border-b border-line px-3 py-2 text-sm font-black">خرید تدارکاتی به تفکیک تامین‌کننده <span className="text-[10px] font-normal text-ink/40">(تعهد سفارش خرید)</span></div>
              {byVendor.length === 0 && <p className="p-3 text-sm text-ink/40">سفارش خریدی در این بازه نیست.</p>}
              {byVendor.slice(0, 20).map((v, i) => {
                const max = byVendor[0]?.value || 1;
                return (
                  <div key={i} className="px-3 py-1.5 text-sm">
                    <div className="flex justify-between"><span className="truncate font-bold">{v.name}</span><b className="shrink-0">{fmt(v.value)}</b></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line"><div className="h-full" style={{ width: `${(v.value / max) * 100}%`, background: CH.primary }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* خلاصه هر پروژه */}
          <div className="card mt-4 overflow-auto p-0">
            <div className="border-b border-line px-3 py-2 text-sm font-black">خلاصه مالی هر پروژه</div>
            <table className="w-full">
              <thead className="bg-surface"><tr>
                <th className="th">پروژه</th><th className="th">بخش</th><th className="th">دریافت/درآمد</th>
                <th className="th">پرداخت/هزینه</th><th className="th">خالص</th><th className="th">اسناد</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {perProject.map(p => (
                  <tr key={p.id}>
                    <td className="td"><Link href={`/project?id=${p.id}`} className="font-bold text-blueprint hover:underline">{p.name}</Link></td>
                    <td className="td text-xs">{kindMeta(p.kind).icon} {kindMeta(p.kind).label}</td>
                    <td className="td text-ok">{fmt(p.cin)}</td>
                    <td className="td text-danger">{fmt(p.cout)}</td>
                    <td className={`td font-bold ${p.net < 0 ? "text-danger" : ""}`}>{fmt(p.net)}</td>
                    <td className="td">{fmt(p.count)}</td>
                    <td className="td"><Link href={`/report?id=${p.id}`} className="text-xs text-blueprint hover:underline">گزارش ←</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  );
}
