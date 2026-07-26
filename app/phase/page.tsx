"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import CostCodeField from "@/components/CostCodeField";
import { cbsFields } from "@/lib/costlink";
import { num } from "@/lib/num";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { fmt, fmtDate, TASK_STATUS, allowedTabs, editTabs } from "@/lib/constants";
import { logAction } from "@/lib/log";

function PhaseInner() {
  const sp = useSearchParams();
  const id = sp.get("p") || "";
  const phaseId = sp.get("ph") || "";
  const { profile } = useSession();
  const [phase, setPhase] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [myMember, setMyMember] = useState<any>(null);
  const [openAct, setOpenAct] = useState<string | null>(null);
  const [tf, setTf] = useState({ title: "", assignee: "", start_date: "", due_date: "" });
  const [tCost, setTCost] = useState({ code: "", phase: "" });

  const canManage = profile && editTabs(profile.role, myMember, project?.kind || "construction").includes("plan");

  const load = async () => {
    const { data: ph } = await supabase.from("phases").select("*").eq("id", phaseId).single();
    setPhase(ph);
    const { data: pr } = await supabase.from("projects").select("*").eq("id", id).single();
    setProject(pr);
    const { data: ts } = await supabase.from("tasks").select("*, profiles:assignee(full_name)")
      .eq("phase_id", phaseId).order("due_date");
    setTasks(ts || []);
    if (ph) {
      const { data: ci } = await supabase.from("cbs_items").select("*")
        .eq("project_id", id).eq("phase_name", ph.name).limit(2000);
      setItems(ci || []);
    }
    const { data: ms } = await supabase.from("project_members").select("*, profiles(full_name)").eq("project_id", id);
    setMembers(ms || []);
    if (profile) setMyMember((ms || []).find((m: any) => m.user_id === profile.id) || null);
  };
  useEffect(() => { if (profile) load(); }, [phaseId, profile]);

  const canSeeCbs = profile && allowedTabs(profile.role, myMember, project?.kind || "construction").includes("cbs");
  const planned = (it: any) => num(it.quantity || 0) * num(it.unit_rate || 0) * (1 + num(it.waste_pct || 0));

  const byActivity = useMemo(() => {
    const m: Record<string, { items: any[]; planned: number; actual: number }> = {};
    for (const it of items) {
      const k = it.activity || "سایر";
      m[k] = m[k] || { items: [], planned: 0, actual: 0 };
      m[k].items.push(it); m[k].planned += planned(it); m[k].actual += num(it.actual_total || 0);
    }
    return m;
  }, [items]);

  const addTask = async () => {
    if (!tf.title.trim()) return;
    const cbs = await cbsFields(id, tCost.code, { item_name: tf.title, phase_name: phase?.name });
    await supabase.from("tasks").insert({
      project_id: id, phase_id: phaseId, title: tf.title, assignee: tf.assignee || null,
      start_date: tf.start_date || null, due_date: tf.due_date || null,
      status: "todo", progress: 0, priority: "متوسط", created_by: profile.id,
      ...cbs,
    });
    if (tf.assignee) await supabase.from("notifications").insert({
      user_id: tf.assignee, kind: "task", title: "فعالیت جدید به شما محول شد",
      body: `${tf.title} — ${phase?.name}`, link: `/phase?p=${id}&ph=${phaseId}`,
    });
    logAction(id, profile.id, "افزودن فعالیت", `${tf.title} — ${phase?.name}${tCost.code ? ` · کد ${tCost.code}` : ""}`);
    setTf({ title: "", assignee: "", start_date: "", due_date: "" }); setTCost({ code: "", phase: "" }); load();
  };
  const setTaskStatus = async (t: any, status: string) => {
    await supabase.from("tasks").update({ status, progress: status === "done" ? 100 : t.progress }).eq("id", t.id);
    logAction(id, profile.id, "تغییر وضعیت فعالیت", `${t.title} ← ${TASK_STATUS[status]}`);
    load();
  };

  if (!phase || !project || !profile)
    return <Shell><p className="text-ink/40">در حال بارگذاری فاز…</p></Shell>;

  return (
    <Shell>
      <div className="mb-1 text-xs text-ink/50">
        <Link href="/projects" className="hover:underline">پروژه‌ها</Link> ← {" "}
        <Link href={`/project?id=${id}&tab=plan`} className="hover:underline">{project.name}</Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black">{phase.name}</h1>
        <span className="text-xs text-ink/50">از {fmtDate(phase.start_date)} تا {fmtDate(phase.end_date)}</span>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-crane" style={{ width: `${phase.progress || 0}%` }} />
        </div>
        <span className="text-sm font-black">{(phase.progress || 0).toLocaleString("fa-IR")}٪</span>
      </div>

      {/* ---------- برنامه زمانی فعالیت‌های فاز ---------- */}
      <div className="card mb-4">
        <h2 className="mb-3 font-black">برنامه زمانی فعالیت‌های این فاز</h2>
        {tasks.map(t => (
          <div key={t.id} className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
            <span className="flex-1 font-bold">{t.title}</span>
            <span className="text-xs text-ink/50">{t.profiles?.full_name || "بدون مسئول"}</span>
            <span className="text-xs text-ink/50">{fmtDate(t.start_date)} ← {fmtDate(t.due_date)}</span>
            <select className="input w-40 py-1 text-xs" value={t.status} onChange={e => setTaskStatus(t, e.target.value)}>
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        ))}
        {tasks.length === 0 && <p className="mb-2 text-xs text-ink/40">فعالیتی ثبت نشده است.</p>}
        {canManage && (
          <div className="grid gap-2 md:grid-cols-6">
            <input className="input md:col-span-2" placeholder="عنوان فعالیت" value={tf.title} onChange={e => setTf({ ...tf, title: e.target.value })} />
            <select className="input" value={tf.assignee} onChange={e => setTf({ ...tf, assignee: e.target.value })}>
              <option value="">مسئول اجرا…</option>
              {members.map((m: any) => <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name}</option>)}
            </select>
            <DateInput className="input" value={tf.start_date} onChange={v => setTf({ ...tf, start_date: v })} />
            <DateInput className="input" value={tf.due_date} onChange={v => setTf({ ...tf, due_date: v })} />
            <CostCodeField projectId={id} value={tCost} onChange={setTCost} compact showPhase={false} />
            <button className="btn-primary" onClick={addTask}>افزودن فعالیت</button>
          </div>
        )}
      </div>

      {/* ---------- ساختار هزینه فاز به تفکیک فعالیت ---------- */}
      {canSeeCbs ? (
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <h2 className="font-black">ساختار هزینه این فاز (به تفکیک فعالیت)</h2>
            <span className="text-sm">برنامه‌ای: <b>{fmt(Object.values(byActivity).reduce((s, a) => s + a.planned, 0))}</b> ریال</span>
            <span className="text-sm">واقعی: <b>{fmt(Object.values(byActivity).reduce((s, a) => s + a.actual, 0))}</b> ریال</span>
          </div>
          {Object.keys(byActivity).length === 0 && (
            <p className="text-sm text-ink/40">آیتم هزینه‌ای برای این فاز یافت نشد. ابتدا فایل CBS را در تب «ساختار هزینه» پروژه وارد کنید.</p>
          )}
          {Object.entries(byActivity).map(([act, g]) => {
            const open = openAct === act;
            const dev = g.planned - g.actual;
            return (
              <div key={act} className="mb-2 rounded-lg border border-line">
                <button className="flex w-full flex-wrap items-center gap-3 p-3 text-right" onClick={() => setOpenAct(open ? null : act)}>
                  <span className="flex-1 font-bold">{open ? "▾" : "◂"} {act}</span>
                  <span className="text-xs text-ink/50">{g.items.length.toLocaleString("fa-IR")} آیتم</span>
                  <span className="text-xs">برنامه‌ای: <b>{fmt(g.planned)}</b></span>
                  <span className="text-xs">واقعی: <b>{fmt(g.actual)}</b></span>
                  <span className={`chip ${dev < 0 ? "bg-danger/10 text-danger" : "bg-ok/10 text-ok"}`}>
                    {dev < 0 ? "فراتر از بودجه" : "در بودجه"}
                  </span>
                </button>
                {open && (
                  <div className="overflow-auto border-t border-line">
                    <table className="w-full">
                      <thead className="bg-surface">
                        <tr><th className="th">کد</th><th className="th">نام آیتم</th><th className="th">واحد</th>
                        <th className="th">مقدار</th><th className="th">نرخ</th><th className="th">برنامه‌ای</th><th className="th">واقعی</th></tr>
                      </thead>
                      <tbody>
                        {g.items.map(it => (
                          <tr key={it.id}>
                            <td className="td"><span className="code-chip">{it.cost_code}</span></td>
                            <td className="td max-w-72 truncate" title={it.item_name}>{it.item_name}</td>
                            <td className="td">{it.unit}</td>
                            <td className="td">{fmt(it.quantity)}</td>
                            <td className="td">{fmt(it.unit_rate)}</td>
                            <td className="td font-bold">{fmt(planned(it))}</td>
                            <td className="td">{fmt(it.actual_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-sm text-ink/50">دسترسی شما به ساختار هزینه این فاز محدود شده است. در این صفحه فقط برنامه زمانی را می‌بینید.</div>
      )}
    </Shell>
  );
}


export default function PhasePage() {
  return <Suspense fallback={<Shell><p className="text-ink/40">در حال بارگذاری…</p></Shell>}><PhaseInner /></Suspense>;
}
