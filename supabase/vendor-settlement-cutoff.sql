-- ============================================================
-- 업체정산 집계 기준일: 이 날짜 이전 요청/입금은 부족액 계산에서 제외
-- (예전에 이미 시스템 밖에서 정산 끝난 건들 때문에 부족액이 실제와
-- 안 맞는 문제 해결용)
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- ============================================================

create table if not exists vendor_settlement_cutoff (
  login_id text primary key,
  cutoff_date date not null,
  updated_at timestamptz not null default now()
);

alter table vendor_settlement_cutoff enable row level security;
-- 정책 없음 = anon 직접 접근 불가 (서버는 secret 키로 접근하므로 정상 동작)
