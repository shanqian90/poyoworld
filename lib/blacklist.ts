import { SupabaseClient } from "@supabase/supabase-js";
import { normalizeKakaoId, normalizePhoneDigits } from "./phone";

type CheckInput = {
  kakaoId?: string | null;
  phones?: (string | null | undefined)[];
};

export type BlockResult = { blocked: boolean; reason?: string };

/**
 * 블랙리스트: 하나라도 걸리면 즉시 차단.
 * 화이트리스트: 해당 type(phone/kakao_id)에 등록된 행이 1개라도 있으면
 *              "화이트리스트 모드"가 켜져서 목록에 없는 값은 차단된다.
 *              행이 하나도 없으면 그 type 은 검사하지 않는다.
 */
export async function checkBlocked(
  supabase: SupabaseClient,
  input: CheckInput
): Promise<BlockResult> {
  const kakaoId = input.kakaoId ? normalizeKakaoId(input.kakaoId) : "";
  const phones = (input.phones || [])
    .map((p) => normalizePhoneDigits(p || ""))
    .filter((p) => p.length >= 10);

  const { data: blacklistRows, error: blErr } = await supabase
    .from("blacklist")
    .select("type, value");
  if (blErr) throw new Error(blErr.message);

  const { data: whitelistRows, error: wlErr } = await supabase
    .from("whitelist")
    .select("type, value");
  if (wlErr) throw new Error(wlErr.message);

  const blackKakao = new Set(
    (blacklistRows || [])
      .filter((r) => r.type === "kakao_id")
      .map((r) => normalizeKakaoId(r.value))
  );
  const blackPhone = new Set(
    (blacklistRows || [])
      .filter((r) => r.type === "phone")
      .map((r) => normalizePhoneDigits(r.value))
  );
  const whiteKakao = new Set(
    (whitelistRows || [])
      .filter((r) => r.type === "kakao_id")
      .map((r) => normalizeKakaoId(r.value))
  );
  const whitePhone = new Set(
    (whitelistRows || [])
      .filter((r) => r.type === "phone")
      .map((r) => normalizePhoneDigits(r.value))
  );

  if (kakaoId && blackKakao.has(kakaoId)) {
    return { blocked: true, reason: "차단된 계정입니다. 관리자에게 문의해주세요" };
  }
  if (kakaoId && whiteKakao.size > 0 && !whiteKakao.has(kakaoId)) {
    return { blocked: true, reason: "허용되지 않은 계정입니다. 관리자에게 문의해주세요" };
  }

  for (const phone of phones) {
    if (blackPhone.has(phone)) {
      return { blocked: true, reason: "차단된 전화번호가 포함되어 있습니다" };
    }
    if (whitePhone.size > 0 && !whitePhone.has(phone)) {
      return { blocked: true, reason: "허용되지 않은 전화번호가 포함되어 있습니다" };
    }
  }

  return { blocked: false };
}
