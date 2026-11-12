import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthDialogService } from '../services/auth-dialog.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (authService.isAuthenticated()) {
    return true;
  }

  if (isPlatformBrowser(platformId)) {
    inject(AuthDialogService).openLoginAtHome();
    return false;
  }

  return router.createUrlTree(['/']);
};

export const authMatchGuard: CanMatchFn = () => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }

  const platformId = inject(PLATFORM_ID);
  if (isPlatformBrowser(platformId)) {
    inject(AuthDialogService).openLoginAtHome();
  }

  return false;
};
