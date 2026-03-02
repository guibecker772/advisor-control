import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

import { runEncodingRepairMigration } from '../services/encodingRepairMigration';
import { runOfferBackfillMigration } from '../services/offerBackfillMigration';
import { auth, firebaseInit, googleProvider } from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const migrationUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ?? null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      migrationUidRef.current = null;
      return;
    }

    if (migrationUidRef.current === user.uid) return;
    migrationUidRef.current = user.uid;

    const runMigrations = async () => {
      try {
        await runEncodingRepairMigration(user.uid);
        await runOfferBackfillMigration(user.uid);
      } catch (error) {
        console.error('Erro ao executar migrations pos-login:', error);
      }
    };

    void runMigrations();
  }, [user?.uid]);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error(firebaseInit.message || 'Firebase Auth nao inicializado.');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string) => {
    if (!auth) throw new Error(firebaseInit.message || 'Firebase Auth nao inicializado.');
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (!auth) throw new Error(firebaseInit.message || 'Firebase Auth nao inicializado.');
    await signOut(auth);
  };

  const loginGoogle = async () => {
    if (!auth || !googleProvider) {
      throw new Error(firebaseInit.message || 'Firebase Auth nao inicializado.');
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const authError = error as { code?: string };
      if (authError.code === 'auth/popup-closed-by-user') {
        const popupError = new Error('Login cancelado.');
        (popupError as { code?: string }).code = 'auth/popup-closed-by-user';
        throw popupError;
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
