import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationLogsService } from '../../../core/services/application-logs.service';

type ApplicationLog = Record<string, unknown>;

@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-application-logs',
  styleUrl: './application-logs.css',
  templateUrl: './application-logs.html'
})
export class ApplicationLogs implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly logsService = inject(ApplicationLogsService);

  readonly levels = ['ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
  readonly refreshIntervals = [1, 5, 10, 15, 30, 60];
  readonly logs = signal<ApplicationLog[]>([]);
  readonly services = signal<string[]>(['user-service']);
  readonly selectedDate = signal(this.getLocalDate());
  readonly selectedLevel = signal('ERROR');
  readonly selectedService = signal('ALL');
  readonly refreshIntervalMinutes = signal(5);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly lastUpdated = signal<Date | null>(null);
  private refreshTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (!this.auth.isAdmin()) return;
    this.loadLogs();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  loadLogs(): void {
    if (!this.auth.isAdmin() || this.loading()) return;

    this.loading.set(true);
    this.error.set('');
    this.logsService.getLogs(
      this.selectedDate(),
      this.selectedLevel(),
      this.selectedService()
    ).subscribe({
      next: response => {
        const records = this.extractLogs(response);
        this.logs.set(records);
        const discoveredServices = records
          .map(log => this.readValue(log, ['serviceName', 'service']))
          .filter((service): service is string => !!service);
        this.services.update(current =>
          [...new Set([...current, ...discoveredServices])].sort((a, b) => a.localeCompare(b))
        );
        this.lastUpdated.set(new Date());
      },
      error: error => {
        this.error.set(this.getErrorMessage(error));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }

  changeDate(value: string): void {
    if (!value) return;
    this.selectedDate.set(value);
    this.loadLogs();
  }

  changeLevel(value: string): void {
    this.selectedLevel.set(value);
    this.loadLogs();
  }

  changeService(value: string): void {
    this.selectedService.set(value);
    this.loadLogs();
  }

  changeRefreshInterval(value: string): void {
    const minutes = Number(value);
    if (!this.refreshIntervals.includes(minutes)) return;
    this.refreshIntervalMinutes.set(minutes);
    this.startAutoRefresh();
  }

  getValue(log: ApplicationLog, keys: string[]): string {
    return this.readValue(log, keys) || '-';
  }

  formatRecord(log: ApplicationLog): string {
    return JSON.stringify(log, null, 2);
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => this.loadLogs(), this.refreshIntervalMinutes() * 60_000);
  }

  private getLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractLogs(response: unknown): ApplicationLog[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is ApplicationLog =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
      );
    }
    if (typeof response !== 'object' || response === null) return [];

    const data = response as Record<string, unknown>;
    for (const key of ['logs', 'content', 'results', 'data']) {
      if (key in data) return this.extractLogs(data[key]);
    }
    if (['message', 'logLevel', 'level', 'logTime', 'timestamp'].some(key => key in data)) {
      return [data];
    }
    return [];
  }

  private readValue(log: ApplicationLog, keys: string[]): string {
    for (const key of keys) {
      const value = log[key];
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
      }
      if (value instanceof Date) return value.toISOString();
    }
    return '';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Your session is missing or expired. Sign in again with an administrator account to view application logs.';
      }
      if (error.status === 403) {
        return 'Your account is not authorized to view application logs. Sign in with an administrator account.';
      }
      if (error.status === 0) {
        return 'The logs API could not be reached. Check that the backend is running and that its CORS settings allow this app.';
      }

      const details: unknown = error.error;
      if (typeof details === 'object' && details !== null && 'message' in details &&
          typeof details.message === 'string') {
        return details.message;
      }
      return `The logs API returned an error (HTTP ${error.status}). Please try again.`;
    }
    return 'Application logs could not be loaded because of an unexpected error. Please try again.';
  }
}
