import { Resend } from "resend";

const ADMIN_EMAIL = "shanqian90@gmail.com";

export async function notifyNewWorkRequest(params: {
  companyName: string;
  companyCode: string | null;
  receiptNo: string;
  productCount: number;
  loginId: string;
  adminUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "온라인체험단 <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject: `[신규 요청 접수] ${params.companyName}`,
      html:
        `<h2>신규 작업 요청 접수</h2>` +
        `<b>업체명:</b> ${params.companyName}<br>` +
        `<b>업체코드:</b> ${params.companyCode || "(미지정)"}<br>` +
        `<b>접수번호:</b> ${params.receiptNo}<br>` +
        `<b>제품 수:</b> ${params.productCount}개<br>` +
        `<b>아이디:</b> ${params.loginId}<br><br>` +
        `<a href="${params.adminUrl}">작업요청서 목록 바로가기</a>`,
    });
  } catch {
    /* 이메일 발송 실패는 제출 자체를 막지 않음 */
  }
}
