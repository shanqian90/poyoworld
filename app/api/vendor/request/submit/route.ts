import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkBlocked } from "@/lib/blacklist";
import { discountUnit } from "@/lib/workRequestExpand";

type ProductInput = {
  productUrl: string;
  startDate: string;
  option: string;
  keyword: string;
  price: number | null;
  totalCount: number;
  dailyPlan: string;
  reviewType: string;
};

function receiptNo(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loginId = String(body.loginId || "").trim();
    const vendorId = String(body.vendorId || "").trim();
    const options = body.options || {};
    const products: ProductInput[] = Array.isArray(body.products) ? body.products : [];

    if (!loginId) return fail("로그인이 필요합니다");
    if (!vendorId) return fail("업체를 선택해주세요");
    if (!products.length) return fail("제품을 1개 이상 입력해주세요");

    const block = await checkBlocked(supabase, { kakaoId: loginId });
    if (block.blocked) return fail(block.reason || "차단되었습니다", 403);

    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();
    if (vendorErr || !vendor) return fail("업체 정보를 찾을 수 없습니다");

    const realShip = options.realShip === "Y";
    const baseUnit = realShip ? vendor.real_ship_price : vendor.empty_box_price;
    const rNo = receiptNo();

    const rows = products.map((p) => {
      const qty = Number(p.totalCount) || 0;
      const unitPrice = discountUnit(baseUnit, qty);
      return {
        receipt_no: rNo,
        vendor_id: vendor.id,
        company_code: vendor.company_code,
        company_name: vendor.company_name,
        biz_no: vendor.biz_no,
        owner_name: vendor.owner_name,
        login_id: loginId,
        start_date: p.startDate,
        weekend_work: options.weekend === "Y",
        unit_price: unitPrice,
        product_url: p.productUrl || null,
        product_option: p.option || null,
        product_price: p.price,
        keyword: p.keyword,
        total_count: qty,
        daily_plan: p.dailyPlan || null,
        review_type: p.reviewType || null,
        real_shipping: realShip,
        payment_agency: options.payAgent === "Y",
        delivery_agency: options.shipAgent === "Y",
        tax_bill: options.taxBill === "Y",
        status: "접수",
        main_created: false,
      };
    });

    const { error: insErr } = await supabase.from("work_requests").insert(rows);
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, receiptNo: rNo, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "제출 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
