-- ============================================================
-- 현황관리 - 지출내역 (인건비 등 지출 기록)
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- ============================================================

create table if not exists expenses (
  id bigserial primary key,
  category text not null default '인건비',
  person_name text,
  amount numeric not null,
  expense_date date not null,
  memo text,
  source text,
  source_ref text unique,
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_date on expenses (expense_date desc);

alter table expenses enable row level security;
drop policy if exists expenses_all on expenses;
create policy expenses_all on expenses for all using (true) with check (true);
