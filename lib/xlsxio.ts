"use client";
import * as XLSX from "xlsx";
import { supabase } from "./supabase";

export type Col = {
  key: string;
  label: string;
  type?: "text" | "num" | "date" | "month" | "list";
  opts?: Record<string, string>;   // برای ستون‌های کدی: مقدار ← برچسب فارسی
  fk?: { table: string; nameKey: string; idKey: string }; // نگاشت نام ← شناسه
  example?: any;
  req?: boolean;
};

export type TableDef = { title: string; cols: Col[]; defaults?: Record<string, any> };

const D = (s: string) => s; // خوانایی

export const TABLES: Record<string, TableDef> = {
  // ---------------- عمرانی ----------------
  phases: { title: "فازهای برنامه زمانی", cols: [
    { key: "name", label: "نام فاز", req: true, example: "فاز ۰۶ - فونداسیون" },
    { key: "start_date", label: "تاریخ شروع", type: "date", example: "2026-01-20" },
    { key: "end_date", label: "تاریخ پایان", type: "date", example: "2026-03-20" },
    { key: "baseline_start", label: "شروع مصوب", type: "date" },
    { key: "baseline_end", label: "پایان مصوب", type: "date" },
    { key: "progress", label: "پیشرفت (٪)", type: "num", example: 40 },
    { key: "sort", label: "ترتیب", type: "num", example: 6 },
  ], defaults: { status: "todo" } },

  contracts: { title: "قراردادها", cols: [
    { key: "title", label: "عنوان قرارداد", req: true, example: "پیمان اجرای اسکلت بتنی" },
    { key: "contractor", label: "پیمانکار", example: "شرکت سازه‌گستر" },
    { key: "amount", label: "مبلغ اولیه (ریال)", type: "num", example: 95000000000 },
    { key: "advance_pct", label: "٪ پیش‌پرداخت", type: "num", example: 10 },
    { key: "retention_pct", label: "٪ حسن انجام کار", type: "num", example: 10 },
    { key: "start_date", label: "تاریخ شروع", type: "date" },
    { key: "end_date", label: "تاریخ پایان", type: "date" },
    { key: "body", label: "متن قرارداد" },
  ], defaults: { status: "active" } },

  progress_claims: { title: "صورت‌وضعیت‌ها", cols: [
    { key: "contract_title", label: "قرارداد", req: true, fk: { table: "contracts", nameKey: "title", idKey: "contract_id" }, example: "پیمان اجرای اسکلت بتنی" },
    { key: "no", label: "شماره", example: "۳" },
    { key: "period", label: "دوره", example: "مهر ۱۴۰۵" },
    { key: "gross_amount", label: "کارکرد تجمعی", type: "num", example: 60000000000 },
    { key: "prev_amount", label: "کارکرد قبلی", type: "num", example: 38000000000 },
    { key: "period_amount", label: "کارکرد دوره", type: "num" },
    { key: "retention_deduct", label: "کسر حسن انجام", type: "num" },
    { key: "advance_deduct", label: "کسر پیش‌پرداخت", type: "num" },
    { key: "insurance_deduct", label: "کسر بیمه", type: "num" },
    { key: "net_amount", label: "خالص پرداختنی", type: "num" },
  ], defaults: { status: "draft" } },

  change_orders: { title: "دستور تغییرها", cols: [
    { key: "contract_title", label: "قرارداد", fk: { table: "contracts", nameKey: "title", idKey: "contract_id" } },
    { key: "title", label: "شرح تغییر", req: true, example: "افزایش ضخامت دیوار برشی" },
    { key: "amount_delta", label: "اثر مالی (±ریال)", type: "num", example: 3200000000 },
    { key: "days_delta", label: "اثر زمانی (±روز)", type: "num", example: 8 },
    { key: "reason", label: "دلیل" },
  ], defaults: { status: "approved" } },

  disputes: { title: "ادعاها", cols: [
    { key: "subject", label: "موضوع ادعا", req: true },
    { key: "party", label: "طرف ادعا" },
    { key: "amount", label: "مبلغ برآوردی", type: "num" },
    { key: "detail", label: "شرح" },
  ], defaults: { status: "open" } },

  vendors: { title: "تامین‌کنندگان", cols: [
    { key: "name", label: "نام تامین‌کننده", req: true, example: "فولاد صنعت همدان" },
    { key: "field", label: "زمینه فعالیت", example: "میلگرد و پروفیل" },
    { key: "phone", label: "تلفن", example: "081-34567890" },
    { key: "rating", label: "امتیاز (۱ تا ۵)", type: "num", example: 5 },
  ] },

  purchase_requests: { title: "درخواست‌های خرید", cols: [
    { key: "item", label: "کالا / خدمت", req: true, example: "سیمان تیپ ۲" },
    { key: "qty", label: "مقدار", type: "num", example: 500 },
    { key: "unit", label: "واحد", example: "کیسه" },
    { key: "needed_date", label: "تاریخ نیاز", type: "date" },
    { key: "note", label: "توضیح" },
    { key: "requester_name", label: "درخواست‌کننده" },
  ], defaults: { status: "open" } },

  purchase_orders: { title: "سفارش‌های خرید", cols: [
    { key: "item", label: "کالا", req: true },
    { key: "vendor_name", label: "تامین‌کننده", req: true },
    { key: "qty", label: "مقدار", type: "num" },
    { key: "unit", label: "واحد" },
    { key: "unit_price", label: "فی (ریال)", type: "num" },
    { key: "order_date", label: "تاریخ سفارش", type: "date" },
  ], defaults: { status: "ordered" } },

  warehouse_items: { title: "اقلام انبار", cols: [
    { key: "name", label: "نام کالا", req: true, example: "میلگرد ۱۶" },
    { key: "unit", label: "واحد", example: "کیلوگرم" },
    { key: "category", label: "دسته", example: "فولاد" },
    { key: "min_stock", label: "حداقل موجودی", type: "num", example: 500 },
    { key: "store_type", label: "انبار", type: "list",
      opts: { raw: "مواد اولیه", wip: "نیمه‌ساخته", finished: "محصول نهایی", "": "عمومی" }, example: "مواد اولیه" },
  ] },

  accounts: { title: "حساب‌ها", cols: [
    { key: "name", label: "نام حساب", req: true, example: "بانک ملت — جاری" },
    { key: "kind", label: "نوع", type: "list",
      opts: { bank: "بانکی", cash: "نقدی", partner: "شریک/سهامدار" }, example: "بانکی" },
  ] },

  transactions: { title: "اسناد مالی", cols: [
    { key: "txn_date", label: "تاریخ", type: "date", req: true, example: "2026-04-01" },
    { key: "account_name", label: "حساب", fk: { table: "accounts", nameKey: "name", idKey: "account_id" }, example: "بانک ملت — جاری" },
    { key: "type", label: "نوع", type: "list",
      opts: { receipt: "دریافت", payment: "پرداخت", income: "درآمد", expense: "هزینه" }, example: "پرداخت" },
    { key: "amount", label: "مبلغ (ریال)", type: "num", req: true, example: 250000000 },
    { key: "counterparty", label: "طرف حساب", example: "پیمانکار اسکلت" },
    { key: "description", label: "شرح" },
    { key: "cbs_code", label: "کد CBS" },
  ] },

  daily_reports: { title: "گزارش‌های روزانه کارگاه", cols: [
    { key: "report_date", label: "تاریخ", type: "date", req: true },
    { key: "weather", label: "آب و هوا", example: "آفتابی" },
    { key: "temp", label: "دما" },
    { key: "works", label: "کارهای انجام‌شده", req: true },
    { key: "blockers", label: "موانع و تاخیرها" },
    { key: "created_by_name", label: "ثبت‌کننده" },
  ] },

  timesheets: { title: "حضور و غیاب", cols: [
    { key: "person_name", label: "نام فرد", req: true },
    { key: "role", label: "رده شغلی" },
    { key: "work_date", label: "تاریخ", type: "date" },
    { key: "hours", label: "ساعت کار", type: "num", example: 8 },
    { key: "note", label: "توضیح" },
  ] },

  equipment: { title: "ماشین‌آلات کارگاه", cols: [
    { key: "name", label: "نام دستگاه", req: true },
    { key: "plate", label: "پلاک / سریال" },
    { key: "owner", label: "مالکیت", example: "استیجاری" },
  ], defaults: { status: "فعال" } },

  equipment_logs: { title: "کارکرد ماشین‌آلات", cols: [
    { key: "equipment_name", label: "دستگاه", req: true, fk: { table: "equipment", nameKey: "name", idKey: "equipment_id" } },
    { key: "log_date", label: "تاریخ", type: "date" },
    { key: "hours", label: "ساعت کارکرد", type: "num" },
    { key: "fuel", label: "سوخت (لیتر)", type: "num" },
    { key: "service_note", label: "یادداشت سرویس" },
  ] },

  quality_records: { title: "کیفیت و HSE", cols: [
    { key: "kind", label: "نوع", type: "list",
      opts: { inspection: "بازرسی / ITP", ncr: "عدم انطباق (NCR)", incident: "حادثه HSE", ptw: "پرمیت کار (PTW)", punch: "پانچ‌لیست" }, example: "عدم انطباق (NCR)" },
    { key: "title", label: "عنوان", req: true },
    { key: "location", label: "محل" },
    { key: "severity", label: "شدت", example: "متوسط" },
    { key: "description", label: "شرح" },
    { key: "due_date", label: "مهلت رفع", type: "date" },
    { key: "action", label: "اقدام اصلاحی" },
  ], defaults: { status: "open", photos: [] } },

  meetings: { title: "صورت‌جلسات", cols: [
    { key: "title", label: "عنوان جلسه", req: true },
    { key: "meet_date", label: "تاریخ", type: "date" },
    { key: "attendees", label: "حاضرین" },
    { key: "minutes", label: "خلاصه مذاکرات" },
  ], defaults: { resolutions: [] } },

  letters: { title: "مکاتبات", cols: [
    { key: "no", label: "شماره نامه" },
    { key: "direction", label: "نوع", type: "list", opts: { in: "وارده", out: "صادره" }, example: "صادره" },
    { key: "subject", label: "موضوع", req: true },
    { key: "party", label: "طرف مکاتبه" },
    { key: "letter_date", label: "تاریخ", type: "date" },
  ] },

  rfis: { title: "پرسش‌های فنی (RFI)", cols: [
    { key: "no", label: "شماره" },
    { key: "subject", label: "موضوع", req: true },
    { key: "question", label: "متن سوال" },
    { key: "answer", label: "پاسخ" },
    { key: "to_party", label: "مخاطب" },
    { key: "due_date", label: "مهلت پاسخ", type: "date" },
  ], defaults: { status: "open" } },

  shareholders: { title: "سهامداران", cols: [
    { key: "name", label: "نام سهامدار", req: true },
    { key: "share_pct", label: "درصد سهم", type: "num", example: 60 },
    { key: "phone", label: "تلفن" },
    { key: "note", label: "توضیح" },
  ] },

  // ---------------- کارخانه ----------------
  products: { title: "محصولات", cols: [
    { key: "name", label: "نام محصول", req: true, example: "کاغذ سنگی ۱۲۰ گرم" },
    { key: "unit", label: "واحد", example: "کیلوگرم" },
    { key: "capacity_per_hour", label: "ظرفیت اسمی در ساعت", type: "num", example: 750 },
    { key: "sale_price", label: "قیمت فروش واحد (ریال)", type: "num", example: 950000 },
  ], defaults: { bom: [] } },

  production_orders: { title: "دستور کارهای تولید", cols: [
    { key: "product_name", label: "محصول", req: true, fk: { table: "products", nameKey: "name", idKey: "product_id" } },
    { key: "target_qty", label: "هدف تولید", type: "num", example: 120000 },
    { key: "line", label: "خط تولید", example: "خط ۱" },
    { key: "start_date", label: "تاریخ شروع", type: "date" },
    { key: "end_date", label: "تاریخ پایان", type: "date" },
  ], defaults: { status: "open" } },

  production_records: { title: "رکوردهای تولید", cols: [
    { key: "record_date", label: "تاریخ", type: "date", req: true },
    { key: "shift", label: "شیفت", example: "صبح" },
    { key: "line", label: "خط", example: "خط ۱" },
    { key: "product_name", label: "محصول", req: true, fk: { table: "products", nameKey: "name", idKey: "product_id" } },
    { key: "good_qty", label: "تولید سالم", type: "num", example: 5200 },
    { key: "scrap_qty", label: "ضایعات", type: "num", example: 130 },
    { key: "downtime_min", label: "توقف (دقیقه)", type: "num", example: 45 },
    { key: "note", label: "توضیح" },
  ], defaults: { downtimes: [] } },

  machines: { title: "ماشین‌آلات کارخانه", cols: [
    { key: "name", label: "نام دستگاه", req: true, example: "اکسترودر اصلی" },
    { key: "code", label: "کد", example: "EXT-01" },
    { key: "location", label: "محل استقرار" },
    { key: "pm_interval_days", label: "دوره سرویس (روز)", type: "num", example: 30 },
    { key: "last_pm", label: "آخرین سرویس", type: "date" },
  ] },

  maintenance_orders: { title: "دستور کارهای نت", cols: [
    { key: "machine_name", label: "دستگاه", req: true, fk: { table: "machines", nameKey: "name", idKey: "machine_id" } },
    { key: "kind", label: "نوع", type: "list", opts: { pm: "سرویس دوره‌ای (PM)", cm: "تعمیر (CM)" }, example: "تعمیر (CM)" },
    { key: "issue", label: "شرح مشکل / سرویس", req: true },
    { key: "priority", label: "اولویت", example: "متوسط" },
    { key: "action", label: "اقدام انجام‌شده" },
    { key: "done_date", label: "تاریخ انجام", type: "date" },
  ], defaults: { status: "open" } },

  qc_tests: { title: "آزمون‌های کیفیت", cols: [
    { key: "test_date", label: "تاریخ", type: "date" },
    { key: "stage", label: "مرحله", type: "list",
      opts: { incoming: "بازرسی ورودی مواد", ipqc: "کنترل حین فرآیند (IPQC)", final: "آزمون محصول نهایی" }, example: "آزمون محصول نهایی" },
    { key: "item", label: "ماده / محصول", req: true },
    { key: "parameter", label: "پارامتر", req: true, example: "گراماژ (g/m²)" },
    { key: "value", label: "مقدار", type: "num", example: 121 },
    { key: "spec_min", label: "حد پایین", type: "num", example: 116 },
    { key: "spec_max", label: "حد بالا", type: "num", example: 124 },
    { key: "lot", label: "شماره Lot" },
    { key: "note", label: "توضیح" },
  ] },

  customers: { title: "مشتریان", cols: [
    { key: "name", label: "نام مشتری", req: true },
    { key: "city", label: "شهر" },
    { key: "phone", label: "تلفن" },
  ] },

  sales_orders: { title: "سفارش‌های فروش", cols: [
    { key: "customer_name", label: "مشتری", req: true, fk: { table: "customers", nameKey: "name", idKey: "customer_id" } },
    { key: "product_name", label: "محصول", req: true, fk: { table: "products", nameKey: "name", idKey: "product_id" } },
    { key: "qty", label: "مقدار", type: "num" },
    { key: "unit_price", label: "فی (ریال)", type: "num" },
    { key: "delivery_date", label: "تاریخ تحویل", type: "date" },
  ], defaults: { status: "open" } },

  energy_logs: { title: "مصرف انرژی", cols: [
    { key: "log_date", label: "تاریخ", type: "date", req: true },
    { key: "kwh", label: "برق (kWh)", type: "num", example: 8400 },
    { key: "solar_kwh", label: "تولید خورشیدی (kWh)", type: "num", example: 2600 },
    { key: "gas", label: "گاز (m³)", type: "num", example: 310 },
    { key: "water", label: "آب (m³)", type: "num", example: 22 },
  ] },

  personnel: { title: "پرسنل کارخانه", cols: [
    { key: "name", label: "نام", req: true },
    { key: "role", label: "سمت", example: "اپراتور خط" },
    { key: "shift", label: "شیفت", example: "صبح" },
    { key: "phone", label: "تلفن" },
  ] },

  overheads: { title: "سربار ماهانه", cols: [
    { key: "month", label: "ماه (YYYY-MM)", type: "month", req: true, example: "2026-07" },
    { key: "labor", label: "دستمزد (ریال)", type: "num" },
    { key: "energy", label: "انرژی (ریال)", type: "num" },
    { key: "maintenance", label: "نت و تعمیرات (ریال)", type: "num" },
    { key: "other", label: "سایر (ریال)", type: "num" },
  ] },

  // ---------------- نیروگاه خورشیدی ----------------
  solar_arrays: { title: "آرایه‌های پنل", cols: [
    { key: "name", label: "نام آرایه", req: true, example: "بلوک A" },
    { key: "panel_brand", label: "برند پنل", example: "Longi" },
    { key: "panel_model", label: "مدل پنل", example: "LR5-72HPH-550M" },
    { key: "panel_watt", label: "توان هر پنل (W)", type: "num", example: 550 },
    { key: "panel_count", label: "تعداد پنل", type: "num", example: 1200 },
    { key: "tilt", label: "زاویه شیب (\u00b0)", type: "num", example: 30 },
    { key: "azimuth", label: "آزیموت (\u00b0)", type: "num", example: 180 },
    { key: "install_date", label: "تاریخ نصب", type: "date" },
    { key: "warranty_years", label: "گارانتی (سال)", type: "num", example: 25 },
    { key: "note", label: "توضیح" },
  ] },

  solar_inverters: { title: "اینورترها", cols: [
    { key: "name", label: "نام اینورتر", req: true, example: "اینورتر ۱" },
    { key: "code", label: "کد", example: "INV-01" },
    { key: "brand", label: "برند", example: "Huawei" },
    { key: "model", label: "مدل", example: "SUN2000-100KTL" },
    { key: "capacity_kw", label: "ظرفیت (kW)", type: "num", example: 100 },
    { key: "serial", label: "سریال" },
    { key: "array_name", label: "آرایه متصل", fk: { table: "solar_arrays", nameKey: "name", idKey: "array_id" } },
    { key: "install_date", label: "تاریخ نصب", type: "date" },
    { key: "status", label: "وضعیت", type: "list",
      opts: { active: "در مدار", fault: "خطا", maintenance: "در تعمیر", off: "خارج از مدار" }, example: "در مدار" },
    { key: "note", label: "توضیح" },
  ], defaults: { status: "active" } },

  solar_generation: { title: "تولید برق", cols: [
    { key: "log_date", label: "تاریخ", type: "date", req: true, example: "2026-07-20" },
    { key: "inverter_name", label: "اینورتر", req: true, fk: { table: "solar_inverters", nameKey: "name", idKey: "inverter_id" } },
    { key: "kwh", label: "تولید (kWh)", type: "num", req: true, example: 620 },
    { key: "peak_kw", label: "اوج توان (kW)", type: "num", example: 92 },
    { key: "hours_online", label: "ساعت کارکرد", type: "num", example: 10.5 },
    { key: "irradiance", label: "تابش (kWh/m2)", type: "num", example: 6.4 },
    { key: "temp_c", label: "دما (\u00b0C)", type: "num", example: 34 },
    { key: "note", label: "توضیح" },
  ] },

  solar_sales: { title: "فروش برق", cols: [
    { key: "sale_date", label: "تاریخ فروش", type: "date", req: true },
    { key: "market", label: "بازار", type: "list",
      opts: { bourse: "بورس انرژی", guaranteed: "خرید تضمینی", direct: "قرارداد دوجانبه" }, example: "بورس انرژی" },
    { key: "buyer", label: "خریدار", example: "شرکت توزیع برق" },
    { key: "contract_no", label: "شماره قرارداد" },
    { key: "kwh", label: "انرژی (kWh)", type: "num", req: true, example: 45000 },
    { key: "price_per_kwh", label: "نرخ (ریال/kWh)", type: "num", example: 4200 },
    { key: "total", label: "مبلغ کل (ریال)", type: "num" },
    { key: "settlement_date", label: "تاریخ تسویه", type: "date" },
    { key: "note", label: "توضیح" },
  ], defaults: { status: "open" } },

  solar_prices: { title: "نرخ‌های بازار", cols: [
    { key: "price_date", label: "تاریخ", type: "date", req: true },
    { key: "market", label: "بازار", type: "list",
      opts: { bourse: "بورس انرژی", guaranteed: "خرید تضمینی", direct: "قرارداد دوجانبه" }, example: "بورس انرژی" },
    { key: "price_per_kwh", label: "نرخ (ریال/kWh)", type: "num", req: true, example: 4350 },
    { key: "note", label: "توضیح" },
  ] },

  solar_cleaning: { title: "شست‌وشوی پنل‌ها", cols: [
    { key: "clean_date", label: "تاریخ", type: "date", req: true },
    { key: "array_name", label: "آرایه", fk: { table: "solar_arrays", nameKey: "name", idKey: "array_id" } },
    { key: "method", label: "روش", type: "list",
      opts: { wet: "شست‌وشوی تر", dry: "تمیزکاری خشک", robot: "ربات شست‌وشو" }, example: "شست‌وشوی تر" },
    { key: "crew", label: "اکیپ / پیمانکار" },
    { key: "workers", label: "تعداد نفرات", type: "num", example: 4 },
    { key: "hours", label: "ساعت کار", type: "num", example: 6 },
    { key: "water_liters", label: "آب مصرفی (لیتر)", type: "num", example: 2000 },
    { key: "cost", label: "هزینه (ریال)", type: "num" },
    { key: "before_kwh", label: "تولید روز قبل (kWh)", type: "num" },
    { key: "after_kwh", label: "تولید روز بعد (kWh)", type: "num" },
    { key: "note", label: "توضیح" },
  ] },

  solar_faults: { title: "خرابی و آلارم", cols: [
    { key: "fault_date", label: "تاریخ", type: "date", req: true },
    { key: "inverter_name", label: "اینورتر", fk: { table: "solar_inverters", nameKey: "name", idKey: "inverter_id" } },
    { key: "kind", label: "نوع خطا", example: "قطع رشته DC" },
    { key: "severity", label: "شدت", example: "متوسط" },
    { key: "description", label: "شرح" },
    { key: "downtime_hours", label: "ساعت توقف", type: "num", example: 4 },
    { key: "lost_kwh", label: "انرژی ازدست‌رفته (kWh)", type: "num", example: 240 },
    { key: "action", label: "اقدام" },
    { key: "resolved_date", label: "تاریخ رفع", type: "date" },
  ], defaults: { status: "open" } },
};

/* ---------------- کمکی‌ها ---------------- */
const toDate = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") { // سریال اکسل
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(+d) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
};
const faDigits = (s: string) => s.replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
                                 .replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
const toNum = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(faDigits(String(v)).replace(/[,\s٬]/g, ""));
  return isNaN(n) ? null : n;
};

/* ---------------- خروجی اکسل ---------------- */
export function exportTable(table: string, rows: any[], fileName?: string) {
  const def = TABLES[table];
  if (!def) return;
  const data = rows.map(r => {
    const o: any = {};
    for (const c of def.cols) {
      let v = r[c.key];
      if (c.opts && v != null) v = c.opts[String(v)] ?? v;
      o[c.label] = v ?? "";
    }
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [Object.fromEntries(def.cols.map(c => [c.label, ""]))]);
  ws["!cols"] = def.cols.map(c => ({ wch: Math.max(12, Math.min(38, c.label.length + 6)) }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, def.title.slice(0, 31));
  XLSX.writeFile(wb, `${fileName || def.title}.xlsx`);
}

/* ---------------- قالب خالی ---------------- */
export function downloadTemplate(table: string) {
  const def = TABLES[table];
  if (!def) return;
  const sample: any = {};
  for (const c of def.cols) sample[c.label] = c.example ?? "";
  const guide = def.cols.map(c => ({
    "ستون": c.label,
    "الزامی": c.req ? "بله" : "خیر",
    "نوع": c.type === "num" ? "عدد" : c.type === "date" ? "تاریخ میلادی YYYY-MM-DD" : c.type === "month" ? "ماه YYYY-MM" : "متن",
    "مقادیر مجاز": c.opts ? Object.values(c.opts).filter(Boolean).join(" | ") : c.fk ? `باید در «${TABLES[c.fk.table]?.title || c.fk.table}» موجود باشد` : "",
  }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const ws = XLSX.utils.json_to_sheet([sample]);
  ws["!cols"] = def.cols.map(c => ({ wch: Math.max(14, Math.min(38, c.label.length + 8)) }));
  XLSX.utils.book_append_sheet(wb, ws, "داده");
  const wg = XLSX.utils.json_to_sheet(guide);
  wg["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 26 }, { wch: 46 }];
  XLSX.utils.book_append_sheet(wb, wg, "راهنما");
  XLSX.writeFile(wb, `قالب-${def.title}.xlsx`);
}

/* ---------------- ورودی اکسل ---------------- */
export async function importTable(
  file: File, table: string, projectId: string, extra: Record<string, any> = {}
): Promise<{ ok: number; skipped: number; errors: string[] }> {
  const def = TABLES[table];
  if (!def) return { ok: 0, skipped: 0, errors: ["جدول ناشناخته"] };

  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames.find(n => n !== "راهنما") || wb.SheetNames[0]];
  const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  if (!raw.length) return { ok: 0, skipped: 0, errors: ["فایل خالی است"] };

  // نگاشت سرستون فارسی ← کلید
  const H: Record<string, Col> = {};
  for (const c of def.cols) { H[c.label] = c; H[c.key] = c; }

  // بارگذاری جدول‌های مرجع برای نگاشت نام ← شناسه
  const fkMaps: Record<string, Record<string, string>> = {};
  for (const c of def.cols.filter(x => x.fk)) {
    const { table: ft, nameKey } = c.fk!;
    const { data } = await supabase.from(ft).select("*").eq("project_id", projectId);
    fkMaps[c.key] = Object.fromEntries((data || []).map((r: any) => [String(r[nameKey]).trim(), r.id]));
  }

  const errors: string[] = [];
  const rows: any[] = [];
  raw.forEach((r, i) => {
    const row: any = { project_id: projectId, ...(def.defaults || {}), ...extra };
    let bad = "";
    for (const [header, val] of Object.entries(r)) {
      const c = H[String(header).trim()];
      if (!c) continue;
      let v: any = val;
      if (c.opts) {
        const hit = Object.entries(c.opts).find(([k, l]) => l === String(v).trim() || k === String(v).trim());
        v = hit ? hit[0] : v;
      }
      if (c.type === "num") v = toNum(v);
      else if (c.type === "date") v = toDate(v);
      else if (c.type === "month") v = v ? String(v).slice(0, 7) : null;
      else if (v != null) v = String(v).trim();

      if (c.fk && v) {
        const id = fkMaps[c.key]?.[String(v).trim()];
        if (!id) bad = `«${v}» در ${TABLES[c.fk.table]?.title} یافت نشد`;
        else row[c.fk.idKey] = id;
      }
      row[c.key] = v;
    }
    for (const c of def.cols.filter(x => x.req)) if (row[c.key] == null || row[c.key] === "") bad = `«${c.label}» خالی است`;
    if (bad) { errors.push(`سطر ${i + 2}: ${bad}`); return; }
    rows.push(row);
  });

  if (!rows.length) return { ok: 0, skipped: raw.length, errors: errors.slice(0, 8) };

  // درج دسته‌ای ۳۰۰تایی
  let ok = 0;
  for (let i = 0; i < rows.length; i += 300) {
    const chunk = rows.slice(i, i + 300);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) errors.push(`درج سطرهای ${i + 2} تا ${i + chunk.length + 1}: ${error.message}`);
    else ok += chunk.length;
  }
  return { ok, skipped: raw.length - ok, errors: errors.slice(0, 8) };
}
