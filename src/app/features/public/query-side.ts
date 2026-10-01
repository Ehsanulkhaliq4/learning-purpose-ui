import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PostService } from '../../core/services/post.service';
import { BlogPost } from '../../core/models/catalog.models';
import { PublicExamCategory, PublicExamQuiz } from '../../core/models/quiz.models';
import { AuthService } from '../../core/services/auth.service';
import { QuizService } from '../../core/services/quiz.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

export interface BookDocument {
  id: number;
  bookTitle: string;
  bookAuthorName: string;
  postedDate: string;
  contentType: string;
  bookDescription: string;
  coverImageKey: string | null;
  pdfStorageKey: string | null;
}

@Component({
  selector: 'app-query-side',
  imports: [DatePipe, RouterLink],
  templateUrl: './query-side.html',
  styleUrl: './query-side.css',
})
export class QuerySide implements OnInit {
  private readonly postService = inject(PostService);
  private readonly quizService = inject(QuizService);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);

  readonly posts = signal<BlogPost[]>([]);
  private readonly allCategories = signal<PublicExamCategory[]>([]);
  readonly recentCategories = signal<PublicExamCategory[]>([]);
  readonly recentQuizzes = signal<PublicExamQuiz[]>([]);
  readonly isLoadingPromotions = signal(true);
  readonly promotionError = signal<string | null>(null);
  readonly selectedPost = signal<BlogPost | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /* ---------- Book shelf signals ---------- */
  readonly books = signal<BookDocument[]>([]);
  readonly isLoadingBooks = signal(true);
  readonly booksError = signal<string | null>(null);
  private readonly BOOKS_API = 'http://localhost:8080/api/v1/public/books';

  handleRead(event: Event, postId: number): void {
    if (this.authService.isAuthenticated()) {
      return;
    }

    event.preventDefault();
    void Swal.fire({
      title: 'Sign in to keep learning',
      text: 'Please log in before reading community stories.',
      icon: 'info',
      confirmButtonText: 'Go to login',
      showCancelButton: true,
      cancelButtonText: 'Maybe later',
      reverseButtons: true,
      buttonsStyling: true,
      customClass: {
        popup: 'lp-swal-popup',
        title: 'lp-swal-title',
        htmlContainer: 'lp-swal-text',
        confirmButton: 'lp-swal-confirm',
        cancelButton: 'lp-swal-cancel',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = `/auth/login?returnUrl=/explore/${postId}`;
      }
    });
  }

  ngOnInit(): void {
    this.loadBooks();
    this.loadRecentLearning();

    const postId = Number(this.route.snapshot.paramMap.get('id'));
    if (postId) {
      this.postService.getPublicPostById(postId).subscribe({
        next: (post) => { this.selectedPost.set(post); this.isLoading.set(false); },
        error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to load this story.'); this.isLoading.set(false); },
      });
      return;
    }

    this.postService.getPublicPosts().subscribe({
      next: (page) => { this.posts.set(page.content); this.isLoading.set(false); },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to load the latest stories.'); this.posts.set([]); this.isLoading.set(false); },
    });
  }

  categoryTitle(categoryId: number): string {
    return this.allCategories().find((category) => category.id === categoryId)?.title
      ?? 'Learning';
  }

  coverUrl(book: BookDocument): string | null {
    return null; 
  }

  initials(title: string): string {
    return title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }

  coverGradient(book: BookDocument): string {
    const gradients = [
      'linear-gradient(145deg, #0f766e, #115e59)',
      'linear-gradient(145deg, #0369a1, #075985)',
      'linear-gradient(145deg, #b45309, #92400e)',
      'linear-gradient(145deg, #6d28d9, #5b21b6)',
      'linear-gradient(145deg, #be123c, #9f1239)',
      'linear-gradient(145deg, #0d9488, #0f766e)',
    ];
    const index = Math.abs(book.id ?? 0) % gradients.length;
    return gradients[index];
  }

  private loadBooks(): void {
    this.http.get<BookDocument[]>(this.BOOKS_API).subscribe({
      next: (data) => {
        const sorted = [...data].sort(
          (a, b) => Date.parse(b.postedDate) - Date.parse(a.postedDate)
        );
        this.books.set(sorted.slice(0, 4));
        this.isLoadingBooks.set(false);
      },
      error: () => {
        this.booksError.set('Could not load the book shelf right now.');
        this.books.set([]);
        this.isLoadingBooks.set(false);
      },
    });
  }

  private loadRecentLearning(): void {
    forkJoin({
      categories: this.quizService.getPublicExamCategories(),
      quizzes: this.quizService.getPublicActiveExams(),
    }).subscribe({
      next: ({ categories, quizzes }) => {
        const newestCategories = this.newestFirst(categories);
        this.allCategories.set(newestCategories);
        this.recentCategories.set(newestCategories.slice(0, 3));
        this.recentQuizzes.set(this.newestFirst(quizzes).slice(0, 3));
        this.isLoadingPromotions.set(false);
      },
      error: () => {
        this.promotionError.set('New learning picks are unavailable right now.');
        this.allCategories.set([]);
        this.recentCategories.set([]);
        this.recentQuizzes.set([]);
        this.isLoadingPromotions.set(false);
      },
    });
  }

  private newestFirst<T extends { createdAt: string }>(items: T[]): T[] {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }
    return [...items].sort((left, right) => {
      const rightDate = Date.parse(right?.createdAt) || 0;
      const leftDate = Date.parse(left?.createdAt) || 0;
      return rightDate - leftDate;
    });
  }
}