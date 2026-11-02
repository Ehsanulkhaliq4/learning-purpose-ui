import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
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
export class OverviewMetrics implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly authService = inject(AuthService);

  readonly dashboard = signal<DashboardResponse | null>(null);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly actionMessage = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly weekLabel = this.getWeekLabel();

  private focusListener?: () => void;
  private visibilityListener?: () => void;

  ngOnInit(): void {
    this.loadDashboard();

    if (isPlatformBrowser(this.platformId)) {
      this.focusListener = () => this.loadDashboard(true);
      this.visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          this.loadDashboard(true);
        }
      };
      window.addEventListener('focus', this.focusListener);
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.focusListener) {
        window.removeEventListener('focus', this.focusListener);
      }
      if (this.visibilityListener) {
        document.removeEventListener('visibilitychange', this.visibilityListener);
      }
    }
  }

  loadDashboard(isSilent = false): void {
    if (!isSilent) {
      this.loading.set(true);
    } else {
      this.refreshing.set(true);
    }
    this.errorMessage.set('');

    const user = this.authService.currentUser();
    const identifier = user?.id ?? user?.username ?? 'me';
    this.dashboardService.getDashboard(identifier).subscribe({
      next: (response) => {
        this.dashboard.set(response);
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: () => {
        if (!isSilent) {
          this.errorMessage.set('We could not load your learning overview. Please try again.');
          this.loading.set(false);
        }
        this.refreshing.set(false);
      },
    });
  }

  logQuickStudyTime(hours: number): void {
    const user = this.authService.currentUser();
    const identifier = user?.id ?? user?.username ?? 'me';

    this.refreshing.set(true);
    this.actionMessage.set(`Logging ${hours * 60}m study time...`);

    this.dashboardService.logStudyTime(identifier, { hours }).subscribe({
      next: () => {
        this.actionMessage.set(`Logged ${hours * 60}m study session!`);
        this.loadDashboard(true);
        setTimeout(() => this.actionMessage.set(null), 3000);
      },
      error: () => {
        this.actionMessage.set('Failed to log study time. Try again.');
        this.refreshing.set(false);
        setTimeout(() => this.actionMessage.set(null), 3000);
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
