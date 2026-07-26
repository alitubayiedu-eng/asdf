"use client";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/num";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgBars, svgHBars, CH } from "@/lib/export";
import { loadCostData, sourcesFor, syncActuals, actualOf, isLinked, CostData } from "@/lib/costlink";

// نگاشت سرستون‌های فایل اکسل CBS به فیلدهای دیتابیس
const H: Record<string, string> = {
  "کد هزینه": "cost_code", "کد والد": "parent_code", "فاز پروژه": "phase_name",
  "بسته کاری": "work_package", "فعالیت": "activity", "دسته هزینه": "category",
  "نام آیتم": "item_name", "شرح تفصیلی": "description", "واحد اندازه‌گیری": "unit",
  "مقدار": "quantity", "نرخ واحد (ریال)": "unit_rate", "درصد پرت": "waste_pct",
  "نوع هزینه": "cost_type", "سطح ریسک": "risk", "اولویت": "priority",
  "مایلستون پرداخت": "milestone", "ملاحظات": "remarks",
};

export default function CbsTab({ projectId, profile, canEdit }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [cost, setCost] = useState<CostData | null>(null);
  const [trace, setTrace] = useState<any>(null);   // آیتم در حال ردیابی
  const [q, setQ] = useState("");
  const [phaseF, setPhaseF] = useState("");
  const [busy, setBusy] = useState("");

  const load = () => {
    supabase.from("cbs_items").select("*").eq("project_id", projectId)
      .order("cost_code").limit(5000).then(({ data }: any) => setItems(data || []));
    loadCostData(projectId).then(d => { setCost(d); syncActuals(projectId, d); });
  };
  useEffect(() => { load(); }, [projectId]);

  const importExcel = async (file: File) => {
    setBusy("در حال خواندن فایل اکسل…");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
    const mapped = rows.filter(r => r["کد هزینه"]).map(r => {
      const o: any = { project_id: projectId, actual_total: 0 };
      for (const [fa, en] of Object.entries(H)) o[en] = r[fa] ?? null;
      o.quantity = num(o.quantity) || 0;
      o.unit_rate = num(o.unit_rate) || 0;
      o.waste_pct = num(o.waste_pct) || 0;
      return o;
    });
    setBusy(`در حال ذخیره ${mapped.length.toLocaleString("fa-IR")} آیتم…`);
    await supabase.from("cbs_items").delete().eq("project_id", projectId);
    for (let i = 0; i < mapped.length; i += 500) {
      const { error } = await supabase.from("cbs_items").insert(mapped.slice(i, i + 500));
      if (error) { alert("خطا در ذخیره: " + error.message); break; }
      setBusy(`ذخیره‌شده: ${Math.min(i + 500, mapped.length).toLocaleString("fa-IR")} از ${mapped.length.toLocaleString("fa-IR")}`);
    }
    logAction(projectId, profile.id, "ورود فایل CBS", `${mapped.length.toLocaleString("fa-IR")} آیتم بارگذاری شد`);
    setBusy(""); load();
  };

  const exportExcel = () => {
    const data = items.map(it => ({
      "کد هزینه": it.cost_code, "فاز پروژه": it.phase_name, "بسته کاری": it.work_package,
      "فعالیت": it.activity, "دسته هزینه": it.category, "نام آیتم": it.item_name,
      "واحد": it.unit, "مقدار": it.quantity, "نرخ واحد (ریال)": it.unit_rate,
      "درصد پرت": it.waste_pct, "هزینه برنامه‌ای (ریال)": planned(it),
      "هزینه واقعی (ریال)": it.actual_total, "انحراف (ریال)": planned(it) - num(it.actual_total || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CBS");
    XLSX.writeFile(wb, "CBS-گزارش-هزینه.xlsx");
  };

  const planned = (it: any) => num(it.quantity || 0) * num(it.unit_rate || 0) * (1 + num(it.waste_pct || 0));

  const patch = async (id: string, p: any) => {
    await supabase.from("cbs_items").update(p).eq("id", id);
    setItems(items.map(i => (i.id === id ? { ...i, ...p } : i)));
  };

  const phases = useMemo(() => Array.from(new Set(items.map(i => i.phase_name))).filter(Boolean), [items]);
  const shown = items.filter(i =>
    (!phaseF || i.phase_name === phaseF) &&
    (!q || `${i.cost_code} ${i.item_name} ${i.activity}`.includes(q))
  ).slice(0, 300);

  const totPlanned = items.reduce((s, i) => s + planned(i), 0);
  const R = (id: string) => cost?.byItem[id] || { planned: 0, committed: 0, actual: 0, certified: 0, materialOut: 0, docs: 0 };
  // هزینه واقعی: از اسناد متصل، یا مقدار ثبت‌شده اگر سندی نیست
  const totActual = items.reduce((s2, i) => s2 + actualOf(i, cost?.byItem[i.id]), 0);
  const totCommitted = cost?.totals.committed || 0;
  const totCertified = cost?.totals.certified || 0;

  const cbsPdf = () => {
    const byPhase: Record<string, { p: number; a: number }> = {};
    const byCat: Record<string, number> = {};
    for (const i of items) {
      const k = i.phase_name || "—";
      byPhase[k] = byPhase[k] || { p: 0, a: 0 };
      byPhase[k].p += planned(i); byPhase[k].a += num(i.actual_total || 0);
      byCat[i.category || "سایر"] = (byCat[i.category || "سایر"] || 0) + planned(i);
    }
    const ph = Object.entries(byPhase);
    const topDev = ph.map(([n, v]) => ({ name: n, value: Math.round(v.p - v.a) }))
      .sort((a, b) => a.value - b.value).slice(0, 14);
    printPdf("گزارش ساختار شکست هزینه (CBS)", `${faN(items.length)} آیتم هزینه — بودجه در برابر واقعی`,
      kpis([["تعداد آیتم", faN(items.length)], ["بودجه کل", faN(Math.round(totPlanned)) + " ریال"],
        ["تعهد", faN(Math.round(totCommitted)) + " ریال"],
        ["هزینه واقعی", faN(Math.round(totActual)) + " ریال"]]) +
      kpis([["کارکرد تاییدشده", faN(Math.round(totCertified)) + " ریال"],
        ["مانده بودجه", faN(Math.round(totPlanned - totActual - totCommitted)) + " ریال"],
        ["اسناد متصل", faN(cost?.totals.docs || 0)],
        ["مصرف انبار", faN(Math.round(cost?.totals.materialOut || 0)) + " ریال"]]) +
      (ph.length ? svgBars("بودجه در برابر واقعی به تفکیک فاز", ph.map(x => x[0]), [
        { name: "برنامه‌ای", color: CH.primary, values: ph.map(x => Math.round(x[1].p)) },
        { name: "واقعی", color: CH.accent, values: ph.map(x => Math.round(x[1].a)) }], "ریال") : "") +
      (Object.keys(byCat).length ? svgPie("سهم دسته‌های هزینه از بودجه",
        Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))) : "") +
      (topDev.length ? svgHBars("انحراف هزینه فازها (منفی = بیش‌مصرف)", topDev.map(d => ({
        ...d, color: d.value < 0 ? CH.danger : CH.ok, note: faN(d.value) + " ریال" }))) : "") +
      "<h2>خلاصه فازها</h2>" + tbl(["فاز", "بودجه (ریال)", "واقعی (ریال)", "انحراف", "مصرف"],
        ph.map(([n, v]) => [n, faN(Math.round(v.p)), faN(Math.round(v.a)), faN(Math.round(v.p - v.a)),
          v.p ? faN(Math.round(v.a / v.p * 100)) + "٪" : "—"])) +
      "<h2>آیتم‌های هزینه (۸۰ ردیف اول)</h2>" + tbl(["کد", "فاز", "آیتم", "مقدار", "فی", "برنامه‌ای", "واقعی"],
        items.slice(0, 80).map(i => [i.cost_code, i.phase_name, (i.item_name || "").slice(0, 40),
          faN(i.quantity), faN(i.unit_rate), faN(Math.round(planned(i))), faN(i.actual_total)])));
  };

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3">
        <button className="btn-ghost py-1 text-xs" onClick={cbsPdf}>خروجی PDF</button>
        {canEdit && (
          <label className="btn-accent cursor-pointer">
            ورود فایل اکسل CBS
            <input type="file" accept=".xlsx" className="hidden"
              onChange={e => e.target.files?.[0] && importExcel(e.target.files[0])} />
          </label>
        )}
        <button className="btn-ghost" onClick={exportExcel}>خروجی اکسل با هزینه‌های واقعی</button>
        <span className="text-xs text-ink/50">{busy || `${items.length.toLocaleString("fa-IR")} آیتم بارگذاری‌شده`}</span>
        <div className="mr-auto flex gap-4 text-sm">
          <span>بودجه: <b>{fmt(Math.round(totPlanned))}</b> ریال</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          {[["بودجه کل", totPlanned, ""],
            ["تعهد (قرارداد + خرید)", totCommitted, "text-crane"],
            ["هزینه واقعی (پرداختی)", totActual, totActual > totPlanned ? "text-danger" : ""],
            ["کارکرد تاییدشده", totCertified, "text-primary"],
            ["مانده بودجه", totPlanned - totActual - totCommitted, totPlanned - totActual - totCommitted < 0 ? "text-danger" : "text-ok"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-lg border border-line p-2">
              <div className="text-[11px] font-bold text-ink/50">{l}</div>
              <div className={`mt-0.5 text-sm font-black ${c}`}>{fmt(Math.round(v as number))}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-ink/40">
          هزینه واقعی فقط از اسناد مالی (پرداخت/هزینه) محاسبه می‌شود تا با تعهدها دوباره‌شماری نشود.
          روی ستون «اسناد» هر ردیف کلیک کنید تا ببینید کدام سند آن را ساخته است.
        </p>
      </div>
      <div className="card flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="جستجو در کد، نام آیتم یا فعالیت…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input max-w-xs" value={phaseF} onChange={e => setPhaseF(e.target.value)}>
          <option value="">همه فازها</option>
          {phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="self-center text-xs text-ink/40">نمایش {shown.length.toLocaleString("fa-IR")} ردیف اول نتایج</span>
      </div>
      {/* ─── پنجره ردیابی: کدام اسناد این کد هزینه را ساخته‌اند ─── */}
      {trace && cost && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setTrace(null)}>
          <div className="card max-h-[85vh] w-full max-w-3xl overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="code-chip">{trace.cost_code}</span>
              <h2 className="font-black">{trace.item_name}</h2>
              <button className="btn-ghost mr-auto py-1 text-xs" onClick={() => setTrace(null)}>بستن ✕</button>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {[["بودجه", planned(trace)], ["تعهد", R(trace.id).committed],
                ["هزینه واقعی", actualOf(trace, R(trace.id))], ["کارکرد تاییدشده", R(trace.id).certified]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-line p-2">
                  <div className="text-[11px] text-ink/50">{l}</div>
                  <div className="mt-0.5 font-black">{fmt(Math.round(v as number))}</div>
                </div>
              ))}
            </div>
            <table className="w-full">
              <thead><tr><th className="th">نوع سند</th><th className="th">شرح</th><th className="th">تاریخ</th><th className="th">مبلغ</th></tr></thead>
              <tbody>
                {sourcesFor(cost, trace.id).map((d, i) => (
                  <tr key={i}>
                    <td className="td"><span className={`chip ${
                      d.tone === "actual" ? "bg-primary/10 text-primary" :
                      d.tone === "committed" ? "bg-crane/15 text-crane" :
                      d.tone === "certified" ? "bg-ok/10 text-ok" : "bg-surface"}`}>{d.kind}</span></td>
                    <td className="td max-w-72 truncate" title={d.label}>{d.label}</td>
                    <td className="td">{fmtDate(d.date)}</td>
                    <td className="td font-bold">{fmt(Math.round(d.amount))}</td>
                  </tr>
                ))}
                {sourcesFor(cost, trace.id).length === 0 &&
                  <tr><td className="td text-ink/40" colSpan={4}>سندی به این کد متصل نیست.</td></tr>}
              </tbody>
            </table>
            {R(trace.id).materialOut > 0 && (
              <p className="mt-2 rounded-lg bg-surface p-2 text-[11px] text-ink/55">
                مصرف انبار: {fmt(Math.round(R(trace.id).materialOut))} ریال — این مبلغ در «هزینه واقعی» شمرده نمی‌شود،
                چون هزینه خرید همان کالا قبلاً در سند مالی ثبت شده است.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface">
            <tr>
              <th className="th">کد هزینه</th><th className="th">نام آیتم</th>
              <th className="th">مقدار</th><th className="th">نرخ واحد</th>
              <th className="th">بودجه</th><th className="th">تعهد</th>
              <th className="th">هزینه واقعی</th><th className="th">کارکرد</th>
              <th className="th">مانده بودجه</th><th className="th">اسناد</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(it => {
              const pl = planned(it); const r = R(it.id);
              const act = actualOf(it, r);
              const rem = pl - act - r.committed;   // مانده بودجه پس از تعهد و هزینه
              return (
                <tr key={it.id} className="hover:bg-surface/60">
                  <td className="td"><span className="code-chip">{it.cost_code}</span></td>
                  <td className="td max-w-56 truncate" title={`${it.item_name || ""} · ${it.activity || ""}`}>
                    {it.item_name}
                    {it.phase_name && <span className="mr-1 text-[10px] text-ink/40">{it.phase_name}</span>}
                  </td>
                  <td className="td"><input dir="ltr" className="input w-20 py-1" disabled={!canEdit} value={it.quantity ?? ""}
                    onChange={e => patch(it.id, { quantity: num(e.target.value) || 0 })} /></td>
                  <td className="td"><input dir="ltr" className="input w-28 py-1" disabled={!canEdit} value={it.unit_rate ?? ""}
                    onChange={e => patch(it.id, { unit_rate: num(e.target.value) || 0 })} /></td>
                  <td className="td font-bold">{fmt(Math.round(pl))}</td>
                  <td className="td text-crane">{r.committed ? fmt(Math.round(r.committed)) : "—"}</td>
                  <td className="td font-black">
                    {act ? fmt(Math.round(act)) : "—"}
                    {act > 0 && !isLinked(r) && <span className="mr-1 text-[9px] text-ink/35" title="از ایمپورت اکسل — سندی به این کد متصل نیست">دستی</span>}
                  </td>
                  <td className="td text-primary">{r.certified ? fmt(Math.round(r.certified)) : "—"}</td>
                  <td className={`td font-bold ${rem < 0 ? "text-danger" : "text-ok"}`}>{fmt(Math.round(rem))}</td>
                  <td className="td">
                    {r.docs > 0
                      ? <button className="chip bg-primary/10 text-primary" onClick={() => setTrace(it)}>
                          {r.docs.toLocaleString("fa-IR")} سند ←
                        </button>
                      : <span className="text-[11px] text-ink/30">—</span>}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td className="td text-center text-ink/40" colSpan={10}>آیتمی یافت نشد. فایل اکسل CBS را وارد کنید.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
