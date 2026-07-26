"use client";
import { supabase } from "./supabase";

// ثبت رخداد در گزارش تغییرات پروژه
export async function logAction(projectId: string, userId: string, action: string, detail = "") {
  try {
    await supabase.from("activity_log").insert({ project_id: projectId, user_id: userId, action, detail });
  } catch { /* لاگ نباید جریان کار را متوقف کند */ }
}
