import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ReaderLayout } from "./components/layouts/ReaderLayout";
import { StaffLayout } from "./components/layouts/StaffLayout";
import { RoleGuard, RootRedirect } from "./routes/RoleGuard";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AuthConfirmPage } from "./pages/AuthConfirmPage";
import { SearchPage } from "./pages/reader/SearchPage";
import { HistoryPage } from "./pages/reader/HistoryPage";
import { CounterPage } from "./pages/librarian/CounterPage";
import { ReadersPage } from "./pages/librarian/ReadersPage";
import { LibrarianSearchPage } from "./pages/librarian/SearchPage";
import { LoanRequestsPage } from "./pages/librarian/LoanRequestsPage";
import { BooksPage } from "./pages/admin/BooksPage";
import { UnlockRequestsPage } from "./pages/admin/UnlockRequestsPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { PeoplePage } from "./pages/admin/PeoplePage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />

          <Route element={<RoleGuard allow={["reader"]} />}>
            <Route element={<ReaderLayout />}>
              <Route path="/reader/search" element={<SearchPage />} />
              <Route path="/reader/history" element={<HistoryPage />} />
            </Route>
          </Route>

          <Route element={<RoleGuard allow={["librarian"]} />}>
            <Route element={<StaffLayout role="librarian" />}>
              <Route path="/librarian/counter" element={<CounterPage />} />
              <Route path="/librarian/readers" element={<ReadersPage />} />
              <Route path="/librarian/search" element={<LibrarianSearchPage />} />
              <Route path="/librarian/requests" element={<LoanRequestsPage />} />
            </Route>
          </Route>

          <Route element={<RoleGuard allow={["admin"]} />}>
            <Route element={<StaffLayout role="admin" />}>
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/books" element={<BooksPage />} />
              <Route path="/admin/unlock-requests" element={<UnlockRequestsPage />} />
              <Route path="/admin/people" element={<PeoplePage />} />
            </Route>
          </Route>

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
