export interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  profile: string | null;
  enabled: boolean;
  createdAt: string;
  quizAttempts: number;
  completedLessons: number;
  bestScore: number;
  studyTimeHours: number;
  currentStreakDays: number;
  recentQuizAttempts: QuizActivity[];
}

export interface QuizActivity {
  title: string;
  subtitle: string;
  completedAt: string;
}

export interface UpdateUserProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profile: string | null;
}
