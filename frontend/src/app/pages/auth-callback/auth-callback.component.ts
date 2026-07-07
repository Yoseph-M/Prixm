import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, getRedirectResult } from 'firebase/auth';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.css']
})
export class AuthCallbackComponent implements OnInit {
  private router = inject(Router);
  status: 'loading' | 'error' = 'loading';
  errorMessage = '';

  async ngOnInit() {
    try {
      const auth = getAuth();
      const cred = await getRedirectResult(auth);
      if (cred?.user) {
        // Successfully signed in — navigate to dashboard.
        this.router.navigateByUrl('/dashboard');
      } else {
        // No redirect result (user landed here directly) — send back to auth.
        this.router.navigateByUrl('/auth');
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      this.status = 'error';
      this.errorMessage = err.message || 'Sign-in failed. Please try again.';
      // After a short delay, redirect back to auth with the error.
      setTimeout(() => this.router.navigateByUrl('/auth'), 3000);
    }
  }
}
