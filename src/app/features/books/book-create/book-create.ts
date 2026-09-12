import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookService } from '../../../core/services/book.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-book-create',
  styleUrl: './book-create.css',
  templateUrl: './book-create.html',
})
export class BookCreate {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedCover = signal<File | undefined>(undefined);
  readonly selectedPdf = signal<File | undefined>(undefined);
  readonly bookForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    author: ['', [Validators.required]],
    description: [''],
    contentType: [''],
  });

  isInvalid(name: 'title' | 'author'): boolean {
    const control = this.bookForm.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  onCoverSelected(event: Event): void {
    this.selectedCover.set((event.target as HTMLInputElement).files?.[0]);
  }

  onPdfSelected(event: Event): void {
    this.selectedPdf.set((event.target as HTMLInputElement).files?.[0]);
  }

  removeCover(): void { this.selectedCover.set(undefined); }
  removePdf(): void { this.selectedPdf.set(undefined); }

  onSubmit(): void {
    if (this.bookForm.invalid || this.isSubmitting()) {
      this.bookForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.bookService.createBook(this.bookForm.getRawValue(), this.selectedCover(), this.selectedPdf()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/books']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error?.error?.message || 'Unable to add this book. Please try again.');
      },
    });
  }
}