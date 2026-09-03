import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.css',
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly forgotMessage = signal<string | null>(null);
  readonly isForgotMode = signal(false);

  readonly loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    email: ['', [Validators.required, Validators.email]],
  });

  isInvalid(controlName: 'username' | 'password' | 'email'): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  showForgotPassword(): void {
    this.isForgotMode.set(true);
    this.errorMessage.set(null);
    this.forgotMessage.set(null);
  }

  showLogin(): void {
    this.isForgotMode.set(false);
    this.errorMessage.set(null);
    this.forgotMessage.set(null);
  }

  requestPasswordReset(): void {
    const email = this.loginForm.controls.email.value;
    if (this.loginForm.controls.email.invalid || this.isSubmitting()) {
      this.loginForm.controls.email.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.forgotMessage.set(null);
    this.authService.requestPasswordResetOtp(email).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/auth/reset-password'], {
          queryParams: { email },
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Unable to send OTP. Check your email and try again.');
      },
    });
  }

  onSubmit(): void {
    const usernameControl = this.loginForm.controls.username;
    const passwordControl = this.loginForm.controls.password;

    if (usernameControl.invalid || passwordControl.invalid || this.isSubmitting()) {
      usernameControl.markAsTouched();
      passwordControl.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.loginForm.getRawValue();
    this.authService.login({ username, password }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Sign in failed. Check your username and password.'
        );
      },
    });
  }
}
