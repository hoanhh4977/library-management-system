import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  // Fail loudly in dev rather than silently making unauthenticated requests.
  console.error(
    "Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — kiểm tra file .env (xem .env.example).",
  );
}

export const supabase = createClient(url ?? "", publishableKey ?? "");

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signUpReader(params: {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
}) {
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      // Supabase redirects the browser here after the reader clicks the
      // confirmation link in their email — see pages/AuthConfirmPage.tsx.
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      data: {
        full_name: params.fullName,
        date_of_birth: params.dateOfBirth,
        phone: params.phone,
      },
    },
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}
