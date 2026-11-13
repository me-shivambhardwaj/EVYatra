"use client";
import { useState, useEffect, useCallback } from "react";
import type { UserPayload } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("evyatra:jwt");
      const storedUser = localStorage.getItem("evyatra:user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Background check to verify token validity
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.user) {
              setUser(data.user);
              localStorage.setItem("evyatra:user", JSON.stringify(data.user));
            } else {
              // Token invalid
              localStorage.removeItem("evyatra:jwt");
              localStorage.removeItem("evyatra:user");
              setToken(null);
              setUser(null);
            }
          })
          .catch(() => {});
      }
    } catch {
      // storage not accessible or JSON parse error
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((jwtToken: string, userData: UserPayload) => {
    setToken(jwtToken);
    setUser(userData);
    localStorage.setItem("evyatra:jwt", jwtToken);
    localStorage.setItem("evyatra:user", JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("evyatra:jwt");
    localStorage.removeItem("evyatra:user");
  }, []);

  return {
    user,
    token,
    isLoggedIn: Boolean(user && token),
    loading,
    login,
    logout,
  };
}
