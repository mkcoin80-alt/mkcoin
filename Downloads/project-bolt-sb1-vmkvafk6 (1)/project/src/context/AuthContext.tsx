import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '../lib/firebase';
import { loadSession, saveSession, clearSession } from '../lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session) setUserState(session);
    setLoaded(true);
  }, []);

  const setUser = (u: AuthUser | null) => {
    setUserState(u);
    if (u) saveSession(u);
    else clearSession();
  };

  const logout = () => {
    clearSession();
    setUserState(null);
  };

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
