import type { ReactNode } from "react";
import { BookOpenText, ClipboardText, IdentificationCard, MagnifyingGlass } from "@phosphor-icons/react";

const FEATURES = [
  { icon: MagnifyingGlass, label: "Tra cứu sách tức thời, theo tên, tác giả hoặc thể loại" },
  { icon: ClipboardText, label: "Theo dõi phiếu mượn, hạn trả và gia hạn rõ ràng" },
  { icon: IdentificationCard, label: "Quản lý thẻ thư viện và hồ sơ độc giả tập trung" },
];

/** Shared split-panel shell for every auth screen — ref: Bookary. Left brand panel
 * (accent surface, feature bullets) is desktop-only; the form column is always
 * centered and capped at max-w-sm so the same markup works down to 375px. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-accent to-accent/80 px-12 py-10 text-accent-foreground lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex items-center gap-2">
          <BookOpenText size={28} weight="fill" aria-hidden="true" />
          <span className="font-heading text-xl font-semibold">Bookary</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-heading text-3xl font-semibold leading-tight">
            Hệ thống Quản lý Thư viện
          </h2>
          <p className="mt-3 text-sm text-accent-foreground/80">
            Một nơi duy nhất cho độc giả, thủ thư và quản trị viên theo dõi sách, phiếu mượn và
            thẻ thư viện.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3 text-sm">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-foreground/10">
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className="pt-1.5 text-accent-foreground/90">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-accent-foreground/60">
          © {new Date().getFullYear()} Bookary — Thư viện.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 text-accent lg:hidden">
            <BookOpenText size={26} weight="fill" aria-hidden="true" />
            <span className="font-heading text-lg font-semibold">Bookary</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
