"use client";
/**
 * تبدیل اعداد فارسی/عربی به لاتین و خواندن امن مقدار عددی
 * ۱۵۰ → 150   |   ۱٬۲۵۰٫۵ → 1250.5   |   "1,250" → 1250
 */
const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";

/** همه ارقام فارسی/عربی، جداکننده‌ها و ممیز فارسی را به شکل استاندارد درمی‌آورد */
export function normalizeDigits(input: any): string {
  if (input == null) return "";
  let s = String(input);
  let out = "";
  for (const ch of s) {
    const f = FA.indexOf(ch);
    if (f > -1) { out += f; continue; }
    const a = AR.indexOf(ch);
    if (a > -1) { out += a; continue; }
    out += ch;
  }
  return out
    .replace(/٫/g, ".")            // ممیز فارسی
    .replace(/[٬،]/g, "")          // جداکننده هزارگان فارسی
    .replace(/,/g, "")             // جداکننده لاتین
    .replace(/\u200c|\u200f|\u200e/g, "") // نیم‌فاصله و کاراکترهای جهت
    .trim();
}

/** جایگزین امن Number() — اعداد فارسی را هم می‌فهمد و هرگز NaN برنمی‌گرداند */
export function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(normalizeDigits(v));
  return isNaN(n) ? 0 : n;
}

/** مثل num ولی برای وقتی که «خالی» با «صفر» فرق دارد */
export function numOrNull(v: any): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(normalizeDigits(v));
  return isNaN(n) ? null : n;
}
