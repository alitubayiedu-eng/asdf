"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const t = (localStorage.getItem("dap-theme") as any) || "light";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  const toggle = () => {
    const t = theme === "light" ? "dark" : "light";
    setTheme(t);
    localStorage.setItem("dap-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <button onClick={toggle} title="تغییر تم روشن / تاریک"
      className="rounded-xl border border-line bg-card px-3 py-1.5 text-sm">
      {theme === "light" ? "🌙 تاریک" : "☀️ روشن"}
    </button>
  );
}
