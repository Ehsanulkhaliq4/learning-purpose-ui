import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly resetForm = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  isInvalid(controlName: 'email' | 'otp' | 'newPassword'): boolean {
    const control = this.resetForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  onSubmit(): void {
    if (this.resetForm.invalid || this.isSubmitting()) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const value = this.resetForm.getRawValue();
    this.authService.resetPassword({
      email: value.email,
      otp: Number(value.otp),
      newPassword: value.newPassword,
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.successMessage.set(response.message || 'Password reset successfully');
        setTimeout(() => this.router.navigate(['/auth/login']), 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Unable to reset password. Check the OTP and try again.');
      },
    });
  }
}
