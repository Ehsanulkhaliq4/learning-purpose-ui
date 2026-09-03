import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Quiz, Question, QuizEvaluationResult } from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);
  private readonly GATEWAY_URL = 'http://localhost:8080/api/v1';

  getActiveQuizzes(): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(`${this.GATEWAY_URL}/quizzes/active`);
  }

  getQuestionsByQuiz(quizId: number): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.GATEWAY_URL}/questions/quiz/${quizId}`);
  }

  evaluateQuiz(quizId: number, answers: { quesId: number; selectedOption: string }[]): Observable<QuizEvaluationResult> {
    return this.http.post<QuizEvaluationResult>(`${this.GATEWAY_URL}/quizzes/${quizId}/evaluate`, answers);
  }
}