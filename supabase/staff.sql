-- ============================================================
-- 직원관리 + 출퇴근인증 + 월급명세서
-- Supabase 대시보드 > SQL Editor 에서 schema.sql, auth.sql, vendor.sql 다음에 실행하세요.
-- ============================================================

create extension if not exists pgcrypto;

-- ── 직원 명단 (로그인 계정 + 급여 조건) ──
-- password_hash = null 이면 아직 비밀번호 미설정 → 다음 로그인 시 입력한 비밀번호가 그대로 등록됨
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  login_id text not null,
  password_hash text,
  account_text text,
  hourly_wage numeric not null default 0,
  withhold_tax boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_staff_login_id on staff (lower(login_id));

-- staff 는 비밀번호 해시를 담고 있으므로 RLS 를 걸고 정책은 하나도 두지 않는다.
-- (anon 은 직접 조회/수정 불가, 아래 SECURITY DEFINER 함수를 통해서만 접근)
alter table staff enable row level security;

-- ── 출퇴근 기록 (하루에 한 행, 직원별) ──
create table if not exists staff_attendance (
  id bigserial primary key,
  staff_id uuid not null references staff(id) on delete cascade,
  work_date date not null,
  clock_in time,
  clock_out time,
  hours numeric,
  hourly_wage numeric,
  daily_pay numeric,
  net_pay numeric,
  note text,
  paid_at date,
  created_at timestamptz not null default now(),
  unique (staff_id, work_date)
);
create index if not exists idx_staff_attendance_staff_date on staff_attendance (staff_id, work_date desc);
alter table staff_attendance add column if not exists lunch_minutes integer not null default 0;

-- 이 테이블은 서버 라우트가 로그인 세션(staff_id)으로 항상 필터링해서 접근하므로
-- 나머지 일반 테이블들과 동일하게 RLS true 정책을 사용한다.
alter table staff_attendance enable row level security;
drop policy if exists staff_attendance_all on staff_attendance;
create policy staff_attendance_all on staff_attendance for all using (true) with check (true);

-- ============================================================
-- 직원 로그인 (아이디+비밀번호, 최초 로그인 시 비밀번호 등록)
-- ============================================================
create or replace function staff_login(p_login_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row staff%rowtype;
begin
  if p_login_id is null or trim(p_login_id) = '' then
    raise exception '아이디를 입력해주세요';
  end if;
  if p_password is null or length(p_password) < 4 then
    raise exception '비밀번호는 4자 이상 입력해주세요';
  end if;

  select * into v_row from staff where lower(login_id) = lower(p_login_id) and active limit 1;
  if v_row.id is null then
    raise exception '등록되지 않은 직원 아이디입니다';
  end if;

  if v_row.password_hash is null then
    update staff set password_hash = crypt(p_password, gen_salt('bf')) where id = v_row.id;
    return json_build_object('ok', true, 'mode', 'claimed', 'staffId', v_row.id, 'name', v_row.name);
  end if;

  if crypt(p_password, v_row.password_hash) <> v_row.password_hash then
    raise exception '비밀번호가 일치하지 않습니다';
  end if;

  return json_build_object('ok', true, 'mode', 'login', 'staffId', v_row.id, 'name', v_row.name);
end;
$$;
grant execute on function staff_login(text, text) to anon, authenticated;

-- ── 본인 비밀번호 변경 ──
create or replace function staff_change_password(p_staff_id uuid, p_old_password text, p_new_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row staff%rowtype;
begin
  if p_new_password is null or length(p_new_password) < 4 then
    raise exception '새 비밀번호는 4자 이상 입력해주세요';
  end if;

  select * into v_row from staff where id = p_staff_id;
  if v_row.id is null then
    raise exception '계정을 찾을 수 없습니다';
  end if;

  if v_row.password_hash is not null then
    if p_old_password is null or crypt(p_old_password, v_row.password_hash) <> v_row.password_hash then
      raise exception '현재 비밀번호가 일치하지 않습니다';
    end if;
  end if;

  update staff set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_staff_id;
  return json_build_object('ok', true);
end;
$$;
grant execute on function staff_change_password(uuid, text, text) to anon, authenticated;

-- ── 로그인 세션에서 본인 프로필 조회 (비밀번호 해시는 절대 반환 안 함) ──
create or replace function get_staff_profile(p_staff_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row staff%rowtype;
begin
  select * into v_row from staff where id = p_staff_id and active;
  if v_row.id is null then
    raise exception '계정을 찾을 수 없습니다';
  end if;
  return json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'loginId', v_row.login_id,
    'accountText', v_row.account_text,
    'hourlyWage', v_row.hourly_wage,
    'withholdTax', v_row.withhold_tax
  );
end;
$$;
grant execute on function get_staff_profile(uuid) to anon, authenticated;

-- ── 관리자가 전체 직원 명단 조회 (비밀번호 해시 제외) ──
create or replace function admin_list_staff()
returns table (
  id uuid, name text, login_id text, has_password boolean, account_text text,
  hourly_wage numeric, withhold_tax boolean, active boolean, created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select id, name, login_id, (password_hash is not null), account_text, hourly_wage, withhold_tax, active, created_at
  from staff
  order by created_at asc;
$$;
grant execute on function admin_list_staff() to anon, authenticated;

-- ── 관리자가 직원 등록/수정 (신규면 p_id를 null로 호출) ──
create or replace function admin_upsert_staff(
  p_id uuid,
  p_name text,
  p_login_id text,
  p_account_text text,
  p_hourly_wage numeric,
  p_withhold_tax boolean,
  p_active boolean
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception '이름을 입력해주세요';
  end if;
  if p_login_id is null or trim(p_login_id) = '' then
    raise exception '아이디를 입력해주세요';
  end if;

  if p_id is null then
    insert into staff (name, login_id, account_text, hourly_wage, withhold_tax, active)
    values (p_name, p_login_id, p_account_text, coalesce(p_hourly_wage, 0), coalesce(p_withhold_tax, false), coalesce(p_active, true))
    returning id into v_id;
  else
    update staff set
      name = p_name,
      login_id = p_login_id,
      account_text = p_account_text,
      hourly_wage = coalesce(p_hourly_wage, 0),
      withhold_tax = coalesce(p_withhold_tax, false),
      active = coalesce(p_active, true)
    where id = p_id
    returning id into v_id;
  end if;

  return json_build_object('ok', true, 'id', v_id);
end;
$$;
grant execute on function admin_upsert_staff(uuid, text, text, text, numeric, boolean, boolean) to anon, authenticated;

-- ── 관리자가 직원 비밀번호 초기화 (다음 로그인 시 새로 등록되도록) ──
create or replace function admin_reset_staff_password(p_staff_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update staff set password_hash = null where id = p_staff_id;
  return json_build_object('ok', true);
end;
$$;
grant execute on function admin_reset_staff_password(uuid) to anon, authenticated;

-- ── 관리자 대리 로그인: 아이디가 존재하는지만 확인 (비밀번호 검증은 Next.js 쪽에서 관리자 비밀번호로 처리) ──
create or replace function staff_login_as(p_login_id text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row staff%rowtype;
begin
  if p_login_id is null or trim(p_login_id) = '' then
    raise exception '아이디를 입력해주세요';
  end if;

  select * into v_row from staff where lower(login_id) = lower(p_login_id) and active limit 1;
  if v_row.id is null then
    raise exception '등록되지 않은 직원 아이디입니다';
  end if;

  return json_build_object('ok', true, 'mode', 'admin_override', 'staffId', v_row.id, 'name', v_row.name);
end;
$$;
grant execute on function staff_login_as(text) to anon, authenticated;
