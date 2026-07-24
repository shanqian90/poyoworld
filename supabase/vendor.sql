-- ============================================================
-- 업체견적서(작업요청서) 시스템 추가분
-- schema.sql, auth.sql 다음에 실행하세요.
-- 로그인은 기존 users 테이블(auth_login)을 그대로 재사용합니다
-- (사장님 로그인 아이디 = users.kakao_id 와 같은 값)
-- ============================================================

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  company_code text,
  company_name text not null,
  biz_no text,
  owner_name text,
  email text,
  real_ship_price numeric not null default 3000,
  empty_box_price numeric not null default 3500,
  biz_file_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_vendors_login_id on vendors (lower(login_id));

create table if not exists work_requests (
  id bigserial primary key,
  receipt_no text not null,
  vendor_id uuid references vendors(id),
  company_code text,
  company_name text not null,
  biz_no text,
  owner_name text,
  login_id text,
  start_date date not null,
  weekend_work boolean not null default false,
  unit_price numeric not null default 0,
  product_url text,
  product_option text,
  product_price numeric,
  keyword text not null,
  total_count integer not null,
  daily_plan text,
  review_type text,
  real_shipping boolean not null default false,
  payment_agency boolean not null default false,
  delivery_agency boolean not null default false,
  tax_bill boolean not null default false,
  biz_file_url text,
  status text not null default '접수',
  main_created boolean not null default false,
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists idx_work_requests_status on work_requests (status, main_created);

alter table vendors enable row level security;
alter table work_requests enable row level security;

drop policy if exists vendors_all on vendors;
create policy vendors_all on vendors for all using (true) with check (true);

drop policy if exists work_requests_all on work_requests;
create policy work_requests_all on work_requests for all using (true) with check (true);

alter table work_requests add column if not exists phone text;
alter table work_requests add column if not exists issue_date date;
alter table work_requests add column if not exists deposit_amount numeric;
alter table work_requests add column if not exists deposit_date date;
alter table work_requests add column if not exists image_url text;
