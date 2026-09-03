import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PostService } from '../../../core/services/post.service';

@Component({ selector: 'app-post-create', imports: [ReactiveFormsModule, RouterLink], styleUrl: './post-create.css', templateUrl: './post-create.html' })
export class PostCreate {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedImage = signal<File | undefined>(undefined);
  readonly postForm = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(120)]], content: ['', [Validators.required, Validators.maxLength(5000)]], postedBy: [this.authService.currentUser()?.username || '', [Validators.required]], tags: [''] });

  isInvalid(name: 'name' | 'content' | 'postedBy'): boolean { const control = this.postForm.controls[name]; return control.invalid && (control.dirty || control.touched); }
  onImageSelected(event: Event): void { this.selectedImage.set((event.target as HTMLInputElement).files?.[0]); }
  removeImage(): void { this.selectedImage.set(undefined); }
  onSubmit(): void {
    if (this.postForm.invalid || this.isSubmitting()) { this.postForm.markAllAsTouched(); return; }
    const value = this.postForm.getRawValue(); this.isSubmitting.set(true); this.errorMessage.set(null);
    this.postService.createPost({ name: value.name, content: value.content, postedBy: value.postedBy, tags: value.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }, this.selectedImage()).subscribe({
      next: () => { this.isSubmitting.set(false); this.router.navigate(['/blog']); },
      error: (err) => { this.isSubmitting.set(false); this.errorMessage.set(err?.error?.message || 'Unable to publish post. Please try again.'); },
    });
  }
}
