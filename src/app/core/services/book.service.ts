import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BookItem, BookPage, BookRequest } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:8080/api/v1/books';

  getAllBooks(page = 0, size = 10): Observable<BookPage> {
    return this.http.get<BookPage>(this.API_URL, { params: { page, size } });
  }

  createBook(request: BookRequest, coverImage?: File, pdfFile?: File): Observable<BookItem> {
    return this.http.post<BookItem>(this.API_URL, this.toFormData(request, coverImage, pdfFile));
  }

  updateBook(id: number, request: BookRequest, coverImage?: File, pdfFile?: File): Observable<BookItem> {
    return this.http.put<BookItem>(`${this.API_URL}/${id}`, this.toFormData(request, coverImage, pdfFile));
  }

  searchBooks(query: string): Observable<BookItem[]> {
    return this.http.get<BookItem[]>(`${this.API_URL}/search`, { params: { query } });
  }

  getBook(id: number): Observable<BookItem> {
    return this.http.get<BookItem>(`${this.API_URL}/${id}`);
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${id}/download`, { responseType: 'blob' });
  }

  deleteBook(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  private toFormData(request: BookRequest, coverImage?: File, pdfFile?: File): FormData {
    const formData = new FormData();
    formData.append('book', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    if (coverImage) formData.append('coverImage', coverImage, coverImage.name);
    if (pdfFile) formData.append('pdfFile', pdfFile, pdfFile.name);
    return formData;
  }
}