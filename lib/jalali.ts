"use client";
/**
 * تبدیل تاریخ شمسی ↔ میلادی (الگوریتم بیرشک)
 * قاعده کلی پلتفرم:
 *   • ذخیره در پایگاه‌داده: میلادی ISO (YYYY-MM-DD) — برای مرتب‌سازی، گانت و محاسبات
 *   • نمایش و ورود اطلاعات: همیشه شمسی
 */

export const FA_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const FA_DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const div = (a: number, b: number) => Math.floor(a / b);

/** میلادی → شمسی */
export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

/** شمسی → میلادی */
export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days = 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + 78 + jd
    + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

/** تعداد روزهای ماه شمسی */
export function jalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند: بررسی کبیسه بودن سال شمسی
  const [gy1, gm1, gd1] = toGregorian(jy + 1, 1, 1);
  const [gy0, gm0, gd0] = toGregorian(jy, 12, 1);
  const diff = (Date.UTC(gy1, gm1 - 1, gd1) - Date.UTC(gy0, gm0 - 1, gd0)) / 86400000;
  return diff;
}

/** ISO میلادی → شمسی با قالب دلخواه */
export function isoToJalali(iso?: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const dt = new Date(iso);
    if (isNaN(+dt)) return null;
    const [y, mo, d] = toJalali(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    return { y, m: mo, d };
  }
  const [y, mo, d] = toJalali(+m[1], +m[2], +m[3]);
  return { y, m: mo, d };
}

/** شمسی → ISO میلادی برای ذخیره در پایگاه‌داده */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

const fa = (n: number | string) => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);

/** ۱۴۰۵/۰۴/۲۶ */
export function fmtJalali(iso?: string | null): string {
  const j = isoToJalali(iso);
  if (!j) return "—";
  return `${fa(j.y)}/${fa(String(j.m).padStart(2, "0"))}/${fa(String(j.d).padStart(2, "0"))}`;
}

/** ۲۶ تیر ۱۴۰۵ */
export function fmtJalaliLong(iso?: string | null): string {
  const j = isoToJalali(iso);
  if (!j) return "—";
  return `${fa(j.d)} ${FA_MONTHS[j.m - 1]} ${fa(j.y)}`;
}

/** امروز به شمسی */
export function todayJalali(): { y: number; m: number; d: number } {
  const n = new Date();
  const [y, m, d] = toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
  return { y, m, d };
}

/** روز هفته اول ماه شمسی (۰ = شنبه) */
export function jalaliFirstWeekday(jy: number, jm: number): number {
  const [gy, gm, gd] = toGregorian(jy, jm, 1);
  const wd = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay(); // ۰=یکشنبه
  return (wd + 1) % 7; // ۰=شنبه
}

/** متن شمسی تایپ‌شده → ISO  (۱۴۰۵/۴/۲۶ یا ۱۴۰۵-۰۴-۲۶) */
export function parseJalaliInput(text: string): string | null {
  const s = String(text).replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  const m = s.match(/^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s*$/);
  if (!m) return null;
  const [jy, jm, jd] = [+m[1], +m[2], +m[3]];
  if (jm < 1 || jm > 12 || jd < 1 || jd > jalaliMonthDays(jy, jm)) return null;
  return jalaliToIso(jy, jm, jd);
}
