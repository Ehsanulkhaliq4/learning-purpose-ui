import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register-applicant',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-applicant.html',
  styleUrl: './register-applicant.css',
})
export class RegisterApplicant implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal<boolean>(false);
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    username: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-]{7,15}$/)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  isFieldInvalid(fieldName: keyof typeof this.registerForm.controls): boolean {
    const control = this.registerForm.controls[fieldName];
    return control.invalid && (control.dirty || control.touched);
  }

  onSubmit(): void {
    if (this.registerForm.invalid || this.isSubmitting()) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.authService.registerApplicant(this.registerForm.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showToast('success', 'Account created successfully. Opening your dashboard...');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errorMessage = err?.error?.error || err?.error?.message || 'Registration failed. Please verify your details and try again.';
        this.showToast('error', errorMessage);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
  }
}