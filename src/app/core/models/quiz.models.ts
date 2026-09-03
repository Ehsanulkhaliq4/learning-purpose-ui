export interface Category {
  cid: number;
  title: string;
  description: string;
}

export interface QuestionOption {
  key: string;
  value: string;
}

export interface Question {
  quesId: number;
  content: string;
  image?: string;
  options: QuestionOption[];
  selectedOption?: string;
}

export interface Quiz {
  qId: number;
  title: string;
  description: string;
  maxMarks: number;
  numberOfQuestions: number;
  active: boolean;
  category: Category;
}

export interface QuizEvaluationResult {
  attempted: number;
  correctAnswers: number;
  marksScored: number;
}