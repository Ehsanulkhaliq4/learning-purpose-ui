import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { QuizService } from '../../../core/services/quiz.service';
import { ExamSubmission, Question, QuizEvaluationResult } from '../../../core/models/quiz.models';

@Component({
  imports: [RouterLink],
  selector: 'app-quiz-take',
  styleUrl: './quiz-take.css',
  templateUrl: './quiz-take.html',
})
export class QuizTake {

  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly quizService = inject(QuizService);

  readonly quizId = signal<number>(0);
  readonly questions = signal<Question[]>([]);
  readonly currentQuestionIndex = signal<number>(0);
  readonly selectedAnswers = signal<Map<number, string>>(new Map());
  readonly isSubmitted = signal<boolean>(false);
  readonly result = signal<QuizEvaluationResult | null>(null);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.quizId.set(id);
    this.loadQuestions(id);
  }

  loadQuestions(id: number): void {
    this.loading.set(true);
    this.quizService.getQuestionsByQuiz(id).subscribe({
      next: (data) => {
        this.questions.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  selectOption(questionId: number, option: string): void {
    if (this.isSubmitted()) return;
    const map = new Map(this.selectedAnswers());
    map.set(questionId, option);
    this.selectedAnswers.set(map);
  }

  submitExam(): void {
    const user = this.auth.currentUser();
    if (!user?.username) {
      this.errorMessage.set('Your user session is missing a username. Please sign in again.');
      return;
    }

    if (this.selectedAnswers().size === 0) {
      this.errorMessage.set('Select at least one answer before submitting.');
      return;
    }

    const payload: ExamSubmission = {
      quizId: this.quizId(),
      username: user.username,
      userEmail: user.email,
      selectedAnswers: Object.fromEntries(this.selectedAnswers()),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.quizService.evaluateQuiz(payload).subscribe({
      next: (evaluation) => {
        this.result.set(evaluation);
        this.isSubmitted.set(true);
        this.submitting.set(false);
      },
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(
          typeof error?.error === 'string'
            ? error.error
            : error?.error?.message || 'Unable to submit this assessment.'
        );
      },
    });
  }
}
