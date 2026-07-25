-- ============================================================
-- 로그인 무차별 대입(brute-force) 방지용 시도 기록 테이블
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- ============================================================

create table if not exists login_attempts (
  id bigserial primary key,
  ip text not null,
  scope text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_login_attempts_ip_scope on login_attempts (ip, scope, created_at desc);

-- RLS 활성화 + 정책 없음 = anon 직접 접근 불가.
-- 서버는 secret 키로 접근하므로 RLS를 무시하고 정상 동작한다.
alter table login_attempts enable row level security;
