import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Quiz } from '../../../core/models/quiz.models';
import { QuizService } from '../../../core/services/quiz.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-quiz-table',
  styleUrl: './quiz-table.css',
  templateUrl: './quiz-table.html',
})
export class QuizTable implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly quizService = inject(QuizService);
  readonly auth = inject(AuthService);

  readonly quizzes = signal<Quiz[]>([]);
  readonly categories = signal<{ id: number; title: string; description: string }[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly categoryForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
  });

  readonly quizForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    maxMarks: [1, [Validators.required, Validators.min(1)]],
    numberOfQuestions: [1, [Validators.required, Validators.min(1)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    active: [true],
  });

  readonly questionForm = this.fb.nonNullable.group({
    content: ['', Validators.required],
    imageUrl: [''],
    options: ['', Validators.required],
    answer: ['', Validators.required],
    marks: [1, [Validators.required, Validators.min(1)]],
    quizId: [0, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.loadQuizzes();
  }

  loadQuizzes(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    forkJoin({
      quizzes: this.quizService.getActiveQuizzes(),
      categories: this.quizService.getCategories(),
    }).subscribe({
      next: ({ quizzes, categories }) => {
        const categoriesById = new Map(categories.map((category) => [category.id, category]));
        this.categories.set(categories);
        this.quizzes.set(quizzes.map((quiz) => ({
          ...quiz,
          category: quiz.category || categoriesById.get(quiz.categoryId),
        })));
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Unable to load assessments.');
        this.isLoading.set(false);
      },
    });
  }

  categoryName(quiz: Quiz): string {
    return quiz.category?.title || `Category ${quiz.categoryId}`;
  }

  submitCategory(): void {
    if (this.categoryForm.invalid || this.isSubmitting()) return this.categoryForm.markAllAsTouched();
    this.submit(() => this.quizService.createCategory(this.categoryForm.getRawValue()), () => {
      this.categoryForm.reset({ title: '', description: '' });
      this.loadQuizzes();
    });
  }

  submitQuiz(): void {
    if (this.quizForm.invalid || this.isSubmitting()) return this.quizForm.markAllAsTouched();
    this.submit(() => this.quizService.createQuiz(this.quizForm.getRawValue()), () => {
      this.quizForm.reset({ title: '', description: '', maxMarks: 1, numberOfQuestions: 1, categoryId: 0, active: true });
      this.loadQuizzes();
    });
  }

  submitQuestion(): void {
    if (this.questionForm.invalid || this.isSubmitting()) return this.questionForm.markAllAsTouched();
    const formValue = this.questionForm.getRawValue();
    const options = formValue.options.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      this.errorMessage.set('Add at least two answer options, one per line.');
      return;
    }
    if (!options.includes(formValue.answer.trim())) {
      this.errorMessage.set('The correct answer must exactly match one of the options.');
      return;
    }
    this.submit(() => this.quizService.createQuestion({ ...formValue, options, answer: formValue.answer.trim() }), () => {
      this.questionForm.reset({ content: '', imageUrl: '', options: '', answer: '', marks: 1, quizId: 0 });
    });
  }

  private submit<T>(request: () => Observable<T>, onSuccess: () => void): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    request().subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set('Saved successfully.');
        onSuccess();
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(error?.error?.message || 'Unable to save this item.');
      },
    });
  }
}
