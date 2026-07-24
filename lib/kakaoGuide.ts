export const KAKAO_GUIDE_DIVIDER = "━━━━━━━━━━━━━━━━━━";

const WARNING_BLOCK = [
  "🚨 필독",
  "   ▸ 제품 수령 후 임의 취소 및 반품 불가",
  "   ▸ 임의 취소, 반품, 리뷰 미이행으로 손해 발생 시 내용증명 발송 및 손해배상 청구가 진행될 수 있습니다",
  "   ▸ 관련 자료는 법적 절차 진행 시 증빙자료로 제출될 수 있습니다",
  "   ▸ 규정 위반 시 즉시 퇴출 및 재참여가 영구 제한됩니다",
];

export type KakaoGuideInput = {
  title: string;
  product: string;
  reviewGuide: string;
  formLink: string;
};

export function buildKakaoGuide(d: KakaoGuideInput): string {
  const reviewLines = d.reviewGuide.split("\n").map((line) => "   ▸ " + line);
  const productLines = d.product
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      return "✨ " + t.replace(/^(\d+)\s*/, "$1번 ");
    })
    .filter(Boolean);

  let lines = [
    "🌷 " + d.title,
    "⏰ 2분 체류 필수!!",
    "",
    KAKAO_GUIDE_DIVIDER,
    "",
    "구매할제품",
  ];
  lines = lines.concat(productLines);
  lines = lines.concat([
    "",
    "1️⃣ 하단 링크를 클릭한뒤 가이드확인하기",
    "🔗 " + d.formLink,
    "2️⃣ 제품 클릭링크하여 구매한뒤 구매폼작성하기",
    "3️⃣ 제품도착하면 리뷰작성후 리뷰폼내기",
    "⚠️ 리뷰도 폼으로 작성해주세요",
    "",
    KAKAO_GUIDE_DIVIDER,
    "",
    "📌 구매폼에는 주문번호와 옵션이 들어간",
    "     상세내역 이미지만 올려주세요",
    "",
    "✅ 폼 제출 → 찜 캡처 전송 → 수취인 전달",
    "",
    KAKAO_GUIDE_DIVIDER,
    "",
    "📷 리뷰 가이드 (7일 이내 제출 필수)",
  ]);
  lines = lines.concat(reviewLines);
  lines = lines.concat([
    "",
    KAKAO_GUIDE_DIVIDER,
    "",
    "💰 입금자명 : 진행일자+구매한제품",
    "⏰ 제출 후 3일 이내 입금 (주말제외)",
    "",
    KAKAO_GUIDE_DIVIDER,
    "",
  ]);
  lines = lines.concat(WARNING_BLOCK);
  lines = lines.concat(["", KAKAO_GUIDE_DIVIDER]);
  return lines.join("\n");
}
