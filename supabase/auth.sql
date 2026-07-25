-- ============================================================
-- 아이디 + 비밀번호 로그인 추가분
-- Supabase 대시보드 > SQL Editor 에서 schema.sql 다음에 실행하세요.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  kakao_id text not null,
  password_hash text,               -- null = 아직 비밀번호 미설정 (레거시 계정)
  created_at timestamptz not null default now()
);
create unique index if not exists uq_users_kakao_id on users (lower(kakao_id));

-- RLS 활성화 + 정책 없음 = anon 은 이 테이블에 직접 접근 불가.
-- 아래 함수들은 SECURITY DEFINER 로 만들어서 RLS 를 우회하므로
-- 비밀번호 해시가 절대 외부(브라우저)로 노출되지 않는다.
alter table users enable row level security;

drop function if exists auth_check_kakao_id(text);
drop function if exists auth_signup(text, text);

-- ── 기존에 등록된 카카오톡아이디를 이 테이블로 옮겨줄 때 쓰는 함수 ──
-- (계정 스프레드시트에 있던 아이디 목록을 password_hash = null 로 미리 넣어두면
--  그 사람들은 다음 로그인 시도할 때 입력한 비밀번호가 그대로 최초 등록된다)
create or replace function seed_legacy_kakao_id(p_kakao_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_kakao_id is null or trim(p_kakao_id) = '' then
    return;
  end if;
  if not exists (select 1 from users where lower(kakao_id) = lower(p_kakao_id)) then
    insert into users (kakao_id, password_hash) values (p_kakao_id, null);
  end if;
end;
$$;

-- ── 로그인 한 번에 처리: 아이디+비밀번호만 받으면 알아서 판단 ──
-- 1) 처음 보는 아이디  -> 그 자리에서 회원가입
-- 2) 기존 아이디 + 비밀번호 미설정(레거시) -> 지금 입력한 비밀번호로 최초 등록
-- 3) 기존 아이디 + 비밀번호 있음 -> 검증
create or replace function auth_login(p_kakao_id text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row users%rowtype;
begin
  if p_kakao_id is null or trim(p_kakao_id) = '' then
    raise exception '카카오톡 아이디를 입력해주세요';
  end if;
  if p_password is null or length(p_password) < 4 then
    raise exception '비밀번호는 4자 이상 입력해주세요';
  end if;

  select * into v_row from users where lower(kakao_id) = lower(p_kakao_id) limit 1;

  if v_row.id is null then
    insert into users (kakao_id, password_hash)
    values (p_kakao_id, crypt(p_password, gen_salt('bf')));
    return json_build_object('ok', true, 'mode', 'signup');
  end if;

  if v_row.password_hash is null then
    update users set password_hash = crypt(p_password, gen_salt('bf')) where id = v_row.id;
    return json_build_object('ok', true, 'mode', 'claimed');
  end if;

  if crypt(p_password, v_row.password_hash) <> v_row.password_hash then
    raise exception '비밀번호가 일치하지 않습니다';
  end if;

  return json_build_object('ok', true, 'mode', 'login');
end;
$$;

grant execute on function auth_login(text, text) to anon, authenticated;
grant execute on function seed_legacy_kakao_id(text) to anon, authenticated;

-- ── 본인이 직접 비밀번호 변경 (기존 비밀번호 확인 후 변경) ──
create or replace function auth_change_password(p_kakao_id text, p_old_password text, p_new_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row users%rowtype;
begin
  if p_kakao_id is null or trim(p_kakao_id) = '' then
    raise exception '아이디를 입력해주세요';
  end if;
  if p_new_password is null or length(p_new_password) < 4 then
    raise exception '새 비밀번호는 4자 이상 입력해주세요';
  end if;

  select * into v_row from users where lower(kakao_id) = lower(p_kakao_id) limit 1;
  if v_row.id is null then
    raise exception '계정을 찾을 수 없습니다';
  end if;

  if v_row.password_hash is not null then
    if p_old_password is null or crypt(p_old_password, v_row.password_hash) <> v_row.password_hash then
      raise exception '현재 비밀번호가 일치하지 않습니다';
    end if;
  end if;

  update users set password_hash = crypt(p_new_password, gen_salt('bf')) where id = v_row.id;
  return json_build_object('ok', true);
end;
$$;

grant execute on function auth_change_password(text, text, text) to anon, authenticated;

-- ── 관리자 대리 로그인: 비밀번호 검증은 Next.js 쪽에서 관리자 비밀번호로 이미 처리됨.
--    처음 보는 아이디(예: 로그인을 한 번도 안 해본 업체)라도 여기서 바로 등록해서 대리 로그인이 항상 가능하게 한다 ──
create or replace function auth_login_as(p_kakao_id text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row users%rowtype;
begin
  if p_kakao_id is null or trim(p_kakao_id) = '' then
    raise exception '아이디를 입력해주세요';
  end if;

  select * into v_row from users where lower(kakao_id) = lower(p_kakao_id) limit 1;
  if v_row.id is null then
    insert into users (kakao_id, password_hash) values (p_kakao_id, null);
  end if;

  return json_build_object('ok', true, 'mode', 'admin_override');
end;
$$;

grant execute on function auth_login_as(text) to anon, authenticated;
