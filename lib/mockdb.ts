"use client";
// ============================================================
// حالت نمایشی: دیتابیس محلی در مرورگر (بدون نیاز به Supabase)
// ============================================================
// نسخه seed — با هر تغییر ساختار داده بالا می‌رود تا پایگاه نمایشی خودکار بازسازی شود
const KEY = "vivant-demo-db-v9";
const OLD_KEYS = ["vivant-demo-db", "vivant-demo-db-v2", "vivant-demo-db-v3", "vivant-demo-db-v4", "vivant-demo-db-v5", "vivant-demo-db-v6", "vivant-demo-db-v7", "vivant-demo-db-v8"];
const SESS = "vivant-demo-session";
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// ---------- کاربران پیش‌فرض ----------
const U = {
  ali: "u-ali", arash: "u-arash", mohsen: "u-mohsen", pm: "u-pm",
  chief: "u-chief", acc: "u-acc", fin: "u-fin", com: "u-com",
  // نگاشت شناسه‌های قدیمی داده نمونه
  admin: "u-ali", sysadmin: "u-ali", investor: "u-mohsen", nazer: "u-chief", eng: "u-pm",
};
export const DEMO_USERS = [
  { id: U.ali, email: "alitubayi@vivere.ir", password: "Vivere@Ali1404", full_name: "علی طوبایی", role: "admin", is_active: true },
  { id: U.arash, email: "arash@vivere.ir", password: "Vivere@Arash1404", full_name: "آرش طوبایی", role: "admin", is_active: true },
  { id: U.mohsen, email: "mohsen@vivere.ir", password: "Vivere@Mohsen1404", full_name: "محسن طوبایی", role: "investor", is_active: true },
  { id: U.pm, email: "pm@vivere.ir", password: "Vivere@123", full_name: "مدیر پروژه (نمونه)", role: "pm", is_active: true },
  { id: U.fin, email: "finance@vivere.ir", password: "Vivere@123", full_name: "مدیر مالی (نمونه)", role: "finance_manager", is_active: true },
  { id: U.acc, email: "accountant@vivere.ir", password: "Vivere@123", full_name: "حسابدار (نمونه)", role: "accountant", is_active: true },
  { id: U.com, email: "commerce@vivere.ir", password: "Vivere@123", full_name: "بازرگانی (نمونه)", role: "commerce", is_active: true },
  { id: U.chief, email: "chief@vivere.ir", password: "Vivere@123", full_name: "مهندس ارشد (نمونه)", role: "chief_engineer", is_active: true },
  // — نقش‌های سازمانی جدید (نمونه) —
  { id: "u-ceo", email: "ceo@vivere.ir", password: "Vivere@123", full_name: "مدیرعامل هلدینگ (نمونه)", role: "ceo", is_active: true },
  { id: "u-board", email: "board@vivere.ir", password: "Vivere@123", full_name: "عضو هیئت‌مدیره (نمونه)", role: "board_member", is_active: true },
  { id: "u-fmgr", email: "factory@vivere.ir", password: "Vivere@123", full_name: "مدیر کارخانه (نمونه)", role: "factory_manager", is_active: true },
  { id: "u-pmgr", email: "plant@vivere.ir", password: "Vivere@123", full_name: "مدیر نیروگاه (نمونه)", role: "plant_manager", is_active: true },
  { id: "u-treasury", email: "treasury@vivere.ir", password: "Vivere@123", full_name: "خزانه‌دار (نمونه)", role: "treasurer", is_active: true },
  { id: "u-salesm", email: "salesmgr@vivere.ir", password: "Vivere@123", full_name: "مدیر فروش (نمونه)", role: "sales_manager", is_active: true },
  { id: "u-sales", email: "sales@vivere.ir", password: "Vivere@123", full_name: "کارشناس فروش (نمونه)", role: "sales_expert", is_active: true },
  { id: "u-sitemgr", email: "sitemgr@vivere.ir", password: "Vivere@123", full_name: "مدیر کارگاه (نمونه)", role: "site_manager", is_active: true },
  { id: "u-super", email: "supervisor@vivere.ir", password: "Vivere@123", full_name: "ناظر (نمونه)", role: "supervisor", is_active: true },
  { id: "u-hse", email: "hse@vivere.ir", password: "Vivere@123", full_name: "کارشناس ایمنی و HSE (نمونه)", role: "hse_officer", is_active: true },
  { id: "u-prodm", email: "production@vivere.ir", password: "Vivere@123", full_name: "مدیر تولید (نمونه)", role: "production_manager", is_active: true },
  { id: "u-qcm", email: "qc@vivere.ir", password: "Vivere@123", full_name: "مدیر کنترل کیفیت (نمونه)", role: "qc_manager", is_active: true },
  { id: "u-maint", email: "maintenance@vivere.ir", password: "Vivere@123", full_name: "مدیر نگهداری و تعمیرات (نمونه)", role: "maintenance_manager", is_active: true },
  { id: "u-wh", email: "warehouse@vivere.ir", password: "Vivere@123", full_name: "انباردار (نمونه)", role: "warehouse_keeper", is_active: true },
  { id: "u-om", email: "om@vivere.ir", password: "Vivere@123", full_name: "تکنسین بهره‌برداری O&M (نمونه)", role: "om_technician", is_active: true },
  { id: "u-trader", email: "trader@vivere.ir", password: "Vivere@123", full_name: "کارشناس فروش انرژی (نمونه)", role: "energy_trader", is_active: true },
  { id: "u-hr", email: "hr@vivere.ir", password: "Vivere@123", full_name: "مدیر منابع انسانی (نمونه)", role: "hr_manager", is_active: true },
];

// ---------- پروژه نمونه تکمیل‌شده ----------
/** تولید داده نمونه ۴۵ روز اخیر نیروگاه — بر پایه ظرفیت DC آرایه‌ها و تابش واقعی همدان */
function genSolarData(sid: string) {
  // هر اینورتر سهمی از ظرفیت DC آرایه‌اش را می‌گیرد
  const INV = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `inv${i + 1}`, name: `اینورتر ${"۱۲۳۴"[i]}`, kwp: 1320 / 4 })),   // بلوک A
    ...Array.from({ length: 4 }, (_, i) => ({ id: `inv${i + 5}`, name: `اینورتر ${"۵۶۷۸"[i]}`, kwp: 1320 / 4 })),   // بلوک B
    ...Array.from({ length: 4 }, (_, i) => ({ id: `inv${i + 9}`, name: ["اینورتر ۹", "اینورتر ۱۰", "اینورتر ۱۱", "اینورتر ۱۲"][i], kwp: 1160 / 4 })), // بلوک C
  ];
  const out: any[] = [];
  for (let d = 44; d >= 0; d--) {
    const dt = new Date(); dt.setDate(dt.getDate() - d);
    const iso = dt.toISOString().slice(0, 10);
    const doy = Math.floor((+dt - +new Date(dt.getFullYear(), 0, 0)) / 86400000);
    // تابش تیر و مرداد در همدان: ۵٫۵ تا ۷ کیلووات‌ساعت بر متر مربع
    const cloud = d % 11 === 0 ? 0.55 : d % 7 === 0 ? 0.82 : 1;
    const irr = +(6.4 * cloud * (0.96 + 0.04 * Math.sin(doy / 12))).toFixed(2);
    for (const i of INV) {
      // اینورتر ۸ از ۱۸ تیر خراب است
      if (i.id === "inv8" && iso >= "2026-07-18") continue;
      // ضریب عملکرد: ۰٫۸۰ عادی — قبل از شست‌وشوی ۵ تیر خاک‌گرفتگی دارد
      const pr = (iso < "2026-07-05" ? 0.755 : 0.805) + (i.id.startsWith("inv1") ? 0.005 : 0);
      const kwh = Math.round(i.kwp * irr * pr * (0.99 + ((d * 7 + i.kwp) % 20) / 1000));
      out.push({
        id: uid(), project_id: sid, inverter_id: i.id, inverter_name: i.name, log_date: iso,
        kwh, peak_kw: Math.round(i.kwp * 0.72), hours_online: +(irr * 1.55).toFixed(1),
        irradiance: irr, temp_c: Math.round(30 + 6 * Math.sin(doy / 8)), note: "",
        created_by_name: "مهندس ارشد (نمونه)", created_at: iso,
      });
    }
  }
  return out;
}

function seed() {
  const PID = "p-sample";
  const FID = "p-factory";
  const SID = "p-solar";
  const PHASES = [
    "فاز ۰۱ - تملک زمین","فاز ۰۲ - طراحی و مهندسی","فاز ۰۳ - مجوزها و پروانه‌ها",
    "فاز ۰۴ - تجهیز کارگاه","فاز ۰۵ - آماده‌سازی سایت","فاز ۰۶ - فونداسیون",
    "فاز ۰۷ - اسکلت و سازه","فاز ۰۸ - سفت‌کاری","فاز ۰۹ - نما","فاز ۱۰ - در و پنجره",
    "فاز ۱۱ - تاسیسات مکانیکی","فاز ۱۲ - تاسیسات برقی و جریان ضعیف",
    "فاز ۱۳ - اطفاء حریق، آسانسور و هوشمندسازی","فاز ۱۴ - نازک‌کاری داخلی",
    "فاز ۱۵ - محوطه‌سازی و کارهای خارجی","فاز ۱۶ - راه‌اندازی، تحویل و دوره تضمین",
    "فاز ۱۷ - هزینه‌های بالاسری، مالی و پنهان",
  ];
  const phases = PHASES.map((name, i) => {
    const s = new Date(2024, i, 5), e = new Date(2024, i + 2, 20);
    return { id: `ph-${i + 1}`, project_id: PID, name, sort: i + 1, progress: 100, status: "done",
      start_date: s.toISOString().slice(0, 10), end_date: e.toISOString().slice(0, 10) };
  });

  // آیتم‌های CBS نمونه (نماینده هر فاز، با هزینه واقعی ثبت‌شده)
  const CBS: [string, string, string, string, string, string, number, number, number][] = [
    // کد، فاز، فعالیت، دسته، نام، واحد، مقدار، نرخ، ضریب واقعی
    ["01.01.01.SRV.001", PHASES[0], "خرید زمین", "خدمات و عوارض", "بهای خرید زمین", "مترمربع", 600, 180000000, 1],
    ["01.01.01.SRV.004", PHASES[0], "خرید زمین", "خدمات و عوارض", "مالیات نقل و انتقال ملک", "درصد", 1, 5400000000, 1],
    ["02.01.01.SRV.002", PHASES[1], "طراحی معماری", "خدمات مهندسی", "طراحی معماری فاز یک و دو", "مترمربع", 2400, 3500000, 1],
    ["02.02.01.SRV.001", PHASES[1], "مهندسی سازه", "خدمات مهندسی", "طراحی سازه و دفترچه محاسبات", "مترمربع", 2400, 2200000, 1],
    ["03.01.01.SRV.001", PHASES[2], "مجوزهای شهرداری", "عوارض و مجوزها", "عوارض صدور پروانه ساختمان", "مترمربع", 2400, 9000000, 1.04],
    ["03.02.01.SRV.001", PHASES[2], "انشعابات", "عوارض و مجوزها", "حق انشعاب برق", "اشتراک", 12, 380000000, 1],
    ["04.01.01.SRV.002", PHASES[3], "تجهیز کارگاه", "تجهیز کارگاه", "کانکس دفتر کارگاه", "ماه اجاره", 24, 90000000, 1],
    ["04.01.01.SRV.009", PHASES[3], "تجهیز کارگاه", "تجهیز کارگاه", "نگهبانی و حراست", "نفر-ماه", 24, 220000000, 1.02],
    ["05.02.01.EQP.001", PHASES[4], "خاکبرداری", "ماشین‌آلات و تجهیزات", "بیل مکانیکی - اجاره", "روز", 35, 65000000, 1.06],
    ["05.02.01.LAB.001", PHASES[4], "خاکبرداری", "دستمزد نیروی انسانی", "دستمزد سرکارگر", "نفر-روز", 40, 12000000, 1],
    ["05.02.02.MAT.001", PHASES[4], "سازه نگهبان", "مصالح", "پروفیل فلزی سازه نگهبان", "کیلوگرم", 18000, 420000, 1.03],
    ["06.02.01.MAT.003", PHASES[5], "آرماتوربندی فونداسیون", "مصالح", "میلگرد آجدار A3 سایز ۱۶", "کیلوگرم", 42000, 340000, 1.05],
    ["06.04.01.MAT.001", PHASES[5], "بتن‌ریزی فونداسیون", "مصالح", "بتن آماده C30", "مترمکعب", 520, 22000000, 1.02],
    ["06.04.01.EQP.001", PHASES[5], "بتن‌ریزی فونداسیون", "ماشین‌آلات و تجهیزات", "پمپ بتن - اجاره", "روز", 6, 95000000, 1],
    ["06.02.01.SUB.001", PHASES[5], "آرماتوربندی فونداسیون", "پیمانکاری جزء", "دستمزد پیمانکار آرماتوربندی", "کیلوگرم", 42000, 65000, 1],
    ["07.01.02.MAT.001", PHASES[6], "بتن‌ریزی ستون‌ها", "مصالح", "بتن آماده C30", "مترمکعب", 780, 22500000, 1.07],
    ["07.02.03.MAT.005", PHASES[6], "سقف طبقه اول", "مصالح", "بتن آماده سقف C25", "مترمکعب", 210, 21000000, 1.03],
    ["07.01.01.MAT.001", PHASES[6], "آرماتوربندی ستون‌ها", "مصالح", "میلگرد طولی A3 سایز ۱۸", "کیلوگرم", 65000, 345000, 1.04],
    ["08.01.01.MAT.001", PHASES[7], "دیوارچینی", "مصالح", "بلوک سبک AAC", "مترمربع", 5400, 1450000, 1.06],
    ["08.02.01.MAT.003", PHASES[7], "بام", "مصالح", "عایق رطوبتی بام (ایزوگام دولایه)", "مترمربع", 620, 1900000, 1],
    ["09.02.01.MAT.001", PHASES[8], "نمای سنگ", "مصالح", "سنگ نما تراورتن", "مترمربع", 1350, 8500000, 1.09],
    ["09.02.01.SUB.001", PHASES[8], "نمای سنگ", "پیمانکاری جزء", "دستمزد پیمانکار نما", "مترمربع", 1350, 3200000, 1],
    ["10.01.01.MAT.001", PHASES[9], "پنجره‌ها", "مصالح", "پنجره UPVC با شیشه دوجداره", "مترمربع", 380, 14500000, 1.02],
    ["10.02.01.MAT.001", PHASES[9], "درب‌ها", "مصالح", "درب ضدسرقت واحدها", "لنگه", 12, 220000000, 1],
    ["11.01.01.MAT.001", PHASES[10], "لوله‌کشی آب", "مصالح", "لوله و اتصالات پنج‌لایه", "مترطول", 4800, 850000, 1.05],
    ["11.02.01.MAT.001", PHASES[10], "گرمایش", "مصالح", "پکیج دیواری", "دستگاه", 12, 480000000, 1],
    ["12.01.01.MAT.002", PHASES[11], "سیم‌کشی برق", "مصالح", "سیم و کابل مسی استاندارد", "مترطول", 16000, 320000, 1.08],
    ["12.01.02.MAT.001", PHASES[11], "تابلوهای برق", "مصالح", "تابلو برق واحد و مشاعات", "تابلو", 15, 160000000, 1],
    ["13.02.01.MAT.001", PHASES[12], "آسانسور", "مصالح", "کابین و درب طبقات آسانسور", "دستگاه", 2, 6500000000, 1.03],
    ["13.01.01.MAT.001", PHASES[12], "اعلام حریق", "مصالح", "پنل مرکزی اعلام حریق", "دستگاه", 1, 850000000, 1],
    ["14.01.01.MAT.001", PHASES[13], "گچ‌کاری", "مصالح", "گچ ساختمانی", "کیلوگرم", 96000, 45000, 1.1],
    ["14.02.02.MAT.001", PHASES[13], "سرامیک کف", "مصالح", "سرامیک پرسلان کف", "مترمربع", 2100, 3800000, 1.07],
    ["14.06.01.MAT.001", PHASES[13], "کابینت", "مصالح", "کابینت هایگلاس با صفحه", "مترطول", 96, 95000000, 1],
    ["14.05.01.SUB.001", PHASES[13], "نقاشی", "پیمانکاری جزء", "دستمزد پیمانکار نقاشی", "مترمربع", 9800, 950000, 1],
    ["15.01.01.MAT.001", PHASES[14], "کف‌سازی محوطه", "مصالح", "بتن و واش‌بتن محوطه", "مترمربع", 850, 4200000, 1.04],
    ["15.01.02.MAT.002", PHASES[14], "فضای سبز", "مصالح", "گل، گیاه و درختچه", "اصله", 120, 3500000, 1],
    ["16.01.01.SRV.003", PHASES[15], "راه‌اندازی", "راه‌اندازی و تحویل", "تست و استاندارد آسانسور", "دستگاه", 2, 320000000, 1],
    ["16.02.01.SRV.001", PHASES[15], "دوره تضمین", "تضمین و نگهداری", "رفع نواقص دوره تضمین", "درصد", 1, 3800000000, 0.6],
    ["17.01.01.SRV.001", PHASES[16], "بالاسری", "بالاسری", "حقوق مدیر پروژه", "نفر-ماه", 24, 600000000, 1],
    ["17.03.01.SRV.001", PHASES[16], "ریسک", "ریسک و پنهان", "ذخیره احتیاطی پروژه", "درصد", 1, 9000000000, 0.55],
    ["17.02.01.SRV.001", PHASES[16], "مالی", "مالی و حقوقی", "بهره دوران ساخت", "درصد", 1, 14500000000, 1.08],
  ];
  const cbs_items = CBS.map(([code, ph, act, cat, name, unit, q, r, k]) => ({
    id: uid(), project_id: PID, cost_code: code, parent_code: code.split(".").slice(0, -1).join("."),
    phase_name: ph, work_package: act, activity: act, category: cat, item_name: name,
    description: `${name} — پروژه نمونه`, unit, quantity: q, unit_rate: r, waste_pct: 0,
    actual_total: Math.round(q * r * k), cost_type: "هزینه مستقیم", risk: "متوسط",
    priority: "بالا", milestone: "صورت‌وضعیت ماهانه", remarks: "",
  }));

  // اتصال cbs_item_id به اسنادی که فقط cbs_code دارند
  const codeMap: Record<string, string> = Object.fromEntries(cbs_items.map((c: any) => [c.cost_code, c.id]));

  const wi = (id: string, name: string, unit2: string, min: number) => ({ id, project_id: PID, name, unit: unit2, category: "مصالح", min_stock: min });
  const warehouse_items = [
    wi("w1", "میلگرد A3 سایز ۱۶", "کیلوگرم", 2000), wi("w2", "سیمان تیپ ۲", "کیسه", 100),
    wi("w3", "بلوک AAC", "مترمربع", 200), wi("w4", "گچ ساختمانی", "کیلوگرم", 1000),
    wi("w5", "سرامیک پرسلان", "مترمربع", 50), wi("w6", "سیم مسی ۲.۵", "مترطول", 500),
  ];
  const wt = (item: string, type: string, qty: number, price: number, d: string, ref: string) =>
    ({ id: uid(), project_id: PID, item_id: item, type, qty, unit_price: price, ref, note: "", created_by: U.eng, created_at: d });
  const warehouse_txns = [
    wt("w1", "in", 45000, 340000, "2024-05-10", "فاکتور ۱۰۲"), wt("w1", "out", 42000, 0, "2024-07-02", "حواله ۲۱"),
    wt("w2", "in", 3200, 2800000, "2024-06-01", "فاکتور ۱۱۸"), wt("w2", "out", 3050, 0, "2024-10-15", "حواله ۴۴"),
    wt("w3", "in", 5600, 1450000, "2024-09-05", "فاکتور ۱۴۰"), wt("w3", "out", 5400, 0, "2024-11-20", "حواله ۶۰"),
    wt("w4", "in", 98000, 45000, "2025-01-12", "فاکتور ۲۰۱"), wt("w4", "out", 96000, 0, "2025-03-08", "حواله ۸۸"),
    wt("w5", "in", 2200, 3800000, "2025-02-20", "فاکتور ۲۲۴"), wt("w5", "out", 2100, 0, "2025-04-11", "حواله ۹۹"),
    wt("w6", "in", 17000, 320000, "2024-12-01", "فاکتور ۱۸۸"), wt("w6", "out", 16000, 0, "2025-01-25", "حواله ۷۵"),
  ];

  const accounts = [
    { id: "a1", project_id: PID, name: "بانک ملت - جاری پروژه", kind: "bank" },
    { id: "a2", project_id: PID, name: "تنخواه کارگاه", kind: "cash" },
    { id: "a3", project_id: PID, name: "پیمانکاران", kind: "payable" },
  ];
  const tx = (acc: string, type: string, amount: number, d: string, cp: string, ds: string) =>
    ({ id: uid(), project_id: PID, account_id: acc, type, amount, cbs_item_id: null, counterparty: cp, description: ds, txn_date: d, created_by: U.pm, created_at: d });
  const transactions = [
    // ── اسناد متصل به کد هزینه — نمایش زنجیره CBS ← حسابداری ──
    { ...tx("a1", "payment", 8600000000, "2024-06-10", "فولاد صنعت همدان", "خرید میلگرد اسکلت"),
      cbs_code: "07.01.01.MAT.001", phase_name: PHASES[6] },
    { ...tx("a1", "payment", 4200000000, "2024-07-05", "بتن آماده الوند", "بتن‌ریزی فونداسیون"),
      cbs_code: "06.04.01.MAT.001", phase_name: PHASES[5] },
    { ...tx("a2", "expense", 950000000, "2024-08-12", "اکیپ آرماتوربندی", "دستمزد آرماتوربندی"),
      cbs_code: "07.01.02.MAT.001", phase_name: PHASES[6] },
    { ...tx("a1", "receipt", 120000000000, "2024-02-01", "سرمایه‌گذار", "آورده اولیه سرمایه‌گذار"),
      allocations: [{ shareholder_id: "sh1", name: "محسن طوبایی", pct: 60 }, { shareholder_id: "sh2", name: "علی طوبایی", pct: 40 }] },
    tx("a1", "payment", 108000000000, "2024-02-15", "فروشنده زمین", "بهای خرید زمین"),
    tx("a1", "receipt", 90000000000, "2024-06-01", "سرمایه‌گذار", "آورده مرحله دوم"),
    tx("a1", "payment", 14300000000, "2024-06-20", "فولاد صنعت", "خرید میلگرد فونداسیون"),
    tx("a1", "payment", 11700000000, "2024-07-25", "بتن آماده الوند", "بتن فونداسیون"),
    tx("a1", "receipt", 150000000000, "2024-10-01", "پیش‌فروش واحدها", "پیش‌فروش ۴ واحد"),
    tx("a1", "payment", 22400000000, "2024-11-05", "فولاد صنعت", "میلگرد اسکلت"),
    tx("a3", "payment", 2730000000, "2024-08-10", "اکیپ آرماتوربند", "صورت‌وضعیت پیمانکار آرماتوربندی"),
    tx("a1", "payment", 12500000000, "2025-01-20", "سنگ تراورتن اطلس", "سنگ نما"),
    tx("a1", "payment", 13400000000, "2025-03-15", "آسانسور آریا", "قرارداد آسانسور"),
    tx("a1", "receipt", 180000000000, "2025-06-01", "فروش واحدها", "فروش ۵ واحد"),
    tx("a1", "payment", 9300000000, "2025-07-10", "کابینت مدرن", "کابینت واحدها"),
    tx("a2", "receipt", 5000000000, "2025-02-01", "بانک", "شارژ تنخواه"),
    tx("a2", "expense", 4200000000, "2025-05-30", "متفرقه", "هزینه‌های جاری کارگاه"),
    tx("a1", "payment", 14400000000, "2025-09-15", "ستاد", "حقوق مدیریت پروژه ۲۴ ماه"),
    tx("a1", "receipt", 95000000000, "2026-01-15", "فروش واحدها", "فروش ۳ واحد پایانی"),
  ];

  const tasks = [
    ["ph-6", "بتن‌ریزی فونداسیون بلوک A", U.eng, "2024-07-01", "2024-07-20"],
    ["ph-7", "اجرای سقف طبقه سوم", U.eng, "2024-10-01", "2024-10-25"],
    ["ph-9", "نصب سنگ نمای جبهه شمالی", U.eng, "2025-01-05", "2025-02-10"],
    ["ph-14", "کاشی‌کاری سرویس‌های طبقات ۱ تا ۳", U.eng, "2025-04-01", "2025-04-30"],
    ["ph-16", "اخذ گواهی استاندارد آسانسور", U.chief, "2025-11-01", "2025-11-20"],
  ].map(([ph, title, a, s, d]) => ({
    id: uid(), project_id: PID, phase_id: ph, title, description: "", assignee: a,
    start_date: s, due_date: d, progress: 100, status: "done", priority: "بالا",
    created_by: U.pm, created_at: s,
  }));

  const notes = [
    { id: uid(), project_id: PID, phase_id: null, task_id: null, author: U.nazer, created_at: "2024-07-18",
      body: "نمونه‌های بتن فونداسیون در آزمایشگاه مقاومت ۳۲ مگاپاسکال داشتند — بالاتر از حد طراحی. تایید می‌شود." },
    { id: uid(), project_id: PID, phase_id: null, task_id: null, author: U.chief, created_at: "2025-02-12",
      body: "در جبهه شمالی نما، اسکوپ سنگ طبق دیتیل اجرا شود؛ دو ردیف اول اصلاح شد." },
    { id: uid(), project_id: PID, phase_id: null, task_id: null, author: U.pm, created_at: "2026-03-25",
      body: "تحویل موقت انجام شد. لیست نواقص جزئی (۱۲ مورد) به پیمانکاران ابلاغ شد. دوره تضمین از ۱۴۰۵/۰۱/۰۵ آغاز می‌شود." },
  ];

  const directives = [
    { id: uid(), project_id: PID, from_user: U.pm, to_user: U.eng, title: "تسریع در آرماتوربندی فونداسیون",
      body: "با توجه به رزرو پمپ بتن برای ۲۵ تیر، آرماتوربندی باید تا ۲۳ تیر تایید ناظر را بگیرد.",
      due_date: "2024-07-14", status: "done", created_at: "2024-07-05" },
    { id: uid(), project_id: PID, from_user: U.chief, to_user: U.eng, title: "اصلاح اسکوپ سنگ نما",
      body: "دیتیل اسکوپ مکانیکی مطابق نقشه شاپ شماره N-104 اجرا شود.",
      due_date: "2025-02-15", status: "done", created_at: "2025-02-12" },
    { id: uid(), project_id: PID, from_user: U.pm, to_user: U.chief, title: "پیگیری گواهی پایان‌کار",
      body: "مدارک پایان‌کار تکمیل و به شهرداری ارسال شود.",
      due_date: "2026-02-28", status: "done", created_at: "2026-01-20" },
  ];

  const DB: any = {
    demo_auth: DEMO_USERS.map(({ id, email, password }) => ({ id, email, password })),
    profiles: DEMO_USERS.map(({ id, full_name, role, email, is_active }) => ({ id, full_name, role, email, is_active: is_active !== false, phone: "", created_at: "2024-01-01" })),
    projects: [{
      id: PID, kind: "construction", name: "مجتمع مسکونی آفتاب همدان (نمونه تکمیل‌شده)", code: "VIV-1401-01",
      location: "همدان، بلوار ارم", description: "۱۲ واحد مسکونی در ۶ طبقه — پروژه نمونه برای آشنایی با پلتفرم",
      budget: 520000000000, start_date: "2024-02-01", end_date: "2026-03-20",
      status: "closed", created_by: U.pm, created_at: "2024-01-15",
    }, {
      id: FID, kind: "factory", name: "کارخانه کاغذ سنگی آریا (نمونه)", code: "VIV-1404-F1",
      location: "شهرک صنعتی ویان، همدان", description: "خط تولید کاغذ سنگی ۷۵۰ کیلوگرم بر ساعت — نمونه ماژول‌های مدیریت کارخانه",
      budget: 1500000000000, start_date: "2026-01-05", end_date: null,
      status: "active", created_by: U.pm, created_at: "2026-01-05",
    }, {
      id: SID, kind: "solar", name: "نیروگاه خورشیدی ۵ مگاواتی همدان (نمونه)", code: "VIV-1405-S1",
      location: "کبودرآهنگ، همدان", description: "نیروگاه فتوولتائیک متصل به شبکه — فروش در بورس انرژی ایران",
      budget: 2800000000000, start_date: "2025-03-01", end_date: null,
      status: "active", created_by: U.pm, created_at: "2025-03-01",
    }],
    project_members: [PID, FID, SID].flatMap(pid => DEMO_USERS.map(u => ({
      id: uid(), project_id: pid, user_id: u.id,
      member_role: u.role === "admin" ? "pm" : u.role, phase_scope: null,
      manager_id: u.id === U.chief ? U.pm : u.id === U.pm ? U.ali : null,
      allowed_tabs: null,
    }))),
    project_files: [],
    phases, tasks, cbs_items, warehouse_items, warehouse_txns, accounts, transactions, notes, directives,
    documents: [{
      id: uid(), project_id: PID, kind: "plan", title: "پلان شماتیک طبقه همکف",
      file_name: "plan-ground.svg", mime: "image/svg+xml",
      data_url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNTAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjUwMCIgZmlsbD0iI0Y2RjdGOSIvPjxyZWN0IHg9IjYwIiB5PSI2MCIgd2lkdGg9IjY4MCIgaGVpZ2h0PSIzODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFGM0E1RiIgc3Ryb2tlLXdpZHRoPSIzIi8+PGxpbmUgeDE9IjYwIiB5MT0iMjUwIiB4Mj0iNzQwIiB5Mj0iMjUwIiBzdHJva2U9IiMxRjNBNUYiIHN0cm9rZS13aWR0aD0iMiIvPjxsaW5lIHgxPSI0MDAiIHkxPSI2MCIgeDI9IjQwMCIgeTI9IjQ0MCIgc3Ryb2tlPSIjMUYzQTVGIiBzdHJva2Utd2lkdGg9IjIiLz48cmVjdCB4PSIxMDAiIHk9IjEwMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI4MCIgZmlsbD0iI0YwQjQyOSIgb3BhY2l0eT0iMC40Ii8+PHRleHQgeD0iNDAwIiB5PSI0ODAiIGZvbnQtZmFtaWx5PSJUYWhvbWEiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiMxQjFFMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiPtm+2YTYp9mGINi02YXYp9iq24zaqSDYt9io2YLZhyDZh9mF2qnZgSAtINm+2LHZiNqY2Ycg2YbZhdmI2YbZhzwvdGV4dD48L3N2Zz4=",
      uploaded_by: U.chief, created_at: "2024-03-10",
    }],
    contracts: [
      { id: "c1", project_id: PID, cbs_code: "07.01", phase_name: "فاز ۰۷ - اسکلت و سازه", title: "پیمان اجرای اسکلت بتنی", contractor: "شرکت سازه‌گستر الوند", amount: 95000000000, advance_pct: 10, retention_pct: 10, start_date: "2024-06-01", end_date: "2024-12-20", status: "active", created_at: "2024-05-20" },
      { id: "c2", project_id: PID, title: "پیمان نازک‌کاری", contractor: "اکیپ استاد رضایی", amount: 68000000000, advance_pct: 5, retention_pct: 10, start_date: "2025-01-10", end_date: "2025-09-30", status: "active", created_at: "2024-12-25" },
    ],
    progress_claims: [
      { id: uid(), project_id: PID, contract_id: "c1", contract_title: "پیمان اجرای اسکلت بتنی", no: "۳", period: "مهر ۱۴۰۳", gross_amount: 60000000000, prev_amount: 38000000000, period_amount: 22000000000, retention_deduct: 2200000000, advance_deduct: 2200000000, insurance_deduct: 1716000000, other_deduct: 0, net_amount: 15884000000, status: "approved", created_by_name: "مدیر پروژه (نمونه)", created_at: "2024-10-05" },
      { id: uid(), project_id: PID, contract_id: "c2", contract_title: "پیمان نازک‌کاری", no: "۴", period: "مرداد ۱۴۰۴", gross_amount: 61000000000, prev_amount: 47000000000, period_amount: 14000000000, retention_deduct: 1400000000, advance_deduct: 700000000, insurance_deduct: 1092000000, other_deduct: 0, net_amount: 10808000000, status: "supervisor_ok", created_by_name: "مهندس ارشد (نمونه)", created_at: "2025-08-28" },
    ],
    change_orders: [
      { id: uid(), project_id: PID, contract_id: "c1", contract_title: "پیمان اجرای اسکلت بتنی", title: "افزایش ضخامت دیوار برشی محور B", amount_delta: 3200000000, days_delta: 8, reason: "الزام محاسبات مرحله دوم", status: "approved", created_by_name: "مهندس ارشد (نمونه)", created_at: "2024-08-14" },
    ],
    disputes: [],
    vendors: [
      { id: uid(), project_id: PID, name: "فولاد صنعت همدان", field: "میلگرد و پروفیل", phone: "081-34567890", rating: 5, created_at: "2024-04-01" },
      { id: uid(), project_id: PID, name: "بتن آماده الوند", field: "بتن استاندارد", phone: "081-38765432", rating: 4, created_at: "2024-04-01" },
    ],
    purchase_requests: [
      { id: "pr1", project_id: PID, item: "سیمان تیپ ۲", qty: 500, unit: "کیسه", needed_date: "2026-04-10", note: "", status: "open", requester_name: "واحد اجرا", created_at: "2026-03-20" },
    ],
    purchase_orders: [],
    daily_reports: [
      { id: uid(), project_id: PID, report_date: "2025-04-15", weather: "آفتابی", temp: "18", works: "کاشی‌کاری سرویس‌های طبقه ۲ تکمیل شد؛ سرامیک کف واحد ۵ شروع شد.", blockers: "", manpower: [{ role: "کاشی‌کار", count: 4 }, { role: "کارگر ساده", count: 6 }], photos: [], created_by_name: "واحد اجرا", created_at: "2025-04-15" },
    ],
    timesheets: [],
    equipment: [
      { id: "eq1", project_id: PID, name: "بالابر مصالح ۵۰۰ کیلویی", plate: "BL-500", owner: "ملکی", status: "فعال", created_at: "2024-05-01" },
    ],
    equipment_logs: [
      { id: uid(), project_id: PID, equipment_id: "eq1", equipment_name: "بالابر مصالح ۵۰۰ کیلویی", log_date: "2025-04-15", hours: 6, fuel: 0, service_note: "", created_at: "2025-04-15" },
    ],
    quality_records: [
      { id: uid(), project_id: PID, kind: "ncr", title: "کاور ناکافی آرماتور ستون C4", location: "طبقه سوم", severity: "زیاد", description: "کاور مشاهده‌شده ۲ سانتی‌متر — کمتر از حد نقشه", action: "اسپیسر اصلاح و بتن ترمیمی اجرا شد", due_date: "2024-09-20", photos: [], status: "closed", created_by_name: "مهندس ارشد (نمونه)", created_at: "2024-09-12" },
      { id: uid(), project_id: PID, kind: "punch", title: "خط‌وخش درب ضدسرقت واحد ۷", location: "واحد ۷", severity: "کم", description: "", action: "", due_date: "2026-04-05", photos: [], status: "open", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-03-22" },
    ],
    meetings: [
      { id: uid(), project_id: PID, title: "جلسه هماهنگی تحویل موقت", meet_date: "2026-03-18", attendees: "مدیر پروژه، ناظر، مهندس ارشد", minutes: "برنامه رفع نواقص و تحویل نهایی مرور شد.", resolutions: [{ text: "لیست پانچ نهایی تا پایان هفته ابلاغ شود", owner: "مهندس ارشد (نمونه)", due: "2026-03-25" }], created_by_name: "مدیر پروژه (نمونه)", created_at: "2026-03-18" },
    ],
    letters: [
      { id: uid(), project_id: PID, no: "و/۱۴۰۵/۱۲", direction: "out", subject: "درخواست بازرسی نهایی آسانسور", party: "اداره استاندارد همدان", letter_date: "2025-11-02", created_by_name: "مدیر پروژه (نمونه)", created_at: "2025-11-02" },
    ],
    rfis: [
      { id: uid(), project_id: PID, no: "RFI-07", subject: "دیتیل اتصال نمای سنگ در تراز خرپشته", question: "دیتیل اسکوپ در نقشه N-104 با وضعیت اجرا مطابقت ندارد؛ دیتیل اصلاحی ارائه شود.", answer: "دیتیل اصلاحی N-104-R1 ابلاغ شد.", to_party: "مشاور معماری", due_date: "2025-02-01", status: "answered", created_by_name: "واحد اجرا", created_at: "2025-01-25" },
    ],
    // ---------- کارخانه نمونه ----------
    products: [
      { id: "prod1", project_id: FID, name: "کاغذ سنگی ۱۲۰ گرم", unit: "کیلوگرم", capacity_per_hour: 750, sale_price: 950000,
        bom: [{ material: "پودر کربنات کلسیم", qty: 0.78, unit: "کیلوگرم", unit_price: 95000 }, { material: "گرانول HDPE", qty: 0.20, unit: "کیلوگرم", unit_price: 620000 }, { material: "افزودنی و مستربچ", qty: 0.02, unit: "کیلوگرم", unit_price: 1800000 }], created_at: "2026-01-05" },
      { id: "prod2", project_id: FID, name: "گرانول کامپاند سنگی", unit: "کیلوگرم", capacity_per_hour: 900, sale_price: 480000,
        bom: [{ material: "پودر کربنات کلسیم", qty: 0.80, unit: "کیلوگرم", unit_price: 95000 }, { material: "گرانول HDPE", qty: 0.20, unit: "کیلوگرم", unit_price: 620000 }], created_at: "2026-01-05" },
    ],
    production_orders: [
      { id: uid(), project_id: FID, product_id: "prod1", product_name: "کاغذ سنگی ۱۲۰ گرم", target_qty: 120000, line: "خط ۱", start_date: "2026-07-01", end_date: "2026-07-31", status: "open", created_by_name: "مدیر پروژه (نمونه)", created_at: "2026-06-28" },
    ],
    production_records: [
      { id: uid(), project_id: FID, record_date: "2026-07-12", shift: "صبح", line: "خط ۱", product_id: "prod1", product_name: "کاغذ سنگی ۱۲۰ گرم", good_qty: 5200, scrap_qty: 130, downtime_min: 45, downtimes: [{ reason: "تعویض قالب/گرید", minutes: 45 }], note: "", created_by_name: "واحد اجرا", created_at: "2026-07-12" },
      { id: uid(), project_id: FID, record_date: "2026-07-13", shift: "صبح", line: "خط ۱", product_id: "prod1", product_name: "کاغذ سنگی ۱۲۰ گرم", good_qty: 5650, scrap_qty: 90, downtime_min: 0, downtimes: [], note: "", created_by_name: "واحد اجرا", created_at: "2026-07-13" },
      { id: uid(), project_id: FID, record_date: "2026-07-13", shift: "عصر", line: "خط ۱", product_id: "prod2", product_name: "گرانول کامپاند سنگی", good_qty: 6800, scrap_qty: 60, downtime_min: 75, downtimes: [{ reason: "خرابی مکانیکی", minutes: 75 }], note: "", created_by_name: "واحد اجرا", created_at: "2026-07-13" },
    ],
    machines: [
      { id: "mc1", project_id: FID, name: "اکسترودر اصلی", code: "EXT-01", location: "سالن تولید", pm_interval_days: 30, last_pm: "2026-07-01", created_at: "2026-01-01" },
      { id: "mc2", project_id: FID, name: "میکسر پرسرعت", code: "MIX-01", location: "سالن آماده‌سازی", pm_interval_days: 45, last_pm: "2026-05-20", created_at: "2026-01-01" },
    ],
    maintenance_orders: [
      { id: uid(), project_id: FID, machine_id: "mc2", machine_name: "میکسر پرسرعت", kind: "pm", issue: "سرویس دوره‌ای ۴۵ روزه — گریس‌کاری و بازدید تسمه‌ها", priority: "متوسط", status: "open", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-07-10" },
    ],
    qc_tests: [
      { id: uid(), project_id: FID, stage: "final", item: "کاغذ سنگی ۱۲۰ گرم", parameter: "گراماژ (g/m²)", value: 121, spec_min: 116, spec_max: 124, pass: true, lot: "L-260713-A", note: "", test_date: "2026-07-13", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-07-13" },
      { id: uid(), project_id: FID, stage: "incoming", item: "پودر کربنات کلسیم", parameter: "سفیدی (٪)", value: 94, spec_min: 92, spec_max: null, pass: true, lot: "IN-118", note: "", test_date: "2026-07-10", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-07-10" },
    ],
    customers: [
      { id: "cu1", project_id: FID, name: "چاپ و بسته‌بندی پارس", city: "تهران", phone: "021-88554433", created_at: "2026-02-01" },
    ],
    sales_orders: [
      { id: uid(), project_id: FID, customer_id: "cu1", customer_name: "چاپ و بسته‌بندی پارس", product_id: "prod1", product_name: "کاغذ سنگی ۱۲۰ گرم", qty: 20000, unit_price: 950000, delivery_date: "2026-07-25", status: "open", created_by_name: "مدیر پروژه (نمونه)", created_at: "2026-07-08" },
    ],
    energy_logs: [
      { id: uid(), project_id: FID, log_date: "2026-07-13", kwh: 8400, gas: 310, water: 22, solar_kwh: 2600, created_at: "2026-07-13" },
      { id: uid(), project_id: FID, log_date: "2026-07-12", kwh: 8100, gas: 295, water: 20, solar_kwh: 2450, created_at: "2026-07-12" },
    ],
    personnel: [
      { id: uid(), project_id: FID, name: "رضا کریمی", role: "اپراتور اکسترودر", shift: "صبح", phone: "", created_at: "2026-01-10" },
      { id: uid(), project_id: FID, name: "امید شمس", role: "اپراتور اکسترودر", shift: "عصر", phone: "", created_at: "2026-01-10" },
    ],
    overheads: [
      { id: uid(), project_id: FID, month: "2026-07", labor: 4200000000, energy: 1800000000, maintenance: 600000000, other: 900000000, created_at: "2026-07-01" },
    ],
    // ---------- CRM کارخانه (نمونه) ----------
    crm_leads: [
      { id: "cl1", project_id: FID, title: "سفارش کاغذ سنگی چاپ پارس", customer_id: "cu1", customer_name: "چاپ و بسته‌بندی پارس", product_id: "prod1", product_name: "کاغذ سنگی ۱۲۰ گرم", stage: "negotiation", value: 1900000000, probability: 70, source: "معرفی", owner_name: "کارشناس فروش (نمونه)", next_action_date: "2026-07-26", note: "", created_by_name: "مدیر فروش (نمونه)", created_at: "2026-07-10" },
      { id: "cl2", project_id: FID, title: "سرنخ نمایشگاه چاپ تهران", customer_name: "بسته‌بندی آریا", product_name: "کاغذ سنگی ۱۲۰ گرم", stage: "contacted", value: 2600000000, probability: 40, source: "نمایشگاه", owner_name: "کارشناس فروش (نمونه)", next_action_date: "2026-07-20", note: "درخواست نمونه", created_by_name: "کارشناس فروش (نمونه)", created_at: "2026-07-14" },
      { id: "cl3", project_id: FID, title: "استعلام گرانول کامپاند", customer_name: "پلیمر شرق", product_name: "گرانول کامپاند سنگی", stage: "quoted", value: 1450000000, probability: 55, source: "سایت", owner_name: "مدیر فروش (نمونه)", next_action_date: "2026-07-18", note: "پیش‌فاکتور ارسال شد", created_by_name: "مدیر فروش (نمونه)", created_at: "2026-07-12" },
      { id: "cl4", project_id: FID, title: "فروش تناژ صادراتی", customer_name: "بازرگانی الوند", product_name: "کاغذ سنگی ۱۲۰ گرم", stage: "won", value: 3200000000, probability: 100, source: "معرفی", owner_name: "مدیر فروش (نمونه)", next_action_date: null, note: "قرارداد بسته شد", created_by_name: "مدیر فروش (نمونه)", created_at: "2026-06-28" },
      { id: "cl5", project_id: FID, title: "سرنخ سرد شبکه اجتماعی", customer_name: "چاپ نگین", product_name: "", stage: "lost", value: 800000000, probability: 0, source: "اینستاگرام", owner_name: "کارشناس فروش (نمونه)", next_action_date: null, lost_reason: "قیمت بالا", note: "", created_by_name: "کارشناس فروش (نمونه)", created_at: "2026-06-20" },
    ],
    crm_activities: [
      { id: uid(), project_id: FID, lead_id: "cl1", customer_id: "cu1", kind: "call", subject: "تماس نهایی‌سازی تخفیف", due_date: "2026-07-19", done: false, owner_name: "کارشناس فروش (نمونه)", created_by_name: "کارشناس فروش (نمونه)", created_at: "2026-07-15" },
      { id: uid(), project_id: FID, lead_id: "cl2", kind: "task", subject: "ارسال نمونه محصول", due_date: "2026-07-17", done: false, owner_name: "کارشناس فروش (نمونه)", created_by_name: "کارشناس فروش (نمونه)", created_at: "2026-07-14" },
      { id: uid(), project_id: FID, lead_id: "cl3", kind: "meeting", subject: "جلسه بازدید کارخانه", due_date: "2026-07-22", done: false, owner_name: "مدیر فروش (نمونه)", created_by_name: "مدیر فروش (نمونه)", created_at: "2026-07-13" },
    ],
    // ---------- فاکتور و مطالبات (نمونه B2B) ----------
    sales_invoices: [
      { id: "inv1", project_id: FID, invoice_no: "INV-0001", customer_id: "cu1", customer_name: "چاپ و بسته‌بندی پارس", order_id: null, issue_date: "2026-07-08", due_date: "2026-08-07", lines: [{ product: "کاغذ سنگی ۱۲۰ گرم", qty: 20000, unit_price: 950000 }], subtotal: 19000000000, discount: 0, vat_rate: 10, vat: 1900000000, total: 20900000000, paid: 0, status: "issued", payment_terms: "۳۰ روزه", note: "", created_by_name: "مدیر فروش (نمونه)", created_at: "2026-07-08" },
      { id: "inv2", project_id: FID, invoice_no: "INV-0002", customer_id: "cu1", customer_name: "چاپ و بسته‌بندی پارس", order_id: null, issue_date: "2026-05-20", due_date: "2026-06-19", lines: [{ product: "گرانول کامپاند سنگی", qty: 30000, unit_price: 480000 }], subtotal: 14400000000, discount: 400000000, vat_rate: 10, vat: 1400000000, total: 15400000000, paid: 0, status: "issued", payment_terms: "۳۰ روزه", note: "", created_by_name: "مدیر فروش (نمونه)", created_at: "2026-05-20" },
    ],
    // ---------- دفتر چک (نمونه) ----------
    cheques: [
      { id: uid(), project_id: FID, kind: "receive", cheque_no: "784512", bank: "ملت", branch: "ویان", amount: 15400000000, due_date: "2026-08-01", party: "چاپ و بسته‌بندی پارس", customer_id: "cu1", invoice_id: "inv2", status: "in_hand", cleared_date: null, note: "بابت فاکتور INV-0002", created_by_name: "خزانه‌دار (نمونه)", created_at: "2026-07-10" },
      { id: uid(), project_id: FID, kind: "pay", cheque_no: "112233", bank: "تجارت", branch: "همدان", amount: 6200000000, due_date: "2026-07-28", party: "تامین‌کننده کربنات کلسیم", customer_id: null, invoice_id: null, status: "in_hand", cleared_date: null, note: "خرید مواد اولیه", created_by_name: "خزانه‌دار (نمونه)", created_at: "2026-07-12" },
    ],
    // ---------- نیروگاه خورشیدی نمونه ----------
    solar_arrays: [
      { id: "arr1", project_id: SID, name: "بلوک A — شمالی", panel_brand: "Longi", panel_model: "LR5-72HPH-550M",
        panel_watt: 550, panel_count: 2400, tilt: 30, azimuth: 180, install_date: "2025-06-15", warranty_years: 25, note: "", created_at: "2025-06-15" },
      { id: "arr2", project_id: SID, name: "بلوک B — مرکزی", panel_brand: "Longi", panel_model: "LR5-72HPH-550M",
        panel_watt: 550, panel_count: 2400, tilt: 30, azimuth: 180, install_date: "2025-07-01", warranty_years: 25, note: "", created_at: "2025-07-01" },
      { id: "arr3", project_id: SID, name: "بلوک C — جنوبی", panel_brand: "JinkoSolar", panel_model: "JKM580N-72HL4",
        panel_watt: 580, panel_count: 2000, tilt: 32, azimuth: 175, install_date: "2025-08-10", warranty_years: 25, note: "", created_at: "2025-08-10" },
    ],
    solar_inverters: [
      { id: "inv1", project_id: SID, array_id: "arr1", name: "اینورتر ۱", code: "INV-01", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1171", install_date: "2025-06-20", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv2", project_id: SID, array_id: "arr1", name: "اینورتر ۲", code: "INV-02", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1172", install_date: "2025-06-20", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv3", project_id: SID, array_id: "arr1", name: "اینورتر ۳", code: "INV-03", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1173", install_date: "2025-06-20", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv4", project_id: SID, array_id: "arr1", name: "اینورتر ۴", code: "INV-04", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1174", install_date: "2025-06-20", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv5", project_id: SID, array_id: "arr2", name: "اینورتر ۵", code: "INV-05", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1175", install_date: "2025-07-05", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv6", project_id: SID, array_id: "arr2", name: "اینورتر ۶", code: "INV-06", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1176", install_date: "2025-07-05", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv7", project_id: SID, array_id: "arr2", name: "اینورتر ۷", code: "INV-07", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1177", install_date: "2025-07-05", status: "active", note: "", created_at: "2025-06-20" },
      { id: "inv8", project_id: SID, array_id: "arr2", name: "اینورتر ۸", code: "INV-08", brand: "Huawei", model: "SUN2000-215KTL-H3",
        capacity_kw: 215, serial: "HW2025A1178", install_date: "2025-07-05", status: "fault", note: "خطای رشته DC", created_at: "2025-06-20" },
      { id: "inv9", project_id: SID, array_id: "arr3", name: "اینورتر ۹", code: "INV-09", brand: "Sungrow", model: "SG352HX",
        capacity_kw: 352, serial: "SG2025C4420", install_date: "2025-08-15", status: "active", note: "", created_at: "2025-08-15" },
      { id: "inv10", project_id: SID, array_id: "arr3", name: "اینورتر ۱۰", code: "INV-10", brand: "Sungrow", model: "SG352HX",
        capacity_kw: 352, serial: "SG2025C4421", install_date: "2025-08-15", status: "active", note: "", created_at: "2025-08-15" },
      { id: "inv11", project_id: SID, array_id: "arr3", name: "اینورتر ۱۱", code: "INV-11", brand: "Sungrow", model: "SG352HX",
        capacity_kw: 352, serial: "SG2025C4422", install_date: "2025-08-15", status: "active", note: "", created_at: "2025-08-15" },
      { id: "inv12", project_id: SID, array_id: "arr3", name: "اینورتر ۱۲", code: "INV-12", brand: "Sungrow", model: "SG352HX",
        capacity_kw: 352, serial: "SG2025C4423", install_date: "2025-08-15", status: "active", note: "", created_at: "2025-08-15" },
    ],
    solar_generation: genSolarData(SID),
    solar_sales: [
      { id: uid(), project_id: SID, sale_date: "2026-07-01", market: "bourse", buyer: "بورس انرژی ایران", contract_no: "IREX-140504-118",
        kwh: 118000, price_per_kwh: 4250, total: 501500000, settlement_date: "2026-07-10", status: "settled", note: "عرضه هفتگی تابلوی برق", created_by_name: "مدیر مالی (نمونه)", created_at: "2026-07-01" },
      { id: uid(), project_id: SID, sale_date: "2026-07-08", market: "bourse", buyer: "بورس انرژی ایران", contract_no: "IREX-140504-206",
        kwh: 124000, price_per_kwh: 4480, total: 555520000, settlement_date: null, status: "open", note: "", created_by_name: "مدیر مالی (نمونه)", created_at: "2026-07-08" },
      { id: uid(), project_id: SID, sale_date: "2026-07-15", market: "bourse", buyer: "بورس انرژی ایران", contract_no: "IREX-140504-291",
        kwh: 121000, price_per_kwh: 4520, total: 546920000, settlement_date: null, status: "open", note: "", created_by_name: "مدیر مالی (نمونه)", created_at: "2026-07-15" },
      { id: uid(), project_id: SID, sale_date: "2026-07-05", market: "guaranteed", buyer: "ساتبا — خرید تضمینی", contract_no: "SATBA-1403-7742",
        kwh: 80000, price_per_kwh: 3900, total: 312000000, settlement_date: null, status: "open", note: "سهم قرارداد ۲۰ ساله", created_by_name: "مدیر مالی (نمونه)", created_at: "2026-07-05" },
      { id: uid(), project_id: SID, sale_date: "2026-06-20", market: "direct", buyer: "شرکت فولاد الوند", contract_no: "DIR-1405-03",
        kwh: 95000, price_per_kwh: 4700, total: 446500000, settlement_date: "2026-06-30", status: "settled", note: "قرارداد دوجانبه صنعتی", created_by_name: "مدیر مالی (نمونه)", created_at: "2026-06-20" },
      { id: uid(), project_id: SID, sale_date: "2026-06-10", market: "bourse", buyer: "بورس انرژی ایران", contract_no: "IREX-140503-882",
        kwh: 130000, price_per_kwh: 4180, total: 543400000, settlement_date: "2026-06-22", status: "settled", note: "", created_by_name: "مدیر مالی (نمونه)", created_at: "2026-06-10" },
    ],
    solar_prices: [
      { id: uid(), project_id: SID, price_date: "2026-07-20", market: "bourse", price_per_kwh: 4520, note: "میانگین تابلوی برق", created_at: "2026-07-20" },
      { id: uid(), project_id: SID, price_date: "2026-07-13", market: "bourse", price_per_kwh: 4480, note: "", created_at: "2026-07-13" },
      { id: uid(), project_id: SID, price_date: "2026-07-06", market: "bourse", price_per_kwh: 4250, note: "", created_at: "2026-07-06" },
      { id: uid(), project_id: SID, price_date: "2026-06-29", market: "bourse", price_per_kwh: 4180, note: "", created_at: "2026-06-29" },
      { id: uid(), project_id: SID, price_date: "2026-07-01", market: "guaranteed", price_per_kwh: 3900, note: "نرخ مصوب ساتبا", created_at: "2026-07-01" },
    ],
    solar_cleaning: [
      { id: uid(), project_id: SID, array_id: "arr1", array_name: "بلوک A — شمالی", clean_date: "2026-07-05", method: "wet",
        crew: "پیمانکار نظافت پارس", workers: 6, hours: 8, water_liters: 4500, cost: 42000000,
        before_kwh: 5480, after_kwh: 5920, note: "گرد و غبار فصلی", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-07-05" },
      { id: uid(), project_id: SID, array_id: "arr2", array_name: "بلوک B — مرکزی", clean_date: "2026-07-06", method: "wet",
        crew: "پیمانکار نظافت پارس", workers: 6, hours: 8, water_liters: 4500, cost: 42000000,
        before_kwh: 5390, after_kwh: 5810, note: "", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-07-06" },
      { id: uid(), project_id: SID, array_id: "arr3", array_name: "بلوک C — جنوبی", clean_date: "2026-05-28", method: "robot",
        crew: "ربات خودکار", workers: 1, hours: 5, water_liters: 800, cost: 12000000,
        before_kwh: 4740, after_kwh: 5015, note: "تست ربات شست‌وشو", created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-05-28" },
    ],
    solar_faults: [
      { id: uid(), project_id: SID, inverter_id: "inv8", inverter_name: "اینورتر ۸", fault_date: "2026-07-18",
        kind: "قطع رشته DC", severity: "زیاد", description: "افت توان رشته ۳ و ۴ — احتمال قطعی کانکتور MC4",
        action: null, resolved_date: null, downtime_hours: 26, lost_kwh: 1850, status: "open",
        created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-07-18" },
      { id: uid(), project_id: SID, inverter_id: "inv2", inverter_name: "اینورتر ۲", fault_date: "2026-06-12",
        kind: "اضافه دما", severity: "متوسط", description: "توقف حفاظتی به دلیل دمای بالای محفظه",
        action: "تمیزکاری فن خنک‌کننده و فیلتر هوا", resolved_date: "2026-06-13", downtime_hours: 6, lost_kwh: 420, status: "closed",
        created_by_name: "مهندس ارشد (نمونه)", created_at: "2026-06-12" },
    ],
    // (شناسه CBS اسناد در پایان seed اعمال می‌شود)
    shareholders: [
      { id: "sh1", project_id: PID, name: "محسن طوبایی", share_pct: 60, phone: "0912xxxxxxx", created_at: "2024-01-20" },
      { id: "sh2", project_id: PID, name: "علی طوبایی", share_pct: 40, phone: "0918xxxxxxx", created_at: "2024-01-20" },
      { id: "sh3", project_id: FID, name: "محسن طوبایی", share_pct: 55, phone: "0912xxxxxxx", created_at: "2026-01-05" },
      { id: "sh4", project_id: FID, name: "علی طوبایی", share_pct: 45, phone: "0918xxxxxxx", created_at: "2026-01-05" },
      { id: "sh5", project_id: SID, name: "محسن طوبایی", share_pct: 50, phone: "0912xxxxxxx", created_at: "2025-03-01" },
      { id: "sh6", project_id: SID, name: "علی طوبایی", share_pct: 30, phone: "0918xxxxxxx", created_at: "2025-03-01" },
      { id: "sh7", project_id: SID, name: "آرش طوبایی", share_pct: 20, phone: "0918xxxxxxx", created_at: "2025-03-01" },
    ],
    custom_sections: [],
    section_entries: [],
    activity_log: [
      { id: uid(), project_id: PID, user_id: U.pm, action: "ایجاد پروژه", detail: "مجتمع مسکونی آفتاب همدان", created_at: "2024-01-15T09:00:00Z" },
      { id: uid(), project_id: PID, user_id: U.pm, action: "ورود فایل CBS", detail: "بارگذاری ساختار هزینه پروژه", created_at: "2024-02-05T10:30:00Z" },
      { id: uid(), project_id: PID, user_id: U.eng, action: "تغییر وضعیت فعالیت", detail: "بتن‌ریزی فونداسیون بلوک A ← تکمیل‌شده", created_at: "2024-07-20T14:00:00Z" },
      { id: uid(), project_id: PID, user_id: U.pm, action: "ثبت سند مالی", detail: "پرداخت ۱۳٬۴۰۰٬۰۰۰٬۰۰۰ ریال — قرارداد آسانسور", created_at: "2025-03-15T11:00:00Z" },
    ],
    notifications: [
      { id: uid(), user_id: U.admin, kind: "info", title: "به پلتفرم ویــِـره خوش آمدید", body: "پروژه نمونه «مجتمع آفتاب» برای بررسی امکانات بارگذاری شده است.", link: "/projects", read: false, created_at: new Date().toISOString() },
    ],
  } as Record<string, any[]>;

  // ── اتصال شناسه CBS به اسنادی که فقط کد هزینه دارند ──
  const cmap: Record<string, string> = Object.fromEntries(
    ((DB as any).cbs_items || []).map((c: any) => [c.cost_code, c.id])
  );
  for (const t of ["transactions", "contracts", "purchase_orders", "purchase_requests", "warehouse_txns"]) {
    for (const r of ((DB as any)[t] || [])) {
      if (r.cbs_code && !r.cbs_item_id) r.cbs_item_id = cmap[r.cbs_code] || null;
    }
  }
  return DB;
}

// ---------- موتور دیتابیس ----------
let mem: Record<string, any[]> | null = null;
const isBrowser = typeof window !== "undefined";
function db(): Record<string, any[]> {
  if (mem) return mem;
  if (isBrowser) {
    for (const k of OLD_KEYS) localStorage.removeItem(k); // پاک‌سازی نسخه‌های قدیمی
    const raw = localStorage.getItem(KEY);
    mem = raw ? JSON.parse(raw) : seed();
    if (!raw) persist();
  } else mem = seed();
  return mem!;
}
function persist() { if (isBrowser && mem) localStorage.setItem(KEY, JSON.stringify(mem)); }

// نگاشت روابط برای select های تو در تو
const REL: Record<string, { key: string; table: string; fk: string }> = {
  "profiles:assignee": { key: "profiles", table: "profiles", fk: "assignee" },
  "profiles:author": { key: "profiles", table: "profiles", fk: "author" },
  "from:from_user": { key: "from", table: "profiles", fk: "from_user" },
  "to:to_user": { key: "to", table: "profiles", fk: "to_user" },
  "projects": { key: "projects", table: "projects", fk: "project_id" },
  "profiles": { key: "profiles", table: "profiles", fk: "user_id" },
  "warehouse_items": { key: "warehouse_items", table: "warehouse_items", fk: "item_id" },
  "accounts": { key: "accounts", table: "accounts", fk: "account_id" },
  "profiles:uploaded_by": { key: "profiles", table: "profiles", fk: "uploaded_by" },
};

class Q {
  table: string; cols = "*"; filters: [string, string, any][] = [];
  orderBy: { c: string; asc: boolean } | null = null; lim = 0;
  op = "select"; payload: any = null; isSingle = false; wantReturn = false;
  constructor(t: string) { this.table = t; }
  select(c?: string) { if (this.op === "insert") this.wantReturn = true; else this.cols = c || "*"; return this; }
  eq(c: string, v: any) { this.filters.push([c, "eq", v]); return this; }
  neq(c: string, v: any) { this.filters.push([c, "neq", v]); return this; }
  in(c: string, arr: any[]) { this.filters.push([c, "in", arr]); return this; }
  order(c: string, o?: any) { this.orderBy = { c, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.isSingle = true; return this; }
  insert(rows: any) { this.op = "insert"; this.payload = rows; return this; }
  update(patch: any) { this.op = "update"; this.payload = patch; return this; }
  delete() { this.op = "delete"; return this; }
  private match(r: any) {
    return this.filters.every(([c, op, v]) =>
      op === "eq" ? r[c] === v : op === "in" ? (v as any[]).includes(r[c]) : r[c] !== v);
  }
  private expand(rows: any[]) {
    const tokens = [...this.cols.matchAll(/([\w:]+)\(([^)]*)\)/g)].map(m => m[1]);
    if (!tokens.length) return rows;
    return rows.map(r => {
      const out = { ...r };
      for (const t of tokens) {
        const rel = REL[t]; if (!rel) continue;
        out[rel.key] = db()[rel.table]?.find(x => x.id === r[rel.fk]) || null;
      }
      return out;
    });
  }
  private exec() {
    const d = db();
    if (!d[this.table]) d[this.table] = [];
    if (this.op === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload])
        .map(r => ({ id: uid(), created_at: new Date().toISOString(), ...r }));
      d[this.table].push(...rows); persist();
      const data = this.isSingle ? rows[0] : rows;
      return { data: this.wantReturn || this.isSingle ? data : null, error: null };
    }
    if (this.op === "update") {
      let n = 0;
      d[this.table] = d[this.table].map(r => this.match(r) ? (n++, { ...r, ...this.payload }) : r);
      persist(); return { data: null, error: null };
    }
    if (this.op === "delete") {
      d[this.table] = d[this.table].filter(r => !this.match(r)); persist();
      return { data: null, error: null };
    }
    let rows = d[this.table].filter(r => this.match(r));
    if (this.orderBy) {
      const { c, asc } = this.orderBy;
      rows = [...rows].sort((a, b) => (a[c] ?? "") > (b[c] ?? "") ? 1 : -1);
      if (!asc) rows.reverse();
    }
    if (this.lim) rows = rows.slice(0, this.lim);
    rows = this.expand(rows);
    if (this.isSingle) return { data: rows[0] || null, error: rows[0] ? null : { message: "not found" } };
    return { data: rows, error: null };
  }
  then(res: any, rej?: any) { try { res(this.exec()); } catch (e) { rej ? rej(e) : res({ data: null, error: e }); } }
}

function currentUser() {
  if (!isBrowser) return null;
  const id = localStorage.getItem(SESS);
  if (!id) return null;
  const u = db().demo_auth.find(x => x.id === id);
  return u ? { id: u.id, email: u.email } : null;
}

export function addDemoUser(full_name: string, email: string, password: string, role: string) {
  const d = db();
  if (d.demo_auth.some((x: any) => x.email === email)) return { error: "این ایمیل قبلاً ثبت شده است" };
  const id = uid();
  d.demo_auth.push({ id, email, password });
  d.profiles.push({ id, full_name, role, created_at: new Date().toISOString() });
  persist();
  return { error: null };
}

export const mockClient: any = {
  from: (t: string) => new Q(t),
  auth: {
    getSession: async () => ({ data: { session: currentUser() ? { user: currentUser() } : null } }),
    getUser: async () => ({ data: { user: currentUser() } }),
    signInWithPassword: async ({ email, password }: any) => {
      const u = db().demo_auth.find(x => x.email === email && x.password === password);
      if (!u) return { data: {}, error: { message: "invalid" } };
      localStorage.setItem(SESS, u.id);
      return { data: { user: { id: u.id, email } }, error: null };
    },
    signUp: async ({ email, password }: any) => {
      if (db().demo_auth.some(x => x.email === email)) return { data: {}, error: { message: "این ایمیل قبلاً ثبت شده است" } };
      const id = uid();
      db().demo_auth.push({ id, email, password }); persist();
      localStorage.setItem(SESS, id);
      return { data: { user: { id, email } }, error: null };
    },
    signOut: async () => { localStorage.removeItem(SESS); return { error: null }; },
  },
};
