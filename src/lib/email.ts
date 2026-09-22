import "server-only";
import { db, schema } from "@/db";

export const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Address in the public footer. CONTACT_EMAIL overrides the placeholder. */
export function publicContactEmail(): string {
  const raw = process.env.CONTACT_EMAIL?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "hello@yado.example";
}

/**
 * Sends an email through Resend when RESEND_API_KEY is set; otherwise records it in the
 * `emails` table (visible at /admin/emails) and prints it to the server log.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Yado <onboarding@resend.dev>";
  let provider = "console";
  let status = "logged";
  if (key) {
    provider = "resend";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, text: body }),
      });
      status = res.ok ? "sent" : `failed:${res.status}`;
    } catch (e) {
      status = `failed:${(e as Error).message}`;
    }
  } else {
    console.log(`\n📧 [email → ${to}] ${subject}\n${body}\n`);
  }
  db.insert(schema.emails).values({ to, subject, body, provider, status }).run();
}

export const templates = {
  magicLink: (locale: string, url: string) =>
    locale === "ja"
      ? { subject: "Yado ログインリンク", body: `以下のリンクをタップしてログインしてください（1時間有効）:\n\n${url}\n\n心当たりがない場合はこのメールを無視してください。` }
      : { subject: "Your Yado sign-in link", body: `Tap the link below to sign in (valid for 1 hour):\n\n${url}\n\nIf you didn't request this, you can ignore this email.` },
  verifyPartner: (locale: string, url: string) =>
    locale === "ja"
      ? { subject: "Yado パートナー登録：メールアドレスの確認", body: `ご登録ありがとうございます。以下のリンクでメールアドレスを確認してください（24時間有効）:\n\n${url}\n\n確認後、運営による審査を行います。` }
      : { subject: "Yado partner registration: confirm your email", body: `Thanks for registering. Confirm your email with the link below (valid for 24 hours):\n\n${url}\n\nAfter that, our team will review your property.` },
  resetPassword: (locale: string, url: string) =>
    locale === "ja"
      ? { subject: "Yado パスワード再設定", body: `以下のリンクから新しいパスワードを設定してください（2時間有効）:\n\n${url}\n\n心当たりがない場合はこのメールを無視してください。` }
      : { subject: "Reset your Yado password", body: `Set a new password with the link below (valid for 2 hours):\n\n${url}\n\nIf you didn't request this, you can ignore this email.` },
  partnerApproved: (locale: string, hotelName: string, url: string) =>
    locale === "ja"
      ? { subject: `「${hotelName}」の登録が承認されました`, body: `審査が完了し、施設が承認されました。年会費のお支払い後に掲載が開始されます:\n\n${url}` }
      : { subject: `"${hotelName}" has been approved`, body: `Your property passed review. Pay the annual partner fee to go live:\n\n${url}` },
  partnerRejected: (locale: string, hotelName: string, note: string) =>
    locale === "ja"
      ? { subject: `「${hotelName}」の登録について`, body: `審査の結果、今回は承認を見送らせていただきました。\n\n理由: ${note || "（記載なし）"}\n\n内容を修正のうえ再申請いただけます。` }
      : { subject: `About your registration for "${hotelName}"`, body: `We were not able to approve the property this time.\n\nReason: ${note || "(none given)"}\n\nYou can update the details and resubmit.` },
  bookingConfirmed: (locale: string, ref: string, hotelName: string, checkIn: string, checkOut: string, url: string) =>
    locale === "ja"
      ? { subject: `予約確定 ${ref} – ${hotelName}`, body: `ご予約が確定しました。\n\n予約番号: ${ref}\n施設: ${hotelName}\nチェックイン: ${checkIn}\nチェックアウト: ${checkOut}\n\n詳細: ${url}` }
      : { subject: `Booking confirmed ${ref} – ${hotelName}`, body: `Your booking is confirmed.\n\nReference: ${ref}\nProperty: ${hotelName}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\n\nDetails: ${url}` },
  newBookingForHotel: (locale: string, ref: string, hotelName: string, guest: string, checkIn: string, checkOut: string) =>
    locale === "ja"
      ? { subject: `新規予約 ${ref} – ${hotelName}`, body: `${hotelName} に新しい予約が入りました。\n\n予約番号: ${ref}\n宿泊者: ${guest}\nチェックイン: ${checkIn}\nチェックアウト: ${checkOut}\n\nパートナーポータルで確認: ${APP_URL}/ja/partner/bookings` }
      : { subject: `New booking ${ref} – ${hotelName}`, body: `New booking for ${hotelName}.\n\nRef: ${ref}\nGuest: ${guest}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\n\nSee it in your partner dashboard: ${APP_URL}/en/partner/bookings` },
  changeRequestResolved: (locale: string, hotelName: string, field: string, decision: "done" | "declined", note: string, url: string) =>
    locale === "ja"
      ? {
          subject: `「${hotelName}」の変更依頼（${field}）について`,
          body: decision === "done"
            ? `ご依頼の変更を反映しました。\n\n${note ? `メモ: ${note}\n\n` : ""}登録情報を確認: ${url}`
            : `今回はご依頼の変更を反映できませんでした。\n\n理由: ${note || "（記載なし）"}\n\n登録情報: ${url}`,
        }
      : {
          subject: `Your change request for "${hotelName}" (${field})`,
          body: decision === "done"
            ? `The change you asked for has been applied.\n\n${note ? `Note: ${note}\n\n` : ""}See your registered details: ${url}`
            : `We could not apply the change you asked for.\n\nReason: ${note || "(none given)"}\n\nYour registered details: ${url}`,
        },
};
