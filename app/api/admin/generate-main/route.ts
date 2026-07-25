import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { addDaysByWeekendRule, buildGuideRow, detectPlatform, expandReviewTypes, fmtMMDD, parseDailyPlan } from "@/lib/workRequestExpand";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!isValidAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다" }, { status: 401 });
  }
  void req;

  const { data: pending, error } = await supabase
    .from("work_requests")
    .select("*")
    .eq("status", "접수")
    .eq("main_created", false)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (!pending || !pending.length) {
    return NextResponse.json({ ok: true, orderRows: 0, guideRows: 0, requestCount: 0 });
  }

  const orderRows: Record<string, unknown>[] = [];
  const guideRows: Record<string, unknown>[] = [];
  const doneIds: number[] = [];

  for (const r of pending) {
    const totalCount = Number(r.total_count) || 0;
    if (!totalCount) continue;

    const dailyPlan = parseDailyPlan(r.daily_plan || "", totalCount);
    if (!dailyPlan.length) continue;

    const reviewTypes = expandReviewTypes(r.review_type || "", totalCount);
    const platform = detectPlatform(r.product_url || "");
    const displayOption = !r.real_shipping && r.product_option ? `${r.product_option}/빈` : r.product_option;
    const reviewFeePerUnit = r.real_shipping ? 0 : 1000;
    const deliveryValue = r.delivery_agency ? "CJ대한통운" : null;
    const startDate = new Date(`${r.start_date}T00:00:00`);

    let idx = 0;
    for (let day = 1; day <= dailyPlan.length; day++) {
      const currentDate = addDaysByWeekendRule(startDate, day - 1, r.weekend_work);
      const mmdd = fmtMMDD(currentDate);
      for (let seq = 1; seq <= dailyPlan[day - 1]; seq++) {
        if (idx >= totalCount) break;
        orderRows.push({
          seq: `${day}-${seq}`,
          date_mmdd: mmdd,
          full_date: currentDate.toISOString().slice(0, 10),
          company_code: r.company_code,
          company_name: r.company_name,
          platform,
          product_url: r.product_url,
          product_name: r.keyword,
          option_text: displayOption || "옵션",
          review_type: reviewTypes[idx],
          amount: r.product_price,
          review_fee: reviewFeePerUnit,
          delivery: deliveryValue,
        });
        idx++;
      }
    }

    if (!r.guide_created) guideRows.push(buildGuideRow(r));

    doneIds.push(r.id);
  }

  if (orderRows.length) {
    const { error: insErr } = await supabase.from("orders").insert(orderRows);
    if (insErr) {
      return NextResponse.json({ ok: false, message: `메인시트 생성 실패: ${insErr.message}` }, { status: 500 });
    }
  }
  if (guideRows.length) {
    const { error: guideErr } = await supabase.from("guide_products").insert(guideRows);
    if (guideErr) {
      return NextResponse.json({ ok: false, message: `구매가이드 생성 실패: ${guideErr.message}` }, { status: 500 });
    }
  }
  if (doneIds.length) {
    const { error: updErr } = await supabase
      .from("work_requests")
      .update({ status: "진행중", main_created: true, guide_created: true })
      .in("id", doneIds);
    if (updErr) {
      return NextResponse.json({ ok: false, message: `상태 업데이트 실패: ${updErr.message}` }, { status: 500 });
    }
  }

  // 메인시트 생성 = 실제 진행 시작 시점이므로, 견적 요청금액이 있는 건은 업체정산에 입금으로 자동 등록한다
  const paymentRows = pending
    .filter((r) => doneIds.includes(r.id) && r.login_id && Number(r.deposit_amount) > 0)
    .map((r) => ({
      login_id: r.login_id,
      amount: Number(r.deposit_amount),
      paid_date: new Date().toISOString().slice(0, 10),
      memo: `메인시트 생성 자동등록 (접수번호 ${r.receipt_no})`,
    }));
  let paymentRowsCreated = 0;
  if (paymentRows.length) {
    const { error: payErr } = await supabase.from("vendor_payments").insert(paymentRows);
    if (payErr) {
      return NextResponse.json({ ok: false, message: `입금 자동등록 실패: ${payErr.message}` }, { status: 500 });
    }
    paymentRowsCreated = paymentRows.length;
  }

  return NextResponse.json({
    ok: true,
    orderRows: orderRows.length,
    guideRows: guideRows.length,
    requestCount: doneIds.length,
    paymentRowsCreated,
  });
}
