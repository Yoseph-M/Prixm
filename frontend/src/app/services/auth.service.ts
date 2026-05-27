import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  updateProfile,
  User,
  GoogleAuthProvider
} from 'firebase/auth';

import { environment } from '../../environments/environment';

const firebaseConfig = {
  apiKey: environment.VITE_FIREBASE_API_KEY,
  authDomain: environment.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: environment.VITE_FIREBASE_PROJECT_ID,
  storageBucket: environment.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: environment.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: environment.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const ERROR_MAP: Record<string, string> = {
  'auth/wrong-password':         'Incorrect password. Please try again.',
  'auth/invalid-credential':     'Invalid email or password.',
  'auth/email-already-in-use':   'An account with this email already exists.',
  'auth/user-not-found':         'No account found with this email.',
  'auth/weak-password':          'Password must be at least 6 characters.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
  'auth/popup-closed-by-user':   'Sign-in popup was closed. Please try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
};

function mapError(err: any): string {
  return ERROR_MAP[err.code] || err.message || 'An unexpected error occurred.';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user = signal<User | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  constructor(private router: Router) {
    getRedirectResult(auth)
      .then(async (cred) => {
        if (cred?.user) {
          await this.syncUserToBackend(cred.user);
          this.router.navigateByUrl('/dashboard');
        }
      })
      .catch((err) => {
        console.error('Redirect sign-in error:', err);
        this.error.set(mapError(err));
      });

    onAuthStateChanged(auth, (firebaseUser) => {
      this.user.set(firebaseUser);
      this.loading.set(false);
    });
  }

  async signIn(email: string, password: string) {
    this.error.set(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      this.error.set(mapError(err));
      throw err;
    }
  }

  async signUp(email: string, password: string, displayName?: string) {
    this.error.set(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await this.syncUserToBackend(cred.user);
    } catch (err: any) {
      this.error.set(mapError(err));
      throw err;
    }
  }

  async signInWithGoogle() {
    this.error.set(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      this.error.set(mapError(err));
      throw err;
    }
  }

  async signOut() {
    this.error.set(null);
    await firebaseSignOut(auth);
    this.router.navigate(['/']);
  }

  async getToken(forceRefresh = false): Promise<string | null> {
    const currentUser = this.user();
    if (!currentUser) return null;
    return currentUser.getIdToken(forceRefresh);
  }

  private async syncUserToBackend(firebaseUser: User) {
    const token = await firebaseUser.getIdToken();
    const apiUrl = environment.VITE_API_URL || 'http://localhost:8000';
    await fetch(`${apiUrl}/auth/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
