# Page Override: Key UI Patterns (Data Table, Loan Form, Inventory Dashboard)

> Override/bổ sung cho `MASTER.md` — áp dụng cho 3 pattern khó nhất trong app, dùng chung giữa nhiều trang (Librarian, Admin).

## 1. Bảng danh sách có badge trạng thái (Sách / Phiếu mượn / Yêu cầu mở khóa)

**Stack**: shadcn `Table` + TanStack Table (`useReactTable`) cho sort/filter/pagination (theo `stacks/shadcn.csv` — không tự viết logic sort/filter tay).

**Cấu trúc cột đề xuất cho bảng "Chi tiết phiếu mượn" (Librarian, trang Quầy giao dịch)**:

| Cột | Ghi chú hiển thị |
|---|---|
| Sách | `title` + `code` nhỏ dưới (muted-foreground, 12px) |
| Số lượng | tabular-nums (căn phải) |
| Ngày hẹn trả | tabular-nums; nếu quá hạn → thêm icon `Warning` màu `--color-status-warning-fg` cạnh ngày (không chỉ đổi màu chữ ngày — giữ `color-not-only`) |
| Trạng thái | `<StatusBadge status="borrowing-overdue" />` — xem bảng token ở MASTER.md |
| Hành động | nút icon-only (Trả sách / Gia hạn / Báo mất) trong `DropdownMenu` nếu >2 hành động, để tránh tràn ngang trên tablet (`overflow-menu`) |

**Component `StatusBadge` (React + Tailwind, dùng chung mọi bảng):**
```tsx
const STATUS_MAP: Record<string, {label: string; fg: string; bg: string; Icon: Icon}> = {
  active: { label: "Hoạt động", fg: "text-[#166534]", bg: "bg-[#DCFCE7]", Icon: Check },
  locked: { label: "Bị khóa", fg: "text-[#991B1B]", bg: "bg-[#FEE2E2]", Icon: Lock },
  borrowing: { label: "Đang mượn", fg: "text-[#075985]", bg: "bg-[#E0F2FE]", Icon: BookOpen },
  "borrowing-overdue": { label: "Quá hạn", fg: "text-[#9A3412]", bg: "bg-[#FFEDD5]", Icon: Warning },
  returned: { label: "Đã trả", fg: "text-[#166534]", bg: "bg-[#DCFCE7]", Icon: Check },
  pending_compensation: { label: "Chờ đền bù", fg: "text-[#991B1B]", bg: "bg-[#FEE2E2]", Icon: Warning },
  compensated: { label: "Đã đền bù", fg: "text-[#475569]", bg: "bg-[#E8ECF1]", Icon: Check },
  pending: { label: "Chờ duyệt", fg: "text-[#92400E]", bg: "bg-[#FEF3C7]", Icon: Clock },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_MAP }) {
  const { label, fg, bg, Icon } = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${fg} ${bg}`}>
      <Icon size={14} aria-hidden="true" weight="bold" />
      {label}
    </span>
  );
}
```

**Mobile**: bọc `<Table>` trong `<div className="overflow-x-auto">` (theo `Table Handling` guideline) — KHÔNG dùng card-list riêng cho MVP để tránh duy trì 2 bộ UI; chấp nhận scroll ngang trên < 768px vì đây chủ yếu là công cụ desktop tại quầy.

**Accessibility**: header cột sort được `aria-sort` (TanStack Table hỗ trợ sẵn qua props) — theo `sortable-table`.

## 2. Form lập Phiếu mượn nhiều dòng sách (Librarian)

Đây là màn hình dùng nhiều lần/ngày nhất — tối ưu tốc độ nhập hơn vẻ đẹp thị giác.

**Bố cục 1 màn hình, không multi-step wizard** (vì chỉ 2 nhóm thông tin: chọn Độc giả + danh sách sách — dùng `multi-step-progress` sẽ làm chậm tác vụ lặp lại):

```
┌─ Lập phiếu mượn ────────────────────────────────────┐
│ Độc giả: [Combobox tìm theo tên/mã/SĐT ▾]  [Thẻ: 🟢 Hoạt động]│
│                                                        │
│ Sách mượn                                    [+ Thêm sách] │
│ ┌────────────────────────────────────────────────┐   │
│ │ [Combobox tìm sách ▾]   Số lượng [ - 1 + ]   [✕] │   │
│ │ [Combobox tìm sách ▾]   Số lượng [ - 1 + ]   [✕] │   │
│ └────────────────────────────────────────────────┘   │
│                                                        │
│ Ngày hẹn trả: 24/09/2026 (tự tính +14 ngày, chỉ đọc)  │
│                                                        │
│                    [Hủy]        [Xác nhận lập phiếu]  │
└────────────────────────────────────────────────────────┘
```

**Chi tiết hành vi (map đúng FR trong `spec.md`)**:
- Ngay sau khi chọn Độc giả, hiển thị NGAY badge trạng thái thẻ (`StatusBadge`) cạnh tên — nếu `locked`, disable toàn bộ phần "Sách mượn" + hiện banner đỏ lý do (không để nhân viên điền hết form rồi mới báo lỗi ở cuối — vi phạm `progressive-disclosure`/`error-clarity`).
- Mỗi dòng sách: combobox có debounce search (300ms, theo `debounce-throttle`) gọi `GET /api/books?q=`; hiển thị `quantity` còn lại ngay trong option (ví dụ "Sapiens — còn 3"); nếu chọn số lượng > còn lại → lỗi inline ngay dưới ô đó (`error-placement`), không chặn submit các dòng khác.
- Nút "+ Thêm sách" thêm dòng mới, focus tự chuyển vào combobox dòng mới (giảm số click).
- Nút "✕" xoá dòng — không cần confirm dialog (hành động không phá hủy dữ liệu đã lưu, chỉ là draft).
- Submit: disable nút + spinner (`loading-buttons`) → khi có kết quả hỗn hợp (một số sách bị từ chối do hết hàng — theo FR-015/Acceptance Scenario US1.3), hiển thị summary: dòng nào thành công (viền xanh + check) / dòng nào thất bại (viền đỏ + lý do) NGAY trên form, không rời trang, để thủ thư sửa nhanh và submit lại phần thất bại.

**Field mounting**: dùng React Hook Form + shadcn `Field`/`Controller` (theo `stacks/shadcn.csv`) hoặc TanStack Form — chọn 1 trong 2, đừng trộn.

## 3. Dashboard Báo cáo tồn kho (Admin)

**Chart chính**: Bar chart ngang (top 10 sách có số lượng đang mượn nhiều nhất) — đúng khuyến nghị `chart` domain cho "Compare Categories" (bar chart, sort giảm dần theo giá trị, ≤15 category hiển thị cùng lúc). Thư viện: **Recharts** (tương thích React/shadcn tốt nhất trong 3 lựa chọn được gợi ý Chart.js/Recharts/D3).

```
┌─ Báo cáo tồn kho ───────────────────────────────────────────┐
│ [Tổng đầu sách: 1,240]  [Tổng số bản: 3,850]  [Đang mượn: 612]│ ← 3 stat tiles
│                                                                │
│ Top 10 sách đang được mượn nhiều nhất        [Xuất CSV]       │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Sapiens          ████████████████████ 18                │   │
│ │ Đắc Nhân Tâm      ███████████████ 14                     │   │
│ │ ...                                                       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                                │
│ Bảng chi tiết theo từng sách (sortable, có ô tìm kiếm)         │
└────────────────────────────────────────────────────────────────┘
```

- 3 "stat tiles" ở đầu dùng số lớn (Lexend 600, ~32px) — không cần chart cho số đơn lẻ (`direct-labeling` — số liệu tổng quan nên đọc trực tiếp, không cần biểu đồ cho 1 giá trị).
- Bar chart PHẢI có: `legend-visible` (ở đây không cần legend riêng vì 1 series), `tooltip-on-interact` (hover hiện đúng số), `axis-labels` rõ ("Số lượng đang mượn"), và **bảng dữ liệu thay thế** ngay dưới chart cho accessibility (`data-table` a11y fallback — không chỉ có chart).
- Màu bar: dùng `--color-accent` (#0369A1) đồng nhất — không cần nhiều màu vì chỉ 1 series/1 chỉ số.
- Nút "Xuất CSV" (theo `export-option`) — nice-to-have, không bắt buộc cho MVP nhưng dễ làm nếu đã có bảng dữ liệu.
- Khi chưa có dữ liệu (thư viện mới, chưa có phiếu mượn nào) → hiện `empty-data-state`: "Chưa có dữ liệu mượn sách để hiển thị" + gợi ý hành động (link sang "Quản lý Sách" để thêm sách mới), không hiện chart trống trơn.
