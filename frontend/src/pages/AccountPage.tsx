import { useState, type FormEvent } from "react";
import {
  CalendarBlank,
  EnvelopeSimple,
  IdentificationCard,
  Lock,
  Phone,
  ShieldCheck,
} from "@phosphor-icons/react";

import { useMe } from "../hooks/useMe";
import { usePageHeader } from "../components/layouts/PageHeaderContext";
import { Avatar } from "../components/Avatar";
import { StatusBadge } from "../components/StatusBadge";
import { AuthPasswordField } from "../components/auth/AuthField";
import { authErrorMessage, signIn, updatePassword } from "../services/supabaseClient";
import type { Role } from "../types/api";

const ROLE_LABEL: Record<Role, string> = {
  reader: "Độc giả",
  librarian: "Nhân viên thủ thư",
  admin: "Quản trị viên",
};

const ROLE_PILL_CLASS: Record<Role, string> = {
  reader: "bg-info text-info-foreground",
  librarian: "bg-success text-success-foreground",
  admin: "bg-pending text-pending-foreground",
};

function InfoRow({ icon: Icon, label, value }: { icon: typeof CalendarBlank; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

/** Re-authenticates with the current password before calling updateUser() —
 * Supabase's own API doesn't require this (updateUser just needs an active
 * session), but silently trusting whatever's typed into "current password"
 * without checking it against anything would make the field pure theater. */
function ChangePasswordCard({ email }: { email: string | undefined }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu mới không khớp.");
      return;
    }
    if (!email) {
      setError("Không xác định được email tài khoản.");
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await signIn(email, currentPassword);
    if (signInError) {
      setIsSubmitting(false);
      setError("Mật khẩu hiện tại không đúng.");
      return;
    }

    const { error: updateError } = await updatePassword(newPassword);
    setIsSubmitting(false);
    if (updateError) {
      setError(authErrorMessage(updateError, "Không thể đổi mật khẩu — vui lòng thử lại."));
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning text-warning-foreground">
          <Lock size={16} aria-hidden="true" />
        </span>
        <p className="font-heading text-sm font-semibold">Đổi mật khẩu</p>
      </div>
      <p className="mb-4 pl-10 text-xs text-muted-foreground">
        Yêu cầu nhập đúng mật khẩu hiện tại trước khi đổi sang mật khẩu mới.
      </p>
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
        <AuthPasswordField
          label="Mật khẩu hiện tại"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <AuthPasswordField
          label="Mật khẩu mới"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <AuthPasswordField
          label="Xác nhận mật khẩu mới"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger-foreground">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-1.5 text-sm text-success-foreground">
            <ShieldCheck size={15} aria-hidden="true" /> Đã đổi mật khẩu thành công.
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {isSubmitting ? "Đang xử lý…" : "Đổi mật khẩu"}
        </button>
      </form>
    </div>
  );
}

/** Shared "Tài khoản của tôi" page — same component mounted at /reader/account,
 * /librarian/account and /admin/account, since every role gets the identical
 * view-your-own-info + change-password capability; only the "Thẻ thư viện" row
 * is role-conditional (readers only). */
export function AccountPage() {
  const { data: me } = useMe();

  usePageHeader({ title: "Tài khoản của tôi", subtitle: "Thông tin cá nhân và bảo mật" });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-info/20 lg:col-span-1">
        <div className="flex flex-col items-center px-5 pb-5 pt-8 text-center">
          <Avatar name={me?.full_name ?? "?"} size="lg" />
          <p className="mt-3 font-heading text-lg font-semibold">{me?.full_name}</p>
          {me && (
            <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_PILL_CLASS[me.role]}`}>
              {ROLE_LABEL[me.role]}
            </span>
          )}
          {me?.role === "reader" && (
            <div className="mt-3 flex items-center gap-2">
              {me.library_card ? (
                <>
                  <span className="font-mono text-xs text-muted-foreground">{me.library_card.code}</span>
                  <StatusBadge status={me.library_card.status} />
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Chưa có thẻ thư viện</span>
              )}
            </div>
          )}
        </div>
        <div className="divide-y divide-border border-t border-border bg-card px-5">
          <InfoRow icon={IdentificationCard} label="Mã" value={me?.code ?? ""} />
          <InfoRow icon={EnvelopeSimple} label="Email" value={me?.email ?? ""} />
          <InfoRow icon={Phone} label="Số điện thoại" value={me?.phone || "—"} />
          <InfoRow icon={CalendarBlank} label="Ngày sinh" value={me?.date_of_birth ?? ""} />
          {me?.role === "reader" && me.library_card && (
            <InfoRow icon={CalendarBlank} label="Ngày cấp thẻ" value={me.library_card.issued_at} />
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        <ChangePasswordCard email={me?.email} />
      </div>
    </div>
  );
}
