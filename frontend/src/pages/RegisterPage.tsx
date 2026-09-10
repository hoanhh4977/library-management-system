import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { signUpReader } from "../services/supabaseClient";
import { savePendingRegistration } from "../services/pendingRegistration";

/** Self-registration (FR-004/FR-005): Supabase Auth sends a confirmation link by
 * email; clicking it lands on AuthConfirmPage.tsx, which finishes creating the
 * `profiles` row. Nothing here requires typing a code. */
export function RegisterPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const { error: signUpError } = await signUpReader({ email, password, fullName, dateOfBirth, phone });
    setIsSubmitting(false);
    if (signUpError) {
      setError("Không thể đăng ký — email có thể đã được dùng.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-1 font-heading text-xl font-semibold">Đăng ký tài khoản Độc giả</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Chỉ cần xác nhận qua email — không cần đến thư viện. Thẻ thư viện (để mượn sách)
          sẽ được cấp sau, tại quầy.
        </p>

        {sent ? (
          <p className="text-sm text-muted-foreground">
            Đã gửi link xác nhận tới <strong>{email}</strong>. Mở email và bấm vào link để hoàn
            tất đăng ký (kiểm tra cả mục Spam nếu không thấy).
          </p>
        ) : (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Họ tên</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Ngày sinh</span>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Số điện thoại</span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
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
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Mật khẩu</span>
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
              {isSubmitting ? "Đang gửi link xác nhận…" : "Gửi link xác nhận qua Email"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Đã có tài khoản? <Link to="/login" className="text-accent">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
