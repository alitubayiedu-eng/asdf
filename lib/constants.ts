export const ROLES: Record<string, string> = {
  // — رهبری و هلدینگ —
  admin: "مدیر سیستم",
  ceo: "مدیرعامل هلدینگ",
  board_member: "عضو هیئت‌مدیره",
  investor: "سرمایه‌گذار اصلی",
  // — مدیریت واحد/پروژه —
  pm: "مدیر پروژه (عمران)",
  factory_manager: "مدیر کارخانه",
  plant_manager: "مدیر نیروگاه",
  // — مالی و بازرگانی —
  finance_manager: "مدیر مالی",
  accountant: "حسابدار",
  treasurer: "خزانه‌دار",
  commerce: "بازرگانی و تدارکات",
  sales_manager: "مدیر فروش",
  sales_expert: "کارشناس فروش (CRM)",
  // — فنی و اجرا (عمران) —
  chief_engineer: "مهندس ارشد",
  site_manager: "مدیر کارگاه",
  supervisor: "ناظر",
  phase_engineer: "مهندس فاز / اجرا",
  hse_officer: "کارشناس ایمنی و HSE",
  // — بهره‌برداری کارخانه —
  production_manager: "مدیر تولید",
  production_operator: "اپراتور تولید",
  qc_manager: "مدیر کنترل کیفیت",
  maintenance_manager: "مدیر نگهداری و تعمیرات",
  warehouse_keeper: "انباردار",
  // — بهره‌برداری نیروگاه —
  om_technician: "تکنسین بهره‌برداری (O&M)",
  energy_trader: "کارشناس فروش انرژی/بورس",
  // — پشتیبانی —
  hr_manager: "مدیر منابع انسانی",
};
// نقش‌های رهبری هلدینگ — فقط مدیر سیستم می‌سازد/تغییر می‌دهد
export const ADMIN_ONLY_ROLES = ["admin", "investor", "ceo", "board_member"];

// نقش‌هایی که همه‌ی پروژه‌ها را می‌بینند (بدون نیاز به عضویت)
export const GLOBAL_VIEW_ROLES = ["admin", "pm", "investor", "ceo", "board_member"];

// نقش‌هایی که داخل پروژه به همه‌ی تب‌ها دسترسی کامل دارند
export const FULL_ACCESS_ROLES = ["admin", "pm", "investor", "ceo", "board_member", "factory_manager", "plant_manager"];

// نقش‌هایی که پروژه می‌سازند و اعضا را مدیریت می‌کنند
export const MANAGER_ROLES = ["admin", "pm", "ceo", "chief_engineer", "factory_manager", "plant_manager"];

// نگاشت نقش‌های جدید به پروفایل دسترسی مشابه (پیش‌فرض تب‌ها در هر سه نوع پروژه)
export const ROLE_ACCESS_ALIAS: Record<string, string> = {
  treasurer: "finance_manager", energy_trader: "finance_manager",
  sales_manager: "commerce", sales_expert: "commerce", warehouse_keeper: "commerce",
  site_manager: "chief_engineer", supervisor: "chief_engineer", phase_engineer: "chief_engineer",
  hse_officer: "chief_engineer", production_manager: "chief_engineer", production_operator: "chief_engineer",
  qc_manager: "chief_engineer", maintenance_manager: "chief_engineer", om_technician: "chief_engineer",
  hr_manager: "chief_engineer",
};

export const DEFAULT_PHASES = [
  "فاز ۰۱ - تملک زمین","فاز ۰۲ - طراحی و مهندسی","فاز ۰۳ - مجوزها و پروانه‌ها",
  "فاز ۰۴ - تجهیز کارگاه","فاز ۰۵ - آماده‌سازی سایت","فاز ۰۶ - فونداسیون",
  "فاز ۰۷ - اسکلت و سازه","فاز ۰۸ - سفت‌کاری","فاز ۰۹ - نما","فاز ۱۰ - در و پنجره",
  "فاز ۱۱ - تاسیسات مکانیکی","فاز ۱۲ - تاسیسات برقی و جریان ضعیف",
  "فاز ۱۳ - اطفاء حریق، آسانسور و هوشمندسازی","فاز ۱۴ - نازک‌کاری داخلی",
  "فاز ۱۵ - محوطه‌سازی و کارهای خارجی","فاز ۱۶ - راه‌اندازی، تحویل و دوره تضمین",
  "فاز ۱۷ - هزینه‌های بالاسری، مالی و پنهان",
];

export const TASK_STATUS: Record<string, string> = {
  todo: "برنامه‌ریزی‌شده", doing: "در حال اجرا", blocked: "متوقف", done: "تکمیل‌شده",
};
export const TXN_TYPES: Record<string, string> = {
  receipt: "دریافت", payment: "پرداخت", expense: "هزینه", income: "درآمد",
};
export const ACCOUNT_KINDS: Record<string, string> = {
  bank: "بانک", cash: "صندوق / تنخواه", payable: "بستانکاران (پرداختنی)",
  receivable: "بدهکاران (دریافتنی)", expense: "هزینه", income: "درآمد",
};

export const fmt = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "—" : Number(n).toLocaleString("fa-IR");
// نمایش تاریخ همیشه شمسی — با تبدیل قطعی، نه وابسته به تنظیمات مرورگر
export { fmtJalali as fmtDate } from "./jalali";

export const FILE_CATEGORIES = ["نقشه معماری", "نقشه سازه", "نقشه تاسیسات", "رندر سه‌بعدی", "عکس کارگاه", "سایر مدارک"];

export const PROJECT_TABS: [string, string][] = [
  ["plan", "برنامه زمانی"], ["cbs", "ساختار هزینه (CBS)"], ["analysis", "تحلیل هزینه"],
  ["contracts", "قراردادها و صورت‌وضعیت"], ["procurement", "تدارکات و خرید"],
  ["warehouse", "انبارداری"], ["accounting", "حسابداری"], ["cheques", "دفتر چک"],
  ["site", "کارگاه"], ["quality", "کیفیت و HSE"],
  ["architecture", "مدارک و نقشه‌ها"], ["comms", "جلسات و مکاتبات"],
  ["orders", "دستورها"], ["notes", "یادداشت‌ها"], ["shareholders", "گردش سهامداران"], ["health", "سلامت داده"], ["members", "اعضای پروژه"],
];

export const FACTORY_TABS: [string, string][] = [
  ["fdash", "داشبورد کارخانه"], ["production", "تولید"], ["maintenance", "نگهداری و تعمیرات (نت)"],
  ["qc", "کنترل کیفیت"], ["warehouse", "انبار"], ["sales", "فروش و مشتریان"], ["crm", "قیف فروش (CRM)"],
  ["invoices", "فاکتور و مطالبات"], ["costing", "بهای تمام‌شده"], ["energy", "انرژی و یوتیلیتی"], ["hr", "منابع انسانی"],
  ["procurement", "تدارکات و خرید"], ["accounting", "حسابداری"], ["cheques", "دفتر چک"], ["architecture", "مدارک"],
  ["comms", "جلسات و مکاتبات"], ["orders", "دستورها"], ["notes", "یادداشت‌ها"],
  ["shareholders", "گردش سهامداران"], ["health", "سلامت داده"], ["members", "اعضای پروژه"],
];

export const SOLAR_TABS: [string, string][] = [
  ["sdash", "داشبورد نیروگاه"], ["generation", "تولید برق"], ["assets", "پنل‌ها و اینورترها"],
  ["solarsales", "فروش و بورس انرژی"], ["cleaning", "شست‌وشو و نظافت"], ["faults", "خرابی و آلارم"],
  ["site", "گزارش روزانه"], ["maintenance", "نگهداری و تعمیرات"], ["warehouse", "انبار قطعات"],
  ["hr", "نیروی انسانی"], ["procurement", "تدارکات و خرید"], ["accounting", "حسابداری"], ["cheques", "دفتر چک"],
  ["architecture", "مدارک و نقشه‌ها"], ["comms", "جلسات و مکاتبات"], ["orders", "دستورها"],
  ["notes", "یادداشت‌ها"], ["shareholders", "گردش سهامداران"], ["health", "سلامت داده"], ["members", "اعضای پروژه"],
];

export const CHP_TABS: [string, string][] = [
  ["cdash", "داشبورد سیکل ترکیبی"], ["chpgen", "تولید برق و حرارت"], ["chpunits", "ژنراتورها و تجهیزات"],
  ["chpsales", "فروش برق و حرارت"], ["chpcontracts", "قراردادهای فروش"], ["chpservice", "سرویس و محیط‌زیست"], ["chpfaults", "خرابی و نگهداری"],
  ["warehouse", "انبار قطعات"], ["hr", "نیروی انسانی"], ["procurement", "تدارکات و خرید"],
  ["accounting", "حسابداری"], ["cheques", "دفتر چک"], ["architecture", "مدارک و نقشه‌ها"],
  ["comms", "جلسات و مکاتبات"], ["orders", "دستورها"], ["notes", "یادداشت‌ها"],
  ["shareholders", "گردش سهامداران"], ["health", "سلامت داده"], ["members", "اعضای پروژه"],
];

export const PROJECT_KINDS: Record<string, string> = {
  construction: "عمرانی", factory: "کارخانه", solar: "نیروگاه خورشیدی", chp: "نیروگاه سیکل ترکیبی",
};
export const tabsForKind = (kind: string): [string, string][] =>
  kind === "factory" ? FACTORY_TABS : kind === "solar" ? SOLAR_TABS : kind === "chp" ? CHP_TABS : PROJECT_TABS;

// دسترسی پیش‌فرض هر نقش (وقتی دسترسی سفارشی تعریف نشده باشد)
export const DEFAULT_TABS_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["plan", "cbs", "site", "quality", "architecture", "comms", "orders", "notes", "members"],
  finance_manager: ["cbs", "analysis", "contracts", "procurement", "warehouse", "accounting", "shareholders", "comms", "orders", "notes", "members"],
  accountant: ["cbs", "analysis", "contracts", "procurement", "warehouse", "accounting", "shareholders", "orders", "notes", "members"],
  commerce: ["contracts", "procurement", "warehouse", "comms", "orders", "notes", "members"],
};

export const DEFAULT_EDIT_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["plan", "site", "quality", "architecture", "orders", "notes"],
  finance_manager: ["accounting", "warehouse", "procurement", "contracts", "orders", "notes"],
  accountant: ["accounting", "warehouse", "procurement", "orders", "notes"],
  commerce: ["procurement", "orders", "notes"],
};

const FACTORY_VIEW_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["fdash", "production", "maintenance", "qc", "warehouse", "energy", "hr", "architecture", "orders", "notes", "members"],
  finance_manager: ["fdash", "warehouse", "sales", "crm", "costing", "accounting", "procurement", "shareholders", "comms", "orders", "notes", "members"],
  accountant: ["warehouse", "sales", "costing", "accounting", "procurement", "shareholders", "orders", "notes", "members"],
  commerce: ["fdash", "sales", "crm", "warehouse", "procurement", "comms", "orders", "notes", "members"],
};
const FACTORY_EDIT_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["production", "maintenance", "qc", "energy", "hr", "orders", "notes"],
  finance_manager: ["accounting", "warehouse", "sales", "costing", "procurement", "orders", "notes"],
  accountant: ["accounting", "warehouse", "procurement", "orders", "notes"],
  commerce: ["sales", "crm", "procurement", "orders", "notes"],
};
const SOLAR_VIEW_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["sdash", "generation", "assets", "cleaning", "faults", "site", "maintenance", "warehouse", "hr", "architecture", "orders", "notes", "members"],
  finance_manager: ["sdash", "generation", "solarsales", "accounting", "procurement", "warehouse", "shareholders", "comms", "orders", "notes", "members"],
  accountant: ["generation", "solarsales", "accounting", "procurement", "warehouse", "shareholders", "orders", "notes", "members"],
  commerce: ["sdash", "solarsales", "procurement", "warehouse", "comms", "orders", "notes", "members"],
};
const SOLAR_EDIT_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["generation", "assets", "cleaning", "faults", "site", "maintenance", "warehouse", "hr", "orders", "notes"],
  finance_manager: ["solarsales", "accounting", "procurement", "warehouse", "orders", "notes"],
  accountant: ["solarsales", "accounting", "procurement", "warehouse", "orders", "notes"],
  commerce: ["solarsales", "procurement", "orders", "notes"],
};
const SOLAR_DEFAULT_VIEW = ["sdash", "generation", "assets", "cleaning", "faults", "site", "orders", "notes", "members"];
const SOLAR_DEFAULT_EDIT = ["generation", "cleaning", "faults", "site", "orders", "notes"];

const CHP_VIEW_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["cdash", "chpgen", "chpunits", "chpfaults", "chpservice", "warehouse", "hr", "architecture", "orders", "notes", "members"],
  finance_manager: ["cdash", "chpsales", "chpcontracts", "accounting", "procurement", "warehouse", "shareholders", "comms", "orders", "notes", "members"],
  accountant: ["chpsales", "chpcontracts", "accounting", "procurement", "warehouse", "shareholders", "orders", "notes", "members"],
  commerce: ["cdash", "chpsales", "chpcontracts", "procurement", "warehouse", "comms", "orders", "notes", "members"],
};
const CHP_EDIT_BY_ROLE: Record<string, string[]> = {
  chief_engineer: ["chpgen", "chpunits", "chpfaults", "chpservice", "warehouse", "hr", "orders", "notes"],
  finance_manager: ["chpsales", "chpcontracts", "accounting", "procurement", "warehouse", "orders", "notes"],
  accountant: ["chpsales", "chpcontracts", "accounting", "procurement", "warehouse", "orders", "notes"],
  commerce: ["chpsales", "chpcontracts", "procurement", "orders", "notes"],
};
const CHP_DEFAULT_VIEW = ["cdash", "chpgen", "chpunits", "chpfaults", "chpservice", "orders", "notes", "members"];
const CHP_DEFAULT_EDIT = ["chpgen", "chpunits", "chpfaults", "chpservice", "orders", "notes"];

const FACTORY_DEFAULT_VIEW = ["production", "maintenance", "qc", "energy", "hr", "orders", "notes", "members"];
const FACTORY_DEFAULT_EDIT = ["production", "maintenance", "qc", "energy", "orders", "notes"];

// نقش‌های مالی به «فاکتور و مطالبات» (کارخانه) و «دفتر چک» (همه) دسترسی پیش‌فرض دارند
const FINANCE_ROLES = ["finance_manager", "accountant", "treasurer"];
function withFinance(list: string[], role: string, kind: string): string[] {
  if (!FINANCE_ROLES.includes(role)) return list;
  const extra = kind === "factory" ? ["invoices", "cheques"] : ["cheques"];
  return [...new Set([...list, ...extra])];
}

export function allowedTabs(role: string, member: any, kind = "construction"): string[] {
  if (FULL_ACCESS_ROLES.includes(role)) return tabsForKind(kind).map(t => t[0]);
  if (member?.allowed_tabs != null) {
    const list = String(member.allowed_tabs).split(",").map(s => s.trim()).filter(Boolean);
    if (list.length) return list;
  }
  const r = ROLE_ACCESS_ALIAS[role] || role;   // نقش‌های جدید از پروفایل مشابه ارث می‌برند
  if (kind === "factory") return withFinance(FACTORY_VIEW_BY_ROLE[r] || FACTORY_DEFAULT_VIEW, role, kind);
  if (kind === "solar") return withFinance(SOLAR_VIEW_BY_ROLE[r] || SOLAR_DEFAULT_VIEW, role, kind);
  if (kind === "chp") return withFinance(CHP_VIEW_BY_ROLE[r] || CHP_DEFAULT_VIEW, role, kind);
  return withFinance(DEFAULT_TABS_BY_ROLE[r] || ["plan", "orders", "notes"], role, kind);
}

export function editTabs(role: string, member: any, kind = "construction"): string[] {
  if (FULL_ACCESS_ROLES.includes(role)) return tabsForKind(kind).map(t => t[0]);
  if (member?.edit_tabs != null) {
    return String(member.edit_tabs).split(",").map(s => s.trim()).filter(Boolean);
  }
  const r = ROLE_ACCESS_ALIAS[role] || role;
  if (kind === "factory") return withFinance(FACTORY_EDIT_BY_ROLE[r] || FACTORY_DEFAULT_EDIT, role, kind);
  if (kind === "solar") return withFinance(SOLAR_EDIT_BY_ROLE[r] || SOLAR_DEFAULT_EDIT, role, kind);
  if (kind === "chp") return withFinance(CHP_EDIT_BY_ROLE[r] || CHP_DEFAULT_EDIT, role, kind);
  return withFinance(DEFAULT_EDIT_BY_ROLE[r] || [], role, kind);
}

export const CLAIM_STATUS: Record<string, string> = {
  draft: "پیش‌نویس", supervisor_ok: "تایید مهندس ارشد", approved: "تایید نهایی", rejected: "مردود",
};
export const QUALITY_KINDS: Record<string, string> = {
  inspection: "بازرسی / ITP", ncr: "عدم انطباق (NCR)", incident: "حادثه HSE",
  ptw: "پرمیت کار (PTW)", punch: "پانچ‌لیست",
};
export const daysBetween = (a?: string | null, b?: string | null) =>
  a && b ? Math.round((+new Date(b) - +new Date(a)) / 86400000) : 0;
