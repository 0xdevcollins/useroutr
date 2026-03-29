"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  merchantId: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PUBLIC_PATHS = ["/login", "/register", "/verify", "/payments"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // TODO: Check for existing session / validate JWT
    const checkAuth = async () => {
      try {
        // Placeholder: fetch current user from API
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && !user && !PUBLIC_PATHS.includes(pathname)) {
      router.push("/login");
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string) => {
    // TODO: Call API login endpoint
    void email;
    void password;
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    // TODO: Call API register endpoint
    void data;
  };

  const logout = () => {
    // TODO: Clear tokens and redirect
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
