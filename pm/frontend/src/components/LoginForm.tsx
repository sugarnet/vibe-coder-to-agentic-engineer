import { useState, type FormEvent } from "react";

type LoginFormProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister?: (username: string, password: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
};

type Mode = "login" | "register";

export const LoginForm = ({
  onLogin,
  onRegister,
  isLoading = false,
  error,
}: LoginFormProps) => {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setValidationError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    if (!username.trim() || !password.trim()) return;

    if (mode === "login") {
      await onLogin(username.trim(), password.trim());
      return;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }
    if (onRegister) {
      await onRegister(username.trim(), password.trim());
    }
  };

  const displayError = validationError || error;
  const inputClasses =
    "mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 outline-none transition focus:border-[var(--accent-yellow)] focus:ring-2 focus:ring-[var(--accent-yellow)]/50 disabled:opacity-50";

  const submitLabel = isLoading
    ? mode === "register" ? "Creating account..." : "Signing in..."
    : mode === "register" ? "Create Account" : "Sign In";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--primary-blue)] to-[var(--secondary-purple)] px-4">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">
            Kanban <span className="text-[var(--accent-yellow)]">Studio</span>
          </h1>
          <p className="mt-2 text-sm text-white/70">Project Management</p>
        </div>

        <div className="flex rounded-xl border border-white/20 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "login" ? "bg-white/20 text-white" : "text-white/60 hover:text-white/80"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${mode === "register" ? "bg-white/20 text-white" : "text-white/60 hover:text-white/80"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-white">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === "login" ? "user" : "your_username"}
              disabled={isLoading}
              className={inputClasses}
              required
              aria-label="Username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-white">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "password" : "min. 6 characters"}
              disabled={isLoading}
              className={inputClasses}
              required
              aria-label="Password"
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-white">Confirm Password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                disabled={isLoading}
                className={inputClasses}
                required
                aria-label="Confirm Password"
              />
            </div>
          )}

          {displayError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-xl bg-[var(--secondary-purple)] px-4 py-3 font-semibold uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </form>

        {mode === "login" && (
          <div className="rounded-lg bg-white/5 px-4 py-3 text-xs text-white/70">
            <p className="mb-1 font-semibold">Demo credentials:</p>
            <p>Username: <code className="text-[var(--accent-yellow)]">user</code></p>
            <p>Password: <code className="text-[var(--accent-yellow)]">password</code></p>
          </div>
        )}
      </div>
    </div>
  );
};
