-- ============================================================
-- 관리자 비밀번호 초기화 기능 추가분
-- ============================================================

set search_path = public, extensions;

create table if not exists app_settings (
  key text primary key,
  value text not null
);

-- 관리자 비밀번호(.env.local 의 ADMIN_PASSWORD)를 해시로 저장
-- ⚠️ 나중에 ADMIN_PASSWORD 를 바꾸면 이 값도 다시 넣어줘야 함
insert into app_settings (key, value)
values ('admin_password_hash', crypt('포요월드뽀용뽀용', gen_salt('bf')))
on conflict (key) do update set value = excluded.value;

alter table app_settings enable row level security;
-- 정책 없음 = anon 직접 접근 불가 (RPC 안에서만 사용)

create or replace function admin_reset_password(p_login_id text, p_admin_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_updated int;
begin
  select value into v_hash from app_settings where key = 'admin_password_hash';
  if v_hash is null or crypt(p_admin_password, v_hash) <> v_hash then
    raise exception '관리자 인증에 실패했습니다';
  end if;

  update users set password_hash = null where lower(kakao_id) = lower(p_login_id);
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception '해당 아이디를 찾을 수 없습니다';
  end if;

  return json_build_object('ok', true);
end;
$$;

grant execute on function admin_reset_password(text, text) to anon, authenticated;
