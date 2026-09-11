import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, EnvelopeSimple, PaperPlaneTilt } from "@phosphor-icons/react";

import { requestPasswordReset } from "../services/supabaseClient";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthField } from "../components/auth/AuthField";

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

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-info text-info-foreground">
            <EnvelopeSimple size={24} weight="fill" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold">Kiểm tra email của bạn</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nếu <strong className="text-foreground">{email}</strong> có tài khoản, một email đặt
            lại mật khẩu đã được gửi. Kiểm tra hộp thư (và mục Spam) rồi bấm vào link trong email.
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
      <h1 className="font-heading text-2xl font-semibold">Quên mật khẩu</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <AuthField
          label="Email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Đang gửi…" : "Gửi link đặt lại mật khẩu"}
          {!isSubmitting && <PaperPlaneTilt size={16} aria-hidden="true" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="inline-flex items-center gap-1 text-accent hover:underline">
          <ArrowLeft size={14} aria-hidden="true" /> Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
