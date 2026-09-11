import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

const inputClasses =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

/** Labeled text input shared by every auth form — inline error rendered right
 * below the field (`error-placement`), connected via aria-describedby. */
export function AuthField({ label, error, id, required, ...props }: AuthFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <label htmlFor={fieldId} className="block text-sm">
      <span className="mb-1.5 flex items-center gap-1 font-medium text-foreground">
        {label}
        {required && (
          <span className="text-danger-foreground" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${inputClasses} ${error ? "border-danger-foreground focus:border-danger-foreground focus:ring-danger-foreground/20" : ""}`}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1.5 block text-xs text-danger-foreground">
          {error}
        </span>
      )}
    </label>
  );
}

/** Password field with a show/hide toggle (`password-toggle` guideline) — same
 * label/error contract as AuthField. */
export function AuthPasswordField({
  label,
  error,
  id,
  required,
  ...props
}: Omit<AuthFieldProps, "type">) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={fieldId} className="block text-sm">
      <span className="mb-1.5 flex items-center gap-1 font-medium text-foreground">
        {label}
        {required && (
          <span className="text-danger-foreground" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <span className="relative block">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClasses} pr-10 ${error ? "border-danger-foreground focus:border-danger-foreground focus:ring-danger-foreground/20" : ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {visible ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
      {error && (
        <span id={errorId} role="alert" className="mt-1.5 block text-xs text-danger-foreground">
          {error}
        </span>
      )}
    </label>
  );
}

/** Accessible error summary rendered above form fields on failed submit —
 * `focusable-error-summary` guideline: focus lands here after a failed attempt. */
export function AuthFormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      tabIndex={-1}
      className="rounded-xl border border-danger-foreground/25 bg-danger px-3.5 py-2.5 text-sm text-danger-foreground"
    >
      {message}
    </div>
  );
}
