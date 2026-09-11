import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";

import { supabase, updatePassword } from "../services/supabaseClient";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPasswordField, AuthFormError } from "../components/auth/AuthField";

/**
 * Reached by clicking the "reset password" link from the email sent by
 * ForgotPasswordPage. Supabase parses the recovery token from the URL and
 * fires a PASSWORD_RECOVERY auth event before this can safely show the form.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If the tab already processed the recovery link before this listener
    // attached, there's already a session — allow the form immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);
    if (updateError) {
      setError("Không thể đổi mật khẩu — link có thể đã hết hạn, hãy yêu cầu link mới.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    navigate("/login", { replace: true });
  }

  return (
    <AuthLayout>
      <h1 className="font-heading text-2xl font-semibold">Đặt lại mật khẩu</h1>

      {!ready ? (
        <p className="mt-4 text-sm text-muted-foreground">Đang xác thực link đặt lại mật khẩu…</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <div ref={errorRef} tabIndex={-1}>
            <AuthFormError message={error} />
          </div>
          <AuthPasswordField
            label="Mật khẩu mới"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Đang lưu…" : "Đặt mật khẩu mới"}
            {!isSubmitting && <CheckCircle size={16} aria-hidden="true" />}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
