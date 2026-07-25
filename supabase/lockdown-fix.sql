-- ============================================================
-- lockdown.sql 이후 후속 수정: 브라우저에서 직접 Supabase를 호출하는
-- 화면들이 있어서(업체정산, 근태관리, 업체파일첨부 등), 그 부분만 다시
-- 좁은 범위로 허용합니다. secret 키를 쓰는 서버 코드는 영향 없습니다.
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- ============================================================

-- orders: 읽기만 허용 (퇴출명단/업체정산 화면에서 직접 조회)
drop policy if exists orders_select_anon on orders;
create policy orders_select_anon on orders for select using (true);

-- notices: 읽기만 허용 (공지사항 위젯)
drop policy if exists notices_select_anon on notices;
create policy notices_select_anon on notices for select using (true);

-- work_requests: 읽기만 허용 (최근요청, 업체정산, 매출대시보드)
drop policy if exists work_requests_select_anon on work_requests;
create policy work_requests_select_anon on work_requests for select using (true);

-- vendor_payments: 읽기만 허용 (업체정산)
drop policy if exists vendor_payments_select_anon on vendor_payments;
create policy vendor_payments_select_anon on vendor_payments for select using (true);

-- vendor_charges: 읽기만 허용 (업체정산)
drop policy if exists vendor_charges_select_anon on vendor_charges;
create policy vendor_charges_select_anon on vendor_charges for select using (true);

-- expenses: 등록/삭제만 허용 (근태관리 급여연동, 매출대시보드 지출관리)
drop policy if exists expenses_insert_anon on expenses;
create policy expenses_insert_anon on expenses for insert with check (true);
drop policy if exists expenses_delete_anon on expenses;
create policy expenses_delete_anon on expenses for delete using (true);

-- staff_attendance: 등록/수정만 허용 (근태관리)
drop policy if exists staff_attendance_insert_anon on staff_attendance;
create policy staff_attendance_insert_anon on staff_attendance for insert with check (true);
drop policy if exists staff_attendance_update_anon on staff_attendance;
create policy staff_attendance_update_anon on staff_attendance for update using (true) with check (true);

-- storage vendor-files: 업로드만 다시 허용 (사업자등록증 첨부)
drop policy if exists "vendor files anon upload" on storage.objects;
create policy "vendor files anon upload" on storage.objects
  for insert with check (bucket_id = 'vendor-files');
