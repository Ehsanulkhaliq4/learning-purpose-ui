import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { Question, QuizEvaluationResult } from '../../../core/models/quiz.models';

@Component({
  imports: [RouterLink],
  selector: 'app-quiz-take',
  styleUrl: './quiz-take.css',
  templateUrl: './quiz-take.html',
})
export class QuizTake {

  private readonly route = inject(ActivatedRoute);
  private readonly quizService = inject(QuizService);

  readonly quizId = signal<number>(0);
  readonly questions = signal<Question[]>([]);
  readonly currentQuestionIndex = signal<number>(0);
  readonly selectedAnswers = signal<Map<number, string>>(new Map());
  readonly isSubmitted = signal<boolean>(false);
  readonly result = signal<QuizEvaluationResult | null>(null);
  readonly loading = signal<boolean>(true);

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

  selectOption(quesId: number, key: string): void {
    if (this.isSubmitted()) return;
    const map = new Map(this.selectedAnswers());
    map.set(quesId, key);
    this.selectedAnswers.set(map);
  }

  submitExam(): void {
    const payload = Array.from(this.selectedAnswers().entries()).map(([quesId, selectedOption]) => ({
      quesId,
      selectedOption
    }));

    this.quizService.evaluateQuiz(this.quizId(), payload).subscribe({
      next: (evaluation) => {
        this.result.set(evaluation);
        this.isSubmitted.set(true);
      }
    });
  }
}
