import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";

import { authErrorMessage, signUpReader } from "../services/supabaseClient";
import { clearPendingRegistration, savePendingRegistration } from "../services/pendingRegistration";
import { api, ApiError } from "../services/apiClient";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthField, AuthPasswordField, AuthFormError } from "../components/auth/AuthField";

/** Self-registration (FR-004/FR-005). Two possible paths depending on the
 * Supabase project's "Confirm email" setting:
 * - ON (default): signUp() returns no session — Supabase emails a confirmation
 *   link; clicking it lands on AuthConfirmPage.tsx, which finishes creating the
 *   `profiles` row.
 * - OFF: signUp() returns an active session immediately, no email involved —
 *   finish the profile right here instead of showing a "check your email"
 *   screen nobody will get. Both paths call the same
 *   /api/auth/complete-registration endpoint either way. */
export function RegisterPage() {
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    // Saved before signUp so AuthConfirmPage can finish the profile after the
    // redirect, even though the page reload wipes this component's state.
    savePendingRegistration(email, { fullName, dateOfBirth, phone });
    const { data, error: signUpError } = await signUpReader({ email, password, fullName, dateOfBirth, phone });
    if (signUpError) {
      setIsSubmitting(false);
      setError(authErrorMessage(signUpError, "Không thể đăng ký — vui lòng thử lại."));
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    if (data.session) {
      // Email confirmation is off — already signed in, no link to click.
      try {
        await api.post("/api/auth/complete-registration", {
          full_name: fullName,
          date_of_birth: dateOfBirth,
          phone,
        });
        clearPendingRegistration();
        navigate("/reader/search", { replace: true });
      } catch (e) {
        setIsSubmitting(false);
        setError(e instanceof ApiError ? e.message : "Không thể hoàn tất đăng ký. Vui lòng thử lại.");
        requestAnimationFrame(() => errorRef.current?.focus());
      }
      return;
    }

    setIsSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-foreground">
            <CheckCircle size={26} weight="fill" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold">Kiểm tra email của bạn</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Đã gửi link xác nhận tới <strong className="text-foreground">{email}</strong>. Mở email
            và bấm vào link để hoàn tất đăng ký (kiểm tra cả mục Spam nếu không thấy).
          </p>
          <Link
            to="/login"
            className="mt-6 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Quay lại đăng nhập
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-heading text-2xl font-semibold">Đăng ký tài khoản Độc giả</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Chỉ cần xác nhận qua email — không cần đến thư viện. Thẻ thư viện của bạn sẽ được cấp
        ngay sau khi đăng ký xong.
      </p>

      <form onSubmit={handleSignUp} noValidate className="mt-6 flex flex-col gap-4">
        <div ref={errorRef} tabIndex={-1}>
          <AuthFormError message={error} />
        </div>

        <AuthField
          label="Họ tên"
          required
          autoComplete="name"
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            label="Ngày sinh"
            type="date"
            required
            autoComplete="bday"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
          <AuthField
            label="Số điện thoại"
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <AuthField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <AuthPasswordField
          label="Mật khẩu"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Đang xác nhận đăng ký…" : "Xác nhận đăng ký"}
          {!isSubmitting && <PaperPlaneTilt size={16} aria-hidden="true" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
