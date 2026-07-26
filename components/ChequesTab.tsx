"use client";
import { useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, daysBetween } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { deleteRow } from "@/lib/crud";
import PostToAccounting from "@/components/PostToAccounting";
import { exportExcel } from "@/lib/export";

const today = () => new Date().toISOString().slice(0, 10);
const STATUS: Record<string, string> = {
  in_hand: "در جریان", deposited: "به بانک سپرده", cleared: "وصول‌شده",
  bounced: "برگشتی", returned: "عودت‌شده", spent: "خرج‌شده",
};
const OPEN_ST = ["in_hand", "deposited", "spent"];   // هنوز وصول/تسویه نشده

export default function ChequesTab({ projectId, profile, canEdit }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [f, setF] = useState<any>({ kind: "receive", cheque_no: "", bank: "", branch: "", amount: "", due_date: "", party: "", note: "" });

  const load = async () => {
    const { data } = await supabase.from("cheques").select("*").eq("project_id", projectId).order("due_date").limit(5000);
    setRows(data || []);
    supabase.from("customers").select("*").eq("project_id", projectId).then(({ data }: any) => setCustomers(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!num(f.amount)) return;
    const cust = customers.find(c => String(c.name).trim() === String(f.party).trim());
    await supabase.from("cheques").insert({
      project_id: projectId, kind: f.kind, cheque_no: f.cheque_no, bank: f.bank, branch: f.branch,
      amount: num(f.amount), due_date: f.due_date || null, party: f.party,
      customer_id: cust?.id || null, status: "in_hand", note: f.note, created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, f.kind === "receive" ? "ثبت چک دریافتی" : "ثبت چک پرداختی",
      `${f.cheque_no || ""} — ${fmt(num(f.amount))} ریال — ${f.party}`);
    setF({ ...f, cheque_no: "", bank: "", branch: "", amount: "", due_date: "", party: "", note: "" });
    load();
  };
  const setStatus = async (c: any, status: string) => {
    const patch: any = { status };
    if (status === "cleared") patch.cleared_date = today();
    await supabase.from("cheques").update(patch).eq("id", c.id);
    logAction(projectId, profile.id, "تغییر وضعیت چک", `${c.cheque_no || ""} ← ${STATUS[status]}`);
    load();
  };
  const remove = async (c: any) => {
    if (await deleteRow("cheques", c, { projectId, profile, label: "چک", detail: `${c.cheque_no || ""} — ${fmt(num(c.amount))} ریال` })) load();
  };

  const recv = rows.filter(r => r.kind === "receive");
  const pay = rows.filter(r => r.kind === "pay");
  const sum = (list: any[]) => list.filter(r => OPEN_ST.includes(r.status)).reduce((s, r) => s + num(r.amount), 0);
  const recvOpen = sum(recv), payOpen = sum(pay);
  const dueSoon = rows.filter(r => OPEN_ST.includes(r.status) && r.due_date && daysBetween(today(), r.due_date) >= 0 && daysBetween(today(), r.due_date) <= 7);

  const xlsx = () => exportExcel("دفتر چک", [{
    name: "چک‌ها", rows: [["نوع", "شماره", "بانک", "مبلغ", "سررسید", "طرف حساب", "وضعیت"],
      ...rows.map(r => [r.kind === "receive" ? "دریافتی" : "پرداختی", r.cheque_no, r.bank, num(r.amount), r.due_date || "—", r.party, STATUS[r.status]])],
  }]);

  const Table = ({ list, kind }: { list: any[]; kind: string }) => (
    <div className="card overflow-auto p-0">
      <div className="border-b border-line px-3 py-2 text-sm font-black">{kind === "receive" ? "چک‌های دریافتی" : "چک‌های پرداختی"}</div>
      <table className="w-full">
        <thead className="bg-surface"><tr>
          <th className="th">شماره / بانک</th><th className="th">مبلغ</th><th className="th">سررسید</th>
          <th className="th">طرف حساب</th><th className="th">وضعیت</th>{canEdit && <th className="th">اقدام</th>}
        </tr></thead>
        <tbody>
          {list.map(c => {
            const soon = OPEN_ST.includes(c.status) && c.due_date && daysBetween(today(), c.due_date) <= 7;
            const past = OPEN_ST.includes(c.status) && c.due_date && c.due_date < today();
            return (
              <tr key={c.id}>
                <td className="td font-bold">{c.cheque_no || "—"} <span className="text-[10px] text-ink/40">{c.bank}</span></td>
                <td className="td font-bold">{fmt(c.amount)}</td>
                <td className={`td ${past ? "text-danger font-bold" : soon ? "text-crane font-bold" : ""}`}>{fmtDate(c.due_date)}</td>
                <td className="td">{c.party || "—"}</td>
                <td className="td">
                  {canEdit && OPEN_ST.includes(c.status) ? (
                    <select className="input w-32 py-0.5 text-[11px]" value={c.status} onChange={e => setStatus(c, e.target.value)}>
                      <option value="in_hand">در جریان</option>
                      {kind === "receive" && <option value="deposited">به بانک سپرده</option>}
                      {kind === "pay" && <option value="spent">خرج‌شده</option>}
                      <option value="cleared">وصول‌شده</option>
                      <option value="bounced">برگشتی</option>
                      <option value="returned">عودت‌شده</option>
                    </select>
                  ) : <span className={`chip ${c.status === "cleared" ? "bg-ok/10 text-ok" : c.status === "bounced" ? "bg-danger/10 text-danger" : "bg-surface"}`}>{STATUS[c.status]}</span>}
                </td>
                {canEdit && (
                  <td className="td">
                    <span className="flex flex-wrap items-center gap-1">
                      {c.status === "cleared" && <PostToAccounting projectId={projectId} profile={profile} onDone={load}
                        label={kind === "receive" ? "دریافت ←" : "پرداخت ←"}
                        txn={{ type: kind === "receive" ? "receipt" : "payment", amount: num(c.amount), counterparty: c.party,
                          description: `چک ${kind === "receive" ? "دریافتی" : "پرداختی"} ${c.cheque_no || ""} — ${c.bank || ""}`,
                          txn_date: c.cleared_date || today(), source_table: "cheques", source_id: c.id }} />}
                      <button className="text-[11px] text-danger" onClick={() => remove(c)}>حذف</button>
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
          {list.length === 0 && <tr><td className="td text-ink/40" colSpan={canEdit ? 6 : 5}>چکی ثبت نشده است.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["چک‌های دریافتی در جریان", fmt(Math.round(recvOpen)) + " ریال", "text-ok"],
          ["چک‌های پرداختی در جریان", fmt(Math.round(payOpen)) + " ریال", "text-danger"],
          ["خالص چک", fmt(Math.round(recvOpen - payOpen)) + " ریال", ""],
          ["سررسید ۷ روز آینده", fmt(dueSoon.length), dueSoon.length ? "text-crane" : ""]].map(([l, v, c]) => (
          <div key={l as string} className="stat"><div className="text-xs font-bold text-ink/50">{l}</div><div className={`mt-1.5 text-lg font-black tracking-tight ${c}`}>{v}</div></div>
        ))}
      </div>

      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={xlsx}>خروجی اکسل</button></div>

      {canEdit && (
        <div className="card grid gap-2 md:grid-cols-8">
          <select className="input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
            <option value="receive">چک دریافتی</option><option value="pay">چک پرداختی</option>
          </select>
          <input className="input" placeholder="شماره چک" value={f.cheque_no} onChange={e => setF({ ...f, cheque_no: e.target.value })} />
          <input className="input" placeholder="بانک" value={f.bank} onChange={e => setF({ ...f, bank: e.target.value })} />
          <input className="input" dir="ltr" placeholder="مبلغ (ریال)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
          <DateInput className="input" title="سررسید" value={f.due_date} onChange={(v: string) => setF({ ...f, due_date: v })} />
          <input className="input col-span-2" list="chq-parties" placeholder="طرف حساب" value={f.party} onChange={e => setF({ ...f, party: e.target.value })} />
          <datalist id="chq-parties">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
          <button className="btn-primary" onClick={add}>ثبت چک</button>
        </div>
      )}

      <Table list={recv} kind="receive" />
      <Table list={pay} kind="pay" />
    </div>
  );
}
