"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ROLES, MANAGER_ROLES, tabsForKind, DEFAULT_TABS_BY_ROLE, DEFAULT_EDIT_BY_ROLE } from "@/lib/constants";
import { printPdf, tbl, kpis, faN } from "@/lib/export";
import { logAction } from "@/lib/log";

export default function MembersTab({ projectId, profile, kind = "construction" }: any) {
  const KIND_TABS = tabsForKind(kind);
  const [members, setMembers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("accountant");
  const [managerId, setManagerId] = useState("");
  const [view, setView] = useState<string[]>(DEFAULT_TABS_BY_ROLE["accountant"] || []);
  const [edit, setEdit] = useState<string[]>(DEFAULT_EDIT_BY_ROLE["accountant"] || []);
  const [editing, setEditing] = useState<string | null>(null);
  const canManage = MANAGER_ROLES.includes(profile.role);

  const load = async () => {
    const { data: m } = await supabase.from("project_members").select("*, profiles(full_name, role)").eq("project_id", projectId);
    setMembers(m || []);
    const { data: u } = await supabase.from("profiles").select("id, full_name").order("full_name");
    setUsers(u || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const onRoleChange = (r: string) => {
    setRole(r);
    setView(DEFAULT_TABS_BY_ROLE[r] || ["plan", "orders", "notes"]);
    setEdit(DEFAULT_EDIT_BY_ROLE[r] || []);
  };
  const toggle = (list: string[], set: any, tab: string) =>
    set(list.includes(tab) ? list.filter(t => t !== tab) : [...list, tab]);

  const add = async () => {
    const typed = name.trim();
    if (!typed) return;
    const user = users.find(u => u.full_name === typed) ||
      users.find(u => (u.full_name || "").includes(typed));
    if (!user) { alert("کاربری با این نام یافت نشد. ابتدا مدیر سیستم باید کاربر را در «کاربران و نقش‌ها» بسازد."); return; }
    if (members.some(m => m.user_id === user.id)) { alert("این کاربر قبلاً عضو همین پروژه است."); return; }
    await supabase.from("project_members").insert({
      project_id: projectId, user_id: user.id, member_role: role,
      manager_id: managerId || null,
      allowed_tabs: view.join(","), edit_tabs: edit.join(","),
    });
    await supabase.from("notifications").insert({
      user_id: user.id, kind: "member", title: "به یک پروژه اضافه شدید",
      body: `شما با نقش «${ROLES[role]}» به پروژه اضافه شدید.`, link: `/project?id=${projectId}`,
    });
    logAction(projectId, profile.id, "افزودن عضو", `${user.full_name} — نقش: ${ROLES[role]}`);
    setName(""); onRoleChange("accountant"); setManagerId(""); load();
  };

  const patch = async (m: any, p: any, logText?: string) => {
    await supabase.from("project_members").update(p).eq("id", m.id);
    if (logText) logAction(projectId, profile.id, "تغییر دسترسی عضو", `${m.profiles?.full_name}: ${logText}`);
    load();
  };
  const remove = async (m: any) => {
    if (!confirm(`«${m.profiles?.full_name}» از پروژه حذف شود؟`)) return;
    await supabase.from("project_members").delete().eq("id", m.id);
    logAction(projectId, profile.id, "حذف عضو", m.profiles?.full_name || "");
    load();
  };

  const toggleRowTab = (m: any, field: "allowed_tabs" | "edit_tabs", tab: string) => {
    const cur = String(m[field] || "").split(",").filter(Boolean);
    const next = cur.includes(tab) ? cur.filter(t => t !== tab) : [...cur, tab];
    // ویرایش بدون دیدن معنا ندارد: با فعال شدن ویرایش، دیدن هم فعال شود
    const p: any = { [field]: next.join(",") };
    if (field === "edit_tabs" && next.includes(tab)) {
      const v = String(m.allowed_tabs || "").split(",").filter(Boolean);
      if (!v.includes(tab)) p.allowed_tabs = [...v, tab].join(",");
    }
    const label = KIND_TABS.find(t => t[0] === tab)?.[1] || tab;
    patch(m, p, `${field === "edit_tabs" ? "ویرایش" : "دیدن"} «${label}» ${next.includes(tab) ? "فعال" : "غیرفعال"} شد`);
  };

  const memberName = (uid: string | null) => members.find(m => m.user_id === uid)?.profiles?.full_name || "—";

  const PermGrid = ({ v = [], e = [], onV, onE }: any) => (
    <div className="overflow-auto rounded-lg border border-line">
      <table className="w-full">
        <thead className="bg-surface">
          <tr><th className="th">بخش</th><th className="th text-center">دیدن</th><th className="th text-center">ویرایش</th></tr>
        </thead>
        <tbody>
          {KIND_TABS.map(([k, l]) => (
            <tr key={k}>
              <td className="td">{l}</td>
              <td className="td text-center"><input type="checkbox" checked={(v || []).includes(k)} onChange={() => onV(k)} /></td>
              <td className="td text-center"><input type="checkbox" checked={(e || []).includes(k)} onChange={() => onE(k)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const memPdf = () => {
    const labels = Object.fromEntries(KIND_TABS);
    printPdf("گزارش اعضا و دسترسی‌ها", "ماتریس دسترسی هر عضو به بخش‌های پروژه",
      kpis([["اعضای پروژه", faN(members.length)], ["بخش‌های قابل تنظیم", faN(KIND_TABS.length)]]) +
      "<h2>اعضا</h2>" + tbl(["نام", "نقش در پروژه", "مدیر مستقیم", "دسترسی دیدن", "دسترسی ویرایش"],
        members.map((m: any) => [
          m.profiles?.full_name || "—", ROLES[m.member_role] || m.member_role,
          members.find((x: any) => x.user_id === m.manager_id)?.profiles?.full_name || "—",
          m.allowed_tabs ? String(m.allowed_tabs).split(",").map((t: string) => labels[t.trim()] || t).join("، ") : "پیش‌فرض نقش",
          m.edit_tabs ? String(m.edit_tabs).split(",").map((t: string) => labels[t.trim()] || t).join("، ") : "پیش‌فرض نقش",
        ])));
  };

  return (
    <div className="space-y-3">
      <div className="card py-2 flex justify-end"><button className="btn-ghost py-1 text-xs" onClick={memPdf}>خروجی PDF</button></div>
      {canManage && (
        <div className="card space-y-3">
          <h2 className="font-black">افزودن عضو به این پروژه</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <div>
              <label className="label">نام عضو (تایپ کنید)</label>
              <input className="input" list="all-users" placeholder="نام و نام خانوادگی…"
                value={name} onChange={e => setName(e.target.value)} />
              <datalist id="all-users">
                {users.map(u => <option key={u.id} value={u.full_name} />)}
              </datalist>
            </div>
            <div>
              <label className="label">نقش در پروژه</label>
              <select className="input" value={role} onChange={e => onRoleChange(e.target.value)}>
                {Object.entries(ROLES).filter(([k]) => k !== "admin").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">مسئول این عضو</label>
              <select className="input" value={managerId} onChange={e => setManagerId(e.target.value)}>
                <option value="">—</option>
                {members.map((m: any) => <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name}</option>)}
              </select>
            </div>
            <div className="flex items-end"><button className="btn-primary w-full justify-center" onClick={add}>افزودن عضو</button></div>
          </div>
          <div>
            <label className="label">دسترسی‌های این عضو (با تیک زدن، اجازه دیدن یا ویرایش هر بخش را بدهید)</label>
            <PermGrid v={view} e={edit}
              onV={(t: string) => toggle(view, setView, t)}
              onE={(t: string) => { toggle(edit, setEdit, t); if (!edit.includes(t) && !view.includes(t)) setView([...view, t]); }} />
          </div>
          <p className="text-[11px] text-ink/40">اعضای هر پروژه مستقل از پروژه‌های دیگر است؛ کاربری که فقط عضو یک پروژه باشد، تنها همان پروژه را می‌بیند.</p>
        </div>
      )}

      <div className="card overflow-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">نام</th><th className="th">نقش در پروژه</th><th className="th">مسئول عضو</th>
              <th className="th">دسترسی‌ها</th>{canManage && <th className="th"></th>}
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const v = String(m.allowed_tabs || "").split(",").filter(Boolean);
              const e = String(m.edit_tabs || "").split(",").filter(Boolean);
              const managerRole = ["admin", "pm", "investor", "ceo", "board_member", "factory_manager", "plant_manager"].includes(m.profiles?.role);
              const isEditing = editing === m.id;
              return (
                <tr key={m.id} className="align-top">
                  <td className="td font-bold">{m.profiles?.full_name}</td>
                  <td className="td">{ROLES[m.member_role] || m.member_role}</td>
                  <td className="td">
                    {canManage ? (
                      <select className="input w-40 py-1" value={m.manager_id || ""}
                        onChange={ev => patch(m, { manager_id: ev.target.value || null }, "مسئول عضو تغییر کرد")}>
                        <option value="">—</option>
                        {members.filter(x => x.user_id !== m.user_id)
                          .map(x => <option key={x.user_id} value={x.user_id}>{x.profiles?.full_name}</option>)}
                      </select>
                    ) : memberName(m.manager_id)}
                  </td>
                  <td className="td">
                    {managerRole ? (
                      <span className="chip bg-ok/10 text-ok">دسترسی کامل (نقش مدیریتی)</span>
                    ) : canManage ? (
                      <>
                        <button className="text-xs text-blueprint" onClick={() => setEditing(isEditing ? null : m.id)}>
                          دیدن: {v.length.toLocaleString("fa-IR")} · ویرایش: {e.length.toLocaleString("fa-IR")} — {isEditing ? "بستن" : "ویرایش دسترسی‌ها"}
                        </button>
                        {isEditing && (
                          <div className="mt-2 w-72">
                            <PermGrid v={v} e={e}
                              onV={(t: string) => toggleRowTab(m, "allowed_tabs", t)}
                              onE={(t: string) => toggleRowTab(m, "edit_tabs", t)} />
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-ink/50">دیدن: {v.length.toLocaleString("fa-IR")} بخش</span>
                    )}
                  </td>
                  {canManage && <td className="td"><button className="text-xs text-danger" onClick={() => remove(m)}>حذف</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
