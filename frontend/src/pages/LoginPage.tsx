import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { signIn } from "../services/supabaseClient";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        return;
      }
    } catch {
      setIsSubmitting(false);
      setError("Không thể kết nối tới máy chủ xác thực. Kiểm tra kết nối mạng và thử lại.");
      return;
    }
    // RoleGuard resolves the right home page once /api/me can be read.
    navigate("/");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="mb-1 font-heading text-xl font-semibold">Đăng nhập</h1>
        <p className="mb-5 text-sm text-muted-foreground">Hệ thống Quản lý Thư viện</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted-foreground">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="mb-2 block text-sm">
          <span className="mb-1 block text-muted-foreground">Mật khẩu</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <p className="mb-4 text-right text-sm">
          <Link to="/forgot-password" className="text-accent">
            Quên mật khẩu?
          </Link>
        </p>

        {error && (
          <p role="alert" className="mb-4 text-sm text-danger-foreground">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          {isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <Link to="/register" className="text-accent">
            Đăng ký tài khoản Độc giả
          </Link>
        </p>
      </form>
    </div>
  );
}
