import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Activity,
  CreateActivityRequest,
  DailyBar,
  DashboardResponse,
  LogStudyTimeRequest,
  ResumeItem,
  UpdateResumeItemRequest,
} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/users/dashboard';

  getDashboard(userId?: number | string | null): Observable<DashboardResponse> {
    const targetUrl =
      userId && userId !== 'me'
        ? `${this.apiUrl}/${userId}`
        : `${this.apiUrl}/me`;

    const params = new HttpParams().set('t', Date.now().toString());
    return this.http.get<DashboardResponse>(targetUrl, { params });
  }

  getMyDashboard(): Observable<DashboardResponse> {
    const params = new HttpParams().set('t', Date.now().toString());
    return this.http.get<DashboardResponse>(`${this.apiUrl}/me`, { params });
  }

  logActivity(
    userId: number | string,
    request: CreateActivityRequest
  ): Observable<Activity> {
    return this.http.post<Activity>(
      `${this.apiUrl}/${userId}/activities`,
      request
    );
  }

  logStudyTime(
    userId: number | string,
    request: LogStudyTimeRequest
  ): Observable<DailyBar> {
    return this.http.post<DailyBar>(
      `${this.apiUrl}/${userId}/study-rhythm`,
      request
    );
  }

  updateResumeItem(
    userId: number | string,
    request: UpdateResumeItemRequest
  ): Observable<ResumeItem> {
    return this.http.post<ResumeItem>(
      `${this.apiUrl}/${userId}/resume-items`,
      request
    );
  }
}