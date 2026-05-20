import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FlowFieldBackgroundComponent } from '../../components/ui/flow-field-background.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FlowFieldBackgroundComponent],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements OnInit {
  mode: 'signin' | 'signup' = 'signin';
  email = '';
  password = '';
  showPassword = false;
  loading = false;
  validationError = '';
  authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  termsAccepted = false;

  ngOnInit() {
    // Default to signin. If we want query params later, we can add them here.
    const modeParam = this.route.snapshot.queryParams['mode'];
    if (modeParam === 'signup') {
      this.mode = 'signup';
    } else {
      this.mode = 'signin';
    }
  }

  toggleMode() {
    this.mode = this.mode === 'signin' ? 'signup' : 'signin';
    this.validationError = '';
  }

  async handleAuth() {
    this.validationError = '';
    if (!this.email || !this.password) {
      this.validationError = 'Please fill in all fields.';
      return;
    }
    if (!this.termsAccepted) {
      this.validationError = 'You must accept the Terms of Service.';
      return;
    }
    this.loading = true;
    try {
      if (this.mode === 'signup') {
        await this.authService.signUp(this.email, this.password);
      } else {
        await this.authService.signIn(this.email, this.password);
      }
      const redirect = this.route.snapshot.queryParams['redirect'] || '/dashboard';
      this.router.navigateByUrl(redirect);
    } catch (err) {
      // Error is handled in authService
    } finally {
      this.loading = false;
    }
  }

  async handleGoogleSignIn() {
    try {
      await this.authService.signInWithGoogle();
      const redirect = this.route.snapshot.queryParams['redirect'] || '/dashboard';
      this.router.navigateByUrl(redirect);
    } catch (err) {
      // Error is handled in authService
    }
  }
}
