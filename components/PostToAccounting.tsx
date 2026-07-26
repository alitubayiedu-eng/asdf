"use client";
import { useEffect, useState } from "react";
import { loadAccounts, postTxn, alreadyPosted, AutoTxn } from "@/lib/autotxn";
import { fmt } from "@/lib/constants";

/**
 * دکمه «ثبت در حسابداری» — کنار صورت‌وضعیت، سفارش خرید و فروش برق
 * مبلغ، طرف حساب، کد هزینه و فاز خودکار منتقل می‌شود؛ فقط حساب را انتخاب می‌کنید.
 */
export default function PostToAccounting({ projectId, profile, txn, label, onDone }: {
  projectId: string; profile: any; txn: AutoTxn; label?: string; onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [acc, setAcc] = useState("");
  const [posted, setPosted] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    alreadyPosted(projectId, txn.source_table, txn.source_id).then(setPosted);
  }, [projectId, txn.source_id]);

  const openBox = async () => {
    const a = await loadAccounts(projectId);
    setAccounts(a);
    setAcc(a.find((x: any) => x.kind === "bank")?.id || a[0]?.id || "");
    setOpen(true);
  };

  const submit = async () => {
    if (!acc) { alert("ابتدا در تب حسابداری یک حساب تعریف کنید."); return; }
    setBusy(true);
    const ok = await postTxn(projectId, profile, acc, txn);
    setBusy(false);
    if (ok) { setOpen(false); setPosted({ amount: txn.amount }); onDone?.(); }
  };

  if (posted) {
    return (
      <span className="chip bg-ok/10 text-[10px] text-ok" title={`سند مالی ${fmt(Math.round(posted.amount))} ریال ثبت شده`}>
        ✓ در حسابداری ثبت شد
      </span>
    );
  }

  return (
    <>
      <button className="btn-ghost py-0.5 text-[11px]" onClick={openBox}>
        {label || "ثبت در حسابداری"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <h2 className="mb-3 font-black">ثبت سند مالی</h2>
            <div className="mb-3 space-y-1 rounded-lg bg-surface p-3 text-sm">
              <div className="flex justify-between"><span className="text-ink/50">شرح</span><b>{txn.description}</b></div>
              <div className="flex justify-between"><span className="text-ink/50">طرف حساب</span><b>{txn.counterparty || "—"}</b></div>
              <div className="flex justify-between"><span className="text-ink/50">مبلغ</span>
                <b className="text-primary">{fmt(Math.round(txn.amount))} ریال</b></div>
              {txn.cbs_code && (
                <div className="flex justify-between"><span className="text-ink/50">کد هزینه</span>
                  <span className="code-chip">{txn.cbs_code}</span></div>
              )}
              {txn.phase_name && (
                <div className="flex justify-between"><span className="text-ink/50">فاز</span><b>{txn.phase_name}</b></div>
              )}
            </div>
            <label className="label">حساب</label>
            <select className="input" value={acc} onChange={e => setAcc(e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              {accounts.length === 0 && <option value="">حسابی تعریف نشده است</option>}
            </select>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" disabled={busy || !acc} onClick={submit}>
                {busy ? "در حال ثبت…" : "ثبت سند"}
              </button>
              <button className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button>
              <span className="mr-auto self-center text-[10px] text-ink/40">
                هر سند فقط یک بار قابل ثبت است
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
