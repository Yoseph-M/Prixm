import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})
export class SignUpComponent {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;
  validationError = '';
  
  authService = inject(AuthService);
  private router = inject(Router);

  constructor() {}

  async handleSignUp() {
    this.validationError = '';
    if (!this.name || !this.email || !this.password || !this.confirmPassword) {
      this.validationError = 'Please fill in all fields.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.validationError = 'Passwords do not match.';
      return;
    }
    if (this.password.length < 6) {
      this.validationError = 'Password must be at least 6 characters.';
      return;
    }
    
    this.loading = true;
    try {
      await this.authService.signUp(this.email, this.password, this.name);
      this.router.navigate(['/dashboard']);
    } catch (err) {
      // Handled in authService
    } finally {
      this.loading = false;
    }
  }

  async handleGoogleSignUp() {
    try {
      await this.authService.signInWithGoogle();
      this.router.navigate(['/dashboard']);
    } catch (err) {
      // Handled in authService
    }
  }
}
