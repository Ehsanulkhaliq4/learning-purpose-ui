import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CategoryDto, CategoryRequest, ExamSubmission, PublicExamCategory, PublicExamQuiz, Question, QuestionRequest, Quiz, QuizEvaluationResult, QuizRequest } from '../models/quiz.models';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly http = inject(HttpClient);
  private readonly GATEWAY_URL = 'http://localhost:8080/api/v1';

  getActiveQuizzes(): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(`${this.GATEWAY_URL}/quizzes/active`);
  }

  getQuizzes(): Observable<Quiz[]> {
    return this.http.get<Quiz[]>(`${this.GATEWAY_URL}/quizzes`);
  }

  getCategories(): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(`${this.GATEWAY_URL}/categories`);
  }

  getPublicExamCategories(): Observable<PublicExamCategory[]> {
    return this.http.get<PublicExamCategory[]>(`${this.GATEWAY_URL}/public/exams/categories`);
  }

  getPublicActiveExams(): Observable<PublicExamQuiz[]> {
    return this.http.get<PublicExamQuiz[]>(`${this.GATEWAY_URL}/public/exams/quizzes/active`);
  }

  createCategory(request: CategoryRequest): Observable<CategoryDto> {
    return this.http.post<CategoryDto>(`${this.GATEWAY_URL}/categories`, request);
  }

  deleteCategory(categoryId: number): Observable<void> {
    return this.http.delete<void>(`${this.GATEWAY_URL}/categories/${categoryId}`);
  }

  createQuiz(request: QuizRequest): Observable<Quiz> {
    return this.http.post<Quiz>(`${this.GATEWAY_URL}/quizzes`, request);
  }

  deleteQuiz(quizId: number): Observable<void> {
    return this.http.delete<void>(`${this.GATEWAY_URL}/quizzes/${quizId}`);
  }

  updateQuizStatus(quizId: number, active: boolean): Observable<Quiz> {
    return this.http.patch<Quiz>(`${this.GATEWAY_URL}/quizzes/${quizId}/status`, { active });
  }

  createQuestion(request: QuestionRequest): Observable<Question> {
    return this.http.post<Question>(`${this.GATEWAY_URL}/questions`, request);
  }

  deleteQuestion(questionId: number): Observable<void> {
    return this.http.delete<void>(`${this.GATEWAY_URL}/questions/${questionId}`);
  }

  getQuestionsByQuiz(quizId: number): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.GATEWAY_URL}/questions/quiz/${quizId}`);
  }

  evaluateQuiz(submission: ExamSubmission): Observable<QuizEvaluationResult> {
    return this.http.post<QuizEvaluationResult>(`${this.GATEWAY_URL}/quizzes/eval-quiz`, submission);
  }
}