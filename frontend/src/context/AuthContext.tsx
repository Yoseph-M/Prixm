import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  User,
  GoogleAuthProvider
} from 'firebase/auth';
import { environment } from '../environments/environment';

const firebaseConfig = {
  apiKey: environment.VITE_FIREBASE_API_KEY,
  authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: environment.VITE_FIREBASE_PROJECT_ID,
  storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: environment.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const ERROR_MAP: Record<string, string> = {
  'auth/wrong-password':         'Incorrect password. Please try again.',
  'auth/invalid-credential':     'Invalid email or password.',
  'auth/email-already-in-use':   'An account with this email already exists.',
  'auth/user-not-found':         'No account found with this email.',
  'auth/weak-password':          'Password must be at least 6 characters.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
  'auth/popup-closed-by-user':   'Sign-in popup was closed. Please try again.',
  'auth/popup-blocked':          'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function mapError(err: any): string {
  return ERROR_MAP[err.code] || err.message || 'An unexpected error occurred.';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const syncedRef = useRef<boolean>(false);

  const syncUserToBackend = async (firebaseUser: User) => {
    const token = await firebaseUser.getIdToken();
    const apiUrl = environment.VITE_API_URL || 'http://localhost:8000';
    await fetch(`${apiUrl}/auth/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser && !syncedRef.current) {
        syncedRef.current = true;
        try {
          await syncUserToBackend(firebaseUser);
        } catch (syncErr) {
          console.error('Backend sync failed:', syncErr);
          syncedRef.current = false;
        }
      } else if (!firebaseUser) {
        syncedRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setUser(cred.user);
    } catch (err: any) {
      const mapped = mapError(err);
      setError(mapped);
      throw err;
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      setUser(cred.user);
      try {
        await syncUserToBackend(cred.user);
        syncedRef.current = true;
      } catch (syncErr) {
        console.error('Backend sync failed during signUp:', syncErr);
      }
    } catch (err: any) {
      const mapped = mapError(err);
      setError(mapped);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUser(cred.user);
    } catch (err: any) {
      const mapped = mapError(err);
      setError(mapped);
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    syncedRef.current = false;
    await firebaseSignOut(auth);
    setUser(null);
  };

  const getToken = async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken(forceRefresh);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      setError,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
