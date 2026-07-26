"use client";
import { useEffect, useMemo, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, svgLines, CH } from "@/lib/export";

// سهامداران هر پروژه مستقل‌اند و توسط سرمایه‌گذار مادر (یا ادمین) تعریف می‌شوند
export default function ShareholdersTab({ projectId, profile }: any) {
  const [shs, setShs] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [f, setF] = useState({ name: "", share_pct: "", phone: "" });
  const canEdit = ["investor", "admin"].includes(profile.role);

  const load = () => {
    supabase.from("shareholders").select("*").eq("project_id", projectId).order("created_at").then(({ data }: any) => setShs(data || []));
    supabase.from("transactions").select("*").eq("project_id", projectId).order("txn_date", { ascending: false }).then(({ data }: any) => setTxns(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!f.name) return;
    await supabase.from("shareholders").insert({ project_id: projectId, name: f.name, share_pct: num(f.share_pct) || 0, phone: f.phone });
    logAction(projectId, profile.id, "افزودن سهامدار", `${f.name} — ${f.share_pct}٪`);
    setF({ name: "", share_pct: "", phone: "" }); load();
  };
  const remove = async (s: any) => {
    if (!confirm(`سهامدار «${s.name}» حذف شود؟ (گردش‌های قبلی حفظ می‌شود)`)) return;
    await supabase.from("shareholders").delete().eq("id", s.id);
    logAction(projectId, profile.id, "حذف سهامدار", s.name); load();
  };

  // گردش: از تخصیص‌های ثبت‌شده روی اسناد حسابداری
  const ledger = useMemo(() => {
    const rows: any[] = [];
    for (const t of txns) {
      for (const a of t.allocations || []) {
        const amount = Math.round(num(t.amount) * num(a.pct) / 100);
        const isIn = ["receipt", "income"].includes(t.type);
        rows.push({ id: `${t.id}-${a.shareholder_id}`, date: t.txn_date, name: a.name, pct: a.pct, amount, isIn, desc: t.description || t.counterparty || "—" });
      }
    }
    return rows;
  }, [txns]);

  const totals = useMemo(() => {
    const m: Record<string, { in: number; out: number }> = {};
    for (const r of ledger) {
      m[r.name] = m[r.name] || { in: 0, out: 0 };
      if (r.isIn) m[r.name].in += r.amount; else m[r.name].out += r.amount;
    }
    return m;
  }, [ledger]);

  const totalPct = shs.reduce((s, x) => s + num(x.share_pct || 0), 0);

  return (
    <div className="space-y-3">
      <div className="card py-2"><ExcelIO table="shareholders" projectId={projectId} rows={shs} canEdit={canEdit} profile={profile} onDone={load} /></div>
      <div className="card">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="font-black">سهامداران این پروژه</h2>
          <span className={`chip ${totalPct === 100 ? "bg-ok/10 text-ok" : "bg-crane/20"}`}>مجموع سهم: {totalPct.toLocaleString("fa-IR")}٪</span>
          {!canEdit && <span className="text-[11px] text-ink/40">تعریف سهامدار فقط توسط سرمایه‌گذار مادر / مدیر سیستم</span>}
        </div>
        {canEdit && (
          <div className="mb-2 grid grid-cols-5 gap-2">
            <input className="input col-span-2" placeholder="نام سهامدار" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
            <input className="input" dir="ltr" placeholder="درصد سهم" value={f.share_pct} onChange={e => setF({ ...f, share_pct: e.target.value })} />
            <input className="input" dir="ltr" placeholder="تلفن" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
            <button className="btn-primary" onClick={add}>افزودن سهامدار</button>
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-3">
          {shs.map(s => {
            const t = totals[s.name] || { in: 0, out: 0 };
            return (
              <div key={s.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <span className="font-black">{s.name}</span>
                  <span className="chip chip-on">{num(s.share_pct).toLocaleString("fa-IR")}٪ سهم</span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-ink/50">جمع آورده</span><b className="text-ok">{fmt(t.in)}</b></div>
                  <div className="flex justify-between"><span className="text-ink/50">جمع برداشت</span><b className="text-danger">{fmt(t.out)}</b></div>
                  <div className="flex justify-between border-t border-line pt-1"><span className="text-ink/50">خالص</span><b>{fmt(t.in - t.out)}</b></div>
                </div>
                <div className="mt-2 flex gap-3">
                  <button className="text-xs text-blueprint" onClick={() => {
                    const rows = ledger.filter(r => r.name === s.name);
                    // روند تجمعی خالص سهامدار
                    const asc = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
                    const ml: string[] = []; const cum: number[] = []; let run = 0;
                    for (const r of asc) { run += r.isIn ? r.amount : -r.amount; ml.push(String(r.date || "").slice(0, 7)); cum.push(run); }
                    printPdf(`گردش حساب سهامدار: ${s.name}`, `سهم ${faN(s.share_pct)}٪ — ${rows.length ? "" : "بدون گردش ثبت‌شده"}`,
                      kpis([["جمع آورده", faN(t.in) + " ریال"], ["جمع برداشت", faN(t.out) + " ریال"], ["خالص", faN(t.in - t.out) + " ریال"], ["درصد سهم", faN(s.share_pct) + "٪"]]) +
                      svgPie("ترکیب سهام پروژه", shs.map((x: any) => ({ name: x.name + (x.id === s.id ? " (این سهامدار)" : ""), value: num(x.share_pct) || 0 }))) +
                      svgHBars("آورده در برابر برداشت", [
                        { name: "جمع آورده", value: t.in, color: CH.ok, note: faN(t.in) + " ریال" },
                        { name: "جمع برداشت", value: t.out, color: CH.danger, note: faN(t.out) + " ریال" },
                        { name: "خالص", value: Math.abs(t.in - t.out), color: CH.primary, note: faN(t.in - t.out) + " ریال" },
                      ]) +
                      (cum.length > 1 ? svgLines("روند خالص سرمایه (تجمعی)", ml, [{ name: "خالص تجمعی", color: CH.primary, values: cum }], "ریال") : "") +
                      tbl(["تاریخ", "نوع", "درصد از سند", "مبلغ سهم (ریال)", "شرح"],
                        rows.map(r => [faD(r.date), r.isIn ? "آورده" : "برداشت", faN(r.pct) + "٪", faN(r.amount), r.desc])) +
                      `<div class="sign"><div>سهامدار<br><br>______________</div><div>حسابدار<br><br>______________</div><div>سرمایه‌گذار مادر<br><br>______________</div></div>`);
                  }}>خروجی PDF ⬇</button>
                  {canEdit && <button className="text-xs text-danger" onClick={() => remove(s)}>حذف</button>}
                </div>
              </div>
            );
          })}
          {shs.length === 0 && <p className="text-sm text-ink/40">سهامداری تعریف نشده است.</p>}
        </div>
      </div>

      <div className="card overflow-auto p-0">
        <div className="p-3 font-black">گردش سهامداران <span className="text-xs font-normal text-ink/40">— از تخصیص واریزی/برداشت در تب حسابداری</span></div>
        <table className="w-full">
          <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">سهامدار</th><th className="th">نوع</th><th className="th">درصد از سند</th><th className="th">مبلغ سهم (ریال)</th><th className="th">شرح</th></tr></thead>
          <tbody>
            {ledger.map(r => (
              <tr key={r.id}>
                <td className="td">{fmtDate(r.date)}</td>
                <td className="td font-bold">{r.name}</td>
                <td className="td">{r.isIn ? <span className="chip bg-ok/10 text-ok">آورده</span> : <span className="chip bg-danger/10 text-danger">برداشت</span>}</td>
                <td className="td">{num(r.pct).toLocaleString("fa-IR")}٪</td>
                <td className="td font-black">{fmt(r.amount)}</td>
                <td className="td max-w-56 truncate" title={r.desc}>{r.desc}</td>
              </tr>
            ))}
            {ledger.length === 0 && <tr><td className="td text-ink/40" colSpan={6}>هنوز سندی به سهامداران تخصیص داده نشده. در تب حسابداری هنگام ثبت سند، سهامداران را انتخاب کنید.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
