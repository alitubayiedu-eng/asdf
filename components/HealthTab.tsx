"use client";
import { useEffect, useMemo, useState } from "react";
import { inspect, fixAll, loadAcks, saveAck, clearAck, Finding } from "@/lib/inspect";
import { printPdf, tbl, kpis, faN } from "@/lib/export";

const TONE: Record<string, { chip: string; label: string }> = {
  high: { chip: "bg-danger/10 text-danger border-danger/25", label: "بحرانی" },
  mid: { chip: "bg-crane/12 text-crane border-crane/25", label: "نیازمند بررسی" },
  low: { chip: "bg-surface text-ink/60 border-line", label: "پیشنهاد" },
};

/**
 * بررسی سلامت داده — همه ناسازگاری‌ها یکجا
 * هر مورد یا اصلاح خودکار دارد یا با «تایید» از فهرست خارج می‌شود.
 */
export default function HealthTab({ projectId, profile, kind, canEdit }: any) {
  const [all, setAll] = useState<Finding[] | null>(null);
  const [acks, setAcks] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [showAcked, setShowAcked] = useState(false);

  const run = async () => {
    setBusy("در حال بررسی داده‌ها…");
    setAll(await inspect(projectId, kind));
    setAcks(loadAcks(projectId));
    setBusy("");
  };
  useEffect(() => { run(); }, [projectId]);

  const open = useMemo(() => (all || []).filter(f => !acks.includes(f.id)), [all, acks]);
  const acked = useMemo(() => (all || []).filter(f => acks.includes(f.id)), [all, acks]);
  const fixable = open.filter(f => f.fix);
  const groups = useMemo(() => {
    const m: Record<string, Finding[]> = {};
    for (const f of open) (m[f.group] = m[f.group] || []).push(f);
    return m;
  }, [open]);

  const doFixAll = async () => {
    if (!confirm(`${fixable.length.toLocaleString("fa-IR")} مورد قابل اصلاح خودکار است.\nهمه با هم اصلاح شوند؟`)) return;
    setBusy("در حال اصلاح…");
    const n = await fixAll(projectId, profile, fixable);
    alert(`${n.toLocaleString("fa-IR")} مورد اصلاح شد.`);
    await run();
  };
  const doFix = async (f: Finding) => {
    setBusy("در حال اصلاح…");
    try { await f.fix!(); } catch (e: any) { alert("خطا: " + e?.message); }
    await run();
  };
  const ack = (f: Finding) => { saveAck(projectId, f.id); setAcks(loadAcks(projectId)); };
  const unack = (f: Finding) => { clearAck(projectId, f.id); setAcks(loadAcks(projectId)); };

  const healthPdf = () => printPdf("گزارش سلامت داده پروژه", "ناسازگاری‌های شناسایی‌شده و وضعیت رسیدگی",
    kpis([["کل یافته‌ها", faN((all || []).length)], ["باز", faN(open.length)],
      ["تاییدشده (بدون اشکال)", faN(acked.length)], ["قابل اصلاح خودکار", faN(fixable.length)]]) +
    tbl(["شدت", "دسته", "عنوان", "جزئیات"],
      open.map(f => [TONE[f.severity].label, f.group, f.title, f.detail])) +
    (acked.length ? "<h2>مواردی که بررسی و تایید شده‌اند</h2>" +
      tbl(["دسته", "عنوان"], acked.map(f => [f.group, f.title])) : ""));

  const counts = {
    high: open.filter(f => f.severity === "high").length,
    mid: open.filter(f => f.severity === "mid").length,
    low: open.filter(f => f.severity === "low").length,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["بحرانی", counts.high, counts.high ? "text-danger" : "text-ok"],
          ["نیازمند بررسی", counts.mid, counts.mid ? "text-crane" : "text-ok"],
          ["پیشنهاد بهبود", counts.low, ""],
          ["تاییدشده", acked.length, "text-ok"]].map(([l, v, c]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black ${c}`}>{(v as number).toLocaleString("fa-IR")}</div>
          </div>
        ))}
      </div>

      <div className="card flex flex-wrap items-center gap-2">
        <button className="btn-ghost py-1 text-xs" onClick={run} disabled={!!busy}>بررسی مجدد</button>
        {canEdit && fixable.length > 0 && (
          <button className="btn-primary py-1 text-xs" onClick={doFixAll} disabled={!!busy}>
            اصلاح خودکار همه ({fixable.length.toLocaleString("fa-IR")} مورد)
          </button>
        )}
        <button className="btn-ghost py-1 text-xs" onClick={healthPdf}>خروجی PDF</button>
        {acked.length > 0 && (
          <button className="btn-ghost py-1 text-xs" onClick={() => setShowAcked(!showAcked)}>
            {showAcked ? "پنهان کردن" : "نمایش"} تاییدشده‌ها ({acked.length.toLocaleString("fa-IR")})
          </button>
        )}
        {busy && <span className="chip bg-crane/15 text-crane">{busy}</span>}
        <span className="mr-auto text-[11px] text-ink/45">
          موردی که اشکال ندارد را «تایید» کنید تا دیگر نمایش داده نشود
        </span>
      </div>

      {all && open.length === 0 && (
        <div className="card text-center">
          <div className="text-3xl">✓</div>
          <p className="mt-2 font-black text-ok">ناسازگاری بازی وجود ندارد</p>
          <p className="mt-1 text-sm text-ink/50">داده‌های این پروژه با هم هم‌خوان هستند.</p>
        </div>
      )}

      {Object.entries(groups).map(([g, list]) => (
        <div key={g} className="card">
          <h2 className="mb-2 font-black">{g} <span className="text-xs font-normal text-ink/40">({list.length.toLocaleString("fa-IR")} مورد)</span></h2>
          <div className="space-y-1.5">
            {list.map(f => (
              <div key={f.id} className={`rounded-lg border p-2.5 ${TONE[f.severity].chip}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="chip border border-current/20 text-[10px]">{TONE[f.severity].label}</span>
                  <b className="flex-1 text-sm">{f.title}</b>
                  {canEdit && f.fix && (
                    <button className="btn-primary py-0.5 text-[11px]" disabled={!!busy} onClick={() => doFix(f)}>
                      {f.fixLabel || "اصلاح"}
                    </button>
                  )}
                  <button className="btn-ghost py-0.5 text-[11px]" onClick={() => ack(f)}
                    title="این مورد اشکال ندارد — از فهرست خارج شود">اشکال ندارد ✓</button>
                </div>
                <p className="mt-1 text-xs opacity-80">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAcked && acked.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-black text-ink/60">مواردی که تایید کرده‌اید</h2>
          <div className="space-y-1">
            {acked.map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border border-line p-2 text-xs">
                <span className="chip bg-ok/10 text-[10px] text-ok">تاییدشده</span>
                <span className="flex-1">{f.title}</span>
                <button className="text-[11px] text-crane" onClick={() => unack(f)}>بازگرداندن به فهرست</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
