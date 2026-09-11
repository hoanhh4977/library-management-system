import { createClient, type AuthError } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Fail loudly in dev rather than silently making unauthenticated requests.
  console.error(
    "Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — kiểm tra file .env (xem .env.example).",
  );
}

export const supabase = createClient(url ?? "", publishableKey ?? "");

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signUpReader(params: {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
}) {
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      // Supabase redirects the browser here after the reader clicks the
      // confirmation link in their email — see pages/AuthConfirmPage.tsx.
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      data: {
        full_name: params.fullName,
        date_of_birth: params.dateOfBirth,
        phone: params.phone,
      },
    },
  });
}

// Maps Supabase Auth's stable `error.code` (see @supabase/auth-js error-codes.ts) to a
// Vietnamese message. Every auth screen used to hardcode one generic "email đã được
// dùng" string no matter what actually failed — including the free tier's very low
// built-in email-send rate limit, which is a far more likely cause in a dev project
// that's been used for repeated signup/reset testing than the email genuinely
// colliding. Falls back to the raw message so an unmapped code is still visible
// instead of silently mislabeled.
const AUTH_ERROR_MESSAGES: Partial<Record<string, string>> = {
  email_exists: "Email này đã được đăng ký — hãy đăng nhập hoặc dùng \"Quên mật khẩu\".",
  user_already_exists: "Email này đã được đăng ký — hãy đăng nhập hoặc dùng \"Quên mật khẩu\".",
  identity_already_exists: "Email này đã được đăng ký — hãy đăng nhập hoặc dùng \"Quên mật khẩu\".",
  weak_password: "Mật khẩu chưa đủ mạnh — hãy dùng ít nhất 8 ký tự, gồm cả chữ và số.",
  email_address_invalid: "Địa chỉ email không hợp lệ.",
  over_email_send_rate_limit: "Hệ thống đang gửi email quá nhiều trong thời gian ngắn — vui lòng thử lại sau vài phút.",
  over_request_rate_limit: "Quá nhiều yêu cầu trong thời gian ngắn — vui lòng thử lại sau vài phút.",
  over_sms_send_rate_limit: "Quá nhiều yêu cầu trong thời gian ngắn — vui lòng thử lại sau vài phút.",
  signup_disabled: "Đăng ký hiện đang tạm khóa — vui lòng liên hệ quản trị viên.",
  email_provider_disabled: "Đăng ký qua email hiện đang tạm khóa — vui lòng liên hệ quản trị viên.",
};

export function authErrorMessage(error: AuthError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  // `unexpected_failure` is too generic a code to map on its own — Supabase uses it
  // for this specific case too (confirmed against the project's actual Auth API: every
  // signup currently 500s with exactly this message, regardless of email — the custom
  // SMTP provider (Resend) is rejecting/failing the send server-side, not a per-user
  // problem), so sniff the message text for it specifically.
  if (error.message?.toLowerCase().includes("sending confirmation email")) {
    return "Hệ thống hiện không gửi được email xác nhận (lỗi từ nhà cung cấp gửi email phía máy chủ) — vui lòng thử lại sau hoặc liên hệ quản trị viên.";
  }
  return AUTH_ERROR_MESSAGES[error.code ?? ""] ?? error.message ?? fallback;
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}
