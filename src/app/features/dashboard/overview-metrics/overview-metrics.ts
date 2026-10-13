import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { DailyBar, DashboardResponse } from '../../../core/models/dashboard.models';

@Component({
  imports: [DecimalPipe, RouterLink],
  selector: 'app-overview-metrics',
  styleUrl: './overview-metrics.css',
  templateUrl: './overview-metrics.html',
})
export class OverviewMetrics {
  private readonly dashboardService = inject(DashboardService);
  readonly authService = inject(AuthService);

  readonly dashboard = signal<DashboardResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly weekLabel = this.getWeekLabel();

  constructor() {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const userId = this.authService.currentUser()?.id ?? 8;
    this.dashboardService.getDashboard(userId).subscribe({
      next: (response) => {
        this.dashboard.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('We could not load your learning overview. Please try again.');
        this.loading.set(false);
      },
    });
  }

  barHeight(hours: number | null): number {
    const dailyHours = this.dashboard()?.studyRhythm?.dailyHours ?? [];
    const maxHours = Math.max(...dailyHours.map((day: DailyBar) => day.hours ?? 0), 1);
    return Math.max(((hours ?? 0) / maxHours) * 100, 5);
  }

  milestonePercentage(current: number, maximum: number): number {
    return maximum > 0 ? Math.min((current / maximum) * 100, 100) : 0;
  }

  appRoute(url: string | null): string {
    if (!url) return '/quizzes';

    const supportedRoutes = ['/dashboard', '/quizzes', '/books', '/media', '/videos', '/conference', '/blog'];
    return supportedRoutes.some((route) => url === route || url.startsWith(`${route}/`)) ? url : '/quizzes';
  }

  private getWeekLabel(): string {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const format = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
    return `${format.format(start)} - ${format.format(end)}`;
  }
}
