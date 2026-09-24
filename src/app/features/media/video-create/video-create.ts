import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MediaService } from '../../../core/services/media.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-video-create',
  styleUrl: './video-create.css',
  templateUrl: './video-create.html',
})
export class VideoCreate {
  private readonly fb = inject(FormBuilder);
  private readonly mediaService = inject(MediaService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedFile = signal<File | undefined>(undefined);
  readonly videoForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
  });

  isInvalid(name: 'title'): boolean {
    const control = this.videoForm.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.selectedFile.set(file);
  }

  removeFile(): void {
    this.selectedFile.set(undefined);
  }

  onSubmit(): void {
    const file = this.selectedFile();
    if (this.videoForm.invalid || !file || this.isSubmitting()) {
      this.videoForm.markAllAsTouched();
      if (!file) {
        this.errorMessage.set('Please select a video file to upload.');
      }
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const { title, description } = this.videoForm.getRawValue();

    this.mediaService.uploadVideo(title, description, file).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/media']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error?.error?.message || 'Unable to upload this video. Please try again.');
      },
    });
  }
}
