"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, TXN_TYPES, ACCOUNT_KINDS } from "@/lib/constants";
import { fileToDataUrl } from "@/lib/img";
import { logAction } from "@/lib/log";
import { editRow, deleteRow } from "@/lib/crud";
import CostCodeField from "@/components/CostCodeField";
import { cbsFields } from "@/lib/costlink";
import ExcelIO from "@/components/ExcelIO";
import { exportExcel, printPdf, tbl, kpis, faN, faD, svgLines, svgHBars, svgPie, CH } from "@/lib/export";

export default function AccountingTab({ projectId, profile, canEdit }: any) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [na, setNa] = useState({ name: "", kind: "bank" });
  const [nt, setNt] = useState({ account_id: "", type: "payment", amount: "", counterparty: "", description: "", txn_date: "" });
  const [cost, setCost] = useState({ code: "", phase: "" });
  const [receipt, setReceipt] = useState<string | null>(null);
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [ef, setEf] = useState<any>({});
  const [alloc, setAlloc] = useState<Record<string, string>>({}); // shareholder_id -> pct

  const load = async () => {
    const { data: a } = await supabase.from("accounts").select("*").eq("project_id", projectId).order("name");
    setAccounts(a || []);
    const { data: t } = await supabase.from("transactions").select("*, accounts(name)")
      .eq("project_id", projectId).order("txn_date", { ascending: false }).limit(300);
    setTxns(t || []);
  };
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => {
    supabase.from("shareholders").select("*").eq("project_id", projectId).then(({ data }: any) => setShareholders(data || []));
  }, [projectId]);

  const toggleAlloc = (id: string, defPct: number) =>
    setAlloc(a => (id in a ? Object.fromEntries(Object.entries(a).filter(([k]) => k !== id)) : { ...a, [id]: String(defPct || "") }));
  const allocSum = Object.values(alloc).reduce((s, v) => s + (num(v) || 0), 0);

  const acctExport = () => {
    const rows = txns.map((t: any) => [faD(t.txn_date), t.accounts?.name || "—", TXN_TYPES[t.type], num(t.amount),
      t.counterparty || "—", t.description || "—",
      (t.allocations || []).map((a: any) => `${a.name} ${a.pct}٪`).join(" | ")]);
    exportExcel("حسابداری", [
      { name: "دفتر اسناد", rows: [["تاریخ", "حساب", "نوع", "مبلغ (ریال)", "طرف حساب", "شرح", "تخصیص سهامداران"], ...rows] },
      { name: "حساب‌ها", rows: [["حساب", "نوع", "مانده (ریال)"], ...accounts.map((a: any) => [a.name, ACCOUNT_KINDS[a.kind], balances[a.id] || 0])] },
    ]);
  };
  const acctPdf = () => {
    const tin = txns.filter((t: any) => ["receipt", "income"].includes(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0);
    const tout = txns.filter((t: any) => ["payment", "expense"].includes(t.type)).reduce((s: number, t: any) => s + num(t.amount), 0);
    // جریان نقدی ماهانه
    const mm: Record<string, { in: number; out: number }> = {};
    for (const t of txns as any[]) {
      const k = (t.txn_date || "").slice(0, 7); if (!k) continue;
      mm[k] = mm[k] || { in: 0, out: 0 };
      if (["receipt", "income"].includes(t.type)) mm[k].in += num(t.amount); else mm[k].out += num(t.amount);
    }
    const ms = Object.keys(mm).sort();
    // تخصیص به سهامداران
    const sh: Record<string, number> = {};
    for (const t of txns as any[]) for (const a of t.allocations || [])
      sh[a.name] = (sh[a.name] || 0) + Math.round(num(t.amount) * num(a.pct) / 100);

    printPdf("گزارش حسابداری پروژه", "دفتر اسناد، مانده حساب‌ها و تخصیص سهامداران",
      kpis([["جمع دریافت/درآمد", faN(tin) + " ریال"], ["جمع پرداخت/هزینه", faN(tout) + " ریال"],
        ["خالص نقدینگی", faN(tin - tout) + " ریال"], ["تعداد اسناد", faN(txns.length)]]) +
      svgLines("جریان نقدی ماهانه", ms, [
        { name: "دریافت / درآمد", color: CH.ok, values: ms.map(k => mm[k].in) },
        { name: "پرداخت / هزینه", color: CH.danger, values: ms.map(k => mm[k].out) },
      ], "ریال") +
      svgHBars("مانده حساب‌ها", accounts.map((a: any) => ({
        name: a.name, value: balances[a.id] || 0,
        color: (balances[a.id] || 0) < 0 ? CH.danger : CH.primary,
        note: faN(balances[a.id] || 0) + " ریال",
      }))) +
      (Object.keys(sh).length ? svgPie("سهم سهامداران از گردش تخصیص‌یافته",
        Object.entries(sh).map(([name, value]) => ({ name, value }))) : "") +
      "<h2>مانده حساب‌ها</h2>" + tbl(["حساب", "نوع", "مانده (ریال)"],
        accounts.map((a: any) => [a.name, ACCOUNT_KINDS[a.kind], faN(balances[a.id] || 0)])) +
      "<h2>دفتر اسناد</h2>" + tbl(["تاریخ", "حساب", "نوع", "مبلغ", "طرف حساب", "تخصیص سهامداران"],
        txns.slice(0, 60).map((t: any) => [faD(t.txn_date), t.accounts?.name || "—", TXN_TYPES[t.type], faN(t.amount),
          t.counterparty || "—", (t.allocations || []).map((a: any) => `${a.name} ${faN(a.pct)}٪`).join("، ") || "—"])));
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setEf({ txn_date: t.txn_date, type: t.type, amount: t.amount, counterparty: t.counterparty || "", description: t.description || "", receipt_img: t.receipt_img ?? null });
  };
  const saveEdit = async () => {
    const ok = await editRow("transactions", editing, {
      txn_date: ef.txn_date, type: ef.type, amount: num(ef.amount),
      counterparty: ef.counterparty, description: ef.description,
      receipt_img: ef.receipt_img ?? null,
    }, { projectId, profile, label: "سند مالی" });
    if (ok) { setEditing(null); load(); }
  };
  const removeTxn = async (t: any) => {
    const ok = await deleteRow("transactions", t, {
      projectId, profile, label: "سند مالی",
      detail: `${TXN_TYPES[t.type]} ${fmt(t.amount)} ریال — ${t.counterparty || t.description || ""}`,
    });
    if (ok) load();
  };

  const balances = useMemo(() => {
    const b: Record<string, number> = {};
    for (const t of txns) {
      const sign = t.type === "receipt" || t.type === "income" ? 1 : -1;
      b[t.account_id] = (b[t.account_id] || 0) + sign * num(t.amount);
    }
    return b;
  }, [txns]);

  const addAccount = async () => {
    if (!na.name) return;
    await supabase.from("accounts").insert({ project_id: projectId, name: na.name, kind: na.kind });
    logAction(projectId, profile.id, "ایجاد حساب", na.name);
    setNa({ name: "", kind: "bank" }); load();
  };

  const addTxn = async () => {
    if (!nt.account_id || !nt.amount) return;
    // کد هزینه: اگر جدید باشد خودکار در CBS ساخته می‌شود
    const cbs = await cbsFields(projectId, cost.code, {
      item_name: nt.description || nt.counterparty, phase_name: cost.phase,
    });
    await supabase.from("transactions").insert({
      project_id: projectId, account_id: nt.account_id, type: nt.type, amount: num(nt.amount),
      counterparty: nt.counterparty, description: nt.description,
      txn_date: nt.txn_date || new Date().toISOString().slice(0, 10),
      ...cbs, phase_name: cost.phase || null,
      created_by: profile.id, receipt_img: receipt,
      allocations: Object.entries(alloc)
        .filter(([, pct]) => num(pct) > 0)
        .map(([id, pct]) => ({ shareholder_id: id, name: shareholders.find(s => s.id === id)?.name || "", pct: num(pct) })),
    });
    setAlloc({}); setCost({ code: "", phase: "" });
    logAction(projectId, profile.id, "ثبت سند مالی",
      `${TXN_TYPES[nt.type]} ${num(nt.amount).toLocaleString("fa-IR")} ریال${nt.counterparty ? " — " + nt.counterparty : ""}${cost.code ? " — کد " + cost.code : ""}`);
    setNt({ account_id: "", type: "payment", amount: "", counterparty: "", description: "", txn_date: "" });
    setReceipt(null);
    load();
  };

  const inflow = txns.filter(t => ["receipt", "income"].includes(t.type)).reduce((s, t) => s + num(t.amount), 0);
  const outflow = txns.filter(t => ["payment", "expense"].includes(t.type)).reduce((s, t) => s + num(t.amount), 0);

  return (
    <div className="space-y-3">
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black">ویرایش سند مالی</h2>
              <button className="btn-ghost py-1 text-xs" onClick={() => setEditing(null)}>بستن ✕</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><label className="label">تاریخ</label>
                <DateInput value={ef.txn_date} onChange={(v: string) => setEf({ ...ef, txn_date: v })} /></div>
              <div><label className="label">نوع</label>
                <select className="input" value={ef.type} onChange={e => setEf({ ...ef, type: e.target.value })}>
                  {Object.entries(TXN_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="label">مبلغ (ریال)</label>
                <input className="input" dir="ltr" value={ef.amount} onChange={e => setEf({ ...ef, amount: e.target.value })} /></div>
              <div><label className="label">طرف حساب</label>
                <input className="input" value={ef.counterparty} onChange={e => setEf({ ...ef, counterparty: e.target.value })} /></div>
              <div className="md:col-span-2"><label className="label">شرح</label>
                <input className="input" value={ef.description} onChange={e => setEf({ ...ef, description: e.target.value })} /></div>
              <div className="md:col-span-2">
                <label className="label">تصویر فاکتور / رسید</label>
                <div className="flex flex-wrap items-center gap-3">
                  {ef.receipt_img && (
                    <img src={ef.receipt_img} alt="پیوست" className="h-20 cursor-pointer rounded-lg border border-line"
                      onClick={() => setViewImg(ef.receipt_img)} title="بزرگ‌نمایی" />
                  )}
                  <label className="btn-ghost cursor-pointer">
                    {ef.receipt_img ? "تغییر تصویر" : "افزودن تصویر"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async e => { const f = e.target.files?.[0]; if (f) setEf({ ...ef, receipt_img: await fileToDataUrl(f, 1200, 0.7) }); }} />
                  </label>
                  {ef.receipt_img && (
                    <button className="text-xs text-danger" onClick={() => setEf({ ...ef, receipt_img: null })}>حذف تصویر</button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={saveEdit}>ذخیره تغییرات</button>
              <button className="btn-ghost" onClick={() => setEditing(null)}>انصراف</button>
              <span className="mr-auto self-center text-[10px] text-ink/40">تغییرات در گزارش تغییرات ثبت می‌شود</span>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[["جمع دریافت‌ها", inflow, "text-ok"], ["جمع پرداخت‌ها", outflow, "text-danger"], ["مانده خالص", inflow - outflow, ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat">
            <div className="text-xs font-bold text-ink/50">{l}</div>
            <div className={`mt-1.5 text-xl font-black tracking-tight ${c}`}>{fmt(v as number)} ریال</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 font-black">حساب‌ها</h2>
          <div className="mb-2 border-b border-line pb-2 space-y-1">
            <ExcelIO table="accounts" projectId={projectId} rows={accounts} canEdit={canEdit} profile={profile} onDone={load} />
            <ExcelIO table="transactions" projectId={projectId} rows={txns} canEdit={canEdit} profile={profile} onDone={load} />
          </div>
          {canEdit && <div className="mb-2 flex gap-2">
            <input className="input" placeholder="نام حساب" value={na.name} onChange={e => setNa({ ...na, name: e.target.value })} />
            <select className="input" value={na.kind} onChange={e => setNa({ ...na, kind: e.target.value })}>
              {Object.entries(ACCOUNT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn-primary" onClick={addAccount}>+</button>
          </div>}
          {accounts.map(a => (
            <div key={a.id} className="mb-1 flex justify-between rounded-lg border border-line p-2 text-sm">
              <span className="font-bold">{a.name} <span className="text-xs text-ink/40">({ACCOUNT_KINDS[a.kind]})</span></span>
              <span className="font-black">{fmt(balances[a.id] || 0)}</span>
            </div>
          ))}
        </div>
        <div className="card lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-black">ثبت سند مالی</h2>
            <span className="flex flex-wrap gap-2">
              <button className="btn-ghost py-1 text-xs" onClick={acctExport}>گزارش اکسل کامل</button>
              <button className="btn-ghost py-1 text-xs" onClick={acctPdf}>خروجی PDF</button>
            </span>
          </div>
          {canEdit && <div className="mb-3 rounded-xl border border-line bg-surface/40 p-3">
            {/* ردیف ۱ — مشخصات اصلی سند، هر فیلد با برچسب */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label">حساب</label>
                <select className="input" value={nt.account_id} onChange={e => setNt({ ...nt, account_id: e.target.value })}>
                  <option value="">انتخاب حساب…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">نوع سند</label>
                <select className="input" value={nt.type} onChange={e => setNt({ ...nt, type: e.target.value })}>
                  {Object.entries(TXN_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">مبلغ (ریال)</label>
                <input className="input" dir="ltr" placeholder="۰" value={nt.amount} onChange={e => setNt({ ...nt, amount: e.target.value })} />
              </div>
              <div>
                <label className="label">تاریخ</label>
                <DateInput className="input" value={nt.txn_date} onChange={v => setNt({ ...nt, txn_date: v })} />
              </div>
            </div>
            {/* ردیف ۲ — طرف حساب و شرح */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">طرف حساب</label>
                <input className="input" placeholder="نام پیمانکار / فروشنده / مشتری" value={nt.counterparty} onChange={e => setNt({ ...nt, counterparty: e.target.value })} />
              </div>
              <div>
                <label className="label">شرح سند</label>
                <input className="input" placeholder="بابت چه چیزی؟" value={nt.description} onChange={e => setNt({ ...nt, description: e.target.value })} />
              </div>
            </div>
            {/* ردیف ۳ — کد هزینه و فاز */}
            <div className="mt-3 rounded-lg border border-line bg-card p-2">
              <div className="mb-1 text-[11px] font-bold text-ink/55">
                کد هزینه و فاز {["payment", "expense"].includes(nt.type) && <span className="text-crane">— این سند در هزینه واقعی CBS لحاظ می‌شود</span>}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <CostCodeField projectId={projectId} value={cost} onChange={setCost} compact />
              </div>
            </div>
            {/* ردیف ۴ — تخصیص سهامداران */}
            {shareholders.length > 0 && (
              <div className="mt-3 rounded-xl border border-line bg-card p-2">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold">
                  تخصیص این آورده / برداشت به سهامداران (اختیاری)
                  {allocSum > 0 && <span className={`chip ${allocSum === 100 ? "bg-ok/10 text-ok" : "bg-crane/20"}`}>مجموع: {allocSum.toLocaleString("fa-IR")}٪</span>}
                </div>
                <div className="flex flex-wrap gap-3">
                  {shareholders.map(s => (
                    <label key={s.id} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={s.id in alloc} onChange={() => toggleAlloc(s.id, s.share_pct)} />
                      <b>{s.name}</b>
                      {s.id in alloc && (
                        <span className="flex items-center gap-1">
                          <input className="input w-16 py-0.5" dir="ltr" value={alloc[s.id]}
                            onChange={e => setAlloc({ ...alloc, [s.id]: e.target.value })} />٪
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* ردیف ۵ — پیوست و ثبت */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="btn-ghost cursor-pointer">
                {receipt ? "✓ تصویر پیوست شد — تغییر" : "پیوست تصویر فاکتور / رسید"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => { const f = e.target.files?.[0]; if (f) setReceipt(await fileToDataUrl(f, 1200, 0.7)); }} />
              </label>
              {receipt && (
                <span className="flex items-center gap-2">
                  <img src={receipt} alt="پیوست" className="h-12 rounded-lg border border-line" />
                  <button className="text-xs text-danger" onClick={() => setReceipt(null)}>حذف پیوست</button>
                </span>
              )}
              <button className="btn-primary mr-auto px-6" onClick={addTxn}>ثبت سند مالی</button>
            </div>
          </div>}
          <p className="mb-2 text-[11px] text-ink/40">با وارد کردن کد هزینه CBS، مبلغ پرداخت/هزینه به‌صورت خودکار به هزینه واقعی همان آیتم اضافه می‌شود.</p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full">
              <thead><tr><th className="th">تاریخ</th><th className="th">حساب</th><th className="th">نوع</th><th className="th">مبلغ</th><th className="th">طرف حساب</th><th className="th">شرح</th><th className="th">پیوست</th>{canEdit && <th className="th">اقدام</th>}</tr></thead>
              <tbody>
                {txns.map(t => (
                  <tr key={t.id}>
                    <td className="td">{fmtDate(t.txn_date)}</td>
                    <td className="td">{t.accounts?.name}</td>
                    <td className="td">{TXN_TYPES[t.type]}</td>
                    <td className="td font-bold">{fmt(t.amount)}</td>
                    <td className="td">{t.counterparty || "—"}</td>
                    <td className="td max-w-56 truncate" title={t.description}>{t.description || "—"}</td>
                    <td className="td">
                      {t.receipt_img
                        ? <button onClick={() => setViewImg(t.receipt_img)}><img src={t.receipt_img} alt="رسید" className="h-8 w-12 rounded border border-line object-cover" /></button>
                        : <span className="text-ink/30">—</span>}
                    </td>
                    {canEdit && (
                      <td className="td">
                        <span className="flex gap-1">
                          <button className="btn-ghost py-0.5 text-[11px]" onClick={() => openEdit(t)}>ویرایش</button>
                          <button className="py-0.5 text-[11px] text-danger" onClick={() => removeTxn(t)}>حذف</button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {viewImg && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setViewImg(null)}>
          <img src={viewImg} alt="رسید" className="max-h-[85vh] rounded-xl bg-card p-2" />
        </div>
      )}
    </div>
  );
}
