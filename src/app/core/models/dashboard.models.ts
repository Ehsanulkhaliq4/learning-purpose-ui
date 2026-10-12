export interface DashboardResponse {
  todayFocus: TodayFocus | null;
  studyRhythm: StudyRhythm | null;
  learningStreak: MetricCard | null;
  completedLessons: MetricCard | null;
  assessmentScore: MetricCard | null;
  studyTime: MetricCard | null;
  weeklyTarget: WeeklyTarget | null;
  recentActivities: Activity[] | null;
  resumeItems: ResumeItem[] | null;
  nextMilestone: NextMilestone | null;
}

export interface TodayFocus {
  title: string | null;
  subtitle: string | null;
  actionUrl: string | null;
}

export interface StudyRhythm {
  totalHoursThisWeek: number | null;
  dailyHours: DailyBar[] | null;
}

export interface DailyBar {
  dayOfWeek: string | null;
  hours: number | null;
}

export interface MetricCard {
  mainValue: string | null;
  unit: string | null;
  caption: string | null;
  isPositiveTrend: boolean | null;
}

export interface WeeklyTarget {
  targetPercentage: number;
  completedHours: number | null;
  goalHours: number | null;
  motivationalText: string | null;
  recommendedNext: RecommendedNext | null;
}

export interface RecommendedNext {
  title: string | null;
  linkUrl: string | null;
}

export interface Activity {
  id: string;
  title: string | null;
  subtitle: string | null;
  timeAgo: string | null;
  statusColor: string | null;
}

export interface ResumeItem {
  type: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  progressPercentage: number;
  actionText: string | null;
  actionUrl: string | null;
}

export interface NextMilestone {
  title: string | null;
  description: string | null;
  currentProgress: number;
  maxProgress: number;
}