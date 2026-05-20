import { createContext, useState, useCallback, type ReactNode } from 'react';
import { login as apiLogin, type LoginPayload } from '../api/auth';

interface AuthState {
  token: string | null;
  role: string | null;
}

interface AuthContextType extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// Normalize role from backend ALL CAPS to frontend Title Case
const normalizeRole = (role: string | undefined | null): string => {
  // "ADMINISTRATEUR" -> "Administrateur"
  // "DISPATCHEUR" -> "Dispatcheur"
  // "EXPEDITEUR" -> "Expediteur"
  // "CHAUFFEUR" -> "Chauffeur"
  if (!role) {
    console.error('normalizeRole: role is undefined or null');
    return '';
  }
  return role.charAt(0) + role.slice(1).toLowerCase();
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem('access_token'),
    role: localStorage.getItem('role'),
  }));

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await apiLogin(payload);
    console.log('Login response:', data);
    console.log('Role from backend:', data.role, 'Type:', typeof data.role);

    const normalizedRole = normalizeRole(data.role);
    console.log('Normalized role:', normalizedRole);

    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('role', normalizedRole);

    setAuth({
      token: data.access_token,
      role: normalizedRole
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('role');
    setAuth({ token: null, role: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        login,
        logout,
        isAuthenticated: !!auth.token
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
