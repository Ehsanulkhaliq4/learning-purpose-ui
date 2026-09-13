import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CategoryDto, CategoryRequest, ExamSubmission, Question, QuestionRequest, Quiz, QuizEvaluationResult, QuizRequest } from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);
  private readonly GATEWAY_URL = 'http://localhost:8080/api/v1';

  getActiveQuizzes(): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(`${this.GATEWAY_URL}/quizzes/active`);
  }

  getCategories(): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(`${this.GATEWAY_URL}/categories`);
  }

  createCategory(request: CategoryRequest): Observable<CategoryDto> {
    return this.http.post<CategoryDto>(`${this.GATEWAY_URL}/categories`, request);
  }

  createQuiz(request: QuizRequest): Observable<Quiz> {
    return this.http.post<Quiz>(`${this.GATEWAY_URL}/quizzes`, request);
  }

  createQuestion(request: QuestionRequest): Observable<Question> {
    return this.http.post<Question>(`${this.GATEWAY_URL}/questions`, request);
  }

  getQuestionsByQuiz(quizId: number): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.GATEWAY_URL}/questions/quiz/${quizId}`);
  }

  evaluateQuiz(submission: ExamSubmission): Observable<QuizEvaluationResult> {
    return this.http.post<QuizEvaluationResult>(`${this.GATEWAY_URL}/quizzes/evaluate`, submission);
  }
}