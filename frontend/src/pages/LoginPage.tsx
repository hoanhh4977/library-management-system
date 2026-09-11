import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";

import { signIn } from "../services/supabaseClient";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthField, AuthPasswordField, AuthFormError } from "../components/auth/AuthField";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signInError } = await signIn(email, password);
      setIsSubmitting(false);
      if (signInError) {
        // Supabase returns status 400 for wrong credentials; anything else
        // (network/5xx) is not a credentials problem — say so explicitly.
        setError(
          signInError.status === 400
            ? "Email hoặc mật khẩu không đúng."
            : `Không thể kết nối tới máy chủ xác thực (${signInError.message}). Vui lòng thử lại.`,
        );
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
    } catch {
      setIsSubmitting(false);
      setError("Không thể kết nối tới máy chủ xác thực. Kiểm tra kết nối mạng và thử lại.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    // RoleGuard resolves the right home page once /api/me can be read.
    navigate("/");
  }

  return (
    <AuthLayout>
      <h1 className="font-heading text-2xl font-semibold">Đăng nhập</h1>
      <p className="mt-1 text-sm text-muted-foreground">Chào mừng quay lại Hệ thống Quản lý Thư viện.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <div ref={errorRef} tabIndex={-1}>
          <AuthFormError message={error} />
        </div>

        <AuthField
          label="Email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <AuthPasswordField
            label="Mật khẩu"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-2 text-right text-sm">
            <Link to="/forgot-password" className="text-accent hover:underline">
              Quên mật khẩu?
            </Link>
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
          {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Đăng ký tài khoản Độc giả
        </Link>
      </p>
    </AuthLayout>
  );
}
