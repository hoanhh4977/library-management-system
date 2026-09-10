import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../services/apiClient";
import { supabase } from "../services/supabaseClient";
import { clearPendingRegistration, readPendingRegistration } from "../services/pendingRegistration";

type Status = "waiting" | "need-details" | "submitting" | "error";

/** Landed on after the reader clicks the confirmation link in their email.
 * Supabase has already turned that link into a real session by the time this
 * mounts (or fires SIGNED_IN shortly after) — this page's only job is to
 * finish creating the `profiles` row via POST /api/auth/complete-registration. */
export function AuthConfirmPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  async function finish(details: { fullName: string; dateOfBirth: string; phone: string }) {
    setStatus("submitting");
    try {
      await api.post("/api/auth/complete-registration", {
        full_name: details.fullName,
        date_of_birth: details.dateOfBirth,
        phone: details.phone,
      });
      clearPendingRegistration();
      navigate("/reader/search", { replace: true });
    } catch (e) {
      // 409 = this account's profile already exists (e.g. link opened twice) — that's fine.
      if (e instanceof ApiError && e.status === 409) {
        clearPendingRegistration();
        navigate("/reader/search", { replace: true });
        return;
      }
      setError("Không thể hoàn tất đăng ký. Vui lòng thử lại.");
      setStatus("error");
    }
  }

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email;
      if (!email) {
        // No session yet — Supabase may still be processing the URL; try once more shortly.
        await new Promise((r) => setTimeout(r, 800));
        const retry = await supabase.auth.getSession();
        if (!retry.data.session?.user.email) {
          setStatus("error");
          setError("Link xác nhận không hợp lệ hoặc đã hết hạn.");
          return;
        }
      }
      const pending = readPendingRegistration(email ?? data.session!.user.email!);
      if (pending) {
        await finish(pending);
      } else {
        // Different browser/device than where the form was filled in — ask again.
        setStatus("need-details");
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void finish({ fullName, dateOfBirth, phone });
  }

  if (status === "waiting" || status === "submitting") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Đang xác nhận email…</p>
      </div>
    );
  }

  if (status === "need-details") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h1 className="mb-1 font-heading text-xl font-semibold">Hoàn tất đăng ký</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            Email đã được xác nhận. Nhập lại vài thông tin để hoàn tất hồ sơ.
          </p>
          <div className="flex flex-col gap-3">
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
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            Hoàn tất
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <p className="text-sm text-danger-foreground">{error}</p>
    </div>
  );
}
