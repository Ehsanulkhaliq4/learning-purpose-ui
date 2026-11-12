import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserProfile, UpdateUserProfileRequest } from '../../../core/models/user-profile.models';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';

@Component({
  selector: 'app-user-profile',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfilePage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly profileService = inject(UserProfileService);
  private readonly auth = inject(AuthService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('profileImageInput');

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isDeactivating = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    phone: ['', [Validators.maxLength(30), Validators.pattern(/^\+?[0-9\s()-]{7,30}$/)]],
  });

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.form.patchValue({
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          email: profile.email,
          phone: profile.phone ?? '',
        });
        this.isLoading.set(false);
        this.auth.updateCurrentUser({
          id: profile.id,
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName ?? undefined,
          email: profile.email,
          phone: profile.phone ?? undefined,
          profile: profile.profile ?? undefined,
          enabled: profile.enabled,
        });
      },
      error: () => {
        this.errorMessage.set('Your profile could not be loaded. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  chooseProfileImage(): void {
    this.fileInput()?.nativeElement.click();
  }

  async onProfileImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!file) return;
    if (!file.type.startsWith('image/') || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.errorMessage.set('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage.set('Choose an image smaller than 10 MB.');
      return;
    }

    try {
      const imageUrl = await this.compressImage(file);
      if (imageUrl.length > 700_000) {
        this.errorMessage.set('This image could not be compressed enough. Choose a smaller image.');
        return;
      }
      this.profile.update((current) => current ? { ...current, profile: imageUrl } : current);
      this.successMessage.set('Image selected. Save your profile to apply the change.');
    } catch {
      this.errorMessage.set('This image could not be opened. Try a different file.');
    }
  }

  removeProfileImage(): void {
    this.profile.update((current) => current ? { ...current, profile: null } : current);
    this.successMessage.set('Image removed. Save your profile to apply the change.');
    this.errorMessage.set('');
  }

  saveProfile(): void {
    if (this.form.invalid || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }
    const currentProfile = this.profile();
    if (!currentProfile) return;

    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const request: UpdateUserProfileRequest = {
      ...this.form.getRawValue(),
      profile: currentProfile.profile,
    };
    this.profileService.updateProfile(request).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.isSaving.set(false);
        this.successMessage.set('Your profile has been updated.');
        this.auth.updateCurrentUser({
          firstName: profile.firstName,
          lastName: profile.lastName ?? undefined,
          email: profile.email,
          phone: profile.phone ?? undefined,
          profile: profile.profile ?? undefined,
        });
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error?.error?.error || error?.error?.message || 'Your changes could not be saved. Please try again.');
      },
    });
  }

  deactivateAccount(): void {
    const username = this.profile()?.username;
    if (!username || this.isDeactivating()) return;
    const confirmed = window.confirm(
      `Deactivate @${username}? You will be signed out and will no longer be able to access this account.`,
    );
    if (!confirmed) return;

    this.isDeactivating.set(true);
    this.errorMessage.set('');
    this.profileService.deactivateAccount().subscribe({
      next: () => this.auth.logout(),
      error: (error) => {
        this.isDeactivating.set(false);
        this.errorMessage.set(error?.error?.error || 'Your account could not be deactivated. Please try again.');
      },
    });
  }

  initials(profile: UserProfile): string {
    return `${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? profile.username.charAt(0)}`.toUpperCase();
  }

  private compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not prepare the selected image.'));
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read the selected image.'));
      };
      image.src = objectUrl;
    });
  }
}
