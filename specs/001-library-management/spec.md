# Feature Specification: Library Management System

**Feature Branch**: `001-library-management`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Xây dựng Hệ thống Quản lý Thư viện (Library Management System) - full-stack web app với Backend Python FastAPI, Frontend React, Database Supabase. Vai trò: Độc giả, Nhân viên thủ thư, Quản trị viên. Nghiệp vụ: quản lý sách, thẻ thư viện, mượn/trả/gia hạn sách, báo mất & đền bù, khóa/mở khóa thẻ, tra cứu sách & lịch sử mượn, báo cáo tồn kho, quản lý độc giả/nhân viên. (Chi tiết đầy đủ trong docs/Mô tả hệ thống.pdf và docs/Data Dict _ Process Spec.pdf)"

## Clarifications

### Session 2026-09-10

- Q: Tài khoản đăng nhập chỉ-đọc của Độc giả (đã chốt ở bước specify) được tạo và cấp bằng cách nào? → A: Độc giả tự đăng ký tài khoản trực tuyến trước (Họ tên, Ngày sinh, Số điện thoại, Email, mật khẩu); sau đó đến quầy để Nhân viên thủ thư xác minh danh tính và cấp Thẻ thư viện liên kết với tài khoản đã đăng ký.
- Q: Hệ thống cần ghi lại ai đã phê duyệt mở khóa thẻ hoặc xác nhận đền bù, kèm thời điểm, để phục vụ truy vết trách nhiệm không? → A: Có, bắt buộc ghi lại người thực hiện (Mã quản trị viên/Mã nhân viên xử lý) và thời điểm cho mỗi lần phê duyệt mở khóa thẻ và mỗi lần xác nhận đền bù.
- Q: Những hạng mục nào nên loại rõ là ngoài phạm vi (out of scope) cho phiên bản đầu tiên? → A: Không loại trừ hạng mục nào ở bước này (ví dụ phạt tiền, thông báo email/SMS); giữ nguyên phạm vi hiện tại của spec, quyết định cụ thể để lại cho giai đoạn sau (plan/tasks) nếu cần.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mượn và trả sách tại quầy (Priority: P1)

Nhân viên thủ thư lập Phiếu mượn cho Độc giả khi Độc giả đến mượn sách, và ghi nhận việc trả sách khi Độc giả trả lại. Đây là nghiệp vụ lõi, diễn ra hàng ngày và tạo ra giá trị cốt lõi của hệ thống.

**Why this priority**: Đây là giao dịch trung tâm của toàn bộ hệ thống thư viện — không có mượn/trả thì các nghiệp vụ khác (tra cứu, lịch sử, báo cáo) không có dữ liệu để vận hành.

**Independent Test**: Có thể kiểm thử độc lập bằng cách: tạo một Độc giả đã có Thẻ thư viện hoạt động, lập một Phiếu mượn cho 1-2 đầu sách còn hàng, xác nhận số lượng tồn kho giảm đúng; sau đó ghi nhận trả sách và xác nhận tồn kho được cộng lại và trạng thái chi tiết phiếu mượn chuyển thành "Đã trả".

**Acceptance Scenarios**:

1. **Given** Độc giả có Thẻ thư viện đang "Hoạt động", không có sách quá hạn hoặc chưa đền bù, **When** Nhân viên thủ thư lập Phiếu mượn cho các đầu sách còn đủ số lượng trong kho, **Then** hệ thống tạo Phiếu mượn mới với Ngày hẹn trả mặc định, tạo các Chi tiết phiếu mượn tương ứng ở trạng thái "Đang mượn", và trừ đúng số lượng tồn kho của từng đầu sách.
2. **Given** Độc giả có Thẻ thư viện "Bị khóa", **When** Nhân viên thủ thư thử lập Phiếu mượn cho Độc giả đó, **Then** hệ thống từ chối yêu cầu và hiển thị lý do "Thẻ bị khóa".
3. **Given** một đầu sách trong yêu cầu mượn có số lượng tồn kho nhỏ hơn số lượng yêu cầu, **When** Nhân viên thủ thư gửi yêu cầu mượn, **Then** hệ thống từ chối riêng đầu sách đó (không đủ hàng) nhưng vẫn cho phép các đầu sách khác trong yêu cầu (nếu đủ hàng) được ghi nhận.
4. **Given** một Chi tiết phiếu mượn ở trạng thái "Đang mượn", **When** Nhân viên thủ thư ghi nhận Độc giả trả sách, **Then** hệ thống cập nhật Ngày trả thực tế, chuyển Trạng thái thành "Đã trả", cộng lại số lượng tồn kho, và thông báo rõ việc trả là đúng hạn hay trễ hạn.
5. **Given** một Phiếu mượn có nhiều đầu sách, **When** Độc giả chỉ trả một phần số sách trong phiếu, **Then** hệ thống cho phép ghi nhận trả từng đầu sách vào các thời điểm khác nhau mà không yêu cầu trả toàn bộ phiếu cùng lúc.

---

### User Story 2 - Đăng ký tài khoản Độc giả và cấp Thẻ thư viện (Priority: P2)

Độc giả tự đăng ký tài khoản (Họ tên, Ngày sinh, Số điện thoại, Email, mật khẩu) trực tuyến để có quyền tra cứu sách và xem lịch sử mượn (User Story 3, 4). Để được mượn sách, Độc giả phải đến quầy thư viện để Nhân viên thủ thư xác minh danh tính và cấp Thẻ thư viện liên kết với tài khoản đã đăng ký.

**Why this priority**: Là điều kiện tiên quyết bắt buộc trước khi Độc giả có thể thực hiện User Story 1 (mượn sách) — không có thẻ thì không thể mượn; đồng thời là điều kiện để Độc giả sử dụng được User Story 3/4 (cần có tài khoản để đăng nhập).

**Independent Test**: Có thể kiểm thử độc lập theo hai bước: (1) một người tự đăng ký tài khoản Độc giả mới và xác nhận đăng nhập được, nhưng chưa có Thẻ thư viện nên chưa mượn được sách; (2) Nhân viên thủ thư xác minh danh tính và cấp Thẻ thư viện cho tài khoản đó, xác nhận trạng thái thẻ chuyển "Hoạt động" và Độc giả có thể mượn sách.

**Acceptance Scenarios**:

1. **Given** một Email chưa được dùng để đăng ký trước đó, **When** người dùng tự đăng ký tài khoản Độc giả trực tuyến (Họ tên, Ngày sinh, Số điện thoại, Email, mật khẩu), **Then** hệ thống tạo tài khoản Độc giả mới và yêu cầu xác thực Email trước khi tài khoản được kích hoạt để đăng nhập.
2. **Given** một tài khoản Độc giả đã được xác thực Email, **When** Độc giả đăng nhập, **Then** hệ thống cho phép tra cứu sách và xem lịch sử mượn của mình (hiện tại trống), nhưng CHƯA có Thẻ thư viện nên chưa thể mượn sách.
3. **Given** một Email đã được dùng để đăng ký tài khoản Độc giả trước đó, **When** người dùng thử đăng ký lại với Email đó, **Then** hệ thống từ chối vì Email phải là duy nhất trên toàn hệ thống.
4. **Given** một Độc giả đã có tài khoản nhưng chưa có Thẻ thư viện, **When** Độc giả đến quầy và Nhân viên thủ thư xác minh danh tính rồi cấp thẻ, **Then** hệ thống tạo một Thẻ thư viện mới liên kết với tài khoản đó, ở trạng thái "Hoạt động".
5. **Given** một Độc giả đã có Thẻ thư viện, **When** hệ thống hoặc Nhân viên thủ thư thử cấp thêm một thẻ khác cho cùng Độc giả, **Then** hệ thống từ chối vì mỗi Độc giả chỉ được cấp duy nhất một Thẻ thư viện tồn tại lâu dài.

---

### User Story 3 - Tra cứu sách theo Tên/Tác giả/Thể loại (Priority: P3)

Độc giả tự đăng nhập vào hệ thống để tra cứu sách theo Tên sách, Tác giả hoặc Thể loại (không cần qua Nhân viên thủ thư), nhằm kiểm tra tình trạng còn hàng trước khi đến quầy yêu cầu mượn. Nhân viên thủ thư cũng có thể tra cứu hộ khi Độc giả yêu cầu trực tiếp tại quầy.

**Why this priority**: Cần thiết để hỗ trợ quyết định mượn sách (User Story 1), nhưng không chặn nghiệp vụ mượn/trả cơ bản nếu độc giả đã biết trước sách cần mượn.

**Independent Test**: Có thể kiểm thử độc lập bằng cách nhập một từ khóa tra cứu và xác nhận danh sách kết quả trả về đúng các sách khớp tiêu chí, kèm số lượng còn lại; và xác nhận thông báo phù hợp khi không có kết quả.

**Acceptance Scenarios**:

1. **Given** kho sách có nhiều đầu sách, **When** người dùng tra cứu theo Tên sách, Tác giả hoặc Thể loại, **Then** hệ thống trả về danh sách các sách khớp cùng số lượng còn lại trong kho.
2. **Given** từ khóa tra cứu không khớp với bất kỳ sách nào, **When** người dùng thực hiện tra cứu, **Then** hệ thống hiển thị thông báo không tìm thấy kết quả.

---

### User Story 4 - Xem lịch sử mượn sách (Priority: P4)

Độc giả tự đăng nhập và xem lại lịch sử mượn sách của chính mình (chỉ xem, không thao tác); Nhân viên thủ thư tra cứu lịch sử mượn của bất kỳ Độc giả nào để hỗ trợ xử lý nghiệp vụ (ví dụ kiểm tra sách quá hạn).

**Why this priority**: Là chức năng tham chiếu hỗ trợ, không tạo giao dịch mới, nên có thể triển khai sau các luồng giao dịch chính.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo sẵn một số Phiếu mượn/Chi tiết phiếu mượn cho một Độc giả, sau đó truy vấn lịch sử và xác nhận đầy đủ thông tin Ngày mượn, Ngày hẹn trả, danh sách sách, Ngày trả thực tế và Trạng thái của từng sách.

**Acceptance Scenarios**:

1. **Given** một Độc giả đã có ít nhất một Phiếu mượn trong quá khứ, **When** Độc giả xem lịch sử mượn của mình, **Then** hệ thống hiển thị đầy đủ danh sách Phiếu mượn kèm chi tiết từng sách (đã trả/đang mượn/trễ hạn/chờ đền bù).
2. **Given** Nhân viên thủ thư nhập Mã độc giả hợp lệ, **When** thực hiện tra cứu lịch sử mượn, **Then** hệ thống hiển thị toàn bộ lịch sử của Độc giả đó, bao gồm các lần trả trễ và sách hiện đang mượn/chưa trả.

---

### User Story 5 - Gia hạn Phiếu mượn (Priority: P5)

Độc giả (qua Nhân viên thủ thư) yêu cầu gia hạn thời gian trả sách cho một Phiếu mượn đang còn hiệu lực.

**Why this priority**: Là một biến thể mở rộng của luồng mượn/trả chính, tần suất thấp hơn giao dịch mượn/trả thông thường.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo một Phiếu mượn còn trong hạn và chưa từng gia hạn, gửi yêu cầu gia hạn, và xác nhận Ngày hẹn trả được dời thêm đúng số ngày quy định và cờ gia hạn được đánh dấu.

**Acceptance Scenarios**:

1. **Given** một Phiếu mượn còn trong hạn (chưa quá Ngày hẹn trả) và chưa từng được gia hạn, **When** yêu cầu gia hạn được gửi, **Then** hệ thống dời Ngày hẹn trả thêm số ngày quy định và đánh dấu Phiếu mượn đã gia hạn.
2. **Given** một Phiếu mượn đã quá Ngày hẹn trả, hoặc đã từng được gia hạn trước đó, **When** yêu cầu gia hạn được gửi, **Then** hệ thống từ chối yêu cầu và nêu rõ lý do.

---

### User Story 6 - Báo mất sách và Đền bù (Priority: P6)

Độc giả báo mất một sách đang mượn; hệ thống ghi nhận trạng thái chờ đền bù và chặn quyền mượn thêm cho tới khi việc đền bù được xác nhận.

**Why this priority**: Là luồng xử lý ngoại lệ, xảy ra không thường xuyên so với mượn/trả thông thường, nhưng cần thiết để đảm bảo tính đúng đắn của nghiệp vụ và quyền mượn sách.

**Independent Test**: Có thể kiểm thử độc lập bằng cách báo mất một sách đang mượn, xác nhận trạng thái chuyển "Chờ đền bù" và Độc giả bị chặn mượn thêm; sau đó xác nhận đền bù và kiểm tra quyền mượn được khôi phục.

**Acceptance Scenarios**:

1. **Given** một sách đang ở trạng thái "Đang mượn", **When** Độc giả báo mất sách đó, **Then** hệ thống chuyển Trạng thái chi tiết phiếu mượn thành "Chờ đền bù" và Độc giả không được phép mượn thêm sách cho tới khi hoàn tất đền bù.
2. **Given** một sách ở trạng thái "Chờ đền bù", **When** Nhân viên thủ thư/Quản trị viên xác nhận Độc giả đã đền bù đúng Tên sách, Tác giả, Nhà xuất bản, **Then** hệ thống chuyển Trạng thái thành "Đã đền bù", ghi lại người xác nhận và thời điểm xác nhận, và khôi phục quyền mượn sách cho Độc giả (nếu không còn vi phạm khác).
3. **Given** sách đền bù không đúng Tên sách/Tác giả/Nhà xuất bản so với sách đã mất, **When** Nhân viên thủ thư/Quản trị viên xử lý xác nhận đền bù, **Then** hệ thống từ chối và giữ trạng thái "Chờ đền bù".

---

### User Story 7 - Khóa và Mở khóa Thẻ thư viện (Priority: P7)

Hệ thống tự động khóa Thẻ thư viện khi phát hiện Độc giả có sách quá hạn hoặc chưa đền bù; khi đủ điều kiện, Nhân viên thủ thư gửi yêu cầu mở khóa lên Quản trị viên để phê duyệt (Nhân viên thủ thư không có quyền tự mở khóa).

**Why this priority**: Là cơ chế kiểm soát rủi ro gắn liền với User Story 1 và User Story 6, nhưng có thể triển khai sau khi các luồng ghi nhận trạng thái quá hạn/đền bù đã hoạt động ổn định.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo tình huống Độc giả có sách quá hạn, xác nhận thẻ tự động chuyển "Bị khóa"; sau đó xử lý hết sách quá hạn, gửi yêu cầu mở khóa, Quản trị viên phê duyệt, và xác nhận thẻ trở lại "Hoạt động" cùng thông tin người phê duyệt được lưu lại.

**Acceptance Scenarios**:

1. **Given** một Độc giả có ít nhất một sách quá hạn chưa trả hoặc một sách ở trạng thái "Chờ đền bù", **When** hệ thống kiểm tra trạng thái, **Then** Thẻ thư viện của Độc giả đó được chuyển thành "Bị khóa".
2. **Given** một Thẻ thư viện đang "Bị khóa" và Độc giả không còn sách quá hạn/chưa đền bù, **When** Nhân viên thủ thư gửi yêu cầu mở khóa, **Then** yêu cầu được chuyển đến Quản trị viên để phê duyệt (Nhân viên thủ thư không thể tự mở khóa).
3. **Given** một yêu cầu mở khóa đang chờ xử lý, **When** Quản trị viên phê duyệt, **Then** Thẻ thư viện chuyển lại thành "Hoạt động" và hệ thống ghi lại Quản trị viên đã phê duyệt cùng thời điểm phê duyệt.
4. **Given** Độc giả vẫn còn sách quá hạn hoặc chưa đền bù, **When** Nhân viên thủ thư cố gắng gửi yêu cầu mở khóa, **Then** hệ thống từ chối yêu cầu ngay và thông báo lý do.

---

### User Story 8 - Quản lý danh mục Sách (Priority: P8)

Quản trị viên thêm mới hoặc cập nhật thông tin Sách (Tên sách, Tác giả, Nhà xuất bản, Thể loại, Số lượng) trong hệ thống.

**Why this priority**: Cần có dữ liệu Sách trước khi mượn/trả có thể diễn ra, nhưng là hoạt động quản trị định kỳ, không phải giao dịch hàng ngày như User Story 1.

**Independent Test**: Có thể kiểm thử độc lập bằng cách thêm một Sách mới với đầy đủ thông tin và xác nhận bản ghi xuất hiện trong kết quả tra cứu; sau đó cập nhật thông tin và xác nhận thay đổi được lưu.

**Acceptance Scenarios**:

1. **Given** thông tin Sách hợp lệ với Mã sách chưa tồn tại, **When** Quản trị viên thêm sách mới, **Then** hệ thống lưu bản ghi mới và sách xuất hiện được trong tra cứu.
2. **Given** một Sách đã tồn tại, **When** Quản trị viên cập nhật thông tin (kể cả Số lượng), **Then** hệ thống lưu thay đổi và các giao dịch mượn/trả sau đó phản ánh đúng số lượng mới.

---

### User Story 9 - Báo cáo thống kê tồn kho (Priority: P9)

Quản trị viên xem báo cáo tổng hợp tình trạng tồn kho: tổng số đầu sách, tổng số bản, số bản đang được mượn, số bản còn lại theo từng đầu sách.

**Why this priority**: Là chức năng hỗ trợ ra quyết định/giám sát, không ảnh hưởng đến các giao dịch nghiệp vụ hàng ngày.

**Independent Test**: Có thể kiểm thử độc lập bằng cách tạo sẵn một số Sách và Phiếu mượn đang hoạt động, sau đó xem báo cáo và xác nhận số liệu tổng hợp khớp với dữ liệu thực tế.

**Acceptance Scenarios**:

1. **Given** dữ liệu Sách và các giao dịch mượn/trả đã tồn tại, **When** Quản trị viên yêu cầu xem báo cáo tồn kho, **Then** hệ thống hiển thị số liệu chi tiết theo từng Sách (tổng số lượng, đang mượn, còn lại) và số liệu tổng hợp toàn hệ thống.

---

### User Story 10 - Quản lý Độc giả và Nhân viên thủ thư (Priority: P10)

Quản trị viên xem, cập nhật thông tin Độc giả và Nhân viên thủ thư nhằm bao quát và giám sát hoạt động chung của hệ thống.

**Why this priority**: Là chức năng quản trị hỗ trợ, tần suất sử dụng thấp hơn các nghiệp vụ mượn/trả và tra cứu hàng ngày.

**Independent Test**: Có thể kiểm thử độc lập bằng cách xem danh sách Độc giả/Nhân viên thủ thư hiện có, cập nhật thông tin một bản ghi, và xác nhận thay đổi được lưu đúng.

**Acceptance Scenarios**:

1. **Given** danh sách Độc giả và Nhân viên thủ thư đã tồn tại, **When** Quản trị viên xem danh sách, **Then** hệ thống hiển thị đầy đủ thông tin từng bản ghi.
2. **Given** một bản ghi Độc giả hoặc Nhân viên thủ thư cần chỉnh sửa, **When** Quản trị viên cập nhật thông tin, **Then** hệ thống lưu thay đổi và phản ánh trong các tra cứu liên quan.

---

### Edge Cases

- Khi Nhân viên thủ thư lập Phiếu mượn với nhiều đầu sách, nếu một số đầu sách đủ hàng và một số không đủ, hệ thống phải xử lý riêng từng đầu sách (chấp nhận phần đủ hàng, báo lỗi phần không đủ) thay vì từ chối toàn bộ phiếu.
- Khi Độc giả có nhiều Chi tiết phiếu mượn quá hạn từ nhiều Phiếu mượn khác nhau, hệ thống phải kiểm tra toàn bộ (không chỉ phiếu mượn gần nhất) trước khi cho phép mượn thêm hoặc mở khóa thẻ.
- Khi một Phiếu mượn đã được gia hạn và sau đó vẫn bị trả trễ, hệ thống vẫn phải ghi nhận đúng "trả trễ hạn" dựa trên Ngày hẹn trả đã được gia hạn (không phải ngày hẹn trả gốc).
- Khi Độc giả trả một phần sách trong Phiếu mượn và giữ lại phần còn lại quá hạn, hệ thống phải khóa thẻ dựa trên phần còn quá hạn, không phụ thuộc vào các sách đã trả đúng hạn trong cùng phiếu.
- Khi Quản trị viên cập nhật giảm Số lượng của một Sách xuống thấp hơn số lượng đang được mượn thực tế, hệ thống phải xử lý nhất quán (ví dụ ngăn số lượng còn lại âm) và không làm sai lệch số liệu báo cáo tồn kho.
- Khi có yêu cầu mở khóa thẻ đang chờ xử lý và trong thời gian đó Độc giả phát sinh thêm sách quá hạn mới, hệ thống phải phản ánh đúng tình trạng mới nhất tại thời điểm Quản trị viên xét duyệt.
- Khi một Độc giả đã tự đăng ký tài khoản nhưng chưa từng đến quầy để nhận Thẻ thư viện, hệ thống phải cho phép Độc giả đó tiếp tục đăng nhập tra cứu sách/xem lịch sử (trống), nhưng không cho phép mượn sách dưới bất kỳ hình thức nào cho tới khi có thẻ.
- Khi Nhân viên thủ thư cố gắng cấp Thẻ thư viện cho một Email/tài khoản Độc giả không tồn tại trong hệ thống (chưa từng tự đăng ký), hệ thống phải từ chối và yêu cầu Độc giả tự đăng ký tài khoản trước.

## Requirements *(mandatory)*

### Functional Requirements

**Quản lý Sách**
- **FR-001**: Hệ thống PHẢI cho phép Quản trị viên thêm mới thông tin Sách (Tên sách, Tác giả, Nhà xuất bản, Thể loại, Số lượng) với Mã sách được hệ thống tự sinh và duy nhất.
- **FR-002**: Hệ thống PHẢI cho phép Quản trị viên cập nhật thông tin Sách hiện có.
- **FR-003**: Hệ thống PHẢI cho phép tra cứu Sách theo Tên sách, Tác giả hoặc Thể loại, hiển thị kèm số lượng còn lại trong kho.

**Quản lý tài khoản Độc giả và Thẻ thư viện**
- **FR-004**: Hệ thống PHẢI cho phép một người tự đăng ký tài khoản Độc giả trực tuyến (Họ tên, Ngày sinh, Số điện thoại, Email, mật khẩu), với Email là duy nhất trên toàn hệ thống và dùng làm định danh đăng nhập.
- **FR-005**: Hệ thống PHẢI xác thực Email của Độc giả (ví dụ qua liên kết/mã xác nhận gửi đến Email) trước khi tài khoản được kích hoạt để đăng nhập.
- **FR-006**: Hệ thống PHẢI cho phép Độc giả đã có tài khoản được xác thực đăng nhập để tra cứu Sách (FR-003) và xem lịch sử mượn của chính mình (FR-022), kể cả khi chưa có Thẻ thư viện.
- **FR-007**: Hệ thống PHẢI cho phép Nhân viên thủ thư xác minh danh tính Độc giả tại quầy (dựa trên tài khoản Độc giả đã đăng ký) và cấp một Thẻ thư viện liên kết với tài khoản đó, ở trạng thái "Hoạt động", tại thời điểm cấp.
- **FR-008**: Hệ thống PHẢI đảm bảo mỗi Độc giả có tối đa một Thẻ thư viện tồn tại lâu dài — không cấp Thẻ thư viện thứ hai cho một Độc giả đã có thẻ.
- **FR-009**: Hệ thống PHẢI tự động chuyển Trạng thái Thẻ thư viện thành "Bị khóa" khi phát hiện Độc giả có ít nhất một sách quá hạn chưa trả hoặc một sách ở trạng thái "Chờ đền bù".
- **FR-010**: Hệ thống PHẢI cho phép Nhân viên thủ thư gửi yêu cầu mở khóa Thẻ thư viện đến Quản trị viên, và PHẢI ngăn Nhân viên thủ thư tự thực hiện thao tác mở khóa.
- **FR-011**: Hệ thống PHẢI cho phép Quản trị viên phê duyệt yêu cầu mở khóa Thẻ thư viện, chỉ chuyển Trạng thái thành "Hoạt động" khi Độc giả không còn sách quá hạn hoặc chưa đền bù nào, và PHẢI ghi lại Quản trị viên đã phê duyệt cùng thời điểm phê duyệt (audit trail).

**Mượn và Trả sách**
- **FR-012**: Hệ thống PHẢI cho phép lập Phiếu mượn cho một Độc giả chỉ khi: Thẻ thư viện đang "Hoạt động", Độc giả không có sách quá hạn chưa trả, và không có sách chưa đền bù.
- **FR-013**: Hệ thống PHẢI gán Ngày hẹn trả mặc định cho mỗi Phiếu mượn mới (14 ngày kể từ Ngày mượn, theo giả định trong tài liệu phân tích gốc — xem mục Assumptions).
- **FR-014**: Hệ thống PHẢI cho phép một Phiếu mượn chứa nhiều đầu sách khác nhau, mỗi đầu sách có Số lượng mượn riêng, được ghi lại dưới dạng Chi tiết phiếu mượn.
- **FR-015**: Hệ thống PHẢI trừ đúng số lượng tồn kho tương ứng khi lập Phiếu mượn/Chi tiết phiếu mượn thành công, và từ chối riêng từng đầu sách có số lượng tồn kho không đủ.
- **FR-016**: Hệ thống PHẢI cho phép ghi nhận Độc giả trả từng cuốn sách trong một Phiếu mượn vào các thời điểm khác nhau (không bắt buộc trả toàn bộ phiếu cùng lúc).
- **FR-017**: Khi ghi nhận trả sách, hệ thống PHẢI cập nhật Ngày trả thực tế, chuyển Trạng thái Chi tiết phiếu mượn thành "Đã trả", cộng lại số lượng tồn kho, và thông báo rõ việc trả đúng hạn hay trễ hạn (so với Ngày hẹn trả tại thời điểm trả, kể cả sau khi đã gia hạn).
- **FR-018**: Hệ thống PHẢI cho phép gia hạn một Phiếu mượn chỉ khi Phiếu mượn còn trong hạn (chưa quá Ngày hẹn trả) và chưa từng được gia hạn trước đó; khi gia hạn thành công, Ngày hẹn trả được dời thêm 7 ngày và Phiếu mượn được đánh dấu đã gia hạn (không cho gia hạn lần thứ hai).

**Báo mất và Đền bù**
- **FR-019**: Hệ thống PHẢI cho phép ghi nhận báo mất một sách đang mượn, chuyển Trạng thái Chi tiết phiếu mượn tương ứng thành "Chờ đền bù".
- **FR-020**: Trong khi một Chi tiết phiếu mượn ở trạng thái "Chờ đền bù", hệ thống PHẢI coi Độc giả như đang có sách quá hạn (áp dụng đầy đủ các ràng buộc ở FR-009 và FR-012).
- **FR-021**: Hệ thống PHẢI cho phép xác nhận đền bù (đúng Tên sách, Tác giả, Nhà xuất bản so với sách đã mất); khi xác nhận, hệ thống PHẢI chuyển Trạng thái thành "Đã đền bù", ghi lại người xác nhận (Nhân viên thủ thư/Quản trị viên) cùng thời điểm xác nhận (audit trail), và khôi phục quyền mượn sách nếu Độc giả không còn vi phạm khác.

**Tra cứu và Lịch sử**
- **FR-022**: Hệ thống PHẢI cho phép Độc giả xem lịch sử mượn của chính mình, bao gồm Mã phiếu mượn, Ngày mượn, Ngày hẹn trả, danh sách sách đã mượn, Ngày trả thực tế và Trạng thái của từng sách.
- **FR-023**: Hệ thống PHẢI cho phép Nhân viên thủ thư tra cứu lịch sử mượn của bất kỳ Độc giả nào, bao gồm các lần trả trễ và các sách đang mượn hoặc chưa trả.

**Quản trị và Báo cáo**
- **FR-024**: Hệ thống PHẢI cho phép Quản trị viên xem báo cáo thống kê tồn kho theo từng Sách (tổng số lượng, số lượng đang mượn, số lượng còn lại) và số liệu tổng hợp toàn hệ thống.
- **FR-025**: Hệ thống PHẢI cho phép Quản trị viên xem và cập nhật thông tin Nhân viên thủ thư và thông tin Độc giả.

**Phân quyền**
- **FR-026**: Hệ thống PHẢI phân biệt rõ ba vai trò (Độc giả, Nhân viên thủ thư, Quản trị viên) và giới hạn hành động của mỗi vai trò đúng theo phạm vi nghiệp vụ đã mô tả (ví dụ: chỉ Quản trị viên được thêm/sửa Sách và phê duyệt mở khóa thẻ; Nhân viên thủ thư không được tự mở khóa thẻ).
- **FR-027**: Tài khoản Độc giả PHẢI chỉ có quyền ĐỌC: tự tra cứu Sách (FR-003) và tự xem lịch sử mượn của chính mình (FR-022). Độc giả KHÔNG được phép tự thực hiện các giao dịch mượn sách, trả sách, gia hạn, báo mất hoặc đền bù qua tài khoản của mình — các giao dịch này chỉ do Nhân viên thủ thư lập/xử lý tại quầy thay cho Độc giả (theo yêu cầu trực tiếp của Độc giả).
- **FR-028**: Hệ thống PHẢI đảm bảo Độc giả chỉ xem được lịch sử mượn và thông tin của chính mình, không xem được dữ liệu của Độc giả khác.

### Key Entities *(include if feature involves data)*

- **Sách (Book)**: Đại diện cho một đầu sách trong thư viện. Thuộc tính: Mã sách (định danh), Tên sách, Tác giả, Nhà xuất bản, Thể loại, Số lượng (tồn kho hiện có). Được quản lý bởi Quản trị viên; số lượng được hệ thống tự cập nhật khi mượn/trả.
- **Độc giả (Reader)**: Người mượn/trả sách, có tài khoản đăng nhập riêng (Email duy nhất + mật khẩu) tự đăng ký để tra cứu sách và xem lịch sử mượn của mình. Thuộc tính: Mã độc giả, Họ tên, Ngày sinh, Số điện thoại, Email. Quan hệ với Thẻ thư viện là 0..1 (chưa có thẻ ngay sau khi đăng ký tài khoản) cho tới khi được Nhân viên thủ thư cấp thẻ tại quầy, sau đó là một-một lâu dài.
- **Thẻ thư viện (Library Card)**: Quyền mượn sách của một Độc giả, chỉ được cấp sau khi Độc giả đã có tài khoản và được Nhân viên thủ thư xác minh danh tính trực tiếp. Thuộc tính: Mã thẻ, Ngày cấp, Trạng thái (Hoạt động/Bị khóa). Thuộc về đúng một Độc giả, tồn tại lâu dài kể từ khi cấp.
- **Nhân viên thủ thư (Librarian)**: Người xử lý giao dịch mượn/trả, xác minh danh tính và cấp Thẻ thư viện, tra cứu hộ. Thuộc tính: Mã nhân viên, Họ tên, Ngày sinh.
- **Quản trị viên (Admin)**: Người quản lý sách, giám sát hệ thống, phê duyệt mở khóa thẻ, xác nhận đền bù, xem báo cáo. Thuộc tính: Mã quản trị viên, Họ tên, Ngày sinh.
- **Phiếu mượn (Loan)**: Một lần giao dịch mượn sách của một Độc giả. Thuộc tính: Mã phiếu mượn, Ngày mượn, Ngày hẹn trả, đã gia hạn hay chưa. Thuộc về đúng một Độc giả, do đúng một Nhân viên thủ thư lập; có thể chứa nhiều Sách khác nhau.
- **Chi tiết phiếu mượn (Loan Detail)**: Một dòng chi tiết trong Phiếu mượn, ứng với một Sách cụ thể. Thuộc tính: Số lượng mượn, Ngày trả thực tế (có thể trống), Trạng thái (Đang mượn/Đã trả/Chờ đền bù/Đã đền bù). Cho phép trả từng sách vào các thời điểm khác nhau trong cùng một Phiếu mượn. Khi trạng thái chuyển "Đã đền bù", ghi lại người xác nhận và thời điểm xác nhận.
- **Yêu cầu mở khóa thẻ (Card Unlock Request)**: Yêu cầu do Nhân viên thủ thư khởi tạo để đề nghị Quản trị viên mở khóa một Thẻ thư viện đang "Bị khóa". Gắn với Độc giả/Thẻ thư viện liên quan, trạng thái chờ xử lý/đã phê duyệt/bị từ chối; khi được phê duyệt, PHẢI lưu lại Quản trị viên đã xử lý và thời điểm xử lý (audit trail).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nhân viên thủ thư có thể hoàn tất một giao dịch lập Phiếu mượn (từ lúc tra cứu độc giả đến lúc xác nhận thành công) trong vòng 2 phút.
- **SC-002**: Độc giả/Nhân viên thủ thư tìm thấy kết quả tra cứu sách (theo tên/tác giả/thể loại) trong vòng vài giây, ngay cả khi kho có hàng nghìn đầu sách.
- **SC-003**: 100% các giao dịch mượn sách vi phạm quy tắc nghiệp vụ (thẻ bị khóa, có sách quá hạn, có sách chưa đền bù) đều bị hệ thống từ chối đúng, không có trường hợp lách được quy tắc.
- **SC-004**: Số lượng tồn kho hiển thị trong báo cáo và trong tra cứu luôn khớp với tổng số sách thực tế đang có trong kho (không có sai lệch) sau mỗi giao dịch mượn/trả.
- **SC-005**: Quản trị viên có thể xem báo cáo tồn kho tổng hợp toàn hệ thống trong vòng vài giây, không cần xử lý theo lô hoặc chờ đợi theo lịch định kỳ.
- **SC-006**: 100% các trường hợp phát hiện sách quá hạn hoặc chưa đền bù đều dẫn đến khóa thẻ tương ứng trước khi cho phép mượn tiếp, không có trường hợp mượn được sách khi đang vi phạm.
- **SC-007**: Toàn bộ 3 vai trò (Độc giả, Nhân viên thủ thư, Quản trị viên) chỉ thực hiện được đúng các hành động thuộc phạm vi quyền hạn của mình (không có Nhân viên thủ thư tự mở khóa thẻ, Độc giả tự thêm/sửa sách, hoặc Độc giả tự lập/gia hạn phiếu mượn).
- **SC-008**: Một người có thể tự đăng ký và xác thực tài khoản Độc giả trong vòng vài phút mà không cần đến trực tiếp thư viện.
- **SC-009**: 100% các lần phê duyệt mở khóa thẻ và xác nhận đền bù đều truy vết được người thực hiện và thời điểm thực hiện.

## Assumptions

- Thời hạn mượn mặc định là 14 ngày kể từ Ngày mượn, và mỗi lần gia hạn dời thêm đúng 7 ngày — theo giả định của tài liệu phân tích nghiệp vụ gốc (docs/Data Dict _ Process Spec.pdf, mục "Vấn đề còn tồn đọng" của Process 3); có thể điều chỉnh thành tham số cấu hình được ở giai đoạn triển khai nếu nghiệp vụ thực tế khác.
- Không giới hạn số đầu sách hoặc tổng số bản tối đa mà một Độc giả được mượn trong một Phiếu mượn hoặc đang mượn đồng thời — giới hạn duy nhất là số lượng tồn kho thực tế của từng đầu sách. Có thể bổ sung giới hạn cụ thể sau nếu nghiệp vụ yêu cầu.
- Việc khóa Thẻ thư viện khi phát hiện sách quá hạn/chưa đền bù được thực hiện tự động bởi hệ thống (không cần Nhân viên thủ thư/Quản trị viên chủ động thao tác khóa), dựa trên kiểm tra Chi tiết phiếu mượn tại các thời điểm giao dịch liên quan (mượn sách mới, trả sách, báo mất, xử lý mở khóa).
- Báo cáo thống kê tồn kho được tính toán theo yêu cầu tức thời (on-demand) mỗi khi Quản trị viên xem báo cáo, không chạy theo lịch định kỳ (batch).
- Số lượng Sách được quản lý theo tổng số bản của từng đầu sách (aggregate count), không theo dõi từng bản sách vật lý bằng mã riêng (không có mã vạch/mã bản sách cá nhân).
- Nhân viên thủ thư và Quản trị viên là các tài khoản nội bộ do hệ thống quản trị cấp phát trước (không có luồng tự đăng ký công khai cho hai vai trò này). Độc giả tự đăng ký tài khoản trực tuyến (đã xác nhận với người dùng — xem mục Clarifications); Thẻ thư viện chỉ được cấp sau khi Nhân viên thủ thư xác minh danh tính trực tiếp tại quầy.
- Email của Độc giả là duy nhất trên toàn hệ thống và dùng làm định danh đăng nhập cho tài khoản Độc giả; việc xác thực Email tại thời điểm đăng ký được thực hiện bằng một cơ chế đơn giản (ví dụ liên kết/mã xác nhận gửi qua email) — cơ chế cụ thể để lại cho giai đoạn /speckit-plan.
- "Yêu cầu mở khóa thẻ" được mô hình hóa như một hành động chuyển trạng thái (Nhân viên thủ thư gửi → Quản trị viên phê duyệt/từ chối) chứ không nhất thiết là một thực thể dữ liệu độc lập có bảng lưu trữ riêng; tuy nhiên thông tin người phê duyệt và thời điểm phê duyệt PHẢI được lưu lại ở đâu đó (trên chính bản ghi Thẻ thư viện hoặc một bảng riêng) — quyết định lưu trữ cụ thể sẽ được xác định ở giai đoạn /speckit-plan.
- Mỗi Chi tiết phiếu mượn chỉ ứng với một đầu sách trong một Phiếu mượn (không có nhiều dòng chi tiết trùng cùng một đầu sách trong cùng một phiếu).
- Không có hạng mục nào được loại trừ rõ ràng khỏi phạm vi ở giai đoạn này (ví dụ phạt tiền trễ hạn, thông báo email/SMS nhắc hạn trả) — các quyết định này để lại cho giai đoạn /speckit-plan hoặc phiên bản sau nếu cần, theo lựa chọn của người dùng trong phiên clarify này.
