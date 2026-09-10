import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { requestPasswordReset } from "../services/supabaseClient";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    await requestPasswordReset(email);
    setIsSubmitting(false);
    // Always show the same confirmation regardless of whether the email exists —
    // don't leak which addresses have accounts.
    setSent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-1 font-heading text-xl font-semibold">Quên mật khẩu</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
        </p>

        {sent ? (
          <p className="text-sm text-muted-foreground">
            Nếu <strong>{email}</strong> có tài khoản, một email đặt lại mật khẩu đã được gửi.
            Kiểm tra hộp thư (và mục Spam) rồi bấm vào link trong email.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm">
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
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              {isSubmitting ? "Đang gửi…" : "Gửi link đặt lại mật khẩu"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-accent">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
