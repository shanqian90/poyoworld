-- ============================================================
-- 배포 전 보안 강화: anon(공개) 키의 데이터 테이블 직접 접근 차단
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
--
-- 배경: 서버 코드가 이제 anon(publishable) 키가 아니라 secret 키로
-- Supabase에 접속하도록 바뀌었습니다. secret 키는 RLS를 항상 무시(bypass)
-- 하므로 앱 동작에는 전혀 영향이 없습니다.
-- 반면 기존에 공개 GitHub 저장소에 노출됐던 anon 키는 지금 모든 테이블에
-- using(true)로 뚫려있어서, 그 키만 알면 누구나 전체 DB를 읽고 쓸 수
-- 있었습니다. 아래는 그 anon 키의 권한을 전부 차단(deny-all)합니다.
--
-- Storage의 "public read" 정책은 그대로 둡니다 (이미지가 <img> 태그로
-- 브라우저에서 직접 열람되어야 하므로). 업로드(insert)만 차단합니다.
-- ============================================================

-- schema.sql 테이블들
drop policy if exists accounts_all on accounts;
create policy accounts_all on accounts for all using (false) with check (false);

drop policy if exists guide_products_select on guide_products;
create policy guide_products_select on guide_products for select using (false);
drop policy if exists guide_products_insert on guide_products;
create policy guide_products_insert on guide_products for insert with check (false);
drop policy if exists guide_products_update on guide_products;
create policy guide_products_update on guide_products for update using (false) with check (false);
drop policy if exists guide_products_delete on guide_products;
create policy guide_products_delete on guide_products for delete using (false);

drop policy if exists orders_all on orders;
create policy orders_all on orders for all using (false) with check (false);

drop policy if exists blacklist_select on blacklist;
create policy blacklist_select on blacklist for select using (false);
drop policy if exists blacklist_insert on blacklist;
create policy blacklist_insert on blacklist for insert with check (false);
drop policy if exists blacklist_delete on blacklist;
create policy blacklist_delete on blacklist for delete using (false);

drop policy if exists whitelist_select on whitelist;
create policy whitelist_select on whitelist for select using (false);
drop policy if exists whitelist_insert on whitelist;
create policy whitelist_insert on whitelist for insert with check (false);
drop policy if exists whitelist_delete on whitelist;
create policy whitelist_delete on whitelist for delete using (false);

drop policy if exists vendor_payments_all on vendor_payments;
create policy vendor_payments_all on vendor_payments for all using (false) with check (false);

drop policy if exists review_complete_seen_all on review_complete_seen;
create policy review_complete_seen_all on review_complete_seen for all using (false) with check (false);

drop policy if exists notices_all on notices;
create policy notices_all on notices for all using (false) with check (false);

-- staff.sql
drop policy if exists staff_attendance_all on staff_attendance;
create policy staff_attendance_all on staff_attendance for all using (false) with check (false);

-- vendor.sql
drop policy if exists vendors_all on vendors;
create policy vendors_all on vendors for all using (false) with check (false);
drop policy if exists work_requests_all on work_requests;
create policy work_requests_all on work_requests for all using (false) with check (false);

-- vendor-charges.sql
drop policy if exists vendor_charges_all on vendor_charges;
create policy vendor_charges_all on vendor_charges for all using (false) with check (false);

-- expenses.sql
drop policy if exists expenses_all on expenses;
create policy expenses_all on expenses for all using (false) with check (false);

-- storage: 이미지 업로드는 이제 서버(API 라우트)가 secret 키로만 하므로
-- anon 업로드 정책을 막습니다. public read는 그대로 유지합니다.
drop policy if exists "purchase images anon upload" on storage.objects;
create policy "purchase images anon upload" on storage.objects for insert with check (false);

drop policy if exists "review images anon upload" on storage.objects;
create policy "review images anon upload" on storage.objects for insert with check (false);

drop policy if exists "estimate images anon upload" on storage.objects;
create policy "estimate images anon upload" on storage.objects for insert with check (false);

drop policy if exists "vendor files anon upload" on storage.objects;
create policy "vendor files anon upload" on storage.objects for insert with check (false);

drop policy if exists "guide images anon upload" on storage.objects;
create policy "guide images anon upload" on storage.objects for insert with check (false);
