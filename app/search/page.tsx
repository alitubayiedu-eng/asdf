"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { accessibleProjects, kindMeta } from "@/lib/scope";
import { normalizeDigits } from "@/lib/num";
import { fmt, fmtDate } from "@/lib/constants";

type Hit = {
  group: string; icon: string; title: string; sub: string;
  projectId: string; projectName: string; kind: string; tab?: string;
};

// جدول، تب مقصد، برچسب، نماد، و فیلدهای متنی قابل‌جستجو + سازنده عنوان/زیرعنوان
const SOURCES: {
  table: string; tab?: string; group: string; icon: string;
  fields: string[]; title: (r: any) => string; sub: (r: any) => string;
}[] = [
  { table: "contracts", tab: "contracts", group: "قراردادها", icon: "📄",
    fields: ["title", "contractor", "cbs_code"],
    title: r => r.title || "قرارداد", sub: r => `پیمانکار: ${r.contractor || "—"} · مبلغ ${fmt(r.amount)} ریال` },
  { table: "progress_claims", tab: "contracts", group: "صورت‌وضعیت‌ها", icon: "🧾",
    fields: ["contract_title", "no", "period", "created_by_name"],
    title: r => `صورت‌وضعیت ${r.no || ""} — ${r.contract_title || ""}`, sub: r => `دوره ${r.period || "—"} · خالص ${fmt(r.net_amount)} ریال` },
  { table: "transactions", tab: "accounting", group: "اسناد مالی", icon: "💳",
    fields: ["counterparty", "description", "cbs_code"],
    title: r => `${r.description || r.counterparty || "سند مالی"}`, sub: r => `${fmt(r.amount)} ریال · ${fmtDate(r.txn_date)}${r.cbs_code ? " · کد " + r.cbs_code : ""}` },
  { table: "cbs_items", tab: "cbs", group: "ساختار هزینه (CBS)", icon: "🧱",
    fields: ["cost_code", "item_name", "activity", "category", "phase_name"],
    title: r => `${r.cost_code} — ${r.item_name || r.activity || ""}`, sub: r => `${r.category || ""} · ${r.phase_name || ""}` },
  { table: "vendors", tab: "procurement", group: "تامین‌کنندگان", icon: "🏢",
    fields: ["name", "field", "phone"],
    title: r => r.name, sub: r => `${r.field || "—"}${r.is_global ? " · سراسری هلدینگ" : ""}` },
  { table: "purchase_orders", tab: "procurement", group: "سفارش‌های خرید", icon: "🛒",
    fields: ["item", "vendor_name"],
    title: r => r.item || "سفارش خرید", sub: r => `${r.vendor_name || "—"} · ${fmt(r.qty)} ${r.unit || ""}` },
  { table: "purchase_requests", tab: "procurement", group: "درخواست‌های خرید", icon: "📝",
    fields: ["item", "requester_name", "note"],
    title: r => r.item || "درخواست خرید", sub: r => `${r.requester_name || "—"} · وضعیت ${r.status}` },
  { table: "warehouse_items", tab: "warehouse", group: "اقلام انبار", icon: "📦",
    fields: ["name", "category", "unit"],
    title: r => r.name, sub: r => `${r.category || ""} · واحد ${r.unit || "—"}` },
  { table: "personnel", tab: "hr", group: "پرسنل", icon: "👷",
    fields: ["name", "role", "phone"],
    title: r => r.name, sub: r => `${r.role || "—"} · شیفت ${r.shift || "—"}` },
  { table: "letters", tab: "comms", group: "مکاتبات", icon: "✉️",
    fields: ["subject", "party", "no"],
    title: r => r.subject, sub: r => `${r.direction === "in" ? "وارده" : "صادره"} · ${r.party || "—"} · ${r.no || ""}` },
  { table: "rfis", tab: "comms", group: "درخواست اطلاعات (RFI)", icon: "❓",
    fields: ["subject", "question", "no", "to_party"],
    title: r => r.subject, sub: r => `${r.no || ""} · ${r.status === "answered" ? "پاسخ‌داده‌شده" : "باز"}` },
  { table: "meetings", tab: "comms", group: "جلسات", icon: "🗓",
    fields: ["title", "attendees", "minutes"],
    title: r => r.title, sub: r => `${fmtDate(r.meet_date)} · ${r.attendees || ""}` },
  { table: "quality_records", tab: "quality", group: "کیفیت و HSE", icon: "⚠️",
    fields: ["title", "location", "description"],
    title: r => r.title, sub: r => `${r.location || ""} · شدت ${r.severity || "—"} · ${r.status === "open" ? "باز" : "بسته"}` },
  { table: "tasks", tab: "plan", group: "فعالیت‌ها", icon: "✅",
    fields: ["title", "description"],
    title: r => r.title, sub: r => `سررسید ${fmtDate(r.due_date)} · ${r.status}` },
  { table: "customers", tab: "sales", group: "مشتریان", icon: "🤝",
    fields: ["name", "city", "phone"],
    title: r => r.name, sub: r => `${r.city || "—"}` },
  { table: "sales_orders", tab: "sales", group: "سفارش‌های فروش", icon: "📈",
    fields: ["customer_name", "product_name"],
    title: r => `${r.product_name || ""} — ${r.customer_name || ""}`, sub: r => `${fmt(r.qty)} × ${fmt(r.unit_price)} ریال` },
  { table: "products", tab: "production", group: "محصولات", icon: "🏭",
    fields: ["name", "unit"],
    title: r => r.name, sub: r => `قیمت فروش ${fmt(r.sale_price)} ریال/${r.unit || ""}` },
  { table: "machines", tab: "maintenance", group: "ماشین‌آلات", icon: "⚙️",
    fields: ["name", "code", "location"],
    title: r => r.name, sub: r => `${r.code || ""} · ${r.location || ""}` },
  { table: "solar_sales", tab: "solarsales", group: "فروش برق", icon: "🔌",
    fields: ["buyer", "contract_no", "note"],
    title: r => `${r.buyer || "فروش برق"} — ${fmt(r.kwh)} kWh`, sub: r => `${fmt(r.total)} ریال · ${fmtDate(r.sale_date)}` },
  { table: "solar_faults", tab: "faults", group: "خرابی نیروگاه", icon: "🔧",
    fields: ["kind", "description", "inverter_name"],
    title: r => `${r.inverter_name || ""} — ${r.kind || "خرابی"}`, sub: r => `${r.status === "open" ? "باز" : "بسته"} · افت ${fmt(r.lost_kwh)} kWh` },
];

const norm = (s: any) => normalizeDigits(String(s ?? "")).toLowerCase();

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { profile } = useSession();
  const q = sp.get("q") || "";
  const [term, setTerm] = useState(q);
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);

  useEffect(() => { setTerm(q); }, [q]);

  useEffect(() => {
    if (!profile || !q.trim()) { setHits([]); setRan(!!q.trim()); return; }
    let alive = true;
    (async () => {
      setBusy(true);
      const projects = await accessibleProjects(profile);
      const pmap: Record<string, any> = Object.fromEntries(projects.map(p => [p.id, p]));
      const ids = projects.map(p => p.id);
      const nq = norm(q);
      const out: Hit[] = [];

      // پروژه‌ها را هم جستجو کن
      for (const p of projects) {
        if ([p.name, p.code, p.location].some(v => norm(v).includes(nq)))
          out.push({ group: "پروژه‌ها", icon: kindMeta(p.kind).icon, title: p.name, sub: `${kindMeta(p.kind).label} · ${p.location || ""}`, projectId: p.id, projectName: p.name, kind: p.kind });
      }

      if (ids.length) {
        const results = await Promise.all(SOURCES.map(async s => {
          // تامین‌کننده سراسری project_id ندارد؛ جداگانه هم می‌خوانیم
          const { data } = await supabase.from(s.table).select("*").in("project_id", ids).limit(3000);
          const rows = Array.isArray(data) ? data : [];
          return { s, rows };
        }));
        for (const { s, rows } of results) {
          for (const r of rows) {
            if (!s.fields.some(f => norm(r[f]).includes(nq))) continue;
            const p = pmap[r.project_id]; if (!p) continue;
            out.push({ group: s.group, icon: s.icon, title: s.title(r), sub: s.sub(r), projectId: p.id, projectName: p.name, kind: p.kind, tab: s.tab });
          }
        }
        // تامین‌کننده سراسری هلدینگ (بدون پروژه)
        const { data: gv } = await supabase.from("vendors").select("*").eq("is_global", true).limit(2000);
        for (const r of (gv || [])) {
          if (![r.name, r.field, r.phone].some(v => norm(v).includes(nq))) continue;
          if (out.some(h => h.group === "تامین‌کنندگان" && h.title === r.name)) continue;
          out.push({ group: "تامین‌کنندگان", icon: "🏢", title: r.name, sub: `${r.field || "—"} · سراسری هلدینگ`, projectId: "", projectName: "هلدینگ", kind: "construction", tab: "procurement" });
        }
      }
      if (alive) { setHits(out); setRan(true); setBusy(false); }
    })();
    return () => { alive = false; };
  }, [profile, q]);

  const grouped = useMemo(() => {
    const m: Record<string, Hit[]> = {};
    for (const h of hits) (m[h.group] ||= []).push(h);
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [hits]);

  const submit = (e: React.FormEvent) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(term.trim())}`); };
  const linkOf = (h: Hit) => h.projectId ? `/project?id=${h.projectId}${h.tab ? `&tab=${h.tab}` : ""}` : "/projects?kind=construction";

  return (
    <Shell>
      <h1 className="mb-3 text-xl font-black">جستجوی سراسری هلدینگ</h1>
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input autoFocus className="input flex-1" placeholder="نام پیمانکار، کد هزینه، طرف حساب، قطعه، پرسنل…"
          value={term} onChange={e => setTerm(e.target.value)} />
        <button className="btn-primary" type="submit">جستجو</button>
      </form>

      {busy && <p className="text-sm text-ink/50">در حال جستجو در همه پروژه‌ها…</p>}
      {!busy && ran && hits.length === 0 && (
        <p className="card text-sm text-ink/50">نتیجه‌ای برای «{q}» یافت نشد. املا یا نیم‌فاصله را بررسی کنید.</p>
      )}
      {!busy && hits.length > 0 && (
        <>
          <p className="mb-3 text-xs text-ink/50">{fmt(hits.length)} نتیجه در {fmt(grouped.length)} دسته</p>
          <div className="space-y-4">
            {grouped.map(([group, list]) => (
              <div key={group} className="card p-0 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 text-sm font-black">
                  <span>{list[0].icon}</span><span>{group}</span>
                  <span className="chip mr-auto bg-primary/10 text-primary">{fmt(list.length)}</span>
                </div>
                <div className="divide-y divide-line">
                  {list.slice(0, 40).map((h, i) => (
                    <Link key={i} href={linkOf(h)} className="flex items-start gap-3 px-3 py-2 text-sm hover:bg-surface">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{h.title}</div>
                        <div className="truncate text-xs text-ink/55">{h.sub}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-blueprint">{kindMeta(h.kind).icon} {h.projectName} ←</span>
                    </Link>
                  ))}
                  {list.length > 40 && <div className="px-3 py-2 text-[11px] text-ink/40">و {fmt(list.length - 40)} نتیجه دیگر…</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

export default function SearchPage() {
  return <Suspense fallback={null}><SearchInner /></Suspense>;
}
