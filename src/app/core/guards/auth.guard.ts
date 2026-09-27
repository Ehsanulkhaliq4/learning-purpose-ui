import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (authService.isAuthenticated()) {
    return true;
  }

  const loginUrl = router.createUrlTree(['/auth/login']);
  if (!isPlatformBrowser(platformId)) {
    return loginUrl;
  }

  const { default: Swal } = await import('sweetalert2');
  const result = await Swal.fire({
    title: 'Sign in to continue',
    text: 'Please sign in to access this learning space.',
    icon: 'info',
    confirmButtonText: 'Go to login',
    showCancelButton: true,
    cancelButtonText: 'Stay here',
    reverseButtons: true,
    buttonsStyling: true,
    customClass: {
      popup: 'lp-swal-popup',
      title: 'lp-swal-title',
      htmlContainer: 'lp-swal-text',
      confirmButton: 'lp-swal-confirm',
      cancelButton: 'lp-swal-cancel',
    },
  });

  return result.isConfirmed ? loginUrl : false;
};

export const authMatchGuard: CanMatchFn = () => inject(AuthService).isAuthenticated();
