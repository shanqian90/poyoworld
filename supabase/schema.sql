-- ============================================================
-- 포요월드 (구매제출 + 리뷰제출) Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 전체를 그대로 실행하세요.
-- ============================================================

create extension if not exists pgcrypto;

-- ── 계정관리 ────────────────────────────────────────────────
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  kakao_id text not null,
  store text not null,
  buyer text not null,
  receiver text not null,
  user_id text not null,
  phone text not null,
  address text not null,
  bank text not null,
  account_no text not null,
  holder text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_accounts_kakao_id on accounts (lower(kakao_id));
create index if not exists idx_accounts_phone on accounts (phone);

-- ── 구매가이드 ──────────────────────────────────────────────
create table if not exists guide_products (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  code text,
  company text,
  platform text,
  number_text text,
  short_name text not null,
  full_name text,
  option_text text,
  note text,
  product_url text,
  price numeric,
  review_fee text,
  payback_name text,
  has_receipt boolean not null default false,
  buy_type text,
  review_type text,
  delivery text,
  image_url text,
  deadline text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 메인 (구매 슬롯 / 진행 데이터) ──────────────────────────
-- order_no 가 NULL 인 행 = 아직 채워지지 않은 빈 슬롯
create table if not exists orders (
  id bigserial primary key,
  date_mmdd text not null,             -- 예: '0422'
  company_code text,
  company_name text,
  platform text,
  product_url text,
  product_name text not null,
  option_text text not null,
  review_type text,
  review_url text,
  manager text,
  real_manager text,
  order_image text,
  order_no text,
  buyer text,
  receiver text,
  user_id text,
  phone text,
  address text,
  account_text text,
  amount numeric,
  review_fee numeric not null default 0,
  review_done boolean not null default false,
  paid boolean not null default false,
  paid_date date,
  company_paid boolean not null default false,
  delivery text,
  tracking text,
  remark text,
  created_at timestamptz not null default now()
);

-- 주문번호는 채워지면 유일해야 함 (중복 제출 방지)
create unique index if not exists uq_orders_order_no
  on orders (order_no) where order_no is not null;

-- 빈 슬롯 조회용
create index if not exists idx_orders_empty_slot
  on orders (date_mmdd, product_name, option_text) where order_no is null;

-- 리뷰제출 전화번호 조회용
create index if not exists idx_orders_phone on orders (phone);

-- ── 블랙리스트 / 화이트리스트 ───────────────────────────────
-- type: 'phone' 또는 'kakao_id'
-- 블랙리스트: 있으면 무조건 차단
-- 화이트리스트: 해당 type 에 행이 1개라도 있으면 "화이트리스트 모드"가 켜져서
--              그 type 은 목록에 없는 값이면 차단됨 (없으면 화이트리스트 검사 자체를 안 함)
create table if not exists blacklist (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('phone', 'kakao_id')),
  value text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (type, value)
);

create table if not exists whitelist (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('phone', 'kakao_id')),
  value text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (type, value)
);

-- ============================================================
-- 빈 슬롯 원자적 선점 함수
-- 여러 사람이 동시에 제출해도 같은 슬롯을 두 번 배정하지 않도록
-- FOR UPDATE SKIP LOCKED 로 잠근 뒤 order_no 를 즉시 기록한다.
-- ============================================================
create or replace function claim_order_slots(
  p_date_mmdd text,
  p_product_name text,
  p_option_text text,
  p_order_nos text[]
)
returns setof orders
language plpgsql
as $$
declare
  v_need int := array_length(p_order_nos, 1);
  v_ids bigint[];
begin
  if v_need is null or v_need < 1 then
    raise exception '주문번호 목록이 비어 있습니다';
  end if;

  select array_agg(id) into v_ids
  from (
    select id
    from orders
    where order_no is null
      and date_mmdd = p_date_mmdd
      and product_name = p_product_name
      and option_text = p_option_text
    order by id
    limit v_need
    for update skip locked
  ) s;

  if v_ids is null or array_length(v_ids, 1) < v_need then
    raise exception '빈 슬롯이 부족합니다 (남은 슬롯 %건)', coalesce(array_length(v_ids, 1), 0);
  end if;

  for i in 1..v_need loop
    update orders
      set order_no = p_order_nos[i]
      where id = v_ids[i];
  end loop;

  return query select * from orders where id = any(v_ids);
end;
$$;

-- ============================================================
-- RLS: 내부 트러스트 기반 툴이므로 anon(publishable key) 에게
-- 필요한 범위만 열어준다. (원본 GAS 앱도 링크만 알면 누구나 조작 가능한 구조)
-- ============================================================
alter table accounts enable row level security;
alter table guide_products enable row level security;
alter table orders enable row level security;
alter table blacklist enable row level security;
alter table whitelist enable row level security;

drop policy if exists accounts_all on accounts;
create policy accounts_all on accounts for all using (true) with check (true);

drop policy if exists guide_products_select on guide_products;
create policy guide_products_select on guide_products for select using (true);

drop policy if exists guide_products_insert on guide_products;
create policy guide_products_insert on guide_products for insert with check (true);

drop policy if exists guide_products_update on guide_products;
create policy guide_products_update on guide_products for update using (true) with check (true);

drop policy if exists guide_products_delete on guide_products;
create policy guide_products_delete on guide_products for delete using (true);

drop policy if exists orders_all on orders;
create policy orders_all on orders for all using (true) with check (true);

drop policy if exists blacklist_select on blacklist;
create policy blacklist_select on blacklist for select using (true);

drop policy if exists whitelist_select on whitelist;
create policy whitelist_select on whitelist for select using (true);

-- ============================================================
-- Storage 버킷 (구매/리뷰 이미지)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('purchase-images', 'purchase-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

drop policy if exists "purchase images public read" on storage.objects;
create policy "purchase images public read" on storage.objects
  for select using (bucket_id = 'purchase-images');

drop policy if exists "purchase images anon upload" on storage.objects;
create policy "purchase images anon upload" on storage.objects
  for insert with check (bucket_id = 'purchase-images');

drop policy if exists "review images public read" on storage.objects;
create policy "review images public read" on storage.objects
  for select using (bucket_id = 'review-images');

drop policy if exists "review images anon upload" on storage.objects;
create policy "review images anon upload" on storage.objects
  for insert with check (bucket_id = 'review-images');

-- ============================================================
-- 샘플 데이터 (테스트용 - 필요 없으면 지워도 됨)
-- ============================================================
insert into orders (date_mmdd, company_name, product_name, option_text, amount)
select '0724', '테스트업체', '테스트제품', '기본옵션', 15000
where not exists (select 1 from orders limit 1);
