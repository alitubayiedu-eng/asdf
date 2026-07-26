"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Profile = { id: string; full_name: string; role: string; email?: string };

export function useSession() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
      setProfile(p ? { ...p, email: data.user.email } : null);
      setLoading(false);
    });
  }, []);
  return { profile, loading };
}
