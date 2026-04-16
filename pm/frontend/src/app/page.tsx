"use client";

import { useAuth } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { KanbanBoard } from "@/components/KanbanBoard";

export default function Home() {
  const { isAuthenticated, isLoading, error, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)]">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--stroke)] border-t-[var(--primary-blue)]"></div>
          <p className="text-[var(--gray-text)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
        onLogin={async (username, password) => {
          await login(username, password);
        }}
        error={error || undefined}
      />
    );
  }

  return <KanbanBoard onLogout={logout} />;
}
