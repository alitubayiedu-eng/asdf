"use client";
import { fmtJalali } from "./jalali";
import { num } from "./num";

export type Clause = { no: string; title: string; body: string };
export type Template = { id: string; cat: string; name: string; title: string; clauses: Clause[]; vars: string[] };

let cache: Template[] | null = null;

/** بارگذاری قالب‌ها — فقط یک بار و فقط هنگام باز شدن کتابخانه */
export async function loadTemplates(): Promise<Template[]> {
  if (cache) return cache;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const r = await fetch(`${base}/contract-templates.json`);
  cache = await r.json();
  return cache!;
}

/** برچسب فارسی هر متغیر برای نمایش در فرم */
export const VAR_LABELS: Record<string, string> = {
  کارفرما: "نام کارفرما",
  پیمانکار: "نام پیمانکار",
  درصد_پیش_پرداخت: "٪ پیش‌پرداخت",
  درصد_حسن_انجام: "٪ حسن انجام کار",
  نماینده: "نماینده / مدیرعامل",
  نشانی: "نشانی",
  تلفن: "تلفن",
  شماره_ملی: "شماره ملی / شناسنامه",
  شماره_ثبت: "شماره ثبت",
  نام_پدر: "نام پدر",
  محل_صدور: "محل صدور",
  شهر: "شهر انعقاد",
  محل_اجرا: "محل اجرای کار",
  موضوع_قرارداد: "موضوع قرارداد",
  تاریخ_قرارداد: "تاریخ قرارداد",
  تاریخ_شروع: "تاریخ شروع",
  تاریخ_پایان: "تاریخ پایان",
  مدت_قرارداد: "مدت قرارداد",
  مبلغ_قرارداد: "مبلغ قرارداد (ریال)",
  مبلغ_حروف: "مبلغ به حروف",
  فی_واحد: "فی واحد",
  تعداد_ماده: "تعداد مواد قرارداد",
};

/** متغیرهایی که خودکار از مشخصات قرارداد پر می‌شوند */
export const AUTO_VARS = [
  "کارفرما", "پیمانکار", "تاریخ_قرارداد", "تاریخ_شروع", "تاریخ_پایان",
  "مدت_قرارداد", "مبلغ_قرارداد", "مبلغ_حروف", "محل_اجرا",
  "درصد_پیش_پرداخت", "درصد_حسن_انجام",
];

const fa = (n: any) => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/** ۱۲۵۰۰۰۰ → «یک میلیون و دویست و پنجاه هزار» */
export function numToWords(n: number): string {
  if (!n || n < 0) return "";
  const yek = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const dah = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const yaz = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const sad = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const scale = ["", " هزار", " میلیون", " میلیارد", " بیلیون"];

  const three = (x: number): string => {
    const p: string[] = [];
    const s = Math.floor(x / 100), r = x % 100;
    if (s) p.push(sad[s]);
    if (r >= 10 && r < 20) p.push(yaz[r - 10]);
    else {
      const d = Math.floor(r / 10), y = r % 10;
      if (d) p.push(dah[d]);
      if (y) p.push(yek[y]);
    }
    return p.join(" و ");
  };

  const parts: string[] = [];
  let i = 0;
  while (n > 0) {
    const g = n % 1000;
    if (g) parts.unshift(three(g) + scale[i]);
    n = Math.floor(n / 1000); i++;
  }
  return parts.join(" و ");
}

/** مقادیر خودکار از روی مشخصات قرارداد ثبت‌شده در پلتفرم */
export function autoValues(c: any, projectName?: string): Record<string, string> {
  const days = c.start_date && c.end_date
    ? Math.round((+new Date(c.end_date) - +new Date(c.start_date)) / 86400000) : 0;
  const amount = num(c.amount);   // اعداد فارسی را هم می‌فهمد
  return {
    کارفرما: "Different Agency Platform",
    پیمانکار: c.contractor || "",
    محل_اجرا: projectName || "",
    درصد_پیش_پرداخت: c.advance_pct ? fa(num(c.advance_pct)) : "",
    درصد_حسن_انجام: c.retention_pct ? fa(num(c.retention_pct)) : "",
    تاریخ_قرارداد: fmtJalali(c.start_date || new Date().toISOString()),
    تاریخ_شروع: fmtJalali(c.start_date),
    تاریخ_پایان: fmtJalali(c.end_date),
    مدت_قرارداد: days ? `${fa(days)} روز` : "",
    مبلغ_قرارداد: amount ? fa(amount.toLocaleString("en-US")) : "",
    مبلغ_حروف: amount ? numToWords(amount) + " ریال" : "",
  };
}

/** جایگزینی {{متغیر}} با مقدار؛ متغیر بدون مقدار به شکل نقطه‌چین باقی می‌ماند */
export function fillVars(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, k) => {
    const v = values[k.trim()];
    return v && String(v).trim() ? String(v) : "………";
  });
}

/** ساخت متن نهایی قرارداد از بندهای انتخاب‌شده */
export function renderContract(title: string, clauses: Clause[], values: Record<string, string>): string {
  const out: string[] = [];
  if (title) out.push(fillVars(title, values), "");
  clauses.forEach((c, i) => {
    const head = `ماده ${fa(i + 1)}${c.title ? " — " + fillVars(c.title, values) : ""}`;
    out.push(head);
    if (c.body?.trim()) out.push(fillVars(c.body, values));
    out.push("");
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** استخراج متغیرهای موجود در مجموعه‌ای از بندها */
export function varsOf(clauses: Clause[]): string[] {
  const s = new Set<string>();
  for (const c of clauses) {
    for (const m of `${c.title}\n${c.body}`.matchAll(/\{\{([^}]+)\}\}/g)) s.add(m[1].trim());
  }
  return [...s];
}
