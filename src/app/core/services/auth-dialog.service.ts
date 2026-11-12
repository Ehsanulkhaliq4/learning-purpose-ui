import { Injectable, signal } from '@angular/core';

export type AuthDialogMode = 'login' | 'register';

@Injectable({ providedIn: 'root' })
export class AuthDialogService {
  readonly mode = signal<AuthDialogMode | null>(null);

  open(mode: AuthDialogMode): void {
    this.mode.set(mode);
  }

  close(): void {
    this.mode.set(null);
  }
}
