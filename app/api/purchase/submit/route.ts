import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkBlocked } from "@/lib/blacklist";
import { extFromMime, parseDataUrl, uploadImage } from "@/lib/storage";
import { getSlotMap, resolveOptionText } from "@/lib/slots";

type Submission = {
  orderNo: string;
  buyer: string;
  receiver: string;
  userId: string;
  phone: string;
  address: string;
  accountText: string;
  images: string[];
  noImage?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dateMmdd = String(body.dateText || "").trim();
    const productName = String(body.productName || "").trim();
    const optionNo = String(body.optionNo || "").replace(/번/g, "").trim();
    const kakaoId = String(body.kakaoId || "").trim();
    const submissions: Submission[] = Array.isArray(body.submissions) ? body.submissions : [];

    if (!/^\d{4}$/.test(dateMmdd)) return fail("구매일을 확인하세요");
    if (!productName) return fail("제품명을 확인하세요");
    if (!optionNo) return fail("옵션번호를 확인하세요");
    if (!kakaoId) return fail("로그인이 필요합니다");
    if (!submissions.length) return fail("제출할 계정을 선택하세요");

    const seen = new Set<string>();
    for (let i = 0; i < submissions.length; i++) {
      const no = String(submissions[i].orderNo || "").trim();
      if (!no) return fail(`${i + 1}번째 계정의 주문번호를 입력해주세요`);
      if (seen.has(no)) return fail(`주문번호가 중복되었습니다: ${no}`);
      seen.add(no);
    }
    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      if (s.noImage) continue;
      if (!s.images || !s.images.length) return fail(`${i + 1}번째 계정의 이미지를 올려주세요`);
      if (s.images.length > 2) return fail(`${i + 1}번째 계정의 이미지는 최대 2장입니다`);
    }

    const block = await checkBlocked(supabase, {
      kakaoId,
      phones: submissions.map((s) => s.phone),
    });
    if (block.blocked) return fail(block.reason || "차단되었습니다", 403);

    // 옵션 텍스트 계산 (전체 행 기준 첫등장 순서)
    const map = await getSlotMap(supabase, dateMmdd);
    // getSlotMap 은 "빈 슬롯이 있는" 옵션만 주므로, 옵션 텍스트 계산엔 order 배열이 필요.
    // 여기선 간단히 orders 테이블에서 다시 순서를 뽑는다.
    const { data: allRows, error: allErr } = await supabase
      .from("orders")
      .select("option_text")
      .eq("date_mmdd", dateMmdd)
      .eq("product_name", productName)
      .order("id", { ascending: true });
    if (allErr) throw new Error(allErr.message);
    const optionOrder: string[] = [];
    for (const r of allRows || []) {
      if (r.option_text && !optionOrder.includes(r.option_text)) optionOrder.push(r.option_text);
    }
    const optionText = resolveOptionText(optionOrder, optionNo);
    if (!optionText) return fail("해당 옵션을 찾을 수 없습니다");
    void map;

    const orderNos = submissions.map((s) => String(s.orderNo).trim());

    const { data: claimed, error: claimErr } = await supabase.rpc("claim_order_slots", {
      p_date_mmdd: dateMmdd,
      p_product_name: productName,
      p_option_text: optionText,
      p_order_nos: orderNos,
    });
    if (claimErr) return fail(claimErr.message, 409);

    const claimedRows = (claimed || []) as { id: number; order_no: string }[];
    const rowByOrderNo = new Map(claimedRows.map((r) => [r.order_no, r.id]));

    const { data: companyRows } = await supabase
      .from("orders")
      .select("id, company_code, company_name")
      .in("id", claimedRows.map((r) => r.id));
    const companyById = new Map((companyRows || []).map((r) => [r.id, r]));

    let noImageCount = 0;
    const results: { orderNo: string; ok: boolean; message?: string; images?: string[] }[] = [];

    for (const s of submissions) {
      const rowId = rowByOrderNo.get(String(s.orderNo).trim());
      if (!rowId) {
        results.push({ orderNo: s.orderNo, ok: false, message: "슬롯 배정 실패" });
        continue;
      }
      try {
        let imageUrl = "";
        const uploaded: string[] = [];
        if (s.noImage) {
          noImageCount++;
        } else {
          const company = companyById.get(rowId);
          const companyFolder = safeFolderName(company?.company_code || company?.company_name || "미지정업체");
          for (let i = 0; i < s.images.length; i++) {
            const { mime } = parseDataUrl(s.images[i]);
            const ext = extFromMime(mime);
            const safeOrderNo = String(s.orderNo).replace(/[^a-zA-Z0-9_-]/g, "_");
            const path = `${companyFolder}/${dateMmdd}/${safeOrderNo}_${i + 1}.${ext}`;
            const url = await uploadImage(supabase, "purchase-images", path, s.images[i]);
            uploaded.push(url);
          }
          imageUrl = uploaded[0] || "";
        }

        const { error: updErr } = await supabase
          .from("orders")
          .update({
            buyer: s.buyer,
            receiver: s.receiver,
            user_id: s.userId,
            phone: s.phone,
            address: s.address,
            account_text: s.accountText,
            order_image: s.noImage
              ? `⚠️ 이미지 미제출 - 개인톡으로 받기 (${s.buyer})`
              : imageUrl,
          })
          .eq("id", rowId);
        if (updErr) throw new Error(updErr.message);
        results.push({ orderNo: s.orderNo, ok: true, images: uploaded });
      } catch (err) {
        results.push({
          orderNo: s.orderNo,
          ok: false,
          message: err instanceof Error ? err.message : "처리 실패",
        });
      }
    }

    return NextResponse.json({ ok: true, count: submissions.length, noImageCount, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "제출 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function safeFolderName(name: string): string {
  return name.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "미지정업체";
}
