-- ============================================================
-- 한 계정(로그인아이디)이 여러 업체를 운영하는 경우 대응:
-- 1) 실제 입금 이력(vendor_payments)에 업체코드/업체명 컬럼 추가
-- 2) 진행요청서 없이 수동으로 "받아야 하는 돈"을 등록할 수 있는 vendor_charges 테이블 추가
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- ============================================================

alter table vendor_payments add column if not exists company_code text;
alter table vendor_payments add column if not exists company_name text;

create table if not exists vendor_charges (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  company_code text,
  company_name text not null,
  product_name text,
  amount numeric not null,
  charge_date date not null,
  memo text,
  created_at timestamptz not null default now()
);
alter table vendor_charges add column if not exists product_name text;
create index if not exists idx_vendor_charges_login_id on vendor_charges (lower(login_id));

alter table vendor_charges enable row level security;
drop policy if exists vendor_charges_all on vendor_charges;
create policy vendor_charges_all on vendor_charges for all using (true) with check (true);
