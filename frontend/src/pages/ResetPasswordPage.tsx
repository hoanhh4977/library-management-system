import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { supabase, updatePassword } from "../services/supabaseClient";

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
      return;
    }
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-1 font-heading text-xl font-semibold">Đặt lại mật khẩu</h1>

        {!ready ? (
          <p className="text-sm text-muted-foreground">Đang xác thực link đặt lại mật khẩu…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Mật khẩu mới</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            {error && <p role="alert" className="text-sm text-danger-foreground">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              {isSubmitting ? "Đang lưu…" : "Đặt mật khẩu mới"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
