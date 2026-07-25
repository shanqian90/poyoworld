-- ============================================================
-- 직원 급여방식 구분 (시급제 / 고정월급제)
-- Supabase 대시보드 > SQL Editor 에서 staff.sql 다음에 실행하세요.
-- ============================================================

alter table staff add column if not exists is_fixed_salary boolean not null default false;

drop function if exists admin_list_staff();
create or replace function admin_list_staff()
returns table (
  id uuid, name text, login_id text, has_password boolean, account_text text,
  hourly_wage numeric, withhold_tax boolean, is_fixed_salary boolean, active boolean, created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select id, name, login_id, (password_hash is not null), account_text, hourly_wage, withhold_tax, is_fixed_salary, active, created_at
  from staff
  order by created_at asc;
$$;
grant execute on function admin_list_staff() to anon, authenticated;

drop function if exists admin_upsert_staff(uuid, text, text, text, numeric, boolean, boolean);
create or replace function admin_upsert_staff(
  p_id uuid,
  p_name text,
  p_login_id text,
  p_account_text text,
  p_hourly_wage numeric,
  p_withhold_tax boolean,
  p_active boolean,
  p_is_fixed_salary boolean default false
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
    insert into staff (name, login_id, account_text, hourly_wage, withhold_tax, active, is_fixed_salary)
    values (p_name, p_login_id, p_account_text, coalesce(p_hourly_wage, 0), coalesce(p_withhold_tax, false), coalesce(p_active, true), coalesce(p_is_fixed_salary, false))
    returning id into v_id;
  else
    update staff set
      name = p_name,
      login_id = p_login_id,
      account_text = p_account_text,
      hourly_wage = coalesce(p_hourly_wage, 0),
      withhold_tax = coalesce(p_withhold_tax, false),
      active = coalesce(p_active, true),
      is_fixed_salary = coalesce(p_is_fixed_salary, false)
    where id = p_id
    returning id into v_id;
  end if;

  return json_build_object('ok', true, 'id', v_id);
end;
$$;
grant execute on function admin_upsert_staff(uuid, text, text, text, numeric, boolean, boolean, boolean) to anon, authenticated;
