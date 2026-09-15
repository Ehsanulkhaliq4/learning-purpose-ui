import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryDto, Question, Quiz } from '../../../core/models/quiz.models';
import { QuizService } from '../../../core/services/quiz.service';

type AdminSection = 'categories' | 'quizzes' | 'questions';

@Component({
  imports: [ReactiveFormsModule, RouterLink, RouterLinkActive],
  selector: 'app-admin-quiz-manager',
  styleUrl: './admin-quiz-manager.css',
  templateUrl: './admin-quiz-manager.html',
})
export class AdminQuizManager implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly quizService = inject(QuizService);
  readonly auth = inject(AuthService);

  readonly section = signal<AdminSection>('categories');
  readonly categories = signal<CategoryDto[]>([]);
  readonly quizzes = signal<Quiz[]>([]);
  readonly questions = signal<Question[]>([]);
  readonly selectedQuizId = signal(0);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

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
    const requestedSection = this.route.snapshot.data['section'] as AdminSection | undefined;
    this.section.set(requestedSection || 'categories');
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadData(): void {
    this.isLoading.set(true);
    forkJoin({
      categories: this.quizService.getCategories(),
      quizzes: this.quizService.getActiveQuizzes(),
    }).subscribe({
      next: ({ categories, quizzes }) => {
        const categoriesById = new Map(categories.map((category) => [category.id, category]));
        this.categories.set(categories);
        this.quizzes.set(quizzes.map((quiz) => ({ ...quiz, category: quiz.category || categoriesById.get(quiz.categoryId) })));
        this.isLoading.set(false);
        if (this.section() === 'questions' && this.selectedQuizId()) this.loadQuestions(this.selectedQuizId());
      },
      error: (error) => {
        this.isLoading.set(false);
        this.showToast('error', error?.error?.message || 'Unable to load assessment data.');
      },
    });
  }

  selectQuiz(quizId: number): void {
    this.selectedQuizId.set(quizId);
    this.questionForm.controls.quizId.setValue(quizId);
    this.loadQuestions(quizId);
  }

  submitCategory(): void {
    if (this.categoryForm.invalid || this.isSubmitting()) return this.categoryForm.markAllAsTouched();
    this.submit(() => this.quizService.createCategory(this.categoryForm.getRawValue()), () => {
      this.categoryForm.reset({ title: '', description: '' });
      this.loadData();
    }, 'Category published to the library.');
  }

  submitQuiz(): void {
    if (this.quizForm.invalid || this.isSubmitting()) return this.quizForm.markAllAsTouched();
    this.submit(() => this.quizService.createQuiz(this.quizForm.getRawValue()), () => {
      this.quizForm.reset({ title: '', description: '', maxMarks: 1, numberOfQuestions: 1, categoryId: 0, active: true });
      this.loadData();
    }, 'Quiz created and ready for questions.');
  }

  submitQuestion(): void {
    if (this.questionForm.invalid || this.isSubmitting()) return this.questionForm.markAllAsTouched();
    const formValue = this.questionForm.getRawValue();
    const options = formValue.options.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) return this.showToast('error', 'Add at least two answer options, one per line.');
    if (!options.includes(formValue.answer.trim())) return this.showToast('error', 'The correct answer must exactly match an option.');
    this.submit(() => this.quizService.createQuestion({ ...formValue, options, answer: formValue.answer.trim() }), () => {
      this.questionForm.reset({ content: '', imageUrl: '', options: '', answer: '', marks: 1, quizId: this.selectedQuizId() });
      this.loadQuestions(this.selectedQuizId());
    }, 'Question added to the quiz.');
  }

  categoryName(quiz: Quiz): string {
    return quiz.category?.title || `Category ${quiz.categoryId}`;
  }

  private loadQuestions(quizId: number): void {
    if (!quizId) {
      this.questions.set([]);
      return;
    }
    this.quizService.getQuestionsByQuiz(quizId).subscribe({
      next: (questions) => this.questions.set(questions),
      error: () => this.showToast('error', 'Unable to load questions for this quiz.'),
    });
  }

  private submit<T>(request: () => Observable<T>, onSuccess: () => void, message: string): void {
    this.isSubmitting.set(true);
    request().subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.showToast('success', message);
        onSuccess();
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.showToast('error', error?.error?.message || 'Unable to save this item.');
      },
    });
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
  }
}
