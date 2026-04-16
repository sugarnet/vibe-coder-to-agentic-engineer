import { useState, FormEvent } from "react";

type LoginFormProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
};

export const LoginForm = ({
  onLogin,
  isLoading = false,
  error,
}: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      return;
    }
    await onLogin(username.trim(), password.trim());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--primary-blue)] to-[var(--secondary-purple)] px-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">
            Kanban <span className="text-[var(--accent-yellow)]">Studio</span>
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Project Management MVP
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-white"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user"
              disabled={isLoading}
              className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 outline-none transition focus:border-[var(--accent-yellow)] focus:ring-2 focus:ring-[var(--accent-yellow)]/50 disabled:opacity-50"
              required
              aria-label="Username"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-white"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              disabled={isLoading}
              className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 outline-none transition focus:border-[var(--accent-yellow)] focus:ring-2 focus:ring-[var(--accent-yellow)]/50 disabled:opacity-50"
              required
              aria-label="Password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 font-semibold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-50"
            aria-label="Sign in"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Help Text */}
        <div className="rounded-lg bg-white/5 px-4 py-3 text-xs text-white/70">
          <p className="mb-2 font-semibold">Demo credentials:</p>
          <p>Username: <code className="text-[var(--accent-yellow)]">user</code></p>
          <p>Password: <code className="text-[var(--accent-yellow)]">password</code></p>
        </div>
      </div>
    </div>
  );
};
