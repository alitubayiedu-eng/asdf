"use client";
import { useEffect, useState } from "react";
import { num } from "@/lib/num";
import { supabase } from "@/lib/supabase";
import { fmt, fmtDate, CLAIM_STATUS, MANAGER_ROLES } from "@/lib/constants";
import { logAction } from "@/lib/log";
import ExcelIO from "@/components/ExcelIO";
import ContractTemplatePicker from "@/components/ContractTemplatePicker";
import CostCodeField from "@/components/CostCodeField";
import PostToAccounting from "@/components/PostToAccounting";
import { cbsFields } from "@/lib/costlink";
import { printPdf, tbl, kpis, faN, faD, svgHBars, svgBars, svgLines, svgPie, CH } from "@/lib/export";

export default function ContractsTab({ projectId, profile, canEdit, projectName }: any) {
  const [sub, setSub] = useState<"contracts" | "claims" | "co" | "disputes">("contracts");
  const [contracts, setContracts] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [cos, setCos] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const isManager = MANAGER_ROLES.includes(profile.role);
  const isSupervisor = profile.role === "chief_engineer";

  const [cf, setCf] = useState({ title: "", contractor: "", amount: "", advance_pct: "10", retention_pct: "10", start_date: "", end_date: "", body: "" });
  const [cCost, setCCost] = useState({ code: "", phase: "" });
  const [vendors, setVendors] = useState<any[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplFor, setTplFor] = useState<any>(null);   // null = فرم ثبت جدید، وگرنه قرارداد موجود
  const [pf, setPf] = useState({ contract_id: "", no: "", period: "", gross_amount: "", prev_amount: "", other_deduct: "0" });
  const [cof, setCof] = useState({ contract_id: "", title: "", amount_delta: "", days_delta: "", reason: "" });
  const [df, setDf] = useState({ subject: "", party: "", amount: "", detail: "" });

  const load = async () => {
    const g = (t: string, set: any) => supabase.from(t).select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false }).then(({ data }: any) => set(data || []));
    await Promise.all([g("contracts", setContracts), g("progress_claims", setClaims),
      g("change_orders", setCos), g("disputes", setDisputes)]);
    supabase.from("vendors").select("*").then(({ data }: any) =>
      setVendors((data || []).filter((v: any) => v.is_global || v.project_id === projectId)));
  };
  useEffect(() => { load(); }, [projectId]);

  const addContract = async () => {
    if (!cf.title || !cf.amount) return;
    await supabase.from("contracts").insert({
      project_id: projectId, title: cf.title, contractor: cf.contractor,
      vendor_id: vendors.find((v: any) => String(v.name).trim() === String(cf.contractor).trim())?.id || null,
      amount: num(cf.amount),
      advance_pct: num(cf.advance_pct) || 0, retention_pct: num(cf.retention_pct) || 0,
      start_date: cf.start_date || null, end_date: cf.end_date || null, status: "active", body: cf.body,
      ...(await cbsFields(projectId, cCost.code, { item_name: cf.title, phase_name: cCost.phase })),
      phase_name: cCost.phase || null,
    });
    logAction(projectId, profile.id, "ثبت قرارداد", `${cf.title} — ${cf.contractor}`);
    setCf({ title: "", contractor: "", amount: "", advance_pct: "10", retention_pct: "10", start_date: "", end_date: "", body: "" }); setCCost({ code: "", phase: "" }); load();
  };

  const calc = (c: any, gross: number, prev: number, other: number) => {
    const period = gross - prev;
    const retention = Math.round(period * (num(c?.retention_pct) || 0) / 100);
    const advance = Math.round(period * (num(c?.advance_pct) || 0) / 100);
    const insurance = Math.round(period * 0.078); // بیمه ماده ۳۸ (قابل تنظیم)
    return { period, retention, advance, insurance, net: period - retention - advance - insurance - other };
  };

  const addClaim = async () => {
    const c = contracts.find(x => x.id === pf.contract_id);
    if (!c || !pf.gross_amount) return;
    const r = calc(c, num(pf.gross_amount), num(pf.prev_amount) || 0, num(pf.other_deduct) || 0);
    await supabase.from("progress_claims").insert({
      project_id: projectId, contract_id: pf.contract_id, contract_title: c.title, no: pf.no, period: pf.period,
      gross_amount: num(pf.gross_amount), prev_amount: num(pf.prev_amount) || 0,
      period_amount: r.period, retention_deduct: r.retention, advance_deduct: r.advance,
      insurance_deduct: r.insurance, other_deduct: num(pf.other_deduct) || 0,
      net_amount: r.net, status: "draft", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت صورت‌وضعیت", `${c.title} — شماره ${pf.no} — خالص ${fmt(r.net)} ریال`);
    setPf({ contract_id: "", no: "", period: "", gross_amount: "", prev_amount: "", other_deduct: "0" }); load();
  };

  const setClaimStatus = async (cl: any, status: string) => {
    await supabase.from("progress_claims").update({ status }).eq("id", cl.id);
    logAction(projectId, profile.id, "گردش صورت‌وضعیت", `${cl.contract_title} ش ${cl.no} ← ${CLAIM_STATUS[status]}`);
    load();
  };

  const addCo = async () => {
    const c = contracts.find(x => x.id === cof.contract_id);
    if (!c || !cof.title) return;
    await supabase.from("change_orders").insert({
      project_id: projectId, contract_id: cof.contract_id, contract_title: c.title, title: cof.title,
      amount_delta: num(cof.amount_delta) || 0, days_delta: num(cof.days_delta) || 0,
      reason: cof.reason, status: "approved", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "دستور تغییر (CO)", `${cof.title} — اثر مالی ${fmt(num(cof.amount_delta))}`);
    setCof({ contract_id: "", title: "", amount_delta: "", days_delta: "", reason: "" }); load();
  };

  const addDispute = async () => {
    if (!df.subject) return;
    await supabase.from("disputes").insert({
      project_id: projectId, subject: df.subject, party: df.party,
      amount: num(df.amount) || 0, detail: df.detail, status: "open", created_by_name: profile.full_name,
    });
    logAction(projectId, profile.id, "ثبت ادعا (Claim)", df.subject);
    setDf({ subject: "", party: "", amount: "", detail: "" }); load();
  };

  const contractPdf = (c: any) => {
    const co = coOf(c.id), done = claimedOf(c.id), cur = num(c.amount) + co;
    const cClaims = claims.filter(x => x.contract_id === c.id);
    printPdf(`قرارداد: ${c.title}`, `پیمانکار: ${c.contractor || "—"} · از ${faD(c.start_date)} تا ${faD(c.end_date)}`,
      kpis([["مبلغ اولیه", faN(c.amount) + " ریال"], ["دستور تغییرها", faN(co) + " ریال"],
        ["مبلغ جاری", faN(cur) + " ریال"], ["کارکرد تاییدشده", `${faN(done)} (${cur ? Math.round(done / cur * 100) : 0}٪)`]]) +
      `<h2>شرایط مالی</h2>` + tbl(["پیش‌پرداخت", "حسن انجام کار", "وضعیت"],
        [[faN(c.advance_pct) + "٪", faN(c.retention_pct) + "٪", c.status === "active" ? "جاری" : c.status]]) +
      svgHBars("پیشرفت مالی پیمان", [
        { name: "مبلغ جاری پیمان", value: cur, color: CH.primary, note: faN(cur) + " ریال" },
        { name: "کارکرد تاییدشده", value: done, color: CH.accent, note: `${faN(done)} (${cur ? Math.round(done / cur * 100) : 0}٪)` },
        { name: "مانده تا سقف", value: Math.max(0, cur - done), color: CH.muted, note: faN(cur - done) + " ریال" },
      ]) +
      (cClaims.length > 1 ? svgLines("روند کارکرد دوره‌ای صورت‌وضعیت‌ها",
        [...cClaims].reverse().map(x => `ش ${x.no}`),
        [{ name: "کارکرد دوره", color: CH.primary, values: [...cClaims].reverse().map(x => num(x.period_amount) || 0) },
         { name: "خالص پرداختنی", color: CH.accent, values: [...cClaims].reverse().map(x => num(x.net_amount) || 0) }], "ریال") : "") +
      (c.body ? `<h2>متن قرارداد</h2><pre>${String(c.body).replace(/</g, "&lt;")}</pre>` : "") +
      (cClaims.length ? "<h2>صورت‌وضعیت‌ها</h2>" + tbl(["شماره", "دوره", "کارکرد دوره", "خالص", "وضعیت"],
        cClaims.map(x => [x.no, x.period, faN(x.period_amount), faN(x.net_amount), CLAIM_STATUS[x.status]])) : "") +
      `<div class="sign"><div>پیمانکار<br><br>______________</div><div>ناظر / مهندس ارشد<br><br>______________</div><div>کارفرما — Different Agency Platform<br><br>______________</div></div>`);
  };
  const listPdf = () => {
    const rows = contracts.map(c => { const co = coOf(c.id), done = claimedOf(c.id), cur = num(c.amount) + co; return { c, co, done, cur }; });
    printPdf("فهرست قراردادهای پروژه", "وضعیت مالی پیمان‌ها",
      kpis([["تعداد پیمان", faN(contracts.length)],
        ["جمع مبلغ جاری", faN(rows.reduce((s, r) => s + r.cur, 0)) + " ریال"],
        ["جمع کارکرد تاییدشده", faN(rows.reduce((s, r) => s + r.done, 0)) + " ریال"],
        ["جمع مانده", faN(rows.reduce((s, r) => s + (r.cur - r.done), 0)) + " ریال"]]) +
      svgBars("مبلغ جاری پیمان در برابر کارکرد تاییدشده", rows.map(r => r.c.title), [
        { name: "مبلغ جاری", color: CH.primary, values: rows.map(r => r.cur) },
        { name: "کارکرد تایید", color: CH.accent, values: rows.map(r => r.done) },
      ], "ریال") +
      svgHBars("درصد پیشرفت مالی هر پیمان", rows.map(r => ({
        name: r.c.title, value: r.cur ? Math.round(r.done / r.cur * 100) : 0,
        color: CH.accent, note: faN(r.cur ? Math.round(r.done / r.cur * 100) : 0) + "٪",
      }))) +
      tbl(["قرارداد", "پیمانکار", "مبلغ اولیه", "CO", "مبلغ جاری", "کارکرد تایید", "مانده"],
        rows.map(r => [r.c.title, r.c.contractor, faN(r.c.amount), faN(r.co), faN(r.cur), faN(r.done), faN(r.cur - r.done)])));
  };

  const claimsPdf = () => {
    const tot = claims.reduce((s2, c) => s2 + num(c.period_amount || 0), 0);
    const net = claims.reduce((s2, c) => s2 + num(c.net_amount || 0), 0);
    const ded = tot - net;
    printPdf("گزارش صورت‌وضعیت‌ها", "کارکرد دوره‌ای، کسورات و گردش تایید",
      kpis([["تعداد صورت‌وضعیت", faN(claims.length)], ["جمع کارکرد دوره", faN(tot) + " ریال"],
        ["جمع کسورات", faN(ded) + " ریال"], ["جمع خالص پرداختنی", faN(net) + " ریال"]]) +
      (claims.length ? svgBars("کارکرد دوره در برابر خالص پرداختنی", claims.map(c => `${c.contract_title} ش${c.no}`), [
        { name: "کارکرد دوره", color: CH.primary, values: claims.map(c => num(c.period_amount || 0)) },
        { name: "خالص پرداختنی", color: CH.ok, values: claims.map(c => num(c.net_amount || 0)) }], "ریال") : "") +
      (ded > 0 ? svgPie("ترکیب کسورات", [
        { name: "حسن انجام کار", value: claims.reduce((s2, c) => s2 + num(c.retention_deduct || 0), 0) },
        { name: "استهلاک پیش‌پرداخت", value: claims.reduce((s2, c) => s2 + num(c.advance_deduct || 0), 0) },
        { name: "بیمه", value: claims.reduce((s2, c) => s2 + num(c.insurance_deduct || 0), 0) },
        { name: "سایر", value: claims.reduce((s2, c) => s2 + num(c.other_deduct || 0), 0) }]) : "") +
      (claims.length ? svgPie("وضعیت گردش تایید", Object.entries(
        claims.reduce((m: any, c) => ({ ...m, [CLAIM_STATUS[c.status]]: (m[CLAIM_STATUS[c.status]] || 0) + 1 }), {})
      ).map(([name, value]) => ({ name, value: value as number }))) : "") +
      "<h2>ریز صورت‌وضعیت‌ها</h2>" + tbl(["قرارداد", "ش", "دوره", "کارکرد دوره", "حسن انجام", "پیش‌پرداخت", "بیمه", "خالص", "وضعیت"],
        claims.map(c => [c.contract_title, c.no, c.period, faN(c.period_amount), faN(c.retention_deduct),
          faN(c.advance_deduct), faN(c.insurance_deduct), faN(c.net_amount), CLAIM_STATUS[c.status]])));
  };

  const coPdf = () => printPdf("گزارش دستور تغییرها (CO)", "اثر مالی و زمانی تغییرات بر پیمان‌ها",
    kpis([["تعداد CO", faN(cos.length)],
      ["جمع اثر مالی", faN(cos.reduce((s2, c) => s2 + num(c.amount_delta || 0), 0)) + " ریال"],
      ["جمع اثر زمانی", faN(cos.reduce((s2, c) => s2 + num(c.days_delta || 0), 0)) + " روز"]]) +
    (cos.length ? svgHBars("اثر مالی هر دستور تغییر", cos.map(c => ({
      name: c.title, value: num(c.amount_delta || 0),
      color: num(c.amount_delta) < 0 ? CH.ok : CH.danger, note: faN(c.amount_delta) + " ریال" }))) : "") +
    tbl(["قرارداد", "شرح تغییر", "اثر مالی", "اثر زمانی", "دلیل", "ثبت‌کننده"],
      cos.map(c => [c.contract_title, c.title, faN(c.amount_delta), faN(c.days_delta) + " روز", c.reason || "—", c.created_by_name || "—"])));

  const dispPdf = () => printPdf("گزارش ادعاها", "ادعاهای ثبت‌شده و وضعیت آن‌ها",
    kpis([["کل ادعاها", faN(disputes.length)], ["باز", faN(disputes.filter(d => d.status === "open").length)],
      ["جمع مبلغ", faN(disputes.reduce((s2, d) => s2 + num(d.amount || 0), 0)) + " ریال"]]) +
    (disputes.length ? svgHBars("مبلغ برآوردی ادعاها", disputes.map(d => ({
      name: d.subject, value: num(d.amount || 0), color: d.status === "open" ? CH.danger : CH.muted,
      note: faN(d.amount) + " ریال" }))) : "") +
    tbl(["موضوع", "طرف", "مبلغ", "وضعیت", "شرح"],
      disputes.map(d => [d.subject, d.party || "—", faN(d.amount), d.status === "open" ? "باز" : "مختومه", (d.detail || "—").slice(0, 70)])));

  const claimedOf = (cid: string) => claims.filter(c => c.contract_id === cid && c.status === "approved")
    .reduce((s, c) => s + num(c.period_amount || 0), 0);
  const coOf = (cid: string) => cos.filter(c => c.contract_id === cid).reduce((s, c) => s + num(c.amount_delta || 0), 0);

  const applyTpl = async (text: string, append = false) => {
    if (tplFor) {   // قرارداد موجود در جدول
      const body = append && tplFor.body ? tplFor.body + "\n\n" + text : text;
      await supabase.from("contracts").update({ body }).eq("id", tplFor.id);
      logAction(projectId, profile.id, "درج متن قرارداد از کتابخانه", tplFor.title);
      load();
    } else {        // فرم ثبت جدید
      setCf(f => ({ ...f, body: append && f.body ? f.body + "\n\n" + text : text }));
    }
  };

  return (
    <div className="space-y-3">
      {tplOpen && (
        <ContractTemplatePicker
          contract={tplFor || cf}
          projectName={projectName}
          onApply={applyTpl}
          onClose={() => setTplOpen(false)}
        />
      )}
      <div className="card py-2">
        <ExcelIO profile={profile} projectId={projectId} canEdit={canEdit} onDone={load}
          table={sub === "contracts" ? "contracts" : sub === "claims" ? "progress_claims" : sub === "co" ? "change_orders" : "disputes"}
          rows={sub === "contracts" ? contracts : sub === "claims" ? claims : sub === "co" ? cos : disputes}
          pdf={sub === "contracts" ? listPdf : sub === "claims" ? claimsPdf : sub === "co" ? coPdf : dispPdf} />
      </div>
      <div className="flex gap-2">
        {[["contracts", "قراردادها"], ["claims", "صورت‌وضعیت‌ها"], ["co", "دستور تغییر"], ["disputes", "ادعاها"]].map(([k, l]) => (
          <button key={k} className={`chip ${sub === k ? "chip-on" : "border border-line bg-card"}`}
            onClick={() => setSub(k as any)}>{l}</button>
        ))}
      </div>

      {sub === "contracts" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-7">
              <input className="input md:col-span-2" placeholder="عنوان قرارداد (مثلاً: پیمان اسکلت)" value={cf.title} onChange={e => setCf({ ...cf, title: e.target.value })} />
              <span className="contents">
                <input className="input" placeholder="پیمانکار" list="contractor-list"
                  value={cf.contractor} onChange={e => setCf({ ...cf, contractor: e.target.value })} />
                <datalist id="contractor-list">
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.field || ""}</option>)}
                </datalist>
              </span>
              <input className="input" dir="ltr" placeholder="مبلغ اولیه" value={cf.amount} onChange={e => setCf({ ...cf, amount: e.target.value })} />
              <input className="input" dir="ltr" placeholder="٪ پیش‌پرداخت" value={cf.advance_pct} onChange={e => setCf({ ...cf, advance_pct: e.target.value })} />
              <input className="input" dir="ltr" placeholder="٪ حسن انجام" value={cf.retention_pct} onChange={e => setCf({ ...cf, retention_pct: e.target.value })} />
              <CostCodeField projectId={projectId} value={cCost} onChange={setCCost} compact />
              <button className="btn-primary" onClick={addContract}>ثبت قرارداد</button>
              <div className="md:col-span-7">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold">متن قرارداد</span>
                  <button type="button" className="btn-accent py-0.5 text-xs"
                    onClick={() => { setTplFor(null); setTplOpen(true); }}>
                    📚 انتخاب از کتابخانه نمونه قراردادها
                  </button>
                  {cf.body && <button type="button" className="btn-ghost py-0.5 text-xs text-danger"
                    onClick={() => setCf({ ...cf, body: "" })}>پاک کردن متن</button>}
                  <span className="text-[11px] text-ink/40">یا مثل قبل، متن را آزادانه اینجا بنویسید</span>
                </div>
                <textarea className="input w-full" rows={cf.body ? 10 : 4} value={cf.body}
                  onChange={e => setCf({ ...cf, body: e.target.value })}
                  placeholder="متن قرارداد — ماده ۱: موضوع پیمان… / ماده ۲: مدت پیمان… / ماده ۳: مبلغ و نحوه پرداخت… (در PDF قرارداد چاپ می‌شود)" />
              </div>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr>
                <th className="th">PDF</th><th className="th">قرارداد</th><th className="th">پیمانکار</th><th className="th">مبلغ اولیه</th>
                <th className="th">دستور تغییرها</th><th className="th">مبلغ جاری</th><th className="th">کارکرد تاییدشده</th><th className="th">مانده</th>
              </tr></thead>
              <tbody>
                {contracts.map(c => {
                  const co = coOf(c.id), done = claimedOf(c.id), cur = num(c.amount) + co;
                  return (
                    <tr key={c.id}>
                      <td className="td">
                        <span className="flex gap-1">
                          <button className="btn-ghost py-0.5 text-xs" onClick={() => contractPdf(c)}>PDF ⬇</button>
                          {canEdit && <button className="btn-ghost py-0.5 text-xs" title="ویرایش متن قرارداد از کتابخانه"
                            onClick={() => { setTplFor(c); setTplOpen(true); }}>📚 متن</button>}
                        </span>
                      </td>
                      <td className="td font-bold">{c.title}</td><td className="td">{c.contractor}</td>
                      <td className="td">{fmt(c.amount)}</td>
                      <td className="td">{co ? fmt(co) : "—"}</td>
                      <td className="td font-bold">{fmt(cur)}</td>
                      <td className="td">{fmt(done)} <span className="text-xs text-ink/40">({cur ? Math.round(done / cur * 100) : 0}٪)</span></td>
                      <td className="td">{fmt(cur - done)}</td>
                    </tr>
                  );
                })}
                {contracts.length === 0 && <tr><td className="td text-ink/40" colSpan={8}>قراردادی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "claims" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-7">
              <select className="input md:col-span-2" value={pf.contract_id} onChange={e => setPf({ ...pf, contract_id: e.target.value })}>
                <option value="">قرارداد…</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input className="input" placeholder="شماره ص.و" value={pf.no} onChange={e => setPf({ ...pf, no: e.target.value })} />
              <input className="input" placeholder="دوره (مثلاً تیر ۱۴۰۵)" value={pf.period} onChange={e => setPf({ ...pf, period: e.target.value })} />
              <input className="input" dir="ltr" placeholder="کارکرد تجمعی" value={pf.gross_amount} onChange={e => setPf({ ...pf, gross_amount: e.target.value })} />
              <input className="input" dir="ltr" placeholder="کارکرد قبلی" value={pf.prev_amount} onChange={e => setPf({ ...pf, prev_amount: e.target.value })} />
              <button className="btn-primary" onClick={addClaim}>ثبت صورت‌وضعیت</button>
              <p className="text-[11px] text-ink/40 md:col-span-7">کسورات (حسن انجام کار، استهلاک پیش‌پرداخت طبق درصد قرارداد، و بیمه ۷.۸٪) خودکار محاسبه می‌شود. گردش تایید: پیش‌نویس ← ناظر ← مدیر پروژه.</p>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr>
                <th className="th">قرارداد</th><th className="th">ش</th><th className="th">دوره</th>
                <th className="th">کارکرد دوره</th><th className="th">حسن انجام</th><th className="th">پیش‌پرداخت</th>
                <th className="th">بیمه</th><th className="th">خالص پرداختنی</th><th className="th">وضعیت</th><th className="th">اقدام</th>
              </tr></thead>
              <tbody>
                {claims.map(cl => (
                  <tr key={cl.id}>
                    <td className="td">{cl.contract_title}</td><td className="td">{cl.no}</td><td className="td">{cl.period}</td>
                    <td className="td font-bold">{fmt(cl.period_amount)}</td>
                    <td className="td text-danger">{fmt(cl.retention_deduct)}-</td>
                    <td className="td text-danger">{fmt(cl.advance_deduct)}-</td>
                    <td className="td text-danger">{fmt(cl.insurance_deduct)}-</td>
                    <td className="td font-black text-ok">{fmt(cl.net_amount)}</td>
                    <td className="td"><span className={`chip ${cl.status === "approved" ? "bg-ok/10 text-ok" : cl.status === "rejected" ? "bg-danger/10 text-danger" : "bg-crane/20"}`}>{CLAIM_STATUS[cl.status]}</span></td>
                    <td className="td">
                      {cl.status === "draft" && (isSupervisor || isManager) &&
                        <button className="btn-ghost py-0.5 text-xs" onClick={() => setClaimStatus(cl, "supervisor_ok")}>تایید مهندس ارشد</button>}
                      {cl.status === "supervisor_ok" && isManager && <span className="flex gap-1">
                        <button className="btn-primary py-0.5 text-xs" onClick={() => setClaimStatus(cl, "approved")}>تایید نهایی</button>
                        <button className="btn-ghost py-0.5 text-xs text-danger" onClick={() => setClaimStatus(cl, "rejected")}>رد</button>
                      </span>}
                      {cl.status === "approved" && canEdit && (() => {
                        const ct = contracts.find(x => x.id === cl.contract_id);
                        return <PostToAccounting projectId={projectId} profile={profile} onDone={load}
                          label="پرداخت ←" txn={{
                            type: "payment", amount: num(cl.net_amount),
                            counterparty: ct?.contractor || cl.contract_title,
                            description: `پرداخت صورت‌وضعیت ${cl.no} — ${cl.contract_title}`,
                            cbs_item_id: ct?.cbs_item_id, cbs_code: ct?.cbs_code, phase_name: ct?.phase_name,
                            source_table: "progress_claims", source_id: cl.id,
                          }} />;
                      })()}
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && <tr><td className="td text-ink/40" colSpan={10}>صورت‌وضعیتی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "co" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-6">
              <select className="input" value={cof.contract_id} onChange={e => setCof({ ...cof, contract_id: e.target.value })}>
                <option value="">قرارداد…</option>
                {contracts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input className="input md:col-span-2" placeholder="شرح تغییر" value={cof.title} onChange={e => setCof({ ...cof, title: e.target.value })} />
              <input className="input" dir="ltr" placeholder="اثر مالی (±ریال)" value={cof.amount_delta} onChange={e => setCof({ ...cof, amount_delta: e.target.value })} />
              <input className="input" dir="ltr" placeholder="اثر زمانی (±روز)" value={cof.days_delta} onChange={e => setCof({ ...cof, days_delta: e.target.value })} />
              <button className="btn-primary" onClick={addCo}>ثبت CO</button>
            </div>
          )}
          <div className="card overflow-auto p-0">
            <table className="w-full">
              <thead className="bg-surface"><tr><th className="th">قرارداد</th><th className="th">شرح</th><th className="th">اثر مالی</th><th className="th">اثر زمانی</th><th className="th">ثبت‌کننده</th></tr></thead>
              <tbody>
                {cos.map(c => (
                  <tr key={c.id}>
                    <td className="td">{c.contract_title}</td><td className="td font-bold">{c.title}</td>
                    <td className={`td font-bold ${c.amount_delta < 0 ? "text-ok" : "text-danger"}`}>{fmt(c.amount_delta)}</td>
                    <td className="td">{c.days_delta ? `${fmt(c.days_delta)} روز` : "—"}</td>
                    <td className="td text-xs">{c.created_by_name}</td>
                  </tr>
                ))}
                {cos.length === 0 && <tr><td className="td text-ink/40" colSpan={5}>دستور تغییری ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === "disputes" && (
        <>
          {canEdit && (
            <div className="card grid gap-2 md:grid-cols-5">
              <input className="input md:col-span-2" placeholder="موضوع ادعا" value={df.subject} onChange={e => setDf({ ...df, subject: e.target.value })} />
              <input className="input" placeholder="طرف ادعا" value={df.party} onChange={e => setDf({ ...df, party: e.target.value })} />
              <input className="input" dir="ltr" placeholder="مبلغ برآوردی" value={df.amount} onChange={e => setDf({ ...df, amount: e.target.value })} />
              <button className="btn-primary" onClick={addDispute}>ثبت ادعا</button>
            </div>
          )}
          {disputes.map(d => (
            <div key={d.id} className="card flex flex-wrap items-center gap-3">
              <span className="flex-1 font-bold">{d.subject}</span>
              <span className="text-xs text-ink/50">طرف: {d.party || "—"}</span>
              <span className="text-sm">مبلغ: <b>{fmt(d.amount)}</b></span>
              <span className={`chip ${d.status === "open" ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"}`}>{d.status === "open" ? "باز" : "مختومه"}</span>
              {isManager && d.status === "open" &&
                <button className="btn-ghost py-1 text-xs" onClick={async () => { await supabase.from("disputes").update({ status: "closed" }).eq("id", d.id); logAction(projectId, profile.id, "مختومه شدن ادعا", d.subject); load(); }}>مختومه</button>}
            </div>
          ))}
          {disputes.length === 0 && <p className="text-sm text-ink/40">ادعایی ثبت نشده است.</p>}
        </>
      )}
    </div>
  );
}
