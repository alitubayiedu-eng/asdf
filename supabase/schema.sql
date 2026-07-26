-- ===============================================================
-- اسکیمای دیتابیس پلتفرم مدیریت ساخت ویــِـره (Supabase / PostgreSQL)
-- این فایل را یک‌بار در SQL Editor سوپابیس اجرا کنید.
-- ===============================================================

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'phase_engineer'
    check (role in ('admin','ceo','board_member','investor','pm','factory_manager','plant_manager',
      'finance_manager','accountant','treasurer','commerce','sales_manager','sales_expert',
      'chief_engineer','site_manager','supervisor','phase_engineer','hse_officer',
      'production_manager','production_operator','qc_manager','maintenance_manager','warehouse_keeper',
      'om_technician','energy_trader','hr_manager')),
  phone text,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  location text,
  description text,
  budget numeric default 0,
  start_date date,
  end_date date,
  status text default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  member_role text default 'phase_engineer',
  phase_scope text,
  manager_id uuid references profiles(id),
  allowed_tabs text,
  edit_tabs text,
  unique(project_id, user_id)
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  sort int default 0,
  start_date date,
  end_date date,
  progress int default 0,
  status text default 'todo'
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete cascade,
  title text not null,
  description text,
  assignee uuid references profiles(id),
  start_date date,
  due_date date,
  progress int default 0,
  status text default 'todo',
  priority text default 'متوسط',
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists cbs_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  cost_code text not null,
  parent_code text,
  phase_name text,
  work_package text,
  activity text,
  category text,
  item_name text,
  description text,
  unit text,
  quantity numeric default 0,
  unit_rate numeric default 0,
  waste_pct numeric default 0,
  actual_total numeric default 0,
  cost_type text,
  risk text,
  priority text,
  milestone text,
  remarks text
);
create index if not exists cbs_items_project_idx on cbs_items(project_id);
create index if not exists cbs_items_code_idx on cbs_items(project_id, cost_code);

create table if not exists warehouse_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  unit text,
  category text,
  min_stock numeric default 0
);

create table if not exists warehouse_txns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  item_id uuid references warehouse_items(id) on delete cascade,
  type text check (type in ('in','out')),
  qty numeric not null,
  unit_price numeric default 0,
  ref text,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  kind text check (kind in ('bank','cash','payable','receivable','expense','income'))
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  type text check (type in ('receipt','payment','expense','income')),
  amount numeric not null,
  cbs_item_id uuid references cbs_items(id) on delete set null,
  counterparty text,
  description text,
  txn_date date default current_date,
  attachment text,   -- تصویر فاکتور/رسید به صورت Data URL
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  category text,
  mime text,
  data text,           -- Data URL؛ برای حجم بالا بعدا به Supabase Storage منتقل کنید
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  body text not null,
  author uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists directives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  from_user uuid references profiles(id),
  to_user uuid references profiles(id),
  title text not null,
  body text,
  due_date date,
  status text default 'open' check (status in ('open','ack','done')),
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  kind text, title text, file_name text, mime text, data_url text,
  rev text, doc_status text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null, contractor text, amount numeric default 0,
  advance_pct numeric default 0, retention_pct numeric default 0,
  start_date date, end_date date, status text default 'active',
  created_at timestamptz default now()
);

create table if not exists progress_claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  contract_id uuid references contracts(id) on delete cascade,
  contract_title text, no text, period text,
  gross_amount numeric default 0, prev_amount numeric default 0, period_amount numeric default 0,
  retention_deduct numeric default 0, advance_deduct numeric default 0,
  insurance_deduct numeric default 0, other_deduct numeric default 0, net_amount numeric default 0,
  status text default 'draft' check (status in ('draft','supervisor_ok','approved','rejected')),
  created_by_name text, created_at timestamptz default now()
);

create table if not exists change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  contract_id uuid references contracts(id) on delete cascade,
  contract_title text, title text not null, amount_delta numeric default 0, days_delta int default 0,
  reason text, status text default 'approved', created_by_name text, created_at timestamptz default now()
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  subject text not null, party text, amount numeric default 0, detail text,
  status text default 'open', created_by_name text, created_at timestamptz default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, field text, phone text, rating int default 3, created_at timestamptz default now()
);

create table if not exists purchase_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  item text not null, qty numeric default 0, unit text, needed_date date, note text,
  status text default 'open' check (status in ('open','ordered','received')),
  requester_name text, created_at timestamptz default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  pr_id uuid references purchase_requests(id) on delete set null,
  item text, qty numeric default 0, unit text, vendor_name text, unit_price numeric default 0,
  status text default 'ordered' check (status in ('ordered','received')),
  order_date date, created_by_name text, created_at timestamptz default now()
);

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  report_date date not null, weather text, temp text, works text, blockers text,
  manpower jsonb default '[]', photos jsonb default '[]',
  created_by_name text, created_at timestamptz default now()
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  person_name text not null, role text, work_date date, hours numeric default 0, note text,
  created_at timestamptz default now()
);

create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, plate text, owner text, status text default 'فعال', created_at timestamptz default now()
);

create table if not exists equipment_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  equipment_id uuid references equipment(id) on delete cascade,
  equipment_name text, log_date date, hours numeric default 0, fuel numeric default 0, service_note text,
  created_at timestamptz default now()
);

create table if not exists quality_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  kind text check (kind in ('inspection','ncr','incident','ptw','punch')),
  title text not null, location text, severity text, description text, action text,
  due_date date, photos jsonb default '[]',
  status text default 'open' check (status in ('open','closed')),
  created_by_name text, created_at timestamptz default now()
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null, meet_date date, attendees text, minutes text,
  resolutions jsonb default '[]', created_by_name text, created_at timestamptz default now()
);

create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  no text, direction text check (direction in ('in','out')), subject text not null,
  party text, letter_date date, created_by_name text, created_at timestamptz default now()
);

create table if not exists rfis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  no text, subject text not null, question text, answer text, to_party text, due_date date,
  status text default 'open' check (status in ('open','answered')),
  created_by_name text, created_at timestamptz default now()
);

alter table phases add column if not exists baseline_start date;
alter table phases add column if not exists baseline_end date;
alter table documents add column if not exists rev text;
alter table documents add column if not exists doc_status text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists is_active boolean default true;
alter table contracts add column if not exists body text;

-- ---------- ماژول کارخانه ----------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, unit text, capacity_per_hour numeric default 0,
  sale_price numeric default 0, bom jsonb default '[]', created_at timestamptz default now()
);
create table if not exists production_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  product_name text, target_qty numeric default 0, line text,
  start_date date, end_date date, status text default 'open',
  created_by_name text, created_at timestamptz default now()
);
create table if not exists production_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  record_date date not null, shift text, line text,
  product_id uuid references products(id) on delete set null,
  product_name text, good_qty numeric default 0, scrap_qty numeric default 0,
  downtime_min numeric default 0, downtimes jsonb default '[]', note text,
  created_by_name text, created_at timestamptz default now()
);
create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, code text, location text,
  pm_interval_days int default 30, last_pm date, created_at timestamptz default now()
);
create table if not exists maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  machine_id uuid references machines(id) on delete cascade,
  machine_name text, kind text check (kind in ('pm','cm')),
  issue text, priority text, action text, done_date date,
  status text default 'open' check (status in ('open','done')),
  created_by_name text, created_at timestamptz default now()
);
create table if not exists qc_tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  stage text check (stage in ('incoming','ipqc','final')),
  item text, parameter text, value numeric, spec_min numeric, spec_max numeric,
  pass boolean default true, lot text, note text, test_date date,
  created_by_name text, created_at timestamptz default now()
);
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, city text, phone text, created_at timestamptz default now()
);
create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  customer_name text, product_id uuid references products(id) on delete set null,
  product_name text, qty numeric default 0, unit_price numeric default 0,
  delivery_date date, status text default 'open' check (status in ('open','delivered','paid')),
  created_by_name text, created_at timestamptz default now()
);
create table if not exists energy_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  log_date date not null, kwh numeric default 0, gas numeric default 0,
  water numeric default 0, solar_kwh numeric default 0, created_at timestamptz default now()
);
create table if not exists personnel (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, role text, shift text, phone text, created_at timestamptz default now()
);
create table if not exists overheads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  month text not null, labor numeric default 0, energy numeric default 0,
  maintenance numeric default 0, other numeric default 0, created_at timestamptz default now()
);

-- ---------- سهامداران و بخش‌های سفارشی ----------
create table if not exists shareholders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, share_pct numeric default 0, phone text, note text,
  created_at timestamptz default now()
);
create table if not exists custom_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, created_by_name text, created_at timestamptz default now()
);
create table if not exists section_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  section_id uuid references custom_sections(id) on delete cascade,
  title text, body text, data_url text, created_by_name text, created_at timestamptz default now()
);

alter table projects add column if not exists kind text default 'construction';
alter table warehouse_items add column if not exists store_type text default '';
alter table transactions add column if not exists allocations jsonb default '[]';
-- تصویر فاکتور/رسید سند مالی (Data URL) — برنامه از ستون receipt_img استفاده می‌کند
alter table transactions add column if not exists receipt_img text;


-- ---------- ماژول نیروگاه خورشیدی ----------
create table if not exists solar_arrays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,                       -- نام آرایه / بلوک
  panel_brand text, panel_model text,
  panel_watt numeric default 0,             -- توان هر پنل (وات)
  panel_count int default 0,
  tilt numeric, azimuth numeric,            -- زاویه شیب و آزیموت
  install_date date, warranty_years int,
  note text, created_at timestamptz default now()
);

create table if not exists solar_inverters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  array_id uuid references solar_arrays(id) on delete set null,
  name text not null, code text, brand text, model text,
  capacity_kw numeric default 0,
  serial text, install_date date,
  status text default 'active' check (status in ('active','fault','maintenance','off')),
  note text, created_at timestamptz default now()
);

create table if not exists solar_generation (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  inverter_id uuid references solar_inverters(id) on delete cascade,
  inverter_name text,
  log_date date not null,
  kwh numeric default 0,                    -- انرژی تولیدی روز
  peak_kw numeric default 0,                -- اوج توان لحظه‌ای
  hours_online numeric default 0,
  irradiance numeric,                       -- تابش kWh/m²
  temp_c numeric, note text,
  created_by_name text, created_at timestamptz default now()
);

create table if not exists solar_sales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  sale_date date not null,
  market text default 'bourse' check (market in ('bourse','guaranteed','direct')),
  buyer text, contract_no text,
  kwh numeric default 0,
  price_per_kwh numeric default 0,
  total numeric default 0,
  settlement_date date,
  status text default 'open' check (status in ('open','settled','overdue')),
  note text, created_by_name text, created_at timestamptz default now()
);

create table if not exists solar_prices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  price_date date not null,
  market text default 'bourse',
  price_per_kwh numeric default 0,
  note text, created_at timestamptz default now()
);

create table if not exists solar_cleaning (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  array_id uuid references solar_arrays(id) on delete set null,
  array_name text,
  clean_date date not null,
  method text default 'wet' check (method in ('wet','dry','robot')),
  crew text, hours numeric default 0, workers int default 0,
  water_liters numeric default 0, cost numeric default 0,
  before_kwh numeric, after_kwh numeric,    -- برای سنجش اثر شست‌وشو
  note text, created_by_name text, created_at timestamptz default now()
);

create table if not exists solar_faults (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  inverter_id uuid references solar_inverters(id) on delete set null,
  inverter_name text,
  fault_date date not null,
  kind text,                                -- نوع خطا
  severity text default 'متوسط',
  description text, action text,
  resolved_date date,
  downtime_hours numeric default 0,
  lost_kwh numeric default 0,
  status text default 'open' check (status in ('open','closed')),
  created_by_name text, created_at timestamptz default now()
);


-- ============================================================
--   یکپارچگی کد هزینه — اتصال همه اسناد به CBS و فاز
-- ============================================================
-- مدل کنترل هزینه (بدون دوباره‌شماری):
--   بودجه      = از CBS (مقدار × فی × ضریب پرت)
--   تعهد       = قرارداد + سفارش خرید تگ‌خورده با کد
--   هزینه واقعی = سند مالی (پرداخت/هزینه) تگ‌خورده با کد  ← پول واقعاً خارج‌شده
--   کارکرد     = صورت‌وضعیت تاییدشده  ← کار گواهی‌شده، شاید هنوز پرداخت نشده
alter table tasks              add column if not exists cbs_item_id uuid references cbs_items(id) on delete set null;
alter table tasks              add column if not exists cbs_code text;
alter table contracts          add column if not exists cbs_item_id uuid references cbs_items(id) on delete set null;
alter table contracts          add column if not exists cbs_code text;
alter table contracts          add column if not exists phase_id uuid references phases(id) on delete set null;
alter table contracts          add column if not exists phase_name text;
alter table purchase_requests  add column if not exists cbs_item_id uuid references cbs_items(id) on delete set null;
alter table purchase_requests  add column if not exists cbs_code text;
alter table purchase_requests  add column if not exists phase_name text;
alter table purchase_orders    add column if not exists cbs_item_id uuid references cbs_items(id) on delete set null;
alter table purchase_orders    add column if not exists cbs_code text;
alter table purchase_orders    add column if not exists phase_name text;
alter table warehouse_txns     add column if not exists cbs_item_id uuid references cbs_items(id) on delete set null;
alter table warehouse_txns     add column if not exists cbs_code text;
alter table warehouse_txns     add column if not exists phase_name text;
alter table transactions       add column if not exists phase_id uuid references phases(id) on delete set null;
alter table transactions       add column if not exists phase_name text;
-- ردیابی مبدأ: کدام سند عملیاتی این سند مالی را ساخته (جلوگیری از ثبت دوباره)
alter table transactions       add column if not exists source_table text;
alter table transactions       add column if not exists source_id uuid;
create unique index if not exists idx_txn_source on transactions(source_table, source_id)
  where source_table is not null;
alter table cbs_items          add column if not exists committed_total numeric default 0;
alter table cbs_items          add column if not exists phase_id uuid references phases(id) on delete set null;

create index if not exists idx_txn_cbs      on transactions(cbs_item_id);
create index if not exists idx_po_cbs       on purchase_orders(cbs_item_id);
create index if not exists idx_contract_cbs on contracts(cbs_item_id);
create index if not exists idx_cbs_code     on cbs_items(project_id, cost_code);


-- ============================================================
--   بانک تامین‌کنندگان سطح هلدینگ — یک بار تعریف، همه‌جا در دسترس
-- ============================================================
alter table vendors add column if not exists is_global boolean default false;
alter table vendors alter column project_id drop not null;


create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,
  detail text,
  created_at timestamptz default now()
);
create index if not exists log_project_idx on activity_log(project_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  kind text,
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);
create index if not exists notif_user_idx on notifications(user_id, read);

-- ===================== امنیت سطح ردیف (RLS) =====================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table phases enable row level security;
alter table tasks enable row level security;
alter table cbs_items enable row level security;
alter table warehouse_items enable row level security;
alter table warehouse_txns enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table notes enable row level security;
alter table directives enable row level security;
alter table documents enable row level security;
alter table activity_log enable row level security;
alter table documents enable row level security;
alter table contracts enable row level security;
alter table progress_claims enable row level security;
alter table change_orders enable row level security;
alter table disputes enable row level security;
alter table vendors enable row level security;
alter table purchase_requests enable row level security;
alter table purchase_orders enable row level security;
alter table daily_reports enable row level security;
alter table timesheets enable row level security;
alter table equipment enable row level security;
alter table equipment_logs enable row level security;
alter table quality_records enable row level security;
alter table meetings enable row level security;
alter table letters enable row level security;
alter table rfis enable row level security;
alter table products enable row level security;
alter table production_orders enable row level security;
alter table production_records enable row level security;
alter table machines enable row level security;
alter table maintenance_orders enable row level security;
alter table qc_tests enable row level security;
alter table customers enable row level security;
alter table sales_orders enable row level security;
alter table energy_logs enable row level security;
alter table personnel enable row level security;
alter table overheads enable row level security;
alter table solar_arrays enable row level security;
alter table solar_inverters enable row level security;
alter table solar_generation enable row level security;
alter table solar_sales enable row level security;
alter table solar_prices enable row level security;
alter table solar_cleaning enable row level security;
alter table solar_faults enable row level security;
alter table shareholders enable row level security;
alter table custom_sections enable row level security;
alter table section_entries enable row level security;
alter table notifications enable row level security;
alter table project_files enable row level security;

-- ============================================================
--                    امنیت (Row Level Security)
-- ============================================================
-- توابع کمکی SECURITY DEFINER — از بازگشت بی‌نهایت در سیاست‌های profiles جلوگیری می‌کنند
create or replace function me_role() returns text
language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid() and coalesce(is_active, true);
$$;

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(me_role() = 'admin', false);
$$;

-- نقش‌های با دید سراسری روی همه پروژه‌ها
create or replace function is_manager() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(me_role() in ('admin', 'pm', 'investor', 'ceo', 'board_member'), false);
$$;

-- عضویت در پروژه (کاربر غیرفعال هیچ دسترسی ندارد)
create or replace function is_project_member(pid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select case when me_role() is null then false
    when is_manager() then true
    else exists(select 1 from project_members m where m.project_id = pid and m.user_id = auth.uid())
  end;
$$;

-- ---------- پروفایل‌ها ----------
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated using (me_role() is not null);
drop policy if exists "profiles insert" on profiles;
create policy "profiles insert" on profiles for insert to authenticated with check (is_admin());
drop policy if exists "profiles update" on profiles;
create policy "profiles update" on profiles for update to authenticated
  using (id = auth.uid() or is_admin() or me_role() = 'pm')
  with check (id = auth.uid() or is_admin() or me_role() = 'pm');
drop policy if exists "profiles delete" on profiles;
create policy "profiles delete" on profiles for delete to authenticated using (is_admin());

-- محافظ: ارتقای نقش و فعال/غیرفعال‌سازی فقط در اختیار مدیر سیستم؛ مدیر پروژه نقش‌های غیرمدیریتی را تغییر می‌دهد
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := me_role();
begin
  if new.role is distinct from old.role then
    if r = 'admin' then null;
    elsif r = 'pm' and new.role not in ('admin','investor','ceo','board_member') and old.role not in ('admin','investor','ceo','board_member') then null;
    else raise exception 'تغییر نقش مجاز نیست';
    end if;
  end if;
  if new.is_active is distinct from old.is_active and r <> 'admin' then
    raise exception 'تغییر وضعیت حساب فقط توسط مدیر سیستم';
  end if;
  if new.id is distinct from old.id then raise exception 'شناسه قابل تغییر نیست'; end if;
  return new;
end $$;
drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard before update on profiles for each row execute function guard_profile_update();

-- ---------- پروژه‌ها و اعضا ----------
drop policy if exists "projects read" on projects;
create policy "projects read" on projects for select to authenticated using (is_project_member(id));
drop policy if exists "projects manage" on projects;
create policy "projects manage" on projects for all to authenticated
  using (me_role() in ('admin','pm')) with check (me_role() in ('admin','pm'));

drop policy if exists "members read" on project_members;
create policy "members read" on project_members for select to authenticated using (is_project_member(project_id));
drop policy if exists "members manage" on project_members;
create policy "members manage" on project_members for all to authenticated
  using (me_role() in ('admin','pm')) with check (me_role() in ('admin','pm'));

-- ---------- سیاست عمومی جداول پروژه‌محور: فقط اعضای همان پروژه ----------
do $$
declare t text;
begin
  foreach t in array array[
    'phases','tasks','cbs_items','warehouse_items','warehouse_txns','accounts','transactions',
    'project_files','documents','notes','directives','contracts','progress_claims','change_orders',
    'disputes','vendors','purchase_requests','purchase_orders','daily_reports','timesheets',
    'equipment','equipment_logs','quality_records','meetings','letters','rfis','products',
    'production_orders','production_records','machines','maintenance_orders','qc_tests','customers',
    'sales_orders','energy_logs','personnel','overheads','custom_sections','section_entries',
    'solar_arrays','solar_inverters','solar_generation','solar_sales','solar_prices',
    'solar_cleaning','solar_faults'
  ]
  loop
    execute format('drop policy if exists "%s member all" on %I;', t, t);
    execute format('create policy "%s member all" on %I for all to authenticated using (is_project_member(project_id)) with check (is_project_member(project_id));', t, t);
  end loop;
end $$;

-- ---------- سهامداران: دیدن برای اعضا، تعریف فقط سرمایه‌گذار اصلی / مدیر سیستم ----------
drop policy if exists "shareholders read" on shareholders;
create policy "shareholders read" on shareholders for select to authenticated using (is_project_member(project_id));
drop policy if exists "shareholders write" on shareholders;
create policy "shareholders write" on shareholders for all to authenticated
  using (is_project_member(project_id) and me_role() in ('admin','investor'))
  with check (is_project_member(project_id) and me_role() in ('admin','investor'));

-- ---------- تامین‌کننده سراسری ----------
-- تامین‌کننده سراسری برای همه اعضای فعال قابل مشاهده است
drop policy if exists "vendors member all" on vendors;
drop policy if exists "vendors read" on vendors;
create policy "vendors read" on vendors for select to authenticated
  using (is_global or is_project_member(project_id));
drop policy if exists "vendors write" on vendors;
create policy "vendors write" on vendors for all to authenticated
  using (case when is_global then me_role() in ('admin','pm','ceo','commerce','finance_manager','factory_manager','plant_manager')
              else is_project_member(project_id) end)
  with check (case when is_global then me_role() in ('admin','pm','ceo','commerce','finance_manager','factory_manager','plant_manager')
                   else is_project_member(project_id) end);

-- ---------- گزارش تغییرات: فقط افزودنی (غیرقابل ویرایش و حذف) ----------
drop policy if exists "log insert" on activity_log;
create policy "log insert" on activity_log for insert to authenticated with check (is_project_member(project_id) and user_id = auth.uid());
drop policy if exists "log read managers" on activity_log;
create policy "log read managers" on activity_log for select to authenticated
  using (me_role() in ('admin','pm','investor'));

-- ---------- اعلان‌ها ----------
drop policy if exists "notif own read" on notifications;
create policy "notif own read" on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "notif own update" on notifications;
create policy "notif own update" on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- ارسال اعلان فقط توسط کاربر فعالِ واردشده (جدول ستون project_id ندارد)
drop policy if exists "notif insert" on notifications;
create policy "notif insert" on notifications for insert to authenticated
  with check (me_role() is not null);

-- ============================================================
--     کاربر مدیر سیستم اولیه — علی طوبایی
-- ============================================================
-- روش پیشنهادی: در داشبورد Supabase → Authentication → Users → Add user
--   ایمیل: alitubayi@vivere.ir  و یک رمز قوی؛ گزینه Auto Confirm را بزنید.
-- سپس این دستور را اجرا کنید تا نقش مدیر سیستم بگیرد:
insert into profiles (id, full_name, role, email, is_active)
select id, 'علی طوبایی', 'admin', email, true from auth.users where email = 'alitubayi@vivere.ir'
on conflict (id) do update set role = 'admin', full_name = 'علی طوبایی', is_active = true;

-- همین کار برای مدیر سیستم دوم و سرمایه‌گذار اصلی (پس از ساخت در داشبورد):
insert into profiles (id, full_name, role, email, is_active)
select id, 'آرش طوبایی', 'admin', email, true from auth.users where email = 'arash@vivere.ir'
on conflict (id) do update set role = 'admin', full_name = 'آرش طوبایی', is_active = true;

insert into profiles (id, full_name, role, email, is_active)
select id, 'محسن طوبایی', 'investor', email, true from auth.users where email = 'mohsen@vivere.ir'
on conflict (id) do update set role = 'investor', full_name = 'محسن طوبایی', is_active = true;


-- ================================================================
--   ماژول نیروگاه سیکل ترکیبی (CHP — هم‌تولیدی برق و حرارت)
-- ================================================================
-- kind پروژه: 'chp'. یک نیروگاه CHP از سوخت (معمولاً گاز) هم برق و هم
-- حرارت مفید تولید می‌کند؛ شاخص کلیدی «راندمان کلی» = (برق+حرارت)/سوخت است.
create table if not exists chp_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null, code text, brand text, model text,
  engine_type text default 'gas_engine' check (engine_type in ('gas_engine','gas_turbine','steam_turbine')),
  fuel_type text default 'gas' check (fuel_type in ('gas','diesel','biogas')),
  elec_capacity_kw numeric default 0,           -- ظرفیت الکتریکی (kW)
  thermal_capacity_kw numeric default 0,        -- ظرفیت حرارتی (kW)
  serial text, install_date date,
  running_hours numeric default 0,              -- ساعت کارکرد موتور (مبنای اورهال)
  overhaul_interval_hours int default 8000,
  last_overhaul date,
  status text default 'active' check (status in ('active','fault','maintenance','off')),
  note text, created_at timestamptz default now()
);

create table if not exists chp_generation (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  unit_id uuid references chp_units(id) on delete cascade, unit_name text,
  log_date date not null,
  elec_kwh numeric default 0,                   -- برق تولیدی روز
  heat_kwh numeric default 0,                   -- حرارت مفید تحویل‌شده (kWh حرارتی)
  fuel_m3 numeric default 0,                    -- گاز مصرفی (مترمکعب)
  fuel_kwh numeric default 0,                   -- انرژی سوخت (kWh)؛ اگر خالی از m3 برآورد می‌شود
  hours_online numeric default 0,
  note text, created_by_name text, created_at timestamptz default now()
);

create table if not exists chp_sales (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  sale_date date not null,
  kind text default 'electricity' check (kind in ('electricity','heat')),
  market text default 'bourse',                 -- bourse|guaranteed|direct|steam|hotwater
  buyer text, contract_no text,
  quantity numeric default 0, unit text default 'kWh',  -- kWh یا GJ یا تن‌بخار
  price_per_unit numeric default 0, total numeric default 0,
  settlement_date date,
  status text default 'open' check (status in ('open','settled','overdue')),
  note text, created_by_name text, created_at timestamptz default now()
);

create table if not exists chp_faults (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  unit_id uuid references chp_units(id) on delete set null, unit_name text,
  fault_date date not null, kind text, severity text default 'متوسط',
  description text, action text, resolved_date date,
  downtime_hours numeric default 0, lost_kwh numeric default 0,
  status text default 'open' check (status in ('open','closed')),
  created_by_name text, created_at timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['chp_units','chp_generation','chp_sales','chp_faults']
  loop
    execute format('create index if not exists %I on %I(project_id);', t || '_project_idx', t);
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "%s member all" on %I;', t, t);
    execute format('create policy "%s member all" on %I for all to authenticated using (is_project_member(project_id)) with check (is_project_member(project_id));', t, t);
  end loop;
end $$;
create index if not exists idx_chpgen_date  on chp_generation(project_id, log_date);
create index if not exists idx_chpgen_unit  on chp_generation(unit_id);
create index if not exists idx_chpsales_date on chp_sales(project_id, sale_date);

-- ---------- CHP: سرویس دوره‌ای، محیط‌زیست، قرارداد فروش ----------
create table if not exists chp_maintenance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  unit_id uuid references chp_units(id) on delete set null, unit_name text,
  kind text default 'oil'
    check (kind in ('oil','oil_filter','air_filter','spark_plug','coolant','top_overhaul','major_overhaul','inspection','other')),
  interval_hours int default 2000,            -- دوره سرویس (ساعت کارکرد)
  service_date date,
  hours_at_service numeric default 0,         -- ساعت کارکرد در زمان سرویس (اختیاری)
  cost numeric default 0, parts text, note text,
  created_by_name text, created_at timestamptz default now()
);

create table if not exists chp_emissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  unit_id uuid references chp_units(id) on delete set null, unit_name text,
  log_date date not null,
  nox numeric default 0,          -- mg/Nm³
  co numeric default 0,           -- mg/Nm³
  co2_ton numeric default 0,      -- تن CO₂ روز
  nox_limit numeric default 500,  -- حد مجاز NOx
  note text, created_by_name text, created_at timestamptz default now()
);

create table if not exists chp_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  kind text default 'electricity' check (kind in ('electricity','heat')),
  party text, contract_no text,
  start_date date, end_date date,
  base_price numeric default 0,   -- نرخ پایه (ریال/kWh یا ریال/GJ)
  unit text default 'kWh',
  adjustment_pct numeric default 0,  -- درصد تعدیل سالانه نرخ
  min_qty numeric default 0, max_qty numeric default 0,
  status text default 'active' check (status in ('active','expired','draft')),
  note text, created_by_name text, created_at timestamptz default now()
);
alter table chp_sales add column if not exists contract_id uuid references chp_contracts(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['chp_maintenance','chp_emissions','chp_contracts']
  loop
    execute format('create index if not exists %I on %I(project_id);', t || '_project_idx', t);
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "%s member all" on %I;', t, t);
    execute format('create policy "%s member all" on %I for all to authenticated using (is_project_member(project_id)) with check (is_project_member(project_id));', t, t);
  end loop;
end $$;
create index if not exists idx_chpmaint_unit on chp_maintenance(unit_id);
create index if not exists idx_chpemis_date  on chp_emissions(project_id, log_date);


-- ============================================================
--   مهاجرت افزایشی: نام‌ها به شناسه (غیرمخرب)
-- ============================================================
-- اصل: ستون‌های نام (contractor, vendor_name, person_name) برای نمایش و
-- سازگاری عقب‌رو حفظ می‌شوند. ستون‌های *_id جدید افزوده و یک‌بار با تطبیق
-- نام پر می‌شوند تا رکوردهای موجود به موجودیت واقعی (تامین‌کننده/پرسنل) وصل
-- شوند. از این پس فرم‌ها می‌توانند مستقیماً شناسه را ذخیره کنند و گزارش‌ها
-- به‌جای متن آزاد روی شناسه جمع بزنند. اجرای این بلوک چندبار بی‌خطر است.

alter table contracts        add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table purchase_orders  add column if not exists vendor_id uuid references vendors(id) on delete set null;
alter table timesheets       add column if not exists personnel_id uuid references personnel(id) on delete set null;

-- پیمانکار قرارداد → بانک تامین‌کنندگان (ترجیح: هم‌پروژه، سپس سراسری هلدینگ)
update contracts c set vendor_id = v.id
from vendors v
where c.vendor_id is null and nullif(btrim(c.contractor), '') is not null
  and btrim(v.name) = btrim(c.contractor)
  and (v.project_id = c.project_id or v.is_global);

-- تامین‌کننده سفارش خرید → بانک تامین‌کنندگان
update purchase_orders p set vendor_id = v.id
from vendors v
where p.vendor_id is null and nullif(btrim(p.vendor_name), '') is not null
  and btrim(v.name) = btrim(p.vendor_name)
  and (v.project_id = p.project_id or v.is_global);

-- فرد حضور و غیاب → پرونده پرسنلی (هم‌پروژه)
update timesheets t set personnel_id = pn.id
from personnel pn
where t.personnel_id is null and nullif(btrim(t.person_name), '') is not null
  and btrim(pn.name) = btrim(t.person_name)
  and pn.project_id = t.project_id;

create index if not exists idx_contracts_vendor    on contracts(vendor_id);
create index if not exists idx_po_vendor           on purchase_orders(vendor_id);
create index if not exists idx_timesheets_personnel on timesheets(personnel_id);

-- یادداشت: ستون‌های created_by_name (مهرِ سازنده) عمداً دست‌نخورده مانده‌اند؛
-- تبدیل آن‌ها به created_by uuid نیازمند تغییر فرم‌هاست و در گام بعد با تست انجام می‌شود.


-- ============================================================
--   مهاجرت نقش‌های سازمانی جدید (برای دیتابیس‌های موجود)
-- ============================================================
-- check قدیمی روی profiles.role فقط ۶ نقش را می‌پذیرفت و با نقش‌های واقعی
-- برنامه (finance_manager, accountant, commerce و نقش‌های سازمانی جدید)
-- ناسازگار بود. این بلوک محدودیت را با فهرست کامل نقش‌ها جایگزین می‌کند.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in (
  'admin','ceo','board_member','investor','pm','factory_manager','plant_manager',
  'finance_manager','accountant','treasurer','commerce','sales_manager','sales_expert',
  'chief_engineer','site_manager','supervisor','phase_engineer','hse_officer',
  'production_manager','production_operator','qc_manager','maintenance_manager','warehouse_keeper',
  'om_technician','energy_trader','hr_manager'
));


-- ============================================================
--   CRM کارخانه — قیف فروش، سرنخ/فرصت و فعالیت (الگوی دیدار)
-- ============================================================
-- سرنخ/فرصت فروش با مراحل قیف؛ به مشتری و محصولِ موجود وصل می‌شود
-- (ضدتکرار). فعالیت‌ها (تماس/جلسه/پیامک/یادداشت) با سررسید و یادآوری.
create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  customer_id uuid references customers(id) on delete set null,
  customer_name text,                 -- سرنخِ هنوز‌مشتری‌نشده
  contact text, phone text,
  product_id uuid references products(id) on delete set null,
  product_name text,
  stage text default 'new'
    check (stage in ('new','contacted','quoted','negotiation','won','lost')),
  value numeric default 0,            -- ارزش برآوردی معامله
  probability int default 20,         -- احتمال موفقیت (٪)
  source text,                        -- منبع سرنخ
  owner_name text,                    -- کارشناس فروش مسئول
  next_action_date date,              -- سررسید اقدام بعدی
  lost_reason text,
  note text,
  created_by_name text, created_at timestamptz default now()
);
create index if not exists idx_crm_leads_project on crm_leads(project_id, stage);

create table if not exists crm_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  lead_id uuid references crm_leads(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  kind text default 'call' check (kind in ('call','meeting','email','sms','task','note')),
  subject text, body text,
  due_date date, done boolean default false,
  owner_name text, created_by_name text, created_at timestamptz default now()
);
create index if not exists idx_crm_act_project on crm_activities(project_id, done);
create index if not exists idx_crm_act_lead on crm_activities(lead_id);

alter table crm_leads enable row level security;
alter table crm_activities enable row level security;
drop policy if exists "crm_leads member all" on crm_leads;
create policy "crm_leads member all" on crm_leads for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));
drop policy if exists "crm_activities member all" on crm_activities;
create policy "crm_activities member all" on crm_activities for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));

-- پیوستگی: سفارش فروش مبدأ خود در قیف را نگه می‌دارد (جلوگیری از سفارش تکراری)
alter table sales_orders     add column if not exists lead_id uuid references crm_leads(id) on delete set null;
alter table production_orders add column if not exists sales_order_id uuid references sales_orders(id) on delete set null;
create index if not exists idx_sales_lead on sales_orders(lead_id);


-- ============================================================
--   فاکتور فروش B2B + مالیات ارزش افزوده + دفتر چک (الگوی سپیدار)
-- ============================================================
create table if not exists sales_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  invoice_no text,
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  order_id uuid references sales_orders(id) on delete set null,
  issue_date date default current_date,
  due_date date,
  lines jsonb default '[]',            -- ردیف‌ها: {product, qty, unit_price}
  subtotal numeric default 0,
  discount numeric default 0,
  vat_rate numeric default 10,         -- درصد مالیات بر ارزش افزوده
  vat numeric default 0,
  total numeric default 0,
  paid numeric default 0,              -- مبلغ وصول‌شده (برای مانده و سنی‌سازی)
  status text default 'issued' check (status in ('draft','issued','paid','overdue','void')),
  payment_terms text,
  note text, created_by_name text, created_at timestamptz default now()
);
create index if not exists idx_inv_project  on sales_invoices(project_id, status);
create index if not exists idx_inv_customer on sales_invoices(customer_id);

create table if not exists cheques (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  kind text default 'receive' check (kind in ('receive','pay')),
  cheque_no text, bank text, branch text,
  amount numeric default 0,
  due_date date,
  party text,                          -- طرف حساب (صادرکننده / ذی‌نفع)
  customer_id uuid references customers(id) on delete set null,
  invoice_id uuid references sales_invoices(id) on delete set null,
  status text default 'in_hand'
    check (status in ('in_hand','deposited','cleared','bounced','returned','spent')),
  cleared_date date,
  note text, created_by_name text, created_at timestamptz default now()
);
create index if not exists idx_chq_project on cheques(project_id, status);

alter table sales_invoices enable row level security;
alter table cheques enable row level security;
drop policy if exists "sales_invoices member all" on sales_invoices;
create policy "sales_invoices member all" on sales_invoices for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));
drop policy if exists "cheques member all" on cheques;
create policy "cheques member all" on cheques for all to authenticated
  using (is_project_member(project_id)) with check (is_project_member(project_id));


-- ============================================================
--   بهینه‌سازی کارایی — ایندکس‌گذاری کامل (بدون تغییر ساختار)
-- ============================================================
-- نکته: تعداد جداول مشکل کارایی نیست؛ Postgres صدها جدول را به‌راحتی
-- مدیریت می‌کند. مشکل واقعی نبود ایندکس روی project_id بود: هر کوئری
-- برنامه با .eq('project_id') فیلتر می‌شود و RLS هم عضویت را بررسی می‌کند،
-- پس بدون ایندکس هر خواندن Seq Scan روی کل جدول است. این بلوک (idempotent)
-- ایندکس‌های لازم را می‌سازد و بار سرور را چند برابر کم می‌کند.

-- ۱) ایندکس project_id روی همه‌ی جداول پروژه‌محور
do $$
declare t text;
begin
  foreach t in array array[
    'phases','tasks','warehouse_items','warehouse_txns','accounts','transactions',
    'project_files','notes','directives','documents','contracts','progress_claims',
    'change_orders','disputes','vendors','purchase_requests','purchase_orders',
    'daily_reports','timesheets','equipment','equipment_logs','quality_records',
    'meetings','letters','rfis','products','production_orders','production_records',
    'machines','maintenance_orders','qc_tests','customers','sales_orders','energy_logs',
    'personnel','overheads','shareholders','custom_sections','section_entries',
    'solar_arrays','solar_inverters','solar_generation','solar_sales','solar_prices',
    'solar_cleaning','solar_faults','crm_leads','crm_activities','sales_invoices','cheques'
  ]
  loop
    execute format('create index if not exists %I on %I(project_id);', t || '_project_idx', t);
  end loop;
end $$;

-- ۲) ایندکس‌های کلیدی برای join و مرتب‌سازی بر اساس تاریخ (کوئری‌های پرتکرار)
create index if not exists idx_members_user     on project_members(user_id);
create index if not exists idx_wtxn_item        on warehouse_txns(item_id);
create index if not exists idx_txn_date         on transactions(project_id, txn_date);
create index if not exists idx_txn_account      on transactions(account_id);
create index if not exists idx_tasks_assignee   on tasks(assignee);
create index if not exists idx_tasks_phase      on tasks(phase_id);
create index if not exists idx_directives_to    on directives(to_user);
create index if not exists idx_claims_contract  on progress_claims(contract_id);
create index if not exists idx_po_pr            on purchase_orders(pr_id);
create index if not exists idx_so_customer      on sales_orders(customer_id);
create index if not exists idx_prodrec_date     on production_records(project_id, record_date);
create index if not exists idx_prodrec_product  on production_records(product_id);
create index if not exists idx_maint_machine    on maintenance_orders(machine_id);
create index if not exists idx_eqlog_equip      on equipment_logs(equipment_id);
create index if not exists idx_solgen_date      on solar_generation(project_id, log_date);
create index if not exists idx_solgen_inv       on solar_generation(inverter_id);
create index if not exists idx_solsales_date    on solar_sales(project_id, sale_date);
create index if not exists idx_daily_date       on daily_reports(project_id, report_date);
create index if not exists idx_timesheet_date   on timesheets(project_id, work_date);

-- ۳) پاک‌سازی ستون مرده: attachment جای خود را به receipt_img داده و بلااستفاده است
alter table transactions drop column if exists attachment;
