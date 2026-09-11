import {
  Check,
  Clock,
  Lock,
  BookOpen,
  Warning,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";

export type Status =
  | "active"
  | "locked"
  | "borrowing"
  | "borrowing-overdue"
  | "returned"
  | "pending_compensation"
  | "compensated"
  | "pending"
  | "approved"
  | "rejected";

interface StatusSpec {
  label: string;
  fg: string;
  bg: string;
  Icon: Icon;
}

// Tokens from design-system/library-management-system/pages/key-patterns.md §1.
// Every badge pairs an icon with text — never color alone (WCAG color-not-only).
const STATUS_MAP: Record<Status, StatusSpec> = {
  active: { label: "Hoạt động", fg: "text-success-foreground", bg: "bg-success", Icon: Check },
  locked: { label: "Bị khóa", fg: "text-danger-foreground", bg: "bg-danger", Icon: Lock },
  borrowing: { label: "Đang mượn", fg: "text-info-foreground", bg: "bg-info", Icon: BookOpen },
  "borrowing-overdue": {
    label: "Quá hạn",
    fg: "text-warning-foreground",
    bg: "bg-warning",
    Icon: Warning,
  },
  returned: { label: "Đã trả", fg: "text-success-foreground", bg: "bg-success", Icon: Check },
  pending_compensation: {
    label: "Chờ đền bù",
    fg: "text-danger-foreground",
    bg: "bg-danger",
    Icon: Warning,
  },
  compensated: { label: "Đã đền bù", fg: "text-muted-foreground", bg: "bg-muted", Icon: Check },
  pending: { label: "Chờ duyệt", fg: "text-pending-foreground", bg: "bg-pending", Icon: Clock },
  approved: { label: "Đã duyệt", fg: "text-success-foreground", bg: "bg-success", Icon: Check },
  rejected: { label: "Bị từ chối", fg: "text-danger-foreground", bg: "bg-danger", Icon: XCircle },
};

/** Outlined pill (colored border + text, near-white fill) — ref: Bookary status
 * pills ("Borrowed", "Overdue") rather than a solid-fill badge. */
export function StatusBadge({ status }: { status: Status }) {
  const spec = STATUS_MAP[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border bg-card px-2.5 py-1 text-sm font-medium ${spec.fg}`}
      style={{ borderColor: "currentcolor" }}
    >
      <spec.Icon size={14} weight="bold" aria-hidden="true" />
      {spec.label}
    </span>
  );
}

/** Derive the loan-detail badge status, folding the overdue check into "borrowing". */
export function loanDetailStatus(
  status: "borrowing" | "returned" | "pending_compensation" | "compensated",
  dueDate: string,
): Status {
  if (status === "borrowing" && new Date(dueDate) < new Date(new Date().toDateString())) {
    return "borrowing-overdue";
  }
  return status;
}
