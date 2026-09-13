export interface Category {
  id: number;
  title: string;
  description: string;
}

export type CategoryDto = Category;

export interface CategoryRequest {
  title: string;
  description: string;
}

export interface QuizRequest {
  title: string;
  description: string;
  maxMarks: number;
  numberOfQuestions: number;
  active: boolean;
  categoryId: number;
}

export interface QuestionRequest {
  content: string;
  imageUrl: string;
  options: string[];
  answer: string;
  marks: number;
  quizId: number;
}

export interface QuestionOption {
  key: string;
  value: string;
}

export interface Question {
  id: number;
  content: string;
  imageUrl?: string;
  options: string[];
  answer?: string;
  marks?: number;
  quizId?: number;
  selectedOption?: string;
}

export interface Quiz {
  id: number;
  title: string;
  description: string;
  maxMarks: number;
  numberOfQuestions: number;
  active: boolean;
  categoryId: number;
  category?: Category;
}

export interface QuizEvaluationResult {
  quizId: number;
  quizTitle: string;
  totalQuestions: number;
  attempted: number;
  correctAnswers: number;
  marksScored: number;
  maxMarks: number;
  percentage: number;
  passed: boolean;
}

export interface ExamSubmission {
  quizId: number;
  username: string;
  userEmail: string;
  selectedAnswers: Record<string, string>;
}