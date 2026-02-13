import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Route guard — redirects unauthenticated users to /login.
 *
 * Uses the AuthService's session signal. If still loading
 * (initial session restore), waits until loading completes
 * before deciding.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for initial session restoration
  if (auth.isLoading()) {
    await waitUntilLoaded(auth);
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Inverse guard — redirects authenticated users away from login.
 */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoading()) {
    await waitUntilLoaded(auth);
  }

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/projects']);
};

/** Poll until AuthService finishes loading (max ~3s). */
function waitUntilLoaded(auth: AuthService): Promise<void> {
  return new Promise((resolve) => {
    const maxAttempts = 30;
    let attempts = 0;

    const check = () => {
      if (!auth.isLoading() || ++attempts >= maxAttempts) {
        resolve();
        return;
      }
      setTimeout(check, 100);
    };

    check();
  });
}
