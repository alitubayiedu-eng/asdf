"use client";
import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { supabase } from "@/lib/supabase";
import { fmtDate } from "@/lib/constants";
import { logAction } from "@/lib/log";
import { callFn } from "@/lib/fn";
import { printPdf, tbl, kpis, faN, faD, svgPie, svgHBars, CH } from "@/lib/export";

export default function OrdersTab({ projectId, profile, projectName, canEdit }: any) {
  const [directives, setDirectives] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [f, setF] = useState({ to_user: "", title: "", body: "", due_date: "" });
  const canSend = !!canEdit;

  const load = async () => {
    const { data: d } = await supabase.from("directives")
      .select("*, from:from_user(full_name), to:to_user(full_name)")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    setDirectives(d || []);
    const { data: m } = await supabase.from("project_members").select("user_id, profiles(full_name)").eq("project_id", projectId);
    setMembers(m || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const send = async () => {
    if (!f.to_user || !f.title) return;
    const { data: d, error } = await supabase.from("directives").insert({
      project_id: projectId, from_user: profile.id, to_user: f.to_user,
      title: f.title, body: f.body, due_date: f.due_date || null, status: "open",
    }).select().single();
    if (error) { alert("خطا: " + error.message); return; }
    // اعلان درون‌برنامه‌ای
    await supabase.from("notifications").insert({
      user_id: f.to_user, kind: "directive", title: `دستور کار جدید: ${f.title}`,
      body: `از طرف ${profile.full_name} در پروژه ${projectName}`, link: `/project?id=${projectId}&tab=orders`,
    });
    // ارسال ایمیل از طریق سرور
    callFn("send-email", { toUserId: f.to_user, subject: `دستور کار جدید - ${projectName}`, title: f.title, body: f.body, from: profile.full_name });
    callFn("send-sms", { toUserId: f.to_user, message: `Different Agency | دستور کار جدید: ${f.title} — پروژه ${projectName}` });
    const toName = members.find((m: any) => m.user_id === f.to_user)?.profiles?.full_name || "";
    logAction(projectId, profile.id, "ارسال دستور کار", `${f.title} ← ${toName}`);
    setF({ to_user: "", title: "", body: "", due_date: "" });
    load();
  };

  const setStatus = async (d: any, status: string) => {
    await supabase.from("directives").update({ status }).eq("id", d.id);
    await supabase.from("notifications").insert({
      user_id: d.from_user, kind: "directive",
      title: status === "done" ? `دستور «${d.title}» انجام شد` : `دستور «${d.title}» دیده شد`,
      body: `توسط ${profile.full_name}`, link: `/project?id=${projectId}&tab=orders`,
    });
    logAction(projectId, profile.id, "تغییر وضعیت دستور", `${d.title} ← ${status === "done" ? "انجام‌شده" : "دیده‌شده"}`);
    load();
  };

  const ordPdf = () => {
    const byTo: Record<string, number> = {};
    for (const d of directives) byTo[d.to?.full_name || "—"] = (byTo[d.to?.full_name || "—"] || 0) + 1;
    printPdf("گزارش دستور کارها", "دستورهای صادرشده و وضعیت اجرا",
      kpis([["کل دستورها", faN(directives.length)],
        ["باز", faN(directives.filter(d => d.status !== "done").length)],
        ["انجام‌شده", faN(directives.filter(d => d.status === "done").length)],
        ["گیرندگان", faN(Object.keys(byTo).length)]]) +
      (directives.length ? svgPie("وضعیت دستورها", [
        { name: "انجام‌شده", value: directives.filter(d => d.status === "done").length },
        { name: "در جریان", value: directives.filter(d => d.status !== "done").length }]) : "") +
      (Object.keys(byTo).length ? svgHBars("دستورها به تفکیک گیرنده", Object.entries(byTo)
        .sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, note: faN(value) + " دستور" }))) : "") +
      "<h2>فهرست دستورها</h2>" + tbl(["عنوان", "از", "به", "تاریخ", "وضعیت", "شرح"],
        directives.map(d => [d.title, d.from?.full_name || "—", d.to?.full_name || "—",
          faD(d.created_at), d.status === "done" ? "انجام‌شده" : "در جریان", (d.body || "—").slice(0, 70)])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={ordPdf}>خروجی PDF</button></div>
      {canSend && (
        <div className="card grid gap-2 md:grid-cols-5">
          <select className="input" value={f.to_user} onChange={e => setF({ ...f, to_user: e.target.value })}>
            <option value="">گیرنده دستور…</option>
            {members.filter((m: any) => m.user_id !== profile.id)
              .map((m: any) => <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name}</option>)}
          </select>
          <input className="input md:col-span-2" placeholder="عنوان دستور کار" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <DateInput className="input" value={f.due_date} onChange={v => setF({ ...f, due_date: v })} />
          <button className="btn-accent" onClick={send}>ارسال (اعلان + ایمیل)</button>
          <textarea className="input md:col-span-5" rows={2} placeholder="متن کامل دستور، مشخصات فنی، مهلت‌ها…" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        </div>
      )}
      {directives.map(d => (
        <div key={d.id} className="card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black">{d.title}</span>
            <span className={`chip ${d.status === "done" ? "bg-ok/10 text-ok" : d.status === "ack" ? "bg-crane/20" : "bg-danger/10 text-danger"}`}>
              {d.status === "done" ? "انجام‌شده" : d.status === "ack" ? "دیده‌شده" : "باز"}
            </span>
            <span className="mr-auto text-xs text-ink/50">مهلت: {fmtDate(d.due_date)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{d.body}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-ink/50">
            <span>از: <b>{d.from?.full_name}</b> ← به: <b>{d.to?.full_name}</b> · {fmtDate(d.created_at)}</span>
            {d.to_user === profile.id && d.status !== "done" && (
              <span className="flex gap-2">
                {d.status === "open" && <button className="btn-ghost py-1" onClick={() => setStatus(d, "ack")}>دیدم</button>}
                <button className="btn-primary py-1" onClick={() => setStatus(d, "done")}>انجام شد</button>
              </span>
            )}
          </div>
        </div>
      ))}
      {directives.length === 0 && <p className="text-sm text-ink/40">دستوری ثبت نشده است.</p>}
    </div>
  );
}
