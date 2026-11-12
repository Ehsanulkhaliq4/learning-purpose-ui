import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

export type AuthDialogMode = 'login' | 'register';

@Injectable({ providedIn: 'root' })
export class AuthDialogService {
  private readonly router = inject(Router);
  readonly mode = signal<AuthDialogMode | null>(null);

  open(mode: AuthDialogMode): void {
    this.mode.set(mode);
  }

  openLoginAtHome(): void {
    void this.router.navigateByUrl('/').then((navigated) => {
      if (navigated || this.router.url === '/') {
        this.open('login');
      }
    });
  }

  close(): void {
    this.mode.set(null);
  }
}
