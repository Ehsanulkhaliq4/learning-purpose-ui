import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookItem } from '../../../core/models/catalog.models';
import { BookService } from '../../../core/services/book.service';

@Component({
  imports: [FormsModule],
  selector: 'app-book-catalog',
  styleUrl: './book-catalog.css',
  templateUrl: './book-catalog.html',
})
export class BookCatalog implements OnInit {
  private readonly bookService = inject(BookService);
  readonly books = signal<BookItem[]>([]);
  readonly searchTerm = signal('');
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void { this.loadBooks(); }

  loadBooks(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.bookService.getAllBooks().subscribe({
      next: (page) => { this.books.set(page.content); this.isLoading.set(false); },
      error: (error) => { this.errorMessage.set(error?.error?.message || 'Unable to load books.'); this.isLoading.set(false); },
    });
  }

  search(): void {
    const query = this.searchTerm().trim();
    if (!query) { this.loadBooks(); return; }
    this.isLoading.set(true);
    this.bookService.searchBooks(query).subscribe({
      next: (books) => { this.books.set(books); this.isLoading.set(false); },
      error: (error) => { this.errorMessage.set(error?.error?.message || 'Unable to search books.'); this.isLoading.set(false); },
    });
  }

  download(book: BookItem): void {
    this.bookService.downloadPdf(book.id).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${book.title}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => this.errorMessage.set(error?.error?.message || 'Unable to download this book.'),
    });
  }

  deleteBook(book: BookItem): void {
    if (!confirm(`Delete "${book.title}"?`)) return;
    this.bookService.deleteBook(book.id).subscribe({
      next: () => this.books.update((items) => items.filter((item) => item.id !== book.id)),
      error: (error) => this.errorMessage.set(error?.error?.message || 'Unable to delete this book.'),
    });
  }
}
