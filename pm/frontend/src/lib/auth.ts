import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";

export type User = {
  username: string;
  token: string;
  user_id?: number;
};

const AUTH_STORAGE_KEY = "kanban_auth";

function persistUser(data: api.AuthResponse): User {
  const user: User = { username: data.username, token: data.token, user_id: data.user_id };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  return user;
}

function describeError(err: unknown, fallback: string, registerConflict = false): string {
  if (registerConflict && err instanceof api.APIError && err.status === 409) {
    return "Username already taken";
  }
  return err instanceof Error ? err.message : fallback;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored) as User);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.login(username, password);
      setUser(persistUser(data));
    } catch (err) {
      setError(describeError(err, "Login failed"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.register({ username, password });
      setUser(persistUser(data));
    } catch (err) {
      setError(describeError(err, "Registration failed", true));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
  };
};
