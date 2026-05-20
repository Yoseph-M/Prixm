import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.loading()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (!authService.loading()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  if (!authService.user()) {
    return router.parseUrl(`/signin?redirect=${state.url}`);
  }

  return true;
};
