import { createContext, useState, useCallback, type ReactNode } from 'react';
import { login as apiLogin, type LoginPayload } from '../api/auth';
import type { Role } from '../utils/constants';

interface AuthState {
  token: string | null;
  role: Role | null;
}

interface AuthContextType extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem('access_token'),
    role: localStorage.getItem('user_role') as Role | null,
  }));

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await apiLogin(payload);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user_role', data.role);
    setAuth({ token: data.access_token, role: data.role as Role });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    setAuth({ token: null, role: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...auth, login, logout, isAuthenticated: !!auth.token }}
    >
      {children}
    </AuthContext.Provider>
  );
}
