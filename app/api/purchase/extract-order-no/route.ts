import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = "숫자(또는 영숫자)만 출력. 설명·한글·특수문자 절대 금지. 없으면 \"없음\".";
const USER_PROMPT =
  '이 이미지는 쇼핑몰 주문상세 화면이다. "주문번호"라는 한글 텍스트를 찾고 그 바로 오른쪽에 붙어있는 숫자만 출력하라. ' +
  '예시: "주문번호 XXXXXXXXXXXXXXXXX" 형식에서 X 자리의 숫자만 출력. 어느 위치에 있든 "주문번호" 텍스트 바로 옆 숫자만 출력하라. ' +
  "주문번호는 10자리 이상 숫자다. 출력 규칙: 숫자만 출력, 띄어쓰기 없음, 하이픈 없음, 한글 없음. " +
  "절대 출력하면 안 되는 것: 010이나 011로 시작하는 전화번호, ****가 포함된 마스킹된 번호, 괄호 안에 있는 숫자, 원이 붙은 금액 숫자, " +
  "날짜 숫자, 우편번호(5자리 이하), 배송요청사항 안의 숫자, 카드번호, 상품 가격. 주문번호를 찾지 못하면 \"없음\"을 출력하라.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const dataUrl = String(body.image || "");
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ ok: false, message: "이미지 형식이 올바르지 않습니다" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, message: "서버에 API 키가 설정되지 않았습니다" }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 50,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
              { type: "text", text: USER_PROMPT },
            ],
          },
        ],
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: result?.error?.message || "추출 실패" }, { status: 500 });
    }

    const extracted = String(result?.content?.[0]?.text || "").trim();
    return NextResponse.json({ ok: true, orderNo: extracted === "없음" ? "" : extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "추출 중 오류가 발생했습니다";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
