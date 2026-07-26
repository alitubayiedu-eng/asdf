"use client";
import { useEffect, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgBars, svgLines, svgHBars, CH } from "@/lib/export";

const STAGES: Record<string, string> = { incoming: "بازرسی ورودی مواد", ipqc: "کنترل حین فرآیند (IPQC)", final: "آزمون محصول نهایی" };

export default function QcTab({ projectId, profile, canEdit }: any) {
  const [tests, setTests] = useState<any[]>([]);
  const [ncrs, setNcrs] = useState<any[]>([]);
  const [f, setF] = useState({ stage: "ipqc", item: "", parameter: "", value: "", spec_min: "", spec_max: "", lot: "", note: "" });
  const [nf, setNf] = useState({ title: "", severity: "متوسط", description: "" });

  const load = () => {
    supabase.from("qc_tests").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100)
      .then(({ data }: any) => setTests(data || []));
    supabase.from("quality_records").select("*").eq("project_id", projectId).eq("kind", "ncr")
      .order("created_at", { ascending: false }).then(({ data }: any) => setNcrs(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const addTest = async () => {
    if (!f.item || !f.parameter) return;
    const v = num(f.value), lo = num(f.spec_min), hi = num(f.spec_max);
    const pass = (!f.spec_min || v >= lo) && (!f.spec_max || v <= hi);
    await supabase.from("qc_tests").insert({
      project_id: projectId, stage: f.stage, item: f.item, parameter: f.parameter,
      value: v, spec_min: f.spec_min ? lo : null, spec_max: f.spec_max ? hi : null,
      pass, lot: f.lot, note: f.note, created_by_name: profile.full_name,
      test_date: new Date().toISOString().slice(0, 10),
    });
    logAction(projectId, profile.id, "ثبت آزمون کیفیت", `${STAGES[f.stage]}: ${f.item} — ${f.parameter}=${f.value} ← ${pass ? "قبول" : "مردود"}`);
    if (!pass) await supabase.from("quality_records").insert({
      project_id: projectId, kind: "ncr", title: `آزمون مردود: ${f.item} — ${f.parameter}`, location: f.lot,
      severity: "زیاد", description: `مقدار ${f.value} خارج از محدوده ${f.spec_min || "-"} تا ${f.spec_max || "-"}`,
      status: "open", created_by_name: profile.full_name, photos: [],
    });
    setF({ stage: f.stage, item: "", parameter: "", value: "", spec_min: "", spec_max: "", lot: "", note: "" });
    load();
  };

  const addNcr = async () => {
    if (!nf.title) return;
    await supabase.from("quality_records").insert({
      project_id: projectId, kind: "ncr", title: nf.title, severity: nf.severity,
      description: nf.description, status: "open", created_by_name: profile.full_name, photos: [],
    });
    logAction(projectId, profile.id, "ثبت عدم انطباق", nf.title);
    setNf({ title: "", severity: "متوسط", description: "" }); load();
  };

  const closeNcr = async (r: any) => {
    const a = prompt("اقدام اصلاحی (CAPA):");
    if (a == null) return;
    await supabase.from("quality_records").update({ status: "closed", action: a }).eq("id", r.id);
    logAction(projectId, profile.id, "بستن NCR با اقدام اصلاحی", r.title);
    load();
  };

  const passRate = tests.length ? Math.round(tests.filter(t => t.pass).length / tests.length * 100) : null;

  const qcPdf = () => {
    const stages = Object.entries(STAGES).map(([k, l]) => ({
      label: l, pass: tests.filter(t => t.stage === k && t.pass).length, fail: tests.filter(t => t.stage === k && !t.pass).length }));
    const asc = [...tests].sort((a, b) => String(a.test_date).localeCompare(String(b.test_date)));
    const days = [...new Set(asc.map(t => t.test_date))];
    const rate = days.map(d => {
      const dd = asc.filter(t => t.test_date === d);
      return dd.length ? Math.round(dd.filter(t => t.pass).length / dd.length * 100) : 0;
    });
    printPdf("گزارش کنترل کیفیت", "آزمون ورودی، حین فرآیند و محصول نهایی",
      kpis([["نرخ قبولی", passRate == null ? "—" : faN(passRate) + "٪"], ["کل آزمون‌ها", faN(tests.length)],
        ["مردود", faN(tests.filter(t => !t.pass).length)], ["NCR باز", faN(ncrs.filter(n => n.status === "open").length)]]) +
      (tests.length ? svgPie("نتیجه کلی آزمون‌ها", [
        { name: "قبول", value: tests.filter(t => t.pass).length },
        { name: "مردود", value: tests.filter(t => !t.pass).length }]) : "") +
      (stages.some(s2 => s2.pass + s2.fail) ? svgBars("نتیجه آزمون به تفکیک مرحله", stages.map(s2 => s2.label), [
        { name: "قبول", color: CH.ok, values: stages.map(s2 => s2.pass) },
        { name: "مردود", color: CH.danger, values: stages.map(s2 => s2.fail) }]) : "") +
      (days.length > 1 ? svgLines("روند نرخ قبولی روزانه (٪)", days.map(d => faD(d)),
        [{ name: "نرخ قبولی", color: CH.primary, values: rate }], "درصد") : "") +
      "<h2>آزمون‌ها</h2>" + tbl(["تاریخ", "مرحله", "ماده/محصول", "پارامتر", "مقدار", "حد پایین", "حد بالا", "Lot", "نتیجه"],
        tests.map(t => [faD(t.test_date), STAGES[t.stage], t.item, t.parameter, faN(t.value),
          t.spec_min ?? "—", t.spec_max ?? "—", t.lot || "—", t.pass ? "قبول" : "مردود"])) +
      (ncrs.length ? "<h2>عدم انطباق و اقدام اصلاحی</h2>" + tbl(["عنوان", "شدت", "وضعیت", "اقدام اصلاحی (CAPA)"],
        ncrs.map(r => [r.title, r.severity || "—", r.status === "open" ? "باز" : "بسته‌شده", (r.action || "—").slice(0, 70)])) : ""));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2"><ExcelIO table="qc_tests" projectId={projectId} rows={tests} canEdit={canEdit} profile={profile} onDone={load} pdf={qcPdf} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="stat"><div className="text-xs font-bold text-ink/50">نرخ قبولی آزمون‌ها</div>
          <div className={`mt-1.5 text-xl font-black tracking-tight ${passRate != null && passRate < 90 ? "text-danger" : "text-ok"}`}>{passRate == null ? "—" : passRate.toLocaleString("fa-IR") + "٪"}</div></div>
        <div className="stat"><div className="text-xs font-bold text-ink/50">آزمون‌های ثبت‌شده</div><div className="mt-1.5 text-xl font-black tracking-tight">{tests.length.toLocaleString("fa-IR")}</div></div>
        <div className="stat"><div className="text-xs font-bold text-ink/50">NCR باز</div>
          <div className={`mt-1.5 text-xl font-black tracking-tight ${ncrs.filter(n => n.status === "open").length ? "text-danger" : "text-ok"}`}>{ncrs.filter(n => n.status === "open").length.toLocaleString("fa-IR")}</div></div>
      </div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-8">
          <select className="input md:col-span-2" value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })}>
            {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" placeholder="ماده/محصول" value={f.item} onChange={e => setF({ ...f, item: e.target.value })} />
          <input className="input" placeholder="پارامتر (گراماژ…)" value={f.parameter} onChange={e => setF({ ...f, parameter: e.target.value })} />
          <input className="input" dir="ltr" placeholder="مقدار" value={f.value} onChange={e => setF({ ...f, value: e.target.value })} />
          <input className="input" dir="ltr" placeholder="حد پایین" value={f.spec_min} onChange={e => setF({ ...f, spec_min: e.target.value })} />
          <input className="input" dir="ltr" placeholder="حد بالا" value={f.spec_max} onChange={e => setF({ ...f, spec_max: e.target.value })} />
          <button className="btn-primary" onClick={addTest}>ثبت آزمون</button>
          <input className="input md:col-span-2" placeholder="شماره Lot/Batch" value={f.lot} onChange={e => setF({ ...f, lot: e.target.value })} />
          <p className="text-[11px] text-ink/40 md:col-span-6 self-center">اگر مقدار خارج از محدوده باشد، خودکار «مردود» و یک NCR باز ثبت می‌شود.</p>
        </div>
      )}

      <div className="card overflow-auto p-0">
        <table className="w-full">
          <thead className="bg-surface"><tr><th className="th">تاریخ</th><th className="th">مرحله</th><th className="th">ماده/محصول</th><th className="th">پارامتر</th><th className="th">مقدار</th><th className="th">محدوده</th><th className="th">Lot</th><th className="th">نتیجه</th></tr></thead>
          <tbody>
            {tests.map(t => (
              <tr key={t.id}>
                <td className="td">{fmtDate(t.test_date)}</td>
                <td className="td text-xs">{STAGES[t.stage]}</td>
                <td className="td font-bold">{t.item}</td>
                <td className="td">{t.parameter}</td>
                <td className="td font-bold">{fmt(t.value)}</td>
                <td className="td text-xs" dir="ltr">{t.spec_min ?? "—"} … {t.spec_max ?? "—"}</td>
                <td className="td">{t.lot ? <span className="code-chip">{t.lot}</span> : "—"}</td>
                <td className="td">{t.pass ? <span className="chip bg-ok/10 text-ok">قبول</span> : <span className="chip bg-danger/10 text-danger">مردود</span>}</td>
              </tr>
            ))}
            {tests.length === 0 && <tr><td className="td text-ink/40" colSpan={8}>آزمونی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="mb-2 font-black">عدم انطباق و اقدام اصلاحی (NCR / CAPA)</h2>
        {canEdit && (
          <div className="mb-2 grid grid-cols-5 gap-2">
            <input className="input col-span-2" placeholder="عنوان عدم انطباق" value={nf.title} onChange={e => setNf({ ...nf, title: e.target.value })} />
            <select className="input" value={nf.severity} onChange={e => setNf({ ...nf, severity: e.target.value })}>
              <option>کم</option><option>متوسط</option><option>زیاد</option><option>بحرانی</option>
            </select>
            <input className="input" placeholder="شرح" value={nf.description} onChange={e => setNf({ ...nf, description: e.target.value })} />
            <button className="btn-primary" onClick={addNcr}>ثبت NCR</button>
          </div>
        )}
        {ncrs.map(r => (
          <div key={r.id} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
            <span className="flex-1 font-bold">{r.title}</span>
            <span className="chip bg-surface">{r.severity}</span>
            {r.status === "open"
              ? (canEdit && <button className="btn-primary py-0.5 text-xs" onClick={() => closeNcr(r)}>CAPA و بستن</button>)
              : <span className="chip bg-ok/10 text-ok" title={r.action}>بسته‌شده</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
